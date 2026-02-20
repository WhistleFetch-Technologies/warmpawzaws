# PowerShell script to deploy Lambda to Production with verify-otp timeout fixes
# Usage: .\scripts\deploy-prod-lambda-verify-otp-fix.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying Lambda to PRODUCTION with verify-otp timeout fixes..." -ForegroundColor Blue

# Configuration
$LAMBDA_FUNCTION_NAME = "warmpawz-prod-api-handler"
$AWS_REGION = "ap-south-1"
$LAMBDA_ZIP = "api-handler.zip"

# Confirm production deployment
Write-Host "⚠️  WARNING: You are about to deploy to PRODUCTION" -ForegroundColor Yellow
Write-Host "   Function: $LAMBDA_FUNCTION_NAME" -ForegroundColor Yellow
Write-Host "   Region: $AWS_REGION" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Are you sure you want to continue? (yes/N)"
if ($confirm -ne "yes") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

# Step 1: Navigate to Lambda directory
Write-Host "📁 Navigating to Lambda directory..." -ForegroundColor Blue
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$lambdaDir = Join-Path $scriptPath "..\backend\lambda"
Set-Location $lambdaDir

# Step 2: Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Blue
npm run clean 2>&1 | Out-Null

# Step 3: Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
npm install

# Step 4: Build Lambda
Write-Host "🔨 Building Lambda..." -ForegroundColor Blue
npm run build

$zipPath = Join-Path $lambdaDir $LAMBDA_ZIP
if (-not (Test-Path $zipPath)) {
    Write-Host "❌ Error: $LAMBDA_ZIP not found after build!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Lambda built successfully" -ForegroundColor Green
$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "📊 Package size: $zipSize MB" -ForegroundColor Blue
Write-Host ""

# Step 5: Verify AWS CLI is configured
Write-Host "🔍 Verifying AWS CLI configuration..." -ForegroundColor Blue
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    $awsAccount = $identity.Account
    Write-Host "✅ AWS CLI configured" -ForegroundColor Green
    Write-Host "   Account: $awsAccount" -ForegroundColor Gray
    Write-Host "   Region: $AWS_REGION" -ForegroundColor Gray
} catch {
    Write-Host "❌ AWS CLI not configured. Please run: aws configure" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Verify Lambda function exists
Write-Host "🔍 Verifying Lambda function exists..." -ForegroundColor Blue
try {
    aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region $AWS_REGION | Out-Null
    Write-Host "✅ Lambda function found" -ForegroundColor Green
} catch {
    Write-Host "❌ Lambda function '$LAMBDA_FUNCTION_NAME' not found in region $AWS_REGION" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 7: Update Lambda function code
Write-Host "📤 Uploading Lambda function code to PRODUCTION..." -ForegroundColor Blue
try {
    $updateResult = aws lambda update-function-code `
        --function-name $LAMBDA_FUNCTION_NAME `
        --zip-file "fileb://$zipPath" `
        --region $AWS_REGION `
        --output json | ConvertFrom-Json
    
    Write-Host "✅ Lambda code updated successfully" -ForegroundColor Green
    Write-Host "   Function: $LAMBDA_FUNCTION_NAME" -ForegroundColor Gray
    Write-Host "   ARN: $($updateResult.FunctionArn)" -ForegroundColor Gray
    Write-Host "   Version: $($updateResult.Version)" -ForegroundColor Gray
    Write-Host "   Last Modified: $($updateResult.LastModified)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Lambda update failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 8: Wait for Lambda to be ready
Write-Host "⏳ Waiting for Lambda to be ready..." -ForegroundColor Blue
try {
    aws lambda wait function-updated `
        --function-name $LAMBDA_FUNCTION_NAME `
        --region $AWS_REGION
    Write-Host "✅ Lambda is ready" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Wait command failed, but Lambda may still be updating..." -ForegroundColor Yellow
}
Write-Host ""

# Step 9: Verify deployment
Write-Host "🔍 Verifying deployment..." -ForegroundColor Blue
try {
    $functionConfig = aws lambda get-function `
        --function-name $LAMBDA_FUNCTION_NAME `
        --region $AWS_REGION `
        --output json | ConvertFrom-Json
    
    $codeSha = $functionConfig.Configuration.CodeSha256
    Write-Host "✅ Deployment verified" -ForegroundColor Green
    Write-Host "   Code SHA256: $codeSha" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Could not verify deployment, but update may have succeeded" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ PRODUCTION LAMBDA DEPLOYMENT COMPLETED                    ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Deployment Summary:" -ForegroundColor Cyan
Write-Host "   ✅ Function: $LAMBDA_FUNCTION_NAME" -ForegroundColor Gray
Write-Host "   ✅ Region: $AWS_REGION" -ForegroundColor Gray
Write-Host "   ✅ Package Size: $zipSize MB" -ForegroundColor Gray
if ($codeSha) {
    Write-Host "   ✅ Code SHA256: $codeSha" -ForegroundColor Gray
}
Write-Host ""
Write-Host "📝 Changes Deployed:" -ForegroundColor Yellow
Write-Host "   • Added timeout protection for OTP verification (10s)" -ForegroundColor Gray
Write-Host "   • Added timeout protection for Cognito authentication (8s)" -ForegroundColor Gray
Write-Host "   • Improved error handling for 503 Service Unavailable errors" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Deployment complete! The verify-otp endpoint should now handle timeouts properly." -ForegroundColor Green
