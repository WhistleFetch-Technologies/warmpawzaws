#Requires -Version 5.1
<#
.SYNOPSIS
  Applies migration 745 (complete stale active bookings) via RDS Data API (AWS CLI).

.DESCRIPTION
  One SQL statement per aws rds-data execute-statement.
  Same cluster/secret ARNs as run-migration-730-rds-data-aws-cli.ps1.

  Order: optional diagnostics -> UPDATE -> post-verify SELECT.
  Run dev first; confirm verify query, then prod.

.PARAMETER Environment
  dev | prod | both

.EXAMPLE
  cd "c:\path\to\warmpawzaws"
  .\scripts\run-migration-745-rds-data-aws-cli.ps1 -Environment dev
#>
param(
  [ValidateSet('dev', 'prod', 'both')]
  [string] $Environment = 'dev'
)

$ErrorActionPreference = 'Stop'

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { 'ap-south-1' }
$Database = 'warmpawz'

$AllEnvs = @(
  @{
    Name       = 'dev'
    ClusterArn = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-dev-cluster'
    SecretArn  = 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI'
  },
  @{
    Name       = 'prod'
    ClusterArn = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster'
    SecretArn  = 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE'
  }
)

$Envs = switch ($Environment) {
  'dev'  { @($AllEnvs[0]) }
  'prod' { @($AllEnvs[1]) }
  default { $AllEnvs }
}

$DiagnosticsStatusBreakdown = @'
SELECT status, COUNT(*) AS n FROM bookings WHERE pet_id IS NOT NULL AND status IN ('confirmed','in_progress','scheduled') GROUP BY status ORDER BY status
'@ -replace "`r`n", ' ' -replace "`n", ' '

$DiagnosticsBucket = @'
SELECT CASE WHEN booking_date >= CURRENT_DATE THEN 'future_or_today' WHEN booking_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'past_0_30d' ELSE 'past_older' END AS bucket, COUNT(*) AS n FROM bookings WHERE pet_id IS NOT NULL AND status IN ('confirmed','in_progress','scheduled') GROUP BY 1 ORDER BY 1
'@ -replace "`r`n", ' ' -replace "`n", ' '

$UpdateSql = @'
UPDATE bookings SET status = 'completed', updated_at = NOW() WHERE pet_id IS NOT NULL AND status IN ('confirmed','in_progress','scheduled') AND booking_date < CURRENT_DATE
'@ -replace "`r`n", ' ' -replace "`n", ' '

$VerifySql = @'
SELECT COUNT(*) AS past_active_remaining FROM bookings WHERE pet_id IS NOT NULL AND status IN ('confirmed','in_progress','scheduled') AND booking_date < CURRENT_DATE
'@ -replace "`r`n", ' ' -replace "`n", ' '

foreach ($env in $Envs) {
  Write-Host ""
  Write-Host "=== $($env.Name) ($($env.ClusterArn)) ===" -ForegroundColor Cyan

  Write-Host "Diag 1: status breakdown..."
  aws rds-data execute-statement `
    --region $Region `
    --resource-arn $env.ClusterArn `
    --secret-arn $env.SecretArn `
    --database $Database `
    --sql $DiagnosticsStatusBreakdown `
    --format-records-as JSON `
    --output json | ConvertFrom-Json | ConvertTo-Json -Compress
  if ($LASTEXITCODE -ne 0) { throw "diag 1 failed on $($env.Name)" }

  Write-Host "Diag 2: date bucket..."
  aws rds-data execute-statement `
    --region $Region `
    --resource-arn $env.ClusterArn `
    --secret-arn $env.SecretArn `
    --database $Database `
    --sql $DiagnosticsBucket `
    --format-records-as JSON `
    --output json | ConvertFrom-Json | ConvertTo-Json -Compress
  if ($LASTEXITCODE -ne 0) { throw "diag 2 failed on $($env.Name)" }

  Write-Host "UPDATE (migration 745)..."
  aws rds-data execute-statement `
    --region $Region `
    --resource-arn $env.ClusterArn `
    --secret-arn $env.SecretArn `
    --database $Database `
    --sql $UpdateSql `
    --output json | ConvertFrom-Json | ConvertTo-Json -Compress
  if ($LASTEXITCODE -ne 0) { throw "UPDATE failed on $($env.Name)" }

  Write-Host "Verify: past-dated active rows remaining (expect 0)..."
  aws rds-data execute-statement `
    --region $Region `
    --resource-arn $env.ClusterArn `
    --secret-arn $env.SecretArn `
    --database $Database `
    --sql $VerifySql `
    --format-records-as JSON `
    --output json | ConvertFrom-Json | ConvertTo-Json -Compress
  if ($LASTEXITCODE -ne 0) { throw "verify failed on $($env.Name)" }

  Write-Host "OK: $($env.Name) migration 745 applied." -ForegroundColor Green
}

Write-Host ""
Write-Host "All requested environments completed." -ForegroundColor Green
