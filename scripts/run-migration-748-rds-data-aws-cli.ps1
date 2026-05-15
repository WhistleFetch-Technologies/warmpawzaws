#Requires -Version 5.1
<#
.SYNOPSIS
  Applies db/migrations/748_reviews_photos_jsonb.sql via RDS Data API (AWS CLI).

.DESCRIPTION
  Runs ALTER + COMMENT as separate execute-statement calls (Data API: one statement per call).
  Discovers cluster ARN and secret like run-migration-727-rds-data-aws-cli.ps1.
  Requires: AWS CLI v2, cluster HttpEndpointEnabled=true, credentials for rds-data:ExecuteStatement.

.PARAMETER Environment
  dev | prod | both

.EXAMPLE
  cd "c:\path\to\warmpawzaws"
  .\scripts\run-migration-748-rds-data-aws-cli.ps1 -Environment dev
  .\scripts\run-migration-748-rds-data-aws-cli.ps1 -Environment both
#>
param(
  [ValidateSet('dev', 'prod', 'both')]
  [string] $Environment = 'dev',
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
  $tmp = Join-Path $env:TEMP ('rds-data-748-' + [Guid]::NewGuid().ToString('n') + '.json')
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

$sqlAlter = @'
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb
'@.Trim()

$sqlComment = @'
COMMENT ON COLUMN public.reviews.photos IS 'Array of image URLs uploaded with the review (JSON array of strings)'
'@.Trim()

$sqlVerify = @'
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'photos' LIMIT 1
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

  Write-Host "DBClusterArn     : $resourceArn"
  Write-Host "DatabaseName     : $dbFromCluster"
  Write-Host "HttpEndpointEnabled (Data API): $httpEnabled"

  if (-not $httpEnabled) {
    throw "RDS Data API is disabled on $ClusterId (HttpEndpointEnabled=false). Enable the HTTP endpoint on the cluster or use node scripts/run-migration-rds-node.js from a network that can reach RDS."
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

  Write-Host ""
  Write-Host "[$label] Step 1 : ALTER TABLE reviews ADD COLUMN photos" -ForegroundColor Yellow
  $e1 = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sqlAlter
  if ($e1.ExitCode -ne 0) {
    throw "execute-statement failed ($label) ALTER: $(if ($e1.StdErr) { $e1.StdErr } else { $e1.StdOut })"
  }
  Write-Host $e1.StdOut

  Write-Host ""
  Write-Host "[$label] Step 2 : COMMENT ON COLUMN reviews.photos" -ForegroundColor Yellow
  $e2 = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sqlComment
  if ($e2.ExitCode -ne 0) {
    throw "execute-statement failed ($label) COMMENT: $(if ($e2.StdErr) { $e2.StdErr } else { $e2.StdOut })"
  }
  Write-Host $e2.StdOut

  Write-Host ""
  Write-Host "[$label] Verify: information_schema.columns for reviews.photos" -ForegroundColor Yellow
  $v = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sqlVerify
  if ($v.ExitCode -ne 0) { throw "verify failed ($label): $($v.StdErr)" }
  Write-Host $v.StdOut

  Write-Host ""
  Write-Host "OK: migration 748 applied on $label." -ForegroundColor Green
}

Write-Host ""
Write-Host "All requested environments completed." -ForegroundColor Green
