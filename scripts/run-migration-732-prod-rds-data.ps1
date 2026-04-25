#Requires -Version 5.1
<#
.SYNOPSIS
  Apply db/migrations/732_vendor_daily_accrual.sql via RDS Data API (dev or prod).

.PARAMETER Environment
  dev | prod (default: prod)

.EXAMPLE
  .\run-migration-732-prod-rds-data.ps1 -Environment dev
#>
param(
  [ValidateSet('dev', 'prod')]
  [string] $Environment = 'prod'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_aws-cli-helpers.ps1"
$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) { throw 'AWS CLI not found' }
$Region = 'ap-south-1'

$ClusterId = if ($Environment -eq 'prod') { 'warmpawz-prod-cluster' } else { 'warmpawz-dev-cluster' }
Write-Host "Cluster: $ClusterId" -ForegroundColor Cyan

$d = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'rds', 'describe-db-clusters',
  '--db-cluster-identifier', $ClusterId,
  '--region', $Region,
  '--output', 'json'
)
if ($d.ExitCode -ne 0) { throw "describe-db-clusters: $($d.StdErr)" }
$cluster = ($d.StdOut | ConvertFrom-Json).DBClusters[0]
$ResourceArn = $cluster.DBClusterArn
if (-not [bool]$cluster.HttpEndpointEnabled) {
  throw "RDS Data API disabled on $ClusterId (HttpEndpointEnabled=false)"
}

$SecretArn = $null
if ($cluster.MasterUserSecret -and $cluster.MasterUserSecret.SecretArn) {
  $SecretArn = $cluster.MasterUserSecret.SecretArn
}
if (-not $SecretArn) {
  $secretName = if ($Environment -eq 'prod') {
    'warmpawz-prod-rds-master-20260207201049162400000001'
  } else {
    'warmpawz-dev-rds-master-20260106164510791100000002'
  }
  Write-Host "Resolving secret by name: $secretName" -ForegroundColor Yellow
  $s = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'secretsmanager', 'describe-secret',
    '--secret-id', $secretName,
    '--region', $Region,
    '--output', 'json'
  )
  if ($s.ExitCode -ne 0) { throw "describe-secret: $($s.StdErr)" }
  $SecretArn = ($s.StdOut | ConvertFrom-Json).ARN
}

$DbName = if ($cluster.DatabaseName) { $cluster.DatabaseName } else { 'warmpawz' }
Write-Host "ResourceArn: $ResourceArn"
Write-Host "SecretArn:   $SecretArn"
Write-Host "Database:    $DbName"

function Invoke-Sql([string]$Label, [string]$Sql) {
  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  $tmp = Join-Path $env:TEMP ('rds-data-732-' + [Guid]::NewGuid().ToString('n') + '.json')
  $payload = @{ resourceArn = $ResourceArn; secretArn = $SecretArn; database = $DbName; sql = $Sql.Trim() }
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($tmp, ($payload | ConvertTo-Json -Compress), $utf8NoBom)
  $fileUri = 'file://' + ($tmp -replace '\\', '/')
  try {
    $e = Invoke-AwsCli -AwsExe $AwsExe -Arguments @('rds-data', 'execute-statement', '--cli-input-json', $fileUri, '--region', $Region, '--output', 'json')
    if ($e.ExitCode -ne 0) { throw "execute-statement failed: $($e.StdErr)`n$($e.StdOut)" }
    Write-Host $e.StdOut
  } finally {
    Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
  }
}

$createTable = @'
CREATE TABLE IF NOT EXISTS vendor_daily_accrual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  gross_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  earnings_line_count INTEGER NOT NULL DEFAULT 0,
  missing_earnings_booking_count INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_date, vendor_id)
)
'@

Invoke-Sql 'CREATE TABLE vendor_daily_accrual' $createTable

Invoke-Sql 'CREATE INDEX report_date' @'
CREATE INDEX IF NOT EXISTS idx_vendor_daily_accrual_report_date ON vendor_daily_accrual (report_date DESC)
'@

Invoke-Sql 'CREATE INDEX vendor_id' @'
CREATE INDEX IF NOT EXISTS idx_vendor_daily_accrual_vendor_id ON vendor_daily_accrual (vendor_id)
'@

Invoke-Sql 'COMMENT ON TABLE' @'
COMMENT ON TABLE vendor_daily_accrual IS 'Per-vendor accrual for calendar day in Asia/Kolkata; sums vendor_earnings by realized_at in [day 00:00, next day 00:00) IST.'
'@

Invoke-Sql 'COMMENT ON COLUMN' @'
COMMENT ON COLUMN vendor_daily_accrual.missing_earnings_booking_count IS 'Completed bookings that day (IST via completed_at) with no vendor_earnings row.'
'@

Write-Host "`nVerify table exists:" -ForegroundColor Green
Invoke-Sql 'verify' @'
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_daily_accrual'
'@

Write-Host "`nDone: migration 732 on $Environment." -ForegroundColor Green
