#Requires -Version 5.1
<#
.SYNOPSIS
  Applies db/migrations/755_meal_order_payment_hold_expires.sql via RDS Data API.

.PARAMETER Environment
  dev | prod | both

.EXAMPLE
  .\scripts\run-migration-755-meal-payment-hold-rds-data-aws-cli.ps1 -Environment prod
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
  $tmp = Join-Path $env:TEMP ('rds-data-755ph-' + [Guid]::NewGuid().ToString('n') + '.json')
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
ALTER TABLE meal_orders
  ADD COLUMN IF NOT EXISTS payment_hold_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_checkout_started_at TIMESTAMPTZ
'@.Trim(),
  "COMMENT ON COLUMN meal_orders.payment_hold_expires_at IS 'When an unpaid meal order stops blocking kitchen prep (default: checkout start + 5 minutes).'",
  "COMMENT ON COLUMN meal_orders.payment_checkout_started_at IS 'When the customer entered checkout for this meal order.'",
  @'
CREATE INDEX IF NOT EXISTS idx_meal_orders_payment_hold_expiry
  ON meal_orders (payment_hold_expires_at)
  WHERE LOWER(COALESCE(payment_status, '')) NOT IN ('paid', 'completed')
'@.Trim(),
  @'
UPDATE meal_orders
SET payment_checkout_started_at = COALESCE(payment_checkout_started_at, created_at),
    payment_hold_expires_at = COALESCE(payment_hold_expires_at, created_at + INTERVAL '5 minutes')
WHERE LOWER(COALESCE(payment_status, '')) NOT IN ('paid', 'completed', 'expired', 'refunded')
  AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'delivered')
  AND payment_hold_expires_at IS NULL
'@.Trim(),
  @'
UPDATE meal_orders mo
SET status = 'cancelled',
    payment_status = 'expired',
    cancelled_at = NOW(),
    cancellation_reason = 'payment_window_expired',
    updated_at = NOW()
WHERE LOWER(COALESCE(mo.payment_status, '')) NOT IN ('paid', 'completed', 'expired', 'refunded')
  AND LOWER(COALESCE(mo.status, '')) NOT IN ('cancelled', 'delivered')
  AND mo.payment_hold_expires_at IS NOT NULL
  AND mo.payment_hold_expires_at <= NOW()
'@.Trim()
)

$sqlVerify = @'
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'meal_orders'
  AND column_name IN ('payment_hold_expires_at', 'payment_checkout_started_at')
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
    Write-Host "[$label] Step $step/$($statements.Count)" -ForegroundColor Yellow
    $e = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sql
    if ($e.ExitCode -ne 0) {
      throw "execute-statement failed ($label) step $step : $(if ($e.StdErr) { $e.StdErr } else { $e.StdOut })"
    }
  }

  Write-Host "[$label] Verify meal_orders payment hold columns" -ForegroundColor Yellow
  $v = Invoke-RdsDataExecuteStatementFromJson -ResourceArn $resourceArn -SecretArn $secretArn -DbName $dbName -Sql $sqlVerify
  if ($v.ExitCode -ne 0) { throw "verify failed ($label): $($v.StdErr)" }
  Write-Host $v.StdOut
  Write-Host "OK: migration 755 meal payment hold applied on $label." -ForegroundColor Green
}

Write-Host ""
Write-Host "All requested environments completed." -ForegroundColor Green
