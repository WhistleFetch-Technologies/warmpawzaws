# ============================================================================
# Fix CORS Issue for Production Lambda
# ============================================================================
# This script updates the Lambda ALLOWED_ORIGINS environment variable
# to include all origins from config/urls.json, including vendor.warmpawz.com
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Fixing CORS Issue - Production Lambda" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

$lambdaName = "warmpawz-prod-api-handler"
$region = "ap-south-1"

# Read allowed origins from config/urls.json
$configPath = Join-Path $PSScriptRoot "..\config\urls.json"
if (!(Test-Path $configPath)) {
    Write-Host "❌ config/urls.json not found: $configPath" -ForegroundColor Red
    exit 1
}

Write-Host "Reading allowed origins from config/urls.json..." -ForegroundColor Yellow
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$allowedOrigins = ($config.allowedOrigins | ForEach-Object { $_ }) -join ','

Write-Host "  ✅ Found $($config.allowedOrigins.Count) allowed origins" -ForegroundColor Green
if ($config.allowedOrigins -contains "https://vendor.warmpawz.com") {
    Write-Host "  ✅ https://vendor.warmpawz.com is included" -ForegroundColor Green
} else {
    Write-Host "  ❌ https://vendor.warmpawz.com is NOT included" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Create environment JSON file
Write-Host "Creating environment configuration..." -ForegroundColor Yellow
$envJson = @{
    Variables = @{
        ALLOWED_ORIGINS = $allowedOrigins
    }
} | ConvertTo-Json -Depth 10

$envFile = Join-Path $env:TEMP "lambda-env-prod.json"
$envJson | Out-File -FilePath $envFile -Encoding UTF8 -NoNewline
Write-Host "  ✅ Environment JSON created: $envFile" -ForegroundColor Green
Write-Host ""

# Update Lambda environment variable
Write-Host "Updating Lambda environment variable..." -ForegroundColor Yellow
Write-Host "  Function: $lambdaName" -ForegroundColor Gray
Write-Host "  Region: $region" -ForegroundColor Gray
Write-Host ""

try {
    $result = aws lambda update-function-configuration `
        --function-name $lambdaName `
        --region $region `
        --environment "file://$envFile" `
        --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $lambda = $result | ConvertFrom-Json
        Write-Host "  ✅ Lambda environment variable updated successfully!" -ForegroundColor Green
        Write-Host "  Function: $($lambda.FunctionName)" -ForegroundColor Gray
        Write-Host "  Last Modified: $($lambda.LastModified)" -ForegroundColor Gray
        Write-Host "  Runtime: $($lambda.Runtime)" -ForegroundColor Gray
        Write-Host ""
        
        if ($lambda.Environment -and $lambda.Environment.Variables -and $lambda.Environment.Variables.ALLOWED_ORIGINS) {
            Write-Host "  ✅ ALLOWED_ORIGINS is now set" -ForegroundColor Green
            $setOrigins = $lambda.Environment.Variables.ALLOWED_ORIGINS -split ','
            Write-Host "  Total origins: $($setOrigins.Count)" -ForegroundColor Gray
            if ($setOrigins -contains "https://vendor.warmpawz.com") {
                Write-Host "  ✅ https://vendor.warmpawz.com is included" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "  ❌ Failed to update Lambda environment variable" -ForegroundColor Red
        Write-Host "  Error: $result" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Error updating Lambda: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Clean up temp file
    if (Test-Path $envFile) {
        Remove-Item $envFile -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "✅ CORS Fix Applied" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Wait 30-60 seconds for Lambda to update" -ForegroundColor White
Write-Host "  2. Test OPTIONS request:" -ForegroundColor White
Write-Host "     curl -X OPTIONS \"https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/auth/send-otp\" \" -ForegroundColor Gray
Write-Host "       -H \"Origin: https://vendor.warmpawz.com\" \" -ForegroundColor Gray
Write-Host "       -H \"Access-Control-Request-Method: POST\"" -ForegroundColor Gray
Write-Host "  3. Expected: HTTP 200 OK (not 500)" -ForegroundColor Green
Write-Host "  4. Test the application at https://vendor.warmpawz.com" -ForegroundColor White
Write-Host ""
