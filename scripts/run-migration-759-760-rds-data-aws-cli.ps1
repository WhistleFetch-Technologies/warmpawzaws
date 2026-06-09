#Requires -Version 5.1
<#
.SYNOPSIS
  Applies migrations 759 (sitter specs) and 760 (close stale tele sessions) via RDS Data API.

.EXAMPLE
  .\scripts\run-migration-759-760-rds-data-aws-cli.ps1 -Environment prod
#>
param(
  [ValidateSet('dev', 'prod', 'both')]
  [string] $Environment = 'prod',
  [string] $Database = ''
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_aws-cli-helpers.ps1"

$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) {
  throw 'AWS CLI v2 not found.'
}

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { 'ap-south-1' }
$repoRoot = Split-Path $PSScriptRoot -Parent

$targets = @()
if ($Environment -eq 'both') {
  $targets += @{ Id = 'warmpawz-dev-cluster'; Label = 'dev' }
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
  $tmp = Join-Path $env:TEMP ('rds-data-759760-' + [Guid]::NewGuid().ToString('n') + '.json')
  $payload = @{
    resourceArn = $ResourceArn
    secretArn   = $SecretArn
    database    = $DbName
    sql         = $Sql
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($tmp, ($payload | ConvertTo-Json -Compress), $utf8NoBom)
  $fileUri = 'file://' + ($tmp -replace '\\', '/')
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

$m759 = Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'db\migrations\759_seed_pet_sitter_specialization_master.sql')
$m760 = Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'db\migrations\760_close_video_sessions_for_completed_bookings.sql')
$sqlVerifySitter = @"
SELECT specialization_id, display_name
FROM specialization_master
WHERE specialization_id IN ('drop_in','day_visits','overnight_sitting','day_sitting','extended_home')
ORDER BY display_order
"@.Trim()

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
  $cluster = ($d.StdOut | ConvertFrom-Json).DBClusters[0]
  $resourceArn = $cluster.DBClusterArn
  if (-not $cluster.HttpEndpointEnabled) {
    throw "RDS Data API disabled on $ClusterId"
  }

  $secretArn = $cluster.MasterUserSecret.SecretArn
  if (-not $secretArn) {
    $secretName = if ($label -eq 'prod') {
      'warmpawz-prod-rds-master-20260207201049162400000001'
    } else {
      'warmpawz-dev-rds-master-20260106164510791100000002'
    }
    $s = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
      'secretsmanager', 'describe-secret', '--secret-id', $secretName, '--region', $Region, '--output', 'json'
    )
    $secretArn = ($s.StdOut | ConvertFrom-Json).ARN
  }

  $dbName = if ($Database) { $Database } else { $cluster.DatabaseName }
  if (-not $dbName) { $dbName = 'warmpawz' }

  Write-Host "[$label] Migration 759 sitter specs" -ForegroundColor Yellow
  $e759 = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $m759.Trim()
  if ($e759.ExitCode -ne 0) {
    throw "759 failed ($label): $(if ($e759.StdErr) { $e759.StdErr } else { $e759.StdOut })"
  }

  Write-Host "[$label] Migration 760 close stale tele sessions" -ForegroundColor Yellow
  $e760 = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $m760.Trim()
  if ($e760.ExitCode -ne 0) {
    throw "760 failed ($label): $(if ($e760.StdErr) { $e760.StdErr } else { $e760.StdOut })"
  }

  Write-Host "[$label] Verify sitter specs" -ForegroundColor Yellow
  $v = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sqlVerifySitter
  if ($v.ExitCode -ne 0) { throw "verify failed ($label): $($v.StdErr)" }
  Write-Host $v.StdOut
  Write-Host "OK: migrations 759+760 applied on $label." -ForegroundColor Green
}
