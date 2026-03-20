# Test AWS CLI Access and Deploy Lambda to Production
# Usage: .\scripts\test-and-deploy-lambda-prod.ps1

$ErrorActionPreference = "Stop"

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Testing AWS CLI Access and Deploying Lambda to Production" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Test AWS CLI access
Write-Host "[1/4] Testing AWS CLI access..." -ForegroundColor Yellow
try {
    $identity = aws sts get-caller-identity --output json 2>&1 | ConvertFrom-Json
    Write-Host "  ✅ AWS CLI is configured" -ForegroundColor Green
    Write-Host "  Account: $($identity.Account)" -ForegroundColor Gray
    Write-Host "  User: $($identity.Arn)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ AWS CLI not configured or credentials invalid" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please configure AWS CLI:" -ForegroundColor Yellow
    Write-Host "  aws configure" -ForegroundColor Gray
    Write-Host "  Or set environment variables:" -ForegroundColor Gray
    Write-Host "    `$env:AWS_ACCESS_KEY_ID = 'YOUR_KEY'" -ForegroundColor Gray
    Write-Host "    `$env:AWS_SECRET_ACCESS_KEY = 'YOUR_SECRET'" -ForegroundColor Gray
    Write-Host "    `$env:AWS_DEFAULT_REGION = 'ap-south-1'" -ForegroundColor Gray
    exit 1
}

# Step 2: Test Lambda permissions
Write-Host ""
Write-Host "[2/4] Testing Lambda update permissions..." -ForegroundColor Yellow
try {
    $lambdaInfo = aws lambda get-function --function-name warmpawz-prod-api-handler --region ap-south-1 --output json 2>&1 | ConvertFrom-Json
    Write-Host "  ✅ Can access Lambda function" -ForegroundColor Green
    Write-Host "  Function: $($lambdaInfo.Configuration.FunctionName)" -ForegroundColor Gray
    Write-Host "  Status: $($lambdaInfo.Configuration.State)" -ForegroundColor Gray
} catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -match "AccessDenied" -or $errorMsg -match "explicit deny") {
        Write-Host "  ❌ Access denied - Quarantine policy still active" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please remove AWSCompromisedKeyQuarantineV3 policy:" -ForegroundColor Yellow
        Write-Host "  1. Go to: https://057442119249.signin.aws.amazon.com/console" -ForegroundColor White
        Write-Host "  2. Sign in as IAM user: shivangtiwari" -ForegroundColor White
        Write-Host "  3. Go to IAM → Users → shivangtiwari → Permissions" -ForegroundColor White
        Write-Host "  4. Detach 'AWSCompromisedKeyQuarantineV3' policy" -ForegroundColor White
        exit 1
    } else {
        Write-Host "  ❌ Error accessing Lambda: $errorMsg" -ForegroundColor Red
        exit 1
    }
}

# Step 3: Build Lambda
Write-Host ""
Write-Host "[3/4] Building Lambda package..." -ForegroundColor Yellow
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
Set-Location "$PROJECT_ROOT\backend\lambda"

if (-not (Test-Path "api-handler.zip")) {
    Write-Host "  Building Lambda..." -ForegroundColor Gray
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Lambda build failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ✅ Using existing api-handler.zip" -ForegroundColor Green
}

if (-not (Test-Path "api-handler.zip")) {
    Write-Host "  ❌ api-handler.zip not found after build" -ForegroundColor Red
    exit 1
}

# Step 4: Deploy Lambda
Write-Host ""
Write-Host "[4/4] Deploying Lambda to production..." -ForegroundColor Yellow
try {
    Write-Host "  Uploading Lambda code..." -ForegroundColor Gray
    $result = aws lambda update-function-code `
        --function-name warmpawz-prod-api-handler `
        --zip-file "fileb://api-handler.zip" `
        --region ap-south-1 `
        --output json 2>&1 | ConvertFrom-Json
    
    Write-Host "  ✅ Lambda deployment initiated" -ForegroundColor Green
    Write-Host "  Function: $($result.FunctionName)" -ForegroundColor Gray
    Write-Host "  Status: $($result.LastUpdateStatus)" -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "  Waiting for deployment to complete..." -ForegroundColor Gray
    aws lambda wait function-updated --function-name warmpawz-prod-api-handler --region ap-south-1
    
    $finalStatus = aws lambda get-function --function-name warmpawz-prod-api-handler --region ap-south-1 --query "Configuration.LastUpdateStatus" --output text
    Write-Host ""
    Write-Host "============================================================================" -ForegroundColor Green
    Write-Host "✅ Lambda Deployment Complete!" -ForegroundColor Green
    Write-Host "============================================================================" -ForegroundColor Green
    Write-Host "  Status: $finalStatus" -ForegroundColor Cyan
    Write-Host "  Function: warmpawz-prod-api-handler" -ForegroundColor Cyan
    Write-Host "  Region: ap-south-1" -ForegroundColor Cyan
    
} catch {
    Write-Host "  ❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
