#Requires -Version 5.1
<#
.SYNOPSIS
  Apply migrations 727 + 728 via RDS Data API (aws rds-data execute-statement).
.PARAMETER Environment
  dev | prod
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('dev', 'prod')]
  [string] $Environment
)

$ErrorActionPreference = 'Stop'
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { 'ap-south-1' }
$ClusterId = "warmpawz-$Environment-cluster"
$Database = if ($env:DB_NAME) { $env:DB_NAME } else { 'warmpawz' }

Write-Host "Region=$Region Cluster=$ClusterId Database=$Database"

$clusterArn = aws rds describe-db-clusters --db-cluster-identifier $ClusterId --region $Region `
  --query 'DBClusters[0].DBClusterArn' --output text
$secretArn = aws rds describe-db-clusters --db-cluster-identifier $ClusterId --region $Region `
  --query 'DBClusters[0].MasterUserSecret.SecretArn' --output text

if ([string]::IsNullOrWhiteSpace($secretArn) -or $secretArn -eq 'None') {
  $secretName = if ($Environment -eq 'prod') {
    'warmpawz-prod-rds-master-20260207201049162400000001'
  } else {
    'warmpawz-dev-rds-master-20260106164510791100000002'
  }
  $secretArn = aws secretsmanager describe-secret --secret-id $secretName --region $Region `
    --query 'ARN' --output text
}

function Invoke-RdsSql {
  param([string] $Sql)
  $preview = ($Sql -replace '\s+', ' ').Substring(0, [Math]::Min(90, ($Sql -replace '\s+', ' ').Length))
  Write-Host "--- execute-statement: $preview..."
  aws rds-data execute-statement `
    --resource-arn $clusterArn `
    --secret-arn $secretArn `
    --database $Database `
    --region $Region `
    --sql $Sql
}

# --- 727 (split for Data API) ---
$sql727a = @'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'auth_version'
  ) THEN
    ALTER TABLE customers ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;
'@

Invoke-RdsSql -Sql $sql727a
Invoke-RdsSql -Sql "UPDATE customers SET auth_version = 0 WHERE auth_version IS NULL"
Invoke-RdsSql -Sql "COMMENT ON COLUMN customers.auth_version IS 'Increment on customer password set/change/reset; invalidates older fallback JWTs when >0 and claim mismatches.'"

$sql727table = @'
CREATE TABLE IF NOT EXISTS auth_operation_rate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key TEXT NOT NULL,
  operation_scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
'@
Invoke-RdsSql -Sql $sql727table
Invoke-RdsSql -Sql "CREATE INDEX IF NOT EXISTS idx_auth_rate_key_scope_time ON auth_operation_rate_events (rate_key, operation_scope, created_at DESC)"
Invoke-RdsSql -Sql "COMMENT ON TABLE auth_operation_rate_events IS 'Append-only events for auth rate limits (e.g. customer password reset OTP sends).'"
Invoke-RdsSql -Sql "CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone_purpose_unused ON otp_tokens (phone, purpose) WHERE is_used = false"

# --- 728 ---
$sql728 = @'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.vendors ADD COLUMN password_hash TEXT;
    COMMENT ON COLUMN public.vendors.password_hash IS 'bcrypt ($2*) or legacy PBKDF2 salt:hex — mirrors customers.password_hash';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'auth_version'
  ) THEN
    ALTER TABLE public.vendors ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
    UPDATE public.vendors SET auth_version = 0 WHERE auth_version IS NULL;
    COMMENT ON COLUMN public.vendors.auth_version IS 'Bump on vendor password set/change; reserved for JWT invalidation parity with customers.';
  END IF;
END $$;
'@
Invoke-RdsSql -Sql $sql728

Write-Host 'Verify:'
aws rds-data execute-statement `
  --resource-arn $clusterArn `
  --secret-arn $secretArn `
  --database $Database `
  --region $Region `
  --sql "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name IN ('auth_version','password_hash') ORDER BY column_name"
aws rds-data execute-statement `
  --resource-arn $clusterArn `
  --secret-arn $secretArn `
  --database $Database `
  --region $Region `
  --sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_operation_rate_events'"

Write-Host "OK: migrations 727 + 728 on $Environment"
