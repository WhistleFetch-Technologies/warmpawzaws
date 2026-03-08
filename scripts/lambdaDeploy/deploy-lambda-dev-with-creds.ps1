# ============================================================================
# Deploy Lambda to Dev Environment with AWS Credentials
# ============================================================================
# This script deploys the Lambda function to dev using provided AWS credentials
# Target: warmpawz-api-dev-api (nodejs18.x)
# API Gateway: z0b3obweb6 (warmpawz-dev-api)
# ============================================================================

param(
    [string]$Region = "ap-south-1",
    [string]$LambdaFunctionName = "warmpawz-api-dev-api",
    [string]$ApiGatewayId = "z0b3obweb6"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Deploying Lambda to Dev Environment" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Lambda Function: $LambdaFunctionName" -ForegroundColor Gray
Write-Host "  API Gateway ID: $ApiGatewayId" -ForegroundColor Gray
Write-Host "  Region: $Region" -ForegroundColor Gray
Write-Host ""

# Verify AWS credentials are configured
Write-Host "Step 0: Verifying AWS credentials..." -ForegroundColor Yellow
try {
    $identity = aws sts get-caller-identity --region $Region --output json 2>&1 | ConvertFrom-Json
    Write-Host "  ✅ AWS credentials verified" -ForegroundColor Green
    Write-Host "  Account: $($identity.Account)" -ForegroundColor Gray
    Write-Host "  User/Role: $($identity.Arn)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Failed to verify AWS credentials" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Verify Lambda function exists
Write-Host "Step 1: Verifying Lambda function exists..." -ForegroundColor Yellow
try {
    $lambdaInfo = aws lambda get-function --function-name $LambdaFunctionName --region $Region --output json 2>&1 | ConvertFrom-Json
    Write-Host "  ✅ Lambda function found" -ForegroundColor Green
    Write-Host "  Runtime: $($lambdaInfo.Configuration.Runtime)" -ForegroundColor Gray
    Write-Host "  Handler: $($lambdaInfo.Configuration.Handler)" -ForegroundColor Gray
    Write-Host "  Last Modified: $($lambdaInfo.Configuration.LastModified)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Lambda function not found: $LambdaFunctionName" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Navigate to Lambda directory
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$lambdaDir = Join-Path $scriptRoot "..\backend\lambda"
if (!(Test-Path $lambdaDir)) {
    Write-Host "❌ Lambda directory not found: $lambdaDir" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Building Lambda..." -ForegroundColor Yellow
Write-Host "  Directory: $lambdaDir" -ForegroundColor Gray
Set-Location $lambdaDir

# Install dependencies if needed
if (!(Test-Path "node_modules")) {
    Write-Host "  Installing dependencies..." -ForegroundColor Gray
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ npm install failed!" -ForegroundColor Red
        exit 1
    }
}

# Build Lambda
Write-Host "  Running: npm run build" -ForegroundColor Gray
$buildOutput = npm run build 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Build failed!" -ForegroundColor Red
    Write-Host $buildOutput
    exit 1
}

Write-Host "  ✅ Build successful" -ForegroundColor Green

# Verify build output
$zipPath = Join-Path $lambdaDir "api-handler.zip"
if (!(Test-Path $zipPath)) {
    Write-Host "  ❌ Deployment package not found: $zipPath" -ForegroundColor Red
    exit 1
}

$zipSize = (Get-Item $zipPath).Length / 1MB
Write-Host "  Package size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Gray
Write-Host ""

# Deploy to Lambda
Write-Host "Step 3: Deploying to $LambdaFunctionName..." -ForegroundColor Yellow
Write-Host "  Region: $Region" -ForegroundColor Gray
Write-Host "  Uploading package..." -ForegroundColor Gray

try {
    $result = aws lambda update-function-code `
        --function-name $LambdaFunctionName `
        --zip-file "fileb://$zipPath" `
        --region $Region `
        --output json 2>&1 | ConvertFrom-Json

    if ($result.LastModified) {
        Write-Host ""
        Write-Host "  ✅ Deployment successful!" -ForegroundColor Green
        Write-Host "  Function Name: $($result.FunctionName)" -ForegroundColor Gray
        Write-Host "  Last Modified: $($result.LastModified)" -ForegroundColor Gray
        Write-Host "  Code Size: $([math]::Round($result.CodeSize / 1MB, 2)) MB" -ForegroundColor Gray
        Write-Host "  Runtime: $($result.Runtime)" -ForegroundColor Gray
        Write-Host "  Version: $($result.Version)" -ForegroundColor Gray
    } else {
        Write-Host "  ❌ Deployment failed - no LastModified in response" -ForegroundColor Red
        Write-Host $result | ConvertTo-Json -Depth 5
        exit 1
    }
} catch {
    Write-Host "  ❌ Deployment failed!" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Wait for Lambda to be ready
Write-Host "Step 4: Waiting for Lambda to be ready..." -ForegroundColor Yellow
try {
    aws lambda wait function-updated `
        --function-name $LambdaFunctionName `
        --region $Region 2>&1 | Out-Null
    Write-Host "  ✅ Lambda is ready" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️ Could not verify Lambda readiness (non-fatal)" -ForegroundColor Yellow
}
Write-Host ""

# Verify API Gateway integration
Write-Host "Step 5: Verifying API Gateway integration..." -ForegroundColor Yellow
try {
    $integrations = aws apigatewayv2 get-integrations --api-id $ApiGatewayId --region $Region --output json 2>&1 | ConvertFrom-Json
    $lambdaIntegration = $integrations.Items | Where-Object { $_.IntegrationUri -like "*$LambdaFunctionName*" } | Select-Object -First 1
    
    if ($lambdaIntegration) {
        Write-Host "  ✅ API Gateway integration verified" -ForegroundColor Green
        Write-Host "  Integration URI: $($lambdaIntegration.IntegrationUri)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠️ Could not find API Gateway integration (non-fatal)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️ Could not verify API Gateway integration (non-fatal)" -ForegroundColor Yellow
}
Write-Host ""

# Test API endpoint (optional)
Write-Host "Step 6: Testing API endpoint..." -ForegroundColor Yellow
$testUrl = "https://$ApiGatewayId.execute-api.$Region.amazonaws.com/customer/services/by-style?style=at_home&category=vet"
Write-Host "  URL: $testUrl" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $testUrl -Method GET -ErrorAction Stop -TimeoutSec 10
    Write-Host "  ✅ API is responding" -ForegroundColor Green
    if ($response.providers) {
        Write-Host "  Providers returned: $($response.providers.Count)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ⚠️ Could not test API (non-fatal): $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "✅ Lambda deployed to dev environment!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Deployment Summary:" -ForegroundColor Cyan
Write-Host "  Lambda Function: $LambdaFunctionName" -ForegroundColor White
Write-Host "  API Gateway: $ApiGatewayId" -ForegroundColor White
Write-Host "  Region: $Region" -ForegroundColor White
Write-Host "  API Endpoint: https://$ApiGatewayId.execute-api.$Region.amazonaws.com" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Test the API endpoint" -ForegroundColor White
Write-Host "2. Check CloudWatch logs for any errors" -ForegroundColor White
Write-Host "3. Verify the deployment in AWS Console" -ForegroundColor White
Write-Host ""
