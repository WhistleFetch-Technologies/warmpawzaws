# PowerShell script to deploy Lambda with vet center discovery debug logging
# Usage: .\scripts\deploy-prod-vet-center-debug.ps1

$ErrorActionPreference = "Stop"

Write-Host "Deploying Lambda with Vet Center Discovery Debug Logging..." -ForegroundColor Blue
Write-Host "PRODUCTION DEPLOYMENT - warmpawz-prod-api-handler" -ForegroundColor Yellow
Write-Host ""

# Configuration
$LAMBDA_FUNCTION_NAME = "warmpawz-prod-api-handler"
$AWS_REGION = "ap-south-1"
$LAMBDA_ZIP = "api-handler.zip"

# Step 1: Build Lambda
Write-Host "Building Lambda..." -ForegroundColor Blue
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$lambdaDir = Join-Path $scriptPath "..\backend\lambda" | Resolve-Path
Set-Location $lambdaDir

# Clean
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path $LAMBDA_ZIP) { Remove-Item -Force $LAMBDA_ZIP }

# Build bundle
Write-Host "   Running npm run build..." -ForegroundColor Gray
npm run build

if (-not (Test-Path "dist\handler.js")) {
    Write-Host "ERROR: dist\handler.js not found after build!" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Lambda built successfully" -ForegroundColor Green

# Step 2: Package Lambda
Write-Host "Packaging Lambda..." -ForegroundColor Blue
$distPath = Join-Path $lambdaDir "dist"
$zipPath = Join-Path $lambdaDir $LAMBDA_ZIP
Set-Location $distPath
Compress-Archive -Path * -DestinationPath $zipPath -Force
Set-Location $lambdaDir

if (-not (Test-Path $LAMBDA_ZIP)) {
    Write-Host "ERROR: $LAMBDA_ZIP not found after packaging!" -ForegroundColor Red
    exit 1
}

$zipSize = (Get-Item $LAMBDA_ZIP).Length / 1MB
Write-Host "Package size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Blue
Write-Host ""

# Step 3: Verify Lambda function exists
Write-Host "Verifying Lambda function exists..." -ForegroundColor Blue
try {
    $lambdaCheck = aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Lambda function '$LAMBDA_FUNCTION_NAME' not found in region $AWS_REGION" -ForegroundColor Red
        Write-Host $lambdaCheck
        exit 1
    }
    Write-Host "SUCCESS: Lambda function verified" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Error checking Lambda function: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Update Lambda function code
Write-Host "Uploading Lambda function code..." -ForegroundColor Blue
try {
    $updateResult = aws lambda update-function-code `
        --function-name $LAMBDA_FUNCTION_NAME `
        --zip-file "fileb://$LAMBDA_ZIP" `
        --region $AWS_REGION `
        --output json | ConvertFrom-Json
    
    Write-Host "SUCCESS: Lambda updated successfully" -ForegroundColor Green
    Write-Host "   Function: $LAMBDA_FUNCTION_NAME"
    Write-Host "   ARN: $($updateResult.FunctionArn)"
    Write-Host "   Version: $($updateResult.Version)"
    Write-Host "   Last Modified: $($updateResult.LastModified)"
} catch {
    Write-Host "ERROR: Lambda update failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 5: Wait for Lambda to be ready
Write-Host "Waiting for Lambda to be ready..." -ForegroundColor Blue
Start-Sleep -Seconds 15

# Step 6: Verify deployment
Write-Host "Verifying deployment..." -ForegroundColor Blue
try {
    $lambdaInfo = aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region $AWS_REGION --output json | ConvertFrom-Json
    $currentVersion = $lambdaInfo.Configuration.Version
    Write-Host "SUCCESS: Deployment verified - Version: $currentVersion" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Could not verify deployment: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "PRODUCTION LAMBDA DEPLOYMENT COMPLETED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployment Summary:"
Write-Host "   Lambda: $LAMBDA_FUNCTION_NAME"
Write-Host "   Region: $AWS_REGION"
Write-Host "   Fix: Vet Center Discovery Debug Logging Added"
Write-Host ''
Write-Host 'Next Steps:'
Write-Host '   1. Test the API endpoint'
Write-Host '   2. Check CloudWatch logs for DEBUG vendor check'
Write-Host ''
