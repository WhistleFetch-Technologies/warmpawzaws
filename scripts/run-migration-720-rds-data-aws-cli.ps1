#Requires -Version 5.1
<#
.SYNOPSIS
  Applies migration 720 (support_agents staff_id FK fix) via RDS Data API for dev and/or prod.

.DESCRIPTION
  1) aws rds describe-db-clusters — prints Data API readiness, DB name, ARNs
  2) aws rds-data execute-statement — one statement per call (cli-input-json, Windows-safe)

.PARAMETER Environment
  dev | prod | both

.EXAMPLE
  cd warmpawzApp\warmpawzaws\scripts
  .\run-migration-720-rds-data-aws-cli.ps1 -Environment both
#>
param(
  [ValidateSet('dev', 'prod', 'both')]
  [string] $Environment = 'both',
  [string] $Database = ''
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_aws-cli-helpers.ps1"

$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) {
  throw 'AWS CLI v2 not found. Install AWS CLI v2 and ensure aws is on PATH.'
}

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { 'ap-south-1' }

$targets = @()
if ($Environment -eq 'both') {
  $targets += @{ Id = 'warmpawz-dev-cluster';  Label = 'dev'  }
  $targets += @{ Id = 'warmpawz-prod-cluster'; Label = 'prod' }
} else {
  $cid = if ($Environment -eq 'prod') { 'warmpawz-prod-cluster' } else { 'warmpawz-dev-cluster' }
  $targets += @{ Id = $cid; Label = $Environment }
}

function Invoke-RdsDataExecuteStatementFromJson {
  param(
    [string]$ResourceArn,
    [string]$SecretArn,
    [string]$DbName,
    [string]$Sql
  )
  $tmp = Join-Path $env:TEMP ('rds-data-720-' + [Guid]::NewGuid().ToString('n') + '.json')
  $payload = @{
    resourceArn = $ResourceArn
    secretArn   = $SecretArn
    database    = $DbName
    sql         = $Sql
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($tmp, ($payload | ConvertTo-Json -Compress), $utf8NoBom)
  $fileUri = 'file://' + $tmp
  try {
    return (Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
        'rds-data', 'execute-statement',
        '--cli-input-json', $fileUri,
        '--region', $Region,
        '--output', 'json'
      ))
  } finally {
    Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
  }
}

# Same logical steps as db/migrations/720_support_agents_staff_id_fkey_fix.sql (no trailing semicolons for Data API)
$sqlDropFk = @'
ALTER TABLE public.support_agents DROP CONSTRAINT IF EXISTS support_agents_staff_id_fkey
'@.Trim()

$sqlCleanStaffId = @'
UPDATE public.support_agents sa
SET staff_id = NULL, updated_at = COALESCE(sa.updated_at, NOW())
WHERE sa.staff_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.staff st WHERE st.id = sa.staff_id)
'@.Trim()

$sqlComment = @'
COMMENT ON COLUMN public.support_agents.staff_id IS 'References staff(id) when the agent is a staff member and user_id is NULL; NULL when the agent is an admin (user_id = admins.id).'
'@.Trim()

$sqlVerifyFkGone = @'
SELECT c.conname AS constraint_name
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'support_agents'
  AND c.contype = 'f'
  AND c.conname = 'support_agents_staff_id_fkey'
'@.Trim()

$sqlVerifyOrphans = @'
SELECT COUNT(*)::bigint AS orphan_staff_id_rows
FROM public.support_agents sa
WHERE sa.staff_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.staff st WHERE st.id = sa.staff_id)
'@.Trim()

foreach ($t in $targets) {
  $ClusterId = $t.Id
  $label = $t.Label
  Write-Host ""
  Write-Host "========== $label : $ClusterId ==========" -ForegroundColor Cyan

  $d = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'rds', 'describe-db-clusters',
    '--db-cluster-identifier', $ClusterId,
    '--region', $Region,
    '--output', 'json'
  )
  if ($d.ExitCode -ne 0) {
    throw "describe-db-clusters ($label): $(if ($d.StdErr) { $d.StdErr } else { $d.StdOut })"
  }
  $clusterJson = $d.StdOut | ConvertFrom-Json
  if (-not $clusterJson.DBClusters -or $clusterJson.DBClusters.Count -eq 0) { throw "Cluster not found: $ClusterId" }
  $cluster = $clusterJson.DBClusters[0]

  $resourceArn = $cluster.DBClusterArn
  $httpEnabled = [bool]$cluster.HttpEndpointEnabled
  $dbFromCluster = $cluster.DatabaseName
  $engine = $cluster.Engine
  $engineVer = $cluster.EngineVersion
  $endpoint = $cluster.Endpoint

  Write-Host "Engine           : $engine $engineVer"
  Write-Host "Endpoint         : $endpoint"
  Write-Host "DBClusterArn     : $resourceArn"
  Write-Host "DatabaseName     : $dbFromCluster"
  Write-Host "HttpEndpointEnabled (Data API): $httpEnabled"

  if (-not $httpEnabled) {
    throw "RDS Data API is disabled on $ClusterId (HttpEndpointEnabled=false). Enable the HTTP endpoint on the cluster or use psql."
  }

  $secretArn = $null
  if ($cluster.MasterUserSecret -and $cluster.MasterUserSecret.SecretArn) {
    $secretArn = $cluster.MasterUserSecret.SecretArn
    Write-Host "MasterUserSecret : $secretArn"
  }
  if (-not $secretArn) {
    $secretName = if ($label -eq 'prod') {
      'warmpawz-prod-rds-master-20260207201049162400000001'
    } else {
      'warmpawz-dev-rds-master-20260106164510791100000002'
    }
    Write-Host "MasterUserSecret missing on cluster; resolving secret by name: $secretName" -ForegroundColor Yellow
    $s = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
      'secretsmanager', 'describe-secret',
      '--secret-id', $secretName,
      '--region', $Region,
      '--output', 'json'
    )
    if ($s.ExitCode -ne 0) { throw "describe-secret failed: $($s.StdErr)" }
    $secretArn = ($s.StdOut | ConvertFrom-Json).ARN
    Write-Host "Secret ARN       : $secretArn"
  }

  $dbName = if ($Database) { $Database } else { $dbFromCluster }
  if (-not $dbName) { $dbName = 'warmpawz' }
  Write-Host "Using database   : $dbName" -ForegroundColor Green

  $step = 0
  foreach ($pair in @(
      @{ Name = 'DROP CONSTRAINT IF EXISTS support_agents_staff_id_fkey'; Sql = $sqlDropFk },
      @{ Name = 'UPDATE invalid staff_id to NULL'; Sql = $sqlCleanStaffId },
      @{ Name = 'COMMENT ON COLUMN support_agents.staff_id'; Sql = $sqlComment }
    )) {
    $step++
    Write-Host ""
    Write-Host "[$label] Step $step : $($pair.Name)" -ForegroundColor Yellow
    $e = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $pair.Sql
    if ($e.ExitCode -ne 0) {
      throw "execute-statement failed ($label) step ${step}: $(if ($e.StdErr) { $e.StdErr } else { $e.StdOut })"
    }
    Write-Host ($e.StdOut)
  }

  Write-Host ""
  Write-Host "[$label] Verify: FK constraint name (expect empty records)" -ForegroundColor Yellow
  $v1 = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sqlVerifyFkGone
  if ($v1.ExitCode -ne 0) { throw "verify FK query failed: $($v1.StdErr)" }
  Write-Host $v1.StdOut

  Write-Host "[$label] Verify: orphan staff_id count (expect 0)" -ForegroundColor Yellow
  $v2 = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sqlVerifyOrphans
  if ($v2.ExitCode -ne 0) { throw "verify orphan query failed: $($v2.StdErr)" }
  Write-Host $v2.StdOut

  Write-Host ""
  Write-Host "OK: migration 720 applied on $label." -ForegroundColor Green
}

Write-Host ""
Write-Host "All requested environments completed." -ForegroundColor Green
