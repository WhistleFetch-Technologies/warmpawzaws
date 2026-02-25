# Deploy Lambda to Production
# Usage: .\prodscripts\deploy-lambda-prod.ps1 [-SkipConfirm]

param(
    [switch]$SkipConfirm
)

$ErrorActionPreference = "Stop"

# Safety confirmation for PROD
if (-not $SkipConfirm) {
    Write-Host "WARNING: PRODUCTION DEPLOYMENT" -ForegroundColor Red
    Write-Host "This will deploy Lambda to PRODUCTION environment!" -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "Are you sure you want to continue? Type 'yes' to proceed"
    if ($confirm -ne "yes") {
        Write-Host "Deployment cancelled" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Deploying Lambda to AWS PRODUCTION environment..." -ForegroundColor Green

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$STAGE = "prod"
$REGION = "ap-south-1"

Set-Location "$PROJECT_ROOT\backend\lambda"

# Step 1: Build API contracts package
Write-Host "[1/5] Building API contracts package..." -ForegroundColor Blue
Set-Location "$PROJECT_ROOT\packages\api-contracts"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: npm install failed in api-contracts" -ForegroundColor Red
    exit 1
}
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: npm build failed in api-contracts" -ForegroundColor Red
    exit 1
}

# Step 2: Install Lambda dependencies
Write-Host "[2/5] Installing Lambda dependencies..." -ForegroundColor Blue
Set-Location "$PROJECT_ROOT\backend\lambda"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: npm install failed in lambda" -ForegroundColor Red
    exit 1
}

# Step 3: Build Lambda function
Write-Host "[3/5] Building Lambda function with esbuild..." -ForegroundColor Blue
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Lambda build failed" -ForegroundColor Red
    exit 1
}

# Step 4: Verify build
if (-not (Test-Path "dist\handler.js")) {
    Write-Host "Error: Build failed - dist/handler.js not found" -ForegroundColor Red
    exit 1
}

Write-Host "Build successful" -ForegroundColor Green

# Step 5: Deploy with Serverless Framework
Write-Host "[4/5] Deploying to AWS..." -ForegroundColor Blue
npx serverless deploy --stage $STAGE --region $REGION
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Serverless deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "LAMBDA PRODUCTION DEPLOYMENT COMPLETED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployment Summary:"
Write-Host "   Stage: $STAGE"
Write-Host "   Region: $REGION"
Write-Host "   API Endpoint: Check Serverless output above"
Write-Host ""
Write-Host "Next Steps:"
Write-Host "   1. Verify API Gateway endpoint is accessible"
Write-Host "   2. Test API endpoints in production"
Write-Host "   3. Monitor CloudWatch logs for any errors"
Write-Host ""
