# ============================================================================
# Run Migration 562 for Production Database
# ============================================================================
# This script runs migration 562 to add allowed_service_styles column to
# problem_grid_mappings table (required by /customer/services/by-problem endpoint)
# ============================================================================

param(
    [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Running Migration 562 for Production" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get RDS cluster info
Write-Host "📋 Getting RDS cluster information..." -ForegroundColor Yellow
$ClusterInfo = aws rds describe-db-clusters --db-cluster-identifier "warmpawz-prod-cluster" --region $Region --output json | ConvertFrom-Json
$RdsArn = $ClusterInfo.DBClusters[0].DBClusterArn
$DbName = $ClusterInfo.DBClusters[0].DatabaseName
$RdsEndpoint = $ClusterInfo.DBClusters[0].Endpoint

Write-Host "   ✅ RDS ARN: $RdsArn" -ForegroundColor Green
Write-Host "   ✅ Database: $DbName" -ForegroundColor Green
Write-Host "   ✅ Endpoint: $RdsEndpoint" -ForegroundColor Green
Write-Host ""

# Get credentials
Write-Host "🔐 Getting database credentials..." -ForegroundColor Yellow
$SecretName = "warmpawz-prod-rds-master-20260207201049162400000001"
$SecretValue = aws secretsmanager get-secret-value --secret-id $SecretName --region $Region --query 'SecretString' --output text | ConvertFrom-Json
$SecretArn = "arn:aws:secretsmanager:$Region`:057442119249:secret:$SecretName"

Write-Host "   ✅ Credentials retrieved" -ForegroundColor Green
Write-Host ""

# Read migration file
Write-Host "📄 Loading migration file..." -ForegroundColor Yellow
$MigrationPath = "db\migrations\562_add_allowed_service_styles_problem_grid_mappings.sql"
if (-not (Test-Path $MigrationPath)) {
    Write-Host "   ❌ ERROR: Migration file not found: $MigrationPath" -ForegroundColor Red
    exit 1
}

$MigrationSql = Get-Content $MigrationPath -Raw -Encoding UTF8
Write-Host "   ✅ Migration SQL loaded: $($MigrationSql.Length) characters" -ForegroundColor Green
Write-Host ""

# Split SQL into statements (handle BEGIN/COMMIT blocks)
$Statements = @()
$CurrentStatement = ""
$InTransaction = $false

# Remove BEGIN/COMMIT and split by semicolons
$SqlWithoutTransaction = $MigrationSql -replace '(?s)^BEGIN;\s*', '' -replace '(?s)\s*COMMIT;\s*$', ''

# Split by semicolons, but keep DO blocks together
$DoBlockPattern = '(?s)(DO\s+\$\$.*?END\s+\$\$;)'
$DoBlocks = [regex]::Matches($SqlWithoutTransaction, $DoBlockPattern)
$RemainingSql = $SqlWithoutTransaction

foreach ($match in $DoBlocks) {
    $Statements += $match.Value.Trim()
    $RemainingSql = $RemainingSql.Replace($match.Value, "")
}

# Split remaining SQL by semicolons
$RemainingStatements = $RemainingSql -split ';' | Where-Object { $_.Trim().Length -gt 0 }
foreach ($stmt in $RemainingStatements) {
    $Statements += ($stmt.Trim() + ';')
}

Write-Host "   ✅ Found $($Statements.Count) SQL statements" -ForegroundColor Green
Write-Host ""

# Execute each statement using RDS Data API
Write-Host "⚙️  Executing migration statements..." -ForegroundColor Yellow
Write-Host ""

foreach ($i in 0..($Statements.Count - 1)) {
    $stmt = $Statements[$i]
    if ([string]::IsNullOrWhiteSpace($stmt)) { continue }
    
    Write-Host "   Executing statement $($i + 1)/$($Statements.Count)..." -ForegroundColor Cyan
    
    # Save statement to temp file to avoid escaping issues
    $TempSqlFile = [System.IO.Path]::GetTempFileName() + ".sql"
    $stmt | Out-File -FilePath $TempSqlFile -Encoding utf8 -NoNewline
    
    $SqlContent = Get-Content $TempSqlFile -Raw
    
    $Response = aws rds-data execute-statement `
        --resource-arn $RdsArn `
        --secret-arn $SecretArn `
        --database $DbName `
        --sql $SqlContent `
        --region $Region `
        --output json 2>&1
    
    Remove-Item $TempSqlFile -Force -ErrorAction SilentlyContinue
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "      ✅ Statement $($i + 1) executed successfully" -ForegroundColor Green
    } else {
        $ResponseText = $Response | Out-String
        if ($ResponseText -match "already exists" -or $ResponseText -match "duplicate") {
            Write-Host "      ⚠️  Statement $($i + 1) skipped (already exists)" -ForegroundColor Yellow
        } else {
            Write-Host "      ❌ ERROR in statement $($i + 1):" -ForegroundColor Red
            Write-Host $ResponseText
            Write-Host ""
            Write-Host "      SQL (first 200 chars):" -ForegroundColor Yellow
            Write-Host $stmt.Substring(0, [Math]::Min(200, $stmt.Length))
            exit 1
        }
    }
}

Write-Host ""
Write-Host "✅ Migration 562 completed successfully!" -ForegroundColor Green
Write-Host ""

# Verify column exists
Write-Host "🔍 Verifying column exists..." -ForegroundColor Yellow
$VerifySql = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'problem_grid_mappings' AND column_name = 'allowed_service_styles'"
$VerifyResponse = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $VerifySql --region $Region --output json | ConvertFrom-Json

if ($VerifyResponse.records -and $VerifyResponse.records.Count -gt 0) {
    Write-Host "   VERIFIED: Column 'allowed_service_styles' exists in 'problem_grid_mappings'!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Migration 562 complete! The /customer/services/by-problem endpoint should now work." -ForegroundColor Green
} else {
    Write-Host "   WARNING: Could not verify column (may need to check manually)" -ForegroundColor Yellow
}

Write-Host ""
