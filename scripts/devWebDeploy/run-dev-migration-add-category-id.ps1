Param(
  [string]$Region = "ap-south-1",
  [string]$Env = "dev"
)

$ErrorActionPreference = "Stop"

Write-Host "Running dev migration: add vendor_services.category_id (UUID)" -ForegroundColor Cyan

$clusterId = "warmpawz-$Env-cluster"

Write-Host "Resolving cluster and secret ARNs..."
$clusterArn = aws rds describe-db-clusters `
  --db-cluster-identifier $clusterId `
  --region $Region `
  --query "DBClusters[0].DBClusterArn" `
  --output text

$dbName = aws rds describe-db-clusters `
  --db-cluster-identifier $clusterId `
  --region $Region `
  --query "DBClusters[0].DatabaseName" `
  --output text
if (-not $dbName -or $dbName -eq "None") { $dbName = "warmpawz" }

$secretArn = aws rds describe-db-clusters `
  --db-cluster-identifier $clusterId `
  --region $Region `
  --query "DBClusters[0].MasterUserSecret.SecretArn" `
  --output text

if (-not $secretArn -or $secretArn -eq "None") {
  $fallbackSecretName = "warmpawz-$Env-rds-master-20260106164510791100000002"
  $secretArn = aws secretsmanager describe-secret `
    --secret-id $fallbackSecretName `
    --region $Region `
    --query "ARN" `
    --output text
}

Write-Host "Cluster ARN: $clusterArn" -ForegroundColor Gray
Write-Host "Database  : $dbName" -ForegroundColor Gray
Write-Host "Secret ARN: $secretArn" -ForegroundColor Gray

# Run migration
$sql = "ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS category_id UUID;"
Write-Host "Executing migration..." -ForegroundColor Yellow
aws rds-data execute-statement `
  --resource-arn $clusterArn `
  --secret-arn $secretArn `
  --database $dbName `
  --region $Region `
  --sql "$sql" `
  --output json | Out-Null
Write-Host "✅ Migration executed" -ForegroundColor Green

# Verify
$verifySql = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='vendor_services' AND column_name='category_id';"
Write-Host "Verifying column..." -ForegroundColor Yellow
$verify = aws rds-data execute-statement `
  --resource-arn $clusterArn `
  --secret-arn $secretArn `
  --database $dbName `
  --region $Region `
  --sql "$verifySql" `
  --output json | ConvertFrom-Json

if ($verify.records -and $verify.records.Count -gt 0) {
  Write-Host "✅ Verified: vendor_services.category_id exists" -ForegroundColor Green
} else {
  Write-Host "❌ Verification failed: column not found" -ForegroundColor Red
  exit 1
}

Write-Host "Done." -ForegroundColor Cyan

