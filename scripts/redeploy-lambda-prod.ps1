# PowerShell script to redeploy Lambda function for production
# Usage: .\scripts\redeploy-lambda-prod.ps1

$ErrorActionPreference = "Stop"

Write-Host "Redeploying Lambda function for production..." -ForegroundColor Blue

# Configuration
$LAMBDA_FUNCTION_NAME = "warmpawz-prod-api-handler"
$AWS_REGION = "ap-south-1"
$LAMBDA_ZIP = "api-handler.zip"

# Step 1: Build Lambda
Write-Host "`n[1/4] Building Lambda..." -ForegroundColor Blue
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
$lambdaDir = Join-Path $projectRoot "backend\lambda"
Write-Host "Lambda directory: $lambdaDir" -ForegroundColor Yellow
Set-Location $lambdaDir

# Clean
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path $LAMBDA_ZIP) { Remove-Item -Force $LAMBDA_ZIP }

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Build bundle
Write-Host "Building TypeScript bundle..." -ForegroundColor Yellow
npm run build:bundle

if (-not (Test-Path "dist\handler.js")) {
    Write-Host "ERROR: dist\handler.js not found after build!" -ForegroundColor Red
    exit 1
}

Write-Host "Lambda built successfully" -ForegroundColor Green

# Step 2: Package Lambda
Write-Host "`n[2/4] Packaging Lambda..." -ForegroundColor Blue
$distPath = Join-Path $lambdaDir "dist"
$zipPath = Join-Path $lambdaDir $LAMBDA_ZIP
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
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

# Step 3: Update Lambda function code
Write-Host "`n[3/4] Uploading Lambda function code..." -ForegroundColor Blue
try {
    $updateResult = aws lambda update-function-code `
        --function-name $LAMBDA_FUNCTION_NAME `
        --zip-file "fileb://$LAMBDA_ZIP" `
        --region $AWS_REGION `
        --output json | ConvertFrom-Json
    
    Write-Host "Lambda updated successfully" -ForegroundColor Green
    Write-Host "   Function: $($updateResult.FunctionName)"
    Write-Host "   Version: $($updateResult.Version)"
    Write-Host "   Last Modified: $($updateResult.LastModified)"
    Write-Host ""
} catch {
    Write-Host "Lambda update failed: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Wait for Lambda to be ready
Write-Host "`n[4/4] Waiting for Lambda to be ready..." -ForegroundColor Blue
$maxWait = 60
$waited = 0
do {
    Start-Sleep -Seconds 2
    $waited += 2
    $config = aws lambda get-function-configuration `
        --function-name $LAMBDA_FUNCTION_NAME `
        --region $AWS_REGION `
        --output json | ConvertFrom-Json
    
    if ($config.State -eq "Active" -and $config.LastUpdateStatus -eq "Successful") {
        Write-Host "Lambda is ready" -ForegroundColor Green
        break
    }
    
    Write-Host "   State: $($config.State), LastUpdateStatus: $($config.LastUpdateStatus)" -ForegroundColor Yellow
} while ($waited -lt $maxWait)

if ($waited -ge $maxWait) {
    Write-Host "WARNING: Lambda update is taking longer than expected" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Lambda redeployment complete!" -ForegroundColor Green
Write-Host ""
