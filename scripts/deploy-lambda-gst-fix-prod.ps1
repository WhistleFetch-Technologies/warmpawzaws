# PowerShell script to deploy Lambda to Production with GST verification fixes
# Usage: .\scripts\deploy-lambda-gst-fix-prod.ps1

Write-Host "🚀 Deploying Lambda to PRODUCTION with GST verification fixes..." -ForegroundColor Blue
Write-Host ""

# Configuration
$LAMBDA_FUNCTION_NAME = "warmpawz-prod-api-handler"
$AWS_REGION = "ap-south-1"
$LAMBDA_ZIP = "api-handler.zip"

# Step 1: Navigate to Lambda directory
Write-Host "[1/4] Navigating to Lambda directory..." -ForegroundColor Yellow
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$lambdaDir = Join-Path $scriptPath "..\backend\lambda"
$lambdaDir = Resolve-Path $lambdaDir
Set-Location $lambdaDir
Write-Host "✅ Current directory: $lambdaDir" -ForegroundColor Green
Write-Host ""

# Step 2: Install dependencies (including new AWS SDK packages)
Write-Host "[2/4] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 3: Build Lambda
Write-Host "[3/4] Building Lambda..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $LAMBDA_ZIP)) {
    Write-Host "❌ Error: $LAMBDA_ZIP not found after build!" -ForegroundColor Red
    exit 1
}

$zipSize = (Get-Item $LAMBDA_ZIP).Length / 1MB
Write-Host "✅ Lambda built successfully" -ForegroundColor Green
Write-Host "📊 Package size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan
Write-Host ""

# Step 4: Deploy to AWS Lambda
Write-Host "[4/4] Uploading Lambda function code to PRODUCTION..." -ForegroundColor Yellow
Write-Host "⚠️  WARNING: This will update PRODUCTION Lambda function: $LAMBDA_FUNCTION_NAME" -ForegroundColor Red
Write-Host ""

try {
    $updateResult = aws lambda update-function-code `
        --function-name $LAMBDA_FUNCTION_NAME `
        --zip-file "fileb://$LAMBDA_ZIP" `
        --region $AWS_REGION `
        --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $result = $updateResult | ConvertFrom-Json
        Write-Host "✅ Lambda updated successfully" -ForegroundColor Green
        Write-Host "   Function: $LAMBDA_FUNCTION_NAME" -ForegroundColor White
        Write-Host "   ARN: $($result.FunctionArn)" -ForegroundColor White
        Write-Host "   Version: $($result.Version)" -ForegroundColor White
        Write-Host "   Last Modified: $($result.LastModified)" -ForegroundColor White
        Write-Host ""
        
        # Wait for Lambda to be ready
        Write-Host "⏳ Waiting for Lambda to be ready..." -ForegroundColor Yellow
        aws lambda wait function-updated `
            --function-name $LAMBDA_FUNCTION_NAME `
            --region $AWS_REGION
        
        Write-Host "✅ Lambda is ready!" -ForegroundColor Green
    } else {
        Write-Host "❌ Lambda update failed:" -ForegroundColor Red
        Write-Host $updateResult -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error deploying Lambda: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ LAMBDA DEPLOYMENT COMPLETED                               ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Deployment Summary:" -ForegroundColor Cyan
Write-Host "   ✅ Lambda: $LAMBDA_FUNCTION_NAME" -ForegroundColor White
Write-Host "   ✅ Region: $AWS_REGION" -ForegroundColor White
Write-Host "   ✅ Package: $LAMBDA_ZIP" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Changes deployed:" -ForegroundColor Cyan
Write-Host "   • AWS SigV4 signing for API Gateway requests" -ForegroundColor White
Write-Host "   • Dummy GST number support (29ABCDE1234F2Z3, TEST*, DUMMY*)" -ForegroundColor White
Write-Host "   • Improved error handling for KYC verification" -ForegroundColor White
Write-Host ""
