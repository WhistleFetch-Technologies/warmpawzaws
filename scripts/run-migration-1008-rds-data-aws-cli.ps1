#Requires -Version 5.1
<#
.SYNOPSIS
  Applies db/migrations/1008_promotions_end_date_nullable.sql via RDS Data API (AWS CLI).

.DESCRIPTION
  Executes one SQL statement per aws rds-data execute-statement (Data API requirement).

.PARAMETER Environment
  dev | prod | both

.EXAMPLE
  .\scripts\run-migration-1008-rds-data-aws-cli.ps1 -Environment both
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
  'DO $$ BEGIN IF EXISTS ( SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''promotions'' AND column_name = ''end_date'' AND is_nullable = ''NO'' ) THEN ALTER TABLE public.promotions ALTER COLUMN end_date DROP NOT NULL; END IF; END $$;'
)

$VerifyNullableSql = @"
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'promotions'
  AND column_name = 'end_date'
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

  Write-Host "Verify promotions.end_date nullable..."
  aws rds-data execute-statement `
    --region $Region `
    --resource-arn $envCfg.ClusterArn `
    --secret-arn $envCfg.SecretArn `
    --database $Database `
    --sql $VerifyNullableSql `
    --format-records-as JSON `
    --output json | ConvertFrom-Json | ConvertTo-Json -Compress
  if ($LASTEXITCODE -ne 0) { throw "verification failed on $($envCfg.Name)" }

  Write-Host "OK: $($envCfg.Name) migration 1008 applied." -ForegroundColor Green
}

Write-Host ""
Write-Host "All requested environments completed." -ForegroundColor Green

