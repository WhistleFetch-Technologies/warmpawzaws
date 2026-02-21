# Deploy tele discovery fix to production Lambda
# Fix: Include vendor_identity records for solo providers in tele/at_home discovery

$LAMBDA_FUNCTION_NAME = "warmpawz-prod-api-handler"
$AWS_REGION = "ap-south-1"
$LAMBDA_ZIP = "api-handler.zip"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploying Tele Discovery Fix to Production" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build Lambda
Write-Host "Building Lambda..." -ForegroundColor Blue
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$lambdaDir = Join-Path $scriptPath "..\backend\lambda" | Resolve-Path
Set-Location $lambdaDir
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Verify zip file exists
$zipPath = Join-Path $lambdaDir $LAMBDA_ZIP
if (-not (Test-Path $zipPath)) {
    Write-Host "Lambda zip file not found: $zipPath" -ForegroundColor Red
    exit 1
}

Write-Host "Lambda zip file found: $zipPath" -ForegroundColor Green
$zipSize = (Get-Item $zipPath).Length / 1MB
Write-Host "Zip file size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Green
Write-Host ""

# Step 3: Verify Lambda function exists
Write-Host "Verifying Lambda function exists..." -ForegroundColor Blue
try {
    $functionInfo = aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region $AWS_REGION --output json | ConvertFrom-Json
    Write-Host "Lambda function found: $LAMBDA_FUNCTION_NAME" -ForegroundColor Green
    Write-Host "Current version: $($functionInfo.Configuration.Version)" -ForegroundColor Green
} catch {
    Write-Host "Lambda function not found or error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Update Lambda function code
Write-Host "Uploading Lambda function code..." -ForegroundColor Blue
try {
    $updateResult = aws lambda update-function-code `
        --function-name $LAMBDA_FUNCTION_NAME `
        --zip-file "fileb://$zipPath" `
        --region $AWS_REGION `
        --output json | ConvertFrom-Json
    
    Write-Host "Lambda function code updated successfully!" -ForegroundColor Green
    Write-Host "New version: $($updateResult.Version)" -ForegroundColor Green
    Write-Host "Code size: $($updateResult.CodeSize) bytes" -ForegroundColor Green
    Write-Host ""
    
    # Wait for update to complete
    Write-Host "Waiting for Lambda update to complete..." -ForegroundColor Blue
    Start-Sleep -Seconds 5
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Deployment Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Changes deployed:" -ForegroundColor Yellow
    Write-Host "  - Tele/at_home discovery now includes vendor_identity records" -ForegroundColor White
    Write-Host "  - Solo providers in vendor_identity will appear in discovery" -ForegroundColor White
    Write-Host ""
    Write-Host "Test the fix:" -ForegroundColor Yellow
    Write-Host "  curl `"https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/customer/discover-services?category=vet&serviceStyle=tele`"" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "Error updating Lambda function: $_" -ForegroundColor Red
    exit 1
}
