# PowerShell script to deploy Lambda with admin login body parsing fix
# Usage: .\scripts\deploy-admin-login-fix-prod.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying Lambda with Admin Login Fix..." -ForegroundColor Blue
Write-Host ""

# Configuration
$LAMBDA_FUNCTION_NAME = "warmpawz-prod-api-handler"
$AWS_REGION = "ap-south-1"
$PROJECT_ROOT = $PSScriptRoot | Split-Path -Parent
$LAMBDA_DIR = Join-Path $PROJECT_ROOT "backend" "lambda"

# Step 1: Build Lambda
Write-Host "📦 Building Lambda..." -ForegroundColor Blue
Push-Location $LAMBDA_DIR

try {
    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-Host "   Installing dependencies..." -ForegroundColor Yellow
        npm install
    }

    # Build TypeScript
    Write-Host "   Building TypeScript..." -ForegroundColor Yellow
    npm run build

    if (-not (Test-Path "api-handler.zip")) {
        Write-Host "❌ Error: api-handler.zip not found after build!" -ForegroundColor Red
        Write-Host "   Run: npm run package" -ForegroundColor Yellow
        exit 1
    }

    $zipSize = (Get-Item "api-handler.zip").Length / 1MB
    Write-Host "✅ Lambda built successfully" -ForegroundColor Green
    Write-Host "   Package size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan
    Write-Host ""

    # Step 2: Update Lambda function code
    Write-Host "📤 Uploading Lambda function code..." -ForegroundColor Blue
    try {
        $updateResult = aws lambda update-function-code `
            --function-name $LAMBDA_FUNCTION_NAME `
            --zip-file "fileb://api-handler.zip" `
            --region $AWS_REGION `
            --output json | ConvertFrom-Json

        Write-Host "✅ Lambda updated successfully" -ForegroundColor Green
        Write-Host "   Function: $LAMBDA_FUNCTION_NAME"
        Write-Host "   ARN: $($updateResult.FunctionArn)"
        Write-Host "   Version: $($updateResult.Version)"
        Write-Host ""

        # Wait for update to complete
        Write-Host "⏳ Waiting for Lambda update to complete..." -ForegroundColor Blue
        aws lambda wait function-updated `
            --function-name $LAMBDA_FUNCTION_NAME `
            --region $AWS_REGION

        Write-Host "✅ Lambda is ready" -ForegroundColor Green
        Write-Host ""

    } catch {
        Write-Host "❌ Lambda update failed: $_" -ForegroundColor Red
        exit 1
    }

} finally {
    Pop-Location
}

Write-Host "✅ Lambda deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Changes Deployed:" -ForegroundColor Yellow
Write-Host "   ✅ Fixed body parsing in /admin/auth/login endpoint"
Write-Host "   ✅ Added createApiGatewayEventWithBody function"
Write-Host ""
Write-Host "🧪 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Run: node scripts/setup-admin-account.js --env=prod (with DB_PASSWORD)"
Write-Host "   2. Test: node scripts/test-admin-login-prod.js"
Write-Host ""
