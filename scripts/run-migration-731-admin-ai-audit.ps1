#Requires -Version 5.1
<#
.SYNOPSIS
  Apply db/migrations/731_admin_ai_audit.sql via AWS RDS Data API (dev or prod).

.DESCRIPTION
  Same logic as run-migration-731-admin-ai-audit-cloudshell.sh. Requires AWS CLI v2 and
  credentials with rds-data:ExecuteStatement, rds:DescribeDBClusters, secretsmanager:DescribeSecret.

.PARAMETER Environment
  dev | prod

.EXAMPLE
  pwsh -File scripts/run-migration-731-admin-ai-audit.ps1 -Environment dev
  pwsh -File scripts/run-migration-731-admin-ai-audit.ps1 -Environment prod
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('dev', 'prod')]
  [string] $Environment
)

$ErrorActionPreference = 'Stop'
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { 'ap-south-1' }
$ClusterId = "warmpawz-$Environment-cluster"
$DbName = if ($env:DB_NAME) { $env:DB_NAME } else { 'warmpawz' }

Write-Host "Region=$Region Cluster=$ClusterId Database=$DbName"

$clusterArn = aws rds describe-db-clusters --db-cluster-identifier $ClusterId --region $Region `
  --query 'DBClusters[0].DBClusterArn' --output text
$secretArn = aws rds describe-db-clusters --db-cluster-identifier $ClusterId --region $Region `
  --query 'DBClusters[0].MasterUserSecret.SecretArn' --output text

if ([string]::IsNullOrWhiteSpace($secretArn) -or $secretArn -eq 'None') {
  if ($Environment -eq 'prod') {
    $secretName = 'warmpawz-prod-rds-master-20260207201049162400000001'
  } else {
    $secretName = 'warmpawz-dev-rds-master-20260106164510791100000002'
  }
  $secretArn = aws secretsmanager describe-secret --secret-id $secretName --region $Region --query 'ARN' --output text
}

function Invoke-RdsSql {
  param([string] $Sql)
  $preview = if ($Sql.Length -gt 90) { $Sql.Substring(0, 90) + '...' } else { $Sql }
  Write-Host "--- execute-statement ($preview)"
  aws rds-data execute-statement `
    --resource-arn $clusterArn `
    --secret-arn $secretArn `
    --database $DbName `
    --region $Region `
    --sql $Sql
}

$createTable = @'
CREATE TABLE IF NOT EXISTS admin_ai_audit (
  id UUID PRIMARY KEY,
  admin_principal_id TEXT NOT NULL,
  route TEXT NOT NULL,
  tool_names TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latency_ms INTEGER,
  outcome TEXT NOT NULL,
  prompt_hash TEXT,
  message_len INTEGER
)
'@

Invoke-RdsSql -Sql $createTable.Trim()
Invoke-RdsSql -Sql 'CREATE INDEX IF NOT EXISTS idx_admin_ai_audit_created_at ON admin_ai_audit (created_at DESC)'
Invoke-RdsSql -Sql 'CREATE INDEX IF NOT EXISTS idx_admin_ai_audit_principal ON admin_ai_audit (admin_principal_id)'

Write-Host "Verify ($Environment):"
aws rds-data execute-statement `
  --resource-arn $clusterArn `
  --secret-arn $secretArn `
  --database $DbName `
  --region $Region `
  --sql "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admin_ai_audit' ORDER BY ordinal_position"

Write-Host "OK: migration 731 (admin_ai_audit) on $Environment"
