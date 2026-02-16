# ============================================================================
# Deploy Database Connection Fix to Production Lambda
# ============================================================================
# Fixes: RDS Proxy statement_timeout incompatibility
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying Database Connection Fix to Production..." -ForegroundColor Cyan
Write-Host ""

# Configuration
$LAMBDA_FUNCTION_NAME = "warmpawz-prod-api-handler"
$AWS_REGION = "ap-south-1"
$LAMBDA_ZIP = "api-handler.zip"

# Step 1: Navigate to Lambda directory
Write-Host "📦 Building Lambda..." -ForegroundColor Blue
$LAMBDA_DIR = Join-Path $PSScriptRoot "..\backend\lambda"
Push-Location $LAMBDA_DIR

try {
    # Step 2: Install dependencies (if needed)
    if (-not (Test-Path "node_modules")) {
        Write-Host "   Installing dependencies..." -ForegroundColor Yellow
        npm install
    }

    # Step 3: Build Lambda
    Write-Host "   Building TypeScript and bundling..." -ForegroundColor Yellow
    npm run build

    if (-not (Test-Path $LAMBDA_ZIP)) {
        Write-Host "❌ Error: $LAMBDA_ZIP not found after build!" -ForegroundColor Red
        exit 1
    }

    $zipSize = (Get-Item $LAMBDA_ZIP).Length / 1MB
    Write-Host "✅ Lambda built successfully" -ForegroundColor Green
    Write-Host "   Package size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan
    Write-Host ""

    # Step 4: Update Lambda function code
    Write-Host "📤 Uploading Lambda function code..." -ForegroundColor Blue
    $updateResult = aws lambda update-function-code `
        --function-name $LAMBDA_FUNCTION_NAME `
        --zip-file "fileb://$LAMBDA_ZIP" `
        --region $AWS_REGION `
        2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Lambda updated successfully" -ForegroundColor Green
        
        # Get function details
        $functionInfo = aws lambda get-function `
            --function-name $LAMBDA_FUNCTION_NAME `
            --region $AWS_REGION `
            --query 'Configuration.{Version:Version,LastModified:LastModified}' `
            --output json | ConvertFrom-Json
        
        Write-Host "   Function: $LAMBDA_FUNCTION_NAME" -ForegroundColor Cyan
        Write-Host "   Version: $($functionInfo.Version)" -ForegroundColor Cyan
        Write-Host "   Last Modified: $($functionInfo.LastModified)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Lambda update failed:" -ForegroundColor Red
        Write-Host $updateResult
        exit 1
    }
    Write-Host ""

    # Step 5: Wait for Lambda to be ready
    Write-Host "⏳ Waiting for Lambda to be ready..." -ForegroundColor Blue
    Start-Sleep -Seconds 5
    
    # Wait for function to be updated
    $maxWait = 60
    $waited = 0
    while ($waited -lt $maxWait) {
        $status = aws lambda get-function `
            --function-name $LAMBDA_FUNCTION_NAME `
            --region $AWS_REGION `
            --query 'Configuration.LastUpdateStatus' `
            --output text
        
        if ($status -eq "Successful") {
            Write-Host "✅ Lambda is ready" -ForegroundColor Green
            break
        } elseif ($status -eq "Failed") {
            Write-Host "❌ Lambda update failed" -ForegroundColor Red
            exit 1
        }
        
        Start-Sleep -Seconds 2
        $waited += 2
        Write-Host "   Status: $status (waited $waited seconds)..." -ForegroundColor Yellow
    }
    
    if ($waited -ge $maxWait) {
        Write-Host "⚠️  Timeout waiting for Lambda update" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "✅ Lambda deployment complete!" -ForegroundColor Green
    Write-Host ""

    # Summary
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║   ✅ DATABASE CONNECTION FIX DEPLOYED                         ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "📦 Deployment Summary:" -ForegroundColor Cyan
    Write-Host "   ✅ Lambda: $LAMBDA_FUNCTION_NAME" -ForegroundColor Green
    Write-Host "   ✅ Fix: Removed statement_timeout for RDS Proxy compatibility" -ForegroundColor Green
    Write-Host "   ✅ Region: $AWS_REGION" -ForegroundColor Green
    Write-Host ""
    Write-Host "🧪 Testing health endpoint..." -ForegroundColor Cyan
    Write-Host "   URL: https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/health" -ForegroundColor Yellow
    Write-Host ""
    
    # Test the health endpoint
    Start-Sleep -Seconds 3
    try {
        $response = Invoke-WebRequest `
            -Uri "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/health" `
            -Method GET `
            -TimeoutSec 35 `
            -ErrorAction Stop
        
        $healthData = $response.Content | ConvertFrom-Json
        $statusColor = if ($response.StatusCode -eq 200) { "Green" } else { "Yellow" }
        $apiColor = if ($healthData.status -eq "healthy") { "Green" } else { "Yellow" }
        $dbColor = if ($healthData.database.connected) { "Green" } else { "Red" }
        Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor $statusColor
        Write-Host "   API Status: $($healthData.status)" -ForegroundColor $apiColor
        Write-Host "   Database: $($healthData.database.connected)" -ForegroundColor $dbColor
        
        if ($healthData.database.connected) {
            Write-Host ""
            Write-Host "✅ Database connection is working!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "⚠️  Database connection still failing. Check CloudWatch logs." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠️  Health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }

} finally {
    Pop-Location
}
