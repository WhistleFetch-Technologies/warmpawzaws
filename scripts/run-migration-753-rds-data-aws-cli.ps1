#Requires -Version 5.1
<#
.SYNOPSIS
  Applies db/migrations/753_tele_completion_attendance.sql via RDS Data API (AWS CLI).

.PARAMETER Environment
  dev | prod | both

.EXAMPLE
  .\scripts\run-migration-753-rds-data-aws-cli.ps1 -Environment dev
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
  $tmp = Join-Path $env:TEMP ('rds-data-753-' + [Guid]::NewGuid().ToString('n') + '.json')
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
  ADD COLUMN IF NOT EXISTS customer_joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_left_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_left_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overlap_duration_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_qualified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completion_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS consultation_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consultation_completed_at TIMESTAMPTZ
'@.Trim(),
  "COMMENT ON COLUMN video_call_sessions.customer_joined_at IS 'First time customer entered the Chime call (API join, not token creation)'",
  "COMMENT ON COLUMN video_call_sessions.vendor_joined_at IS 'First time vendor entered the Chime call'",
  "COMMENT ON COLUMN video_call_sessions.overlap_duration_seconds IS 'Seconds both customer and vendor were present simultaneously'",
  "COMMENT ON COLUMN video_call_sessions.completion_qualified IS 'True when overlap meets minimum consultation threshold'",
  "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tele_completion_status VARCHAR(50)",
  "COMMENT ON COLUMN bookings.tele_completion_status IS 'Tele outcome: waiting_for_vendor, vendor_no_show, customer_no_show, incomplete_call, qualified, disputed'",
  @'
CREATE INDEX IF NOT EXISTS idx_video_call_sessions_booking_attendance
  ON video_call_sessions (booking_id)
  WHERE customer_joined_at IS NOT NULL OR vendor_joined_at IS NOT NULL
'@.Trim(),
  @'
CREATE INDEX IF NOT EXISTS idx_bookings_tele_completion_status
  ON bookings (tele_completion_status)
  WHERE tele_completion_status IS NOT NULL
'@.Trim()
)

$sqlVerify = @'
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'tele_completion_status'
LIMIT 1
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

  Write-Host "[$label] Verify tele_completion_status column" -ForegroundColor Yellow
  $v = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sqlVerify
  if ($v.ExitCode -ne 0) { throw "verify failed ($label): $($v.StdErr)" }
  Write-Host $v.StdOut
  Write-Host "OK: migration 753 applied on $label." -ForegroundColor Green
}

Write-Host ""
Write-Host "All requested environments completed." -ForegroundColor Green
