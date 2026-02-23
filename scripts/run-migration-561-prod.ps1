# ============================================================================
# Run Migration 561 for Production Database
# ============================================================================
# This script:
# 1. Gets the production RDS endpoint from Terraform
# 2. Gets database credentials from AWS Secrets Manager
# 3. Constructs DATABASE_URL
# 4. Runs migration 561 (allow_confirmed_to_completed_transition.sql)
# ============================================================================
# NOTE: This script must be run from an environment with:
# - Access to AWS (AWS CLI configured)
# - Network access to RDS (VPN, bastion host, or same VPC)
# ============================================================================

Write-Host "🚀 Running Migration 561 for Production" -ForegroundColor Cyan
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
Write-Host "⚙️  Step 4: Running migration 561..." -ForegroundColor Yellow
Write-Host ""

$env:DATABASE_URL = $databaseUrl
Push-Location "$PSScriptRoot\..\db"

try {
    node run-migration.js migrations/561_allow_confirmed_to_completed_transition.sql
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration 561 completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "The following transition has been added to booking_state_transitions:" -ForegroundColor Cyan
        Write-Host "  - confirmed -> completed (allowed)" -ForegroundColor White
        Write-Host ""
        Write-Host "Vendors can now complete bookings directly from 'confirmed' status." -ForegroundColor Cyan
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
