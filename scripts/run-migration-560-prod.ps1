# ============================================================================
# Run Migration 560 for Production Database
# ============================================================================
# This script:
# 1. Gets the production RDS endpoint from Terraform
# 2. Gets database credentials from AWS Secrets Manager
# 3. Constructs DATABASE_URL
# 4. Runs migration 560 (ensure_vendor_profile_columns_prod.sql)
# ============================================================================

Write-Host "🚀 Running Migration 560 for Production" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get RDS endpoint from Terraform
Write-Host "📋 Step 1: Getting RDS endpoint from Terraform..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot\..\infra\envs\prod"

try {
    terraform init -backend-config=backend.hcl -migrate-state -input=false 2>&1 | Out-Null
    
    $rdsEndpoint = terraform output -raw rds_endpoint 2>&1
    $rdsSecretArn = terraform output -raw rds_secret_arn 2>&1
    $rdsDatabaseName = terraform output -raw rds_database_name 2>&1
    $rdsPort = terraform output -raw rds_port 2>&1
    
    Write-Host "   ✅ RDS Endpoint: $rdsEndpoint" -ForegroundColor Green
    Write-Host "   ✅ Database: $rdsDatabaseName" -ForegroundColor Green
    Write-Host "   ✅ Port: $rdsPort" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to get Terraform outputs: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

# Step 2: Get database credentials from AWS Secrets Manager
Write-Host ""
Write-Host "🔐 Step 2: Getting database credentials from AWS Secrets Manager..." -ForegroundColor Yellow

try {
    $secretJson = aws secretsmanager get-secret-value --secret-id $rdsSecretArn --region ap-south-1 --query SecretString --output text
    $secret = $secretJson | ConvertFrom-Json
    
    $dbUsername = $secret.username
    $dbPassword = $secret.password
    
    Write-Host "   ✅ Credentials retrieved successfully" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to get credentials: $_" -ForegroundColor Red
    exit 1
}

# Step 3: URL-encode password
Write-Host ""
Write-Host "🔧 Step 3: Constructing DATABASE_URL..." -ForegroundColor Yellow

$encodedPassword = python -c "import urllib.parse; print(urllib.parse.quote('$dbPassword', safe=''))"
$databaseUrl = "postgresql://${dbUsername}:${encodedPassword}@${rdsEndpoint}:${rdsPort}/${rdsDatabaseName}"

Write-Host "   ✅ DATABASE_URL constructed (password masked)" -ForegroundColor Green

# Step 4: Run migration
Write-Host ""
Write-Host "⚙️  Step 4: Running migration 560..." -ForegroundColor Yellow
Write-Host ""

$env:DATABASE_URL = $databaseUrl
Push-Location "$PSScriptRoot\..\db"

try {
    node run-migration.js migrations/560_ensure_vendor_profile_columns_prod.sql
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration 560 completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "The following columns have been ensured in the vendors table:" -ForegroundColor Cyan
        Write-Host "  - profile_photo_url (TEXT, nullable)" -ForegroundColor White
        Write-Host "  - pincode (TEXT, nullable)" -ForegroundColor White
        Write-Host "  - service_radius (NUMERIC(5,2), nullable)" -ForegroundColor White
        Write-Host "  - qualifications (TEXT, nullable)" -ForegroundColor White
        Write-Host "  - service_area (TEXT, nullable)" -ForegroundColor White
        Write-Host "  - description (TEXT, nullable)" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Migration failed: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "🎉 Done!" -ForegroundColor Green
