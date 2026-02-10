# PowerShell script to deploy Lambda fix for RDS Proxy statement_timeout issue
# Usage: .\scripts\deploy-prod-lambda-fix.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying Lambda with RDS Proxy fix..." -ForegroundColor Blue

# Configuration
$LAMBDA_FUNCTION_NAME = "warmpawz-prod-api-handler"
$AWS_REGION = "ap-south-1"
$LAMBDA_ZIP = "api-handler.zip"

# Step 1: Build Lambda
Write-Host "📦 Building Lambda..." -ForegroundColor Blue
$lambdaDir = "$PSScriptRoot\..\backend\lambda"
Set-Location $lambdaDir

# Clean
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path $LAMBDA_ZIP) { Remove-Item -Force $LAMBDA_ZIP }

# Build bundle
npm run build:bundle

if (-not (Test-Path "dist\handler.js")) {
    Write-Host "❌ Error: dist\handler.js not found after build!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Lambda built successfully" -ForegroundColor Green

# Step 2: Package Lambda
Write-Host "📦 Packaging Lambda..." -ForegroundColor Blue
$distPath = Join-Path $lambdaDir "dist"
$zipPath = Join-Path $lambdaDir $LAMBDA_ZIP
Set-Location $distPath
Compress-Archive -Path * -DestinationPath $zipPath -Force
Set-Location $lambdaDir

if (-not (Test-Path $LAMBDA_ZIP)) {
    Write-Host "❌ Error: $LAMBDA_ZIP not found after packaging!" -ForegroundColor Red
    exit 1
}

$zipSize = (Get-Item $LAMBDA_ZIP).Length / 1MB
Write-Host "📊 Package size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Blue
Write-Host ""

# Step 3: Update Lambda function code
Write-Host "📤 Uploading Lambda function code..." -ForegroundColor Blue
try {
    aws lambda update-function-code `
        --function-name $LAMBDA_FUNCTION_NAME `
        --zip-file "fileb://$LAMBDA_ZIP" `
        --region $AWS_REGION `
        --output json | Out-Null
    
    Write-Host "✅ Lambda updated successfully" -ForegroundColor Green
    
    $lambdaInfo = aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region $AWS_REGION --output json | ConvertFrom-Json
    Write-Host "   Function: $LAMBDA_FUNCTION_NAME"
    Write-Host "   ARN: $($lambdaInfo.Configuration.FunctionArn)"
    Write-Host "   Version: $($lambdaInfo.Configuration.Version)"
} catch {
    Write-Host "❌ Lambda update failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Wait for Lambda to be ready
Write-Host "⏳ Waiting for Lambda to be ready..." -ForegroundColor Blue
Start-Sleep -Seconds 10

Write-Host "✅ Lambda deployment complete!" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ LAMBDA DEPLOYMENT COMPLETED                               ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Deployment Summary:"
Write-Host "   ✅ Lambda: $LAMBDA_FUNCTION_NAME"
Write-Host "   ✅ Region: $AWS_REGION"
Write-Host "   ✅ Fix: RDS Proxy statement_timeout removed"
Write-Host ""
