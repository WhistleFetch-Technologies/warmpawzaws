#Requires -Version 5.1
<#
.SYNOPSIS
  Applies db/migrations/755_tele_call_timer_pause.sql via RDS Data API (AWS CLI).

.PARAMETER Environment
  dev | prod | both

.EXAMPLE
  .\scripts\run-migration-755-rds-data-aws-cli.ps1 -Environment dev
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
  $tmp = Join-Path $env:TEMP ('rds-data-755-' + [Guid]::NewGuid().ToString('n') + '.json')
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

$statements = @(
  @'
ALTER TABLE video_call_sessions
  ADD COLUMN IF NOT EXISTS call_timer_remaining_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS call_timer_running_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overlap_segment_started_at TIMESTAMPTZ
'@.Trim(),
  "COMMENT ON COLUMN video_call_sessions.call_timer_remaining_seconds IS 'Frozen slot seconds left when timer paused (participant left or refresh)'",
  "COMMENT ON COLUMN video_call_sessions.call_timer_running_since IS 'When both parties are present and the slot countdown is actively ticking'",
  "COMMENT ON COLUMN video_call_sessions.overlap_segment_started_at IS 'Start of current simultaneous-presence segment for overlap accumulation'"
)

$sqlVerify = @'
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'video_call_sessions'
  AND column_name IN ('call_timer_remaining_seconds', 'call_timer_running_since', 'overlap_segment_started_at')
ORDER BY column_name
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

  $step = 0
  foreach ($sql in $statements) {
    $step++
    Write-Host "[$label] Step $step" -ForegroundColor Yellow
    $e = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sql
    if ($e.ExitCode -ne 0) {
      throw "execute-statement failed ($label) step $step : $(if ($e.StdErr) { $e.StdErr } else { $e.StdOut })"
    }
  }

  Write-Host "[$label] Verify video_call_sessions timer columns" -ForegroundColor Yellow
  $v = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sqlVerify
  if ($v.ExitCode -ne 0) { throw "verify failed ($label): $($v.StdErr)" }
  Write-Host $v.StdOut
  Write-Host "OK: migration 755 applied on $label." -ForegroundColor Green
}

Write-Host ""
Write-Host "All requested environments completed." -ForegroundColor Green
