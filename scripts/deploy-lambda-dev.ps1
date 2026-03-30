# ============================================================================
# Deploy Lambda to Dev Environment
# ============================================================================
# This script identifies the dev Lambda function and deploys the latest code
# to enable the "Next Available Slot" feature in dev/UAT mode

param(
    [string]$Region = "ap-south-1",
    [string]$DevApiId = "z0b3obweb6",
    [string]$LambdaFunctionName = ""
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Deploying Lambda to Dev Environment" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Identify Dev Lambda Function
Write-Host "Step 1: Identifying Dev Lambda Function..." -ForegroundColor Yellow
Write-Host "  API Gateway ID: $DevApiId" -ForegroundColor Gray

$lambdaName = $null
if ($LambdaFunctionName) {
    $lambdaName = $LambdaFunctionName
    Write-Host "  Using explicit function name: $lambdaName" -ForegroundColor Green
}

if (-not $lambdaName) {
    try {
        Write-Host "  Querying API Gateway integrations..." -ForegroundColor Gray
        $integrations = aws apigatewayv2 get-integrations --api-id $DevApiId --region $Region --output json 2>&1 | ConvertFrom-Json

        if ($integrations.Items -and $integrations.Items.Count -gt 0) {
            # Prefer an integration whose Lambda actually exists (stale integrations may point at deleted functions).
            foreach ($item in $integrations.Items) {
                $uri = $item.IntegrationUri
                if ($uri -notmatch 'function:([^/]+)') { continue }
                $candidate = $matches[1]
                aws lambda get-function --function-name $candidate --region $Region --output json 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    $lambdaName = $candidate
                    Write-Host "  ✅ Found Lambda Function (from API integration): $lambdaName" -ForegroundColor Green
                    break
                }
            }
        }
    } catch {
        Write-Host "  ⚠️ Could not auto-detect Lambda function from API Gateway" -ForegroundColor Yellow
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Fallback: Try common dev Lambda function names
if (!$lambdaName) {
    Write-Host ""
    Write-Host "  Trying common dev Lambda function names..." -ForegroundColor Yellow
    $commonNames = @(
        "warmpawz-dev-api-handler",
        "warmpawz-dev-api",
        "warmpawz-api-handler-dev",
        "warmpawz-api-dev"
    )
    
    foreach ($name in $commonNames) {
        try {
            $result = aws lambda get-function --function-name $name --region $Region --output json 2>&1
            if ($LASTEXITCODE -eq 0) {
                $lambdaName = $name
                Write-Host "  ✅ Found Lambda Function: $lambdaName" -ForegroundColor Green
                break
            }
        } catch {
            # Continue to next name
        }
    }
}

if (!$lambdaName) {
    Write-Host ""
    Write-Host "  ❌ Could not identify dev Lambda function automatically" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Please provide the Lambda function name manually:" -ForegroundColor Yellow
    Write-Host "  .\deploy-lambda-dev.ps1 -LambdaFunctionName 'warmpawz-dev-api-handler'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Or list all Lambda functions:" -ForegroundColor Yellow
    Write-Host "  aws lambda list-functions --region $Region | Select-String 'warmpawz'" -ForegroundColor Cyan
    exit 1
}

Write-Host ""

# Step 2: Navigate to Lambda directory
$lambdaDir = Join-Path $PSScriptRoot "..\backend\lambda"
if (!(Test-Path $lambdaDir)) {
    Write-Host "❌ Lambda directory not found: $lambdaDir" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Building Lambda..." -ForegroundColor Yellow
Write-Host "  Directory: $lambdaDir" -ForegroundColor Gray
Set-Location $lambdaDir

# Step 3: Build Lambda
Write-Host "  Running: npm run build:bundle" -ForegroundColor Gray
$buildOutput = npm run build:bundle 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Build failed!" -ForegroundColor Red
    Write-Host $buildOutput
    exit 1
}

Write-Host "  ✅ Build successful" -ForegroundColor Green

# Step 4: Create Deployment Package
Write-Host ""
Write-Host "Step 3: Creating deployment package..." -ForegroundColor Yellow

$handlerPath = Join-Path $lambdaDir "dist\handler.js"
$zipPath = Join-Path $lambdaDir "dist\lambda-dev.zip"

if (!(Test-Path $handlerPath)) {
    Write-Host "  ❌ Handler file not found: $handlerPath" -ForegroundColor Red
    exit 1
}

Write-Host "  Compressing: $handlerPath" -ForegroundColor Gray
Compress-Archive -Path $handlerPath -DestinationPath $zipPath -Force

if (!(Test-Path $zipPath)) {
    Write-Host "  ❌ Failed to create zip file" -ForegroundColor Red
    exit 1
}

$zipSize = (Get-Item $zipPath).Length / 1MB
Write-Host "  ✅ Package created: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Green

# Step 5: Deploy to Dev Lambda
Write-Host ""
Write-Host "Step 4: Deploying to $lambdaName..." -ForegroundColor Yellow
Write-Host "  Region: $Region" -ForegroundColor Gray

try {
    $result = aws lambda update-function-code `
        --function-name $lambdaName `
        --zip-file fileb://$zipPath `
        --region $Region `
        --output json 2>&1 | ConvertFrom-Json

    if ($result.LastModified) {
        Write-Host ""
        Write-Host "  ✅ Deployment successful!" -ForegroundColor Green
        Write-Host "  Function Name: $($result.FunctionName)" -ForegroundColor Gray
        Write-Host "  Last Modified: $($result.LastModified)" -ForegroundColor Gray
        Write-Host "  Code Size: $([math]::Round($result.CodeSize / 1MB, 2)) MB" -ForegroundColor Gray
        Write-Host "  Runtime: $($result.Runtime)" -ForegroundColor Gray
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

# Step 6: Verification
Write-Host ""
Write-Host "Step 5: Verifying deployment..." -ForegroundColor Yellow

Write-Host "  Testing API endpoint..." -ForegroundColor Gray
$testUrl = "https://$DevApiId.execute-api.$Region.amazonaws.com/customer/services/by-style?style=at_home&category=vet"
Write-Host "  URL: $testUrl" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $testUrl -Method GET -ErrorAction Stop
    if ($response.providers -and $response.providers.Count -gt 0) {
        $hasNextAvailable = $response.providers | Where-Object { $_.nextAvailable } | Measure-Object
        Write-Host "  ✅ API is responding" -ForegroundColor Green
        Write-Host "  Providers returned: $($response.providers.Count)" -ForegroundColor Gray
        Write-Host "  Providers with nextAvailable: $($hasNextAvailable.Count)" -ForegroundColor Gray
        
        if ($hasNextAvailable.Count -eq 0) {
            Write-Host ""
            Write-Host "  ⚠️ WARNING: No providers have nextAvailable set" -ForegroundColor Yellow
            Write-Host "  This could mean:" -ForegroundColor Yellow
            Write-Host "    1. No vendors have availability configured in dev database" -ForegroundColor Yellow
            Write-Host "    2. All vendors were filtered out (no availability records)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  Check dev database for vendor_availability_v2 records" -ForegroundColor Cyan
        } else {
            $firstProvider = $response.providers | Where-Object { $_.nextAvailable } | Select-Object -First 1
            Write-Host "  Sample nextAvailable: $($firstProvider.nextAvailable.display)" -ForegroundColor Green
        }
    } else {
        Write-Host "  ⚠️ API responded but no providers returned" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️ Could not verify API (non-fatal): $($_.Exception.Message)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "✅ Lambda deployed to dev environment!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Test API: https://$DevApiId.execute-api.$Region.amazonaws.com/customer/services/by-style?style=at_home" -ForegroundColor White
Write-Host "2. Verify nextAvailable appears in response" -ForegroundColor White
Write-Host "3. Check frontend displays 'Next: ...' on provider cards" -ForegroundColor White
Write-Host "4. If no nextAvailable, check dev database for vendor_availability_v2 records" -ForegroundColor White
Write-Host ""
