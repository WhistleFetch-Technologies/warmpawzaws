#Requires -Version 5.1
<#
.SYNOPSIS
  Applies db/migrations/730_banners_expand_type_check.sql via RDS Data API (AWS CLI).

.DESCRIPTION
  One SQL statement per aws rds-data execute-statement (Data API requirement).
  Same cluster/secret ARNs as run-migration-724-rds-data-aws-cli.ps1.

.PARAMETER Environment
  dev | prod | both

.EXAMPLE
  cd c:\Users\Pranay\OneDrive\Desktop\warmpawzaws\warmpawzaws
  .\scripts\run-migration-730-rds-data-aws-cli.ps1 -Environment both
#>
param(
  [ValidateSet('dev', 'prod', 'both')]
  [string] $Environment = 'both'
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

# No trailing semicolons (RDS Data API)
$Statements = @(
  'ALTER TABLE banners DROP CONSTRAINT IF EXISTS banners_type_check',

  @'
ALTER TABLE banners ADD CONSTRAINT banners_type_check CHECK (
  type IN (
    'main',
    'spotlight',
    'category',
    'service',
    'home_top',
    'home_middle',
    'checkout'
  )
)
'@.Trim(),

  'COMMENT ON CONSTRAINT banners_type_check ON banners IS ''Placement / banner slot: legacy main|spotlight|category|service plus home_top|home_middle|checkout.'''
)

$VerifySql = @"
SELECT pg_get_constraintdef(c.oid, true) AS def
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'banners'
  AND c.conname = 'banners_type_check'
"@ -replace "`r`n", ' ' -replace "`n", ' '

foreach ($env in $Envs) {
  Write-Host ""
  Write-Host "=== $($env.Name) ($($env.ClusterArn)) ===" -ForegroundColor Cyan
  $i = 0
  foreach ($sql in $Statements) {
    $i++
    Write-Host "Statement $i ..."
    aws rds-data execute-statement `
      --region $Region `
      --resource-arn $env.ClusterArn `
      --secret-arn $env.SecretArn `
      --database $Database `
      --sql $sql `
      --output json | ConvertFrom-Json | ConvertTo-Json -Compress
    if ($LASTEXITCODE -ne 0) { throw "execute-statement failed on $($env.Name) step $i" }
  }
  Write-Host "Verify constraint..."
  aws rds-data execute-statement `
    --region $Region `
    --resource-arn $env.ClusterArn `
    --secret-arn $env.SecretArn `
    --database $Database `
    --sql $VerifySql `
    --format-records-as JSON `
    --output json | ConvertFrom-Json | ConvertTo-Json -Compress
  if ($LASTEXITCODE -ne 0) { throw "verify failed on $($env.Name)" }
  Write-Host "OK: $($env.Name) migration 730 applied." -ForegroundColor Green
}

Write-Host ""
Write-Host "All requested environments completed." -ForegroundColor Green
