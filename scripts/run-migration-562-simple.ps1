# Simple script to run migration 562 - Add allowed_service_styles column
param(
    [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Running Migration 562: Add allowed_service_styles to problem_grid_mappings" -ForegroundColor Cyan
Write-Host ""

# Get RDS cluster info
$ClusterInfo = aws rds describe-db-clusters --db-cluster-identifier "warmpawz-prod-cluster" --region $Region --output json | ConvertFrom-Json
$RdsArn = $ClusterInfo.DBClusters[0].DBClusterArn
$DbName = $ClusterInfo.DBClusters[0].DatabaseName

Write-Host "RDS ARN: $RdsArn" -ForegroundColor Green
Write-Host "Database: $DbName" -ForegroundColor Green
Write-Host ""

# Get credentials
$SecretName = "warmpawz-prod-rds-master-20260207201049162400000001"
$SecretArn = "arn:aws:secretsmanager:$Region`:057442119249:secret:$SecretName"

Write-Host "Executing migration statements..." -ForegroundColor Yellow
Write-Host ""

# Statement 1: Add column
Write-Host "1. Adding allowed_service_styles column..." -ForegroundColor Cyan
$stmt1 = 'ALTER TABLE problem_grid_mappings ADD COLUMN IF NOT EXISTS allowed_service_styles JSONB DEFAULT ''["at_home", "at_center", "tele"]''::jsonb;'
$result1 = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $stmt1 --region $Region --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Column added successfully" -ForegroundColor Green
} else {
    $resultText = $result1 | Out-String
    if ($resultText -match "already exists") {
        Write-Host "   Column already exists (skipped)" -ForegroundColor Yellow
    } else {
        Write-Host "   ERROR: $resultText" -ForegroundColor Red
        exit 1
    }
}

# Statement 2: Add comment
Write-Host "2. Adding column comment..." -ForegroundColor Cyan
$stmt2 = "COMMENT ON COLUMN problem_grid_mappings.allowed_service_styles IS 'JSON array specifying which service styles are valid for this problem. Values: at_home, at_center, tele';"
$result2 = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $stmt2 --region $Region --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Comment added successfully" -ForegroundColor Green
} else {
    Write-Host "   Warning (may already exist): $result2" -ForegroundColor Yellow
}

# Statement 3: Create index
Write-Host "3. Creating index..." -ForegroundColor Cyan
$stmt3 = "CREATE INDEX IF NOT EXISTS idx_problem_grid_allowed_styles ON problem_grid_mappings USING GIN (allowed_service_styles);"
$result3 = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $stmt3 --region $Region --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Index created successfully" -ForegroundColor Green
} else {
    $resultText = $result3 | Out-String
    if ($resultText -match "already exists") {
        Write-Host "   Index already exists (skipped)" -ForegroundColor Yellow
    } else {
        Write-Host "   Warning: $resultText" -ForegroundColor Yellow
    }
}

# Statement 4: Update NULL values
Write-Host "4. Updating NULL values..." -ForegroundColor Cyan
$stmt4 = 'UPDATE problem_grid_mappings SET allowed_service_styles = ''["at_home", "at_center", "tele"]''::jsonb WHERE allowed_service_styles IS NULL;'
$result4 = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $stmt4 --region $Region --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   NULL values updated successfully" -ForegroundColor Green
} else {
    Write-Host "   Warning: $result4" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Migration 562 completed!" -ForegroundColor Green
Write-Host ""

# Verify
Write-Host "Verifying column exists..." -ForegroundColor Yellow
$verifySql = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'problem_grid_mappings' AND column_name = 'allowed_service_styles';"
$verifyResult = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $verifySql --region $Region --output json | ConvertFrom-Json

if ($verifyResult.records -and $verifyResult.records.Count -gt 0) {
    Write-Host "VERIFIED: Column 'allowed_service_styles' exists!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The /customer/services/by-problem endpoint should now work." -ForegroundColor Green
} else {
    Write-Host "WARNING: Could not verify column" -ForegroundColor Yellow
}

Write-Host ""
