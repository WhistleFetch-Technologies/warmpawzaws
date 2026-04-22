#Requires -Version 5.1
<#
.SYNOPSIS
  Applies db/migrations/727_customer_password_reset_auth_version.sql via RDS Data API (dev + prod).

.DESCRIPTION
  One SQL statement per execute-statement (Data API). Uses cli-input-json (Windows-safe).
  Same cluster discovery pattern as run-migration-720-rds-data-aws-cli.ps1.

.PARAMETER Environment
  dev | prod | both

.EXAMPLE
  cd warmpawzaws\scripts
  .\run-migration-727-rds-data-aws-cli.ps1 -Environment both
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
  $tmp = Join-Path $env:TEMP ('rds-data-727-' + [Guid]::NewGuid().ToString('n') + '.json')
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

# No trailing semicolons (RDS Data API --sql)
$sqlAddAuthVersionColumn = @'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'auth_version'
  ) THEN
    ALTER TABLE customers ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$
'@.Trim()

$sqlBackfillNullAuthVersion = @'
UPDATE customers SET auth_version = 0 WHERE auth_version IS NULL
'@.Trim()

$sqlCommentAuthVersion = @'
COMMENT ON COLUMN customers.auth_version IS 'Increment on customer password set/change/reset; invalidates older fallback JWTs when >0 and claim mismatches.'
'@.Trim()

$sqlCreateRateEvents = @'
CREATE TABLE IF NOT EXISTS auth_operation_rate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key TEXT NOT NULL,
  operation_scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
'@.Trim()

$sqlIdxRateEvents = @'
CREATE INDEX IF NOT EXISTS idx_auth_rate_key_scope_time
  ON auth_operation_rate_events (rate_key, operation_scope, created_at DESC)
'@.Trim()

$sqlCommentRateEvents = @'
COMMENT ON TABLE auth_operation_rate_events IS 'Append-only events for auth rate limits (e.g. customer password reset OTP sends).'
'@.Trim()

$sqlIdxOtpTokens = @'
CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone_purpose_unused
  ON otp_tokens (phone, purpose)
  WHERE is_used = false
'@.Trim()

$sqlVerifyColumn = @'
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'auth_version'
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
      @{ Name = 'DO block: add customers.auth_version if missing'; Sql = $sqlAddAuthVersionColumn },
      @{ Name = 'UPDATE customers SET auth_version = 0 WHERE NULL'; Sql = $sqlBackfillNullAuthVersion },
      @{ Name = 'COMMENT ON COLUMN customers.auth_version'; Sql = $sqlCommentAuthVersion },
      @{ Name = 'CREATE TABLE auth_operation_rate_events'; Sql = $sqlCreateRateEvents },
      @{ Name = 'CREATE INDEX idx_auth_rate_key_scope_time'; Sql = $sqlIdxRateEvents },
      @{ Name = 'COMMENT ON TABLE auth_operation_rate_events'; Sql = $sqlCommentRateEvents },
      @{ Name = 'CREATE INDEX idx_otp_tokens_phone_purpose_unused'; Sql = $sqlIdxOtpTokens }
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
  Write-Host "[$label] Verify: customers.auth_version column" -ForegroundColor Yellow
  $v = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sqlVerifyColumn
  if ($v.ExitCode -ne 0) { throw "verify failed ($label): $($v.StdErr)" }
  Write-Host $v.StdOut

  Write-Host ""
  Write-Host "OK: migration 727 applied on $label." -ForegroundColor Green
}

Write-Host ""
Write-Host "All requested environments completed." -ForegroundColor Green
