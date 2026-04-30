#Requires -Version 5.1
<#
.SYNOPSIS
  Applies db/migrations/1007_banners_geo_targeting.sql via RDS Data API (AWS CLI).

.DESCRIPTION
  Executes one SQL statement per aws rds-data execute-statement (Data API requirement).

.PARAMETER Environment
  dev | prod | both

.EXAMPLE
  .\scripts\run-migration-1007-rds-data-aws-cli.ps1 -Environment both
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
  'dev' { @($AllEnvs[0]) }
  'prod' { @($AllEnvs[1]) }
  default { $AllEnvs }
}

$Statements = @(
  'ALTER TABLE banners ADD COLUMN IF NOT EXISTS target_state TEXT NULL',
  'ALTER TABLE banners ADD COLUMN IF NOT EXISTS target_city TEXT NULL',
  'COMMENT ON COLUMN banners.target_state IS ''Target state for banner delivery. NULL means global/all states.''',
  'COMMENT ON COLUMN banners.target_city IS ''Target city for banner delivery. NULL means global/all cities.''',
  'CREATE INDEX IF NOT EXISTS idx_banners_target_state_lower ON banners (LOWER(target_state)) WHERE target_state IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS idx_banners_target_city_lower ON banners (LOWER(target_city)) WHERE target_city IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS idx_banners_target_state_city_lower ON banners (LOWER(target_state), LOWER(target_city)) WHERE target_state IS NOT NULL OR target_city IS NOT NULL'
)

$VerifyColumnsSql = @"
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'banners'
  AND column_name IN ('target_state', 'target_city')
ORDER BY column_name
"@ -replace "`r`n", ' ' -replace "`n", ' '

$VerifyIndexesSql = @"
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'banners'
  AND indexname IN (
    'idx_banners_target_state_lower',
    'idx_banners_target_city_lower',
    'idx_banners_target_state_city_lower'
  )
ORDER BY indexname
"@ -replace "`r`n", ' ' -replace "`n", ' '

foreach ($envCfg in $Envs) {
  Write-Host ""
  Write-Host "=== $($envCfg.Name) ($($envCfg.ClusterArn)) ===" -ForegroundColor Cyan

  $i = 0
  foreach ($sql in $Statements) {
    $i++
    Write-Host "Statement $i ..."
    aws rds-data execute-statement `
      --region $Region `
      --resource-arn $envCfg.ClusterArn `
      --secret-arn $envCfg.SecretArn `
      --database $Database `
      --sql $sql `
      --output json | ConvertFrom-Json | ConvertTo-Json -Compress
    if ($LASTEXITCODE -ne 0) { throw "execute-statement failed on $($envCfg.Name) step $i" }
  }

  Write-Host "Verify columns..."
  aws rds-data execute-statement `
    --region $Region `
    --resource-arn $envCfg.ClusterArn `
    --secret-arn $envCfg.SecretArn `
    --database $Database `
    --sql $VerifyColumnsSql `
    --format-records-as JSON `
    --output json | ConvertFrom-Json | ConvertTo-Json -Compress
  if ($LASTEXITCODE -ne 0) { throw "column verification failed on $($envCfg.Name)" }

  Write-Host "Verify indexes..."
  aws rds-data execute-statement `
    --region $Region `
    --resource-arn $envCfg.ClusterArn `
    --secret-arn $envCfg.SecretArn `
    --database $Database `
    --sql $VerifyIndexesSql `
    --format-records-as JSON `
    --output json | ConvertFrom-Json | ConvertTo-Json -Compress
  if ($LASTEXITCODE -ne 0) { throw "index verification failed on $($envCfg.Name)" }

  Write-Host "OK: $($envCfg.Name) migration 1007 applied." -ForegroundColor Green
}

Write-Host ""
Write-Host "All requested environments completed." -ForegroundColor Green
