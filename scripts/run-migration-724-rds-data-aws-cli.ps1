#Requires -Version 5.1
<#
.SYNOPSIS
  Applies db/migrations/724_ai_booking_wizard_sessions.sql via RDS Data API (dev + prod).

.DESCRIPTION
  One SQL statement per aws rds-data execute-statement (Data API requirement).
  Same cluster/secret pattern as db/migrations/run-718-rds-data.ps1.

.PARAMETER Environment
  dev | prod | both

.EXAMPLE
  cd warmpawzApp\warmpawzaws\scripts
  .\run-migration-724-rds-data-aws-cli.ps1 -Environment both
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
  @'
CREATE TABLE IF NOT EXISTS public.ai_booking_wizard_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INTEGER NOT NULL DEFAULT 1,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_phone TEXT,
    category TEXT NOT NULL DEFAULT 'vet',
    vendor_id UUID,
    vendor_service_id UUID,
    service_style TEXT,
    booking_date TEXT,
    slot_time TEXT,
    total_duration INTEGER NOT NULL DEFAULT 30,
    staff_id TEXT,
    pet_id UUID,
    address_id UUID,
    slots_snapshot TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'ready_for_booking', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
'@.Trim(),

  'CREATE INDEX IF NOT EXISTS idx_ai_booking_wizard_sessions_customer ON public.ai_booking_wizard_sessions (customer_id)',

  'CREATE INDEX IF NOT EXISTS idx_ai_booking_wizard_sessions_phone ON public.ai_booking_wizard_sessions (customer_phone)',

  'CREATE INDEX IF NOT EXISTS idx_ai_booking_wizard_sessions_expires ON public.ai_booking_wizard_sessions (expires_at)',

  'COMMENT ON TABLE public.ai_booking_wizard_sessions IS ''Server-backed booking draft for in-chat wizard; slots_snapshot is JSON from available-slots for commit validation when self-HTTP is unavailable'''
)

$VerifySql = "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_booking_wizard_sessions'"

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
  Write-Host "Verify table exists..."
  aws rds-data execute-statement `
    --region $Region `
    --resource-arn $env.ClusterArn `
    --secret-arn $env.SecretArn `
    --database $Database `
    --sql $VerifySql `
    --output json | ConvertFrom-Json | ConvertTo-Json -Compress
  if ($LASTEXITCODE -ne 0) { throw "verify failed on $($env.Name)" }
  Write-Host "OK: $($env.Name) migration 724 applied." -ForegroundColor Green
}

Write-Host ""
Write-Host "All requested environments completed." -ForegroundColor Green
