# Direct AWS CLI deployment script for customer-web (PRODUCTION) - PowerShell Version
# Usage: .\prodscripts\deploy-customer-web-prod.ps1 [-DeployOnly] [-SkipConfirm]
#   -DeployOnly  Skip build; inject config and upload existing dist (fails if dist missing).
#
# WARNING: This script deploys to PRODUCTION environment!

param(
    [switch]$DeployOnly,
    [switch]$SkipConfirm
)

$ErrorActionPreference = "Stop"

# Safety confirmation for PROD
if (-not $SkipConfirm) {
    Write-Host "WARNING: PRODUCTION DEPLOYMENT" -ForegroundColor Red
    Write-Host "This will deploy customer-web to PRODUCTION environment!" -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "Are you sure you want to continue? Type 'yes' to proceed"
    if ($confirm -ne "yes") {
        Write-Host "Deployment cancelled" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Deploying customer-web to AWS PRODUCTION environment..." -ForegroundColor Green

# Production Configuration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$APP_NAME = "customer-web"
$S3_BUCKET = "warmpawz-prod-customer-frontend-ap-south-1"
$CLOUDFRONT_DIST_ID = "E2F29N49KVOOBP"
$CLOUDFRONT_URL = "https://dg69gqp2frh39.cloudfront.net"
$API_BASE_URL = "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"

# Verify API endpoint
if ([string]::IsNullOrEmpty($API_BASE_URL)) {
    Write-Host "Getting API endpoint from AWS..." -ForegroundColor Yellow
    $API_BASE_URL = aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-prod-api'].ApiEndpoint" --output text 2>&1 | Select-Object -First 1
    if ([string]::IsNullOrEmpty($API_BASE_URL) -or $API_BASE_URL -eq "None") {
        Write-Host "Error: Could not get API Gateway endpoint" -ForegroundColor Red
        exit 1
    }
}
$API_BASE_URL = $API_BASE_URL.TrimEnd('/')

Write-Host "Production Configuration:" -ForegroundColor Blue
Write-Host "   S3 Bucket: $S3_BUCKET"
Write-Host "   CloudFront ID: $CLOUDFRONT_DIST_ID"
Write-Host "   CloudFront URL: $CLOUDFRONT_URL"
Write-Host "   Alternate Domain: customer.warmpawz.com"
Write-Host "   API Endpoint: $API_BASE_URL"
Write-Host ""

Set-Location $PROJECT_ROOT

# Step 1: Build the app
Set-Location "apps\$APP_NAME"
if ($DeployOnly -and (Test-Path "dist")) {
    Write-Host "Skipping build (-DeployOnly, dist exists)" -ForegroundColor Green
} else {
    Write-Host "Building $APP_NAME..." -ForegroundColor Blue
    # Clean stale build artifacts
    Write-Host "Cleaning stale build artifacts..." -ForegroundColor Blue
    if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    if (Test-Path "node_modules\.cache") { Remove-Item -Recurse -Force "node_modules\.cache" }
    Start-Sleep -Seconds 2

    $env:NEXT_PUBLIC_ENVIRONMENT = 'production'
    $env:NEXT_PUBLIC_API_BASE_URL = $API_BASE_URL
    $env:NEXT_PUBLIC_FIREBASE_VAPID_KEY = 'BBYvLo7VKgqxQf5reB_dduYQlMYt8447__prjBMxQxfgROeLHYzLuHkKkA99FO2G0fzC4MlG2VbvVNSS-PnnYMw'
    $env:NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED = 'true'
    $env:NEXT_PUBLIC_CUSTOMER_MEAL_PLANS_ENABLED = 'true'

    # Build with retry on failure (prod NEXT_PUBLIC_* baked into static export)
    try {
        npm run build
    } catch {
        Write-Host "First build failed, retrying with full clean..." -ForegroundColor Yellow
        if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
        if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
        if (Test-Path "node_modules\.cache") { Remove-Item -Recurse -Force "node_modules\.cache" }
        Start-Sleep -Seconds 3
        npm run build
    }

    if (-not (Test-Path "dist")) {
        Write-Host "Error: dist directory not found after build!" -ForegroundColor Red
        exit 1
    }

    Write-Host "Build completed successfully" -ForegroundColor Green
}

# Step 1.5: Inject runtime-config.js
Write-Host "Injecting runtime-config.js..." -ForegroundColor Blue
Set-Location $PROJECT_ROOT

$runtimeConfig = "// Runtime Configuration for Warmpawz $APP_NAME (PRODUCTION)`n" +
"// Injected at deployment - API base is API Gateway (backend), not CloudFront`n" +
"(function() {`n" +
"  window.__WARMPAWZ_RUNTIME_CONFIG__ = {`n" +
"    apiBaseUrl: `"$API_BASE_URL`",`n" +
"    uatMode: false,`n" +
"    environment: `"production`",`n" +
"    customerEcommerceEnabled: true,`n" +
"    customerMealPlansEnabled: true`n" +
"  };`n" +
"  console.log('Runtime config loaded (PROD):', window.__WARMPAWZ_RUNTIME_CONFIG__);`n" +
"})();`n"

$runtimeConfig | Out-File -FilePath "apps\$APP_NAME\dist\runtime-config.js" -Encoding utf8 -NoNewline

Write-Host "runtime-config.js injected (apiBaseUrl -> API Gateway)" -ForegroundColor Green

# Step 1.6: Replace inline runtime-config in HTML files
Write-Host "Replacing inline runtime-config in HTML files..." -ForegroundColor Blue
$INLINE_CONFIG = "window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: '$API_BASE_URL', uatMode: false, environment: 'production', customerEcommerceEnabled: true, customerMealPlansEnabled: true };"
Get-ChildItem -Path "apps\$APP_NAME\dist" -Filter "*.html" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'runtime-config-inline') {
        $content = $content -replace "window\.__WARMPAWZ_RUNTIME_CONFIG__ = \{[^}]+\};", $INLINE_CONFIG
        $content | Set-Content $_.FullName -NoNewline
    }
}
Write-Host "Inline runtime-config replaced in HTML files (production values)" -ForegroundColor Green

# Step 2: Deploy to S3
Write-Host "Uploading to S3 bucket: $S3_BUCKET..." -ForegroundColor Blue
aws s3 sync "apps\$APP_NAME\dist\" "s3://$S3_BUCKET/" --delete --exclude "*.map"

# Upload runtime-config.js with no-cache headers
Write-Host "Uploading runtime-config.js with no-cache headers..." -ForegroundColor Blue
aws s3 cp "apps\$APP_NAME\dist\runtime-config.js" "s3://$S3_BUCKET/runtime-config.js" `
    --content-type "application/javascript" `
    --cache-control "no-cache, no-store, must-revalidate" `
    --metadata-directive REPLACE

if ($LASTEXITCODE -eq 0) {
    Write-Host "S3 upload completed successfully" -ForegroundColor Green
} else {
    Write-Host "Error: S3 upload failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Invalidate CloudFront cache
Write-Host "Invalidating CloudFront cache..." -ForegroundColor Blue
$INVALIDATION_ID = aws cloudfront create-invalidation `
    --distribution-id $CLOUDFRONT_DIST_ID `
    --paths "/*" `
    --query 'Invalidation.Id' `
    --output text

if ($LASTEXITCODE -eq 0) {
    Write-Host "CloudFront invalidation created: $INVALIDATION_ID" -ForegroundColor Green
    Write-Host "Full propagation may take 5-15 minutes" -ForegroundColor Yellow
} else {
    Write-Host "Warning: CloudFront invalidation failed (but files are uploaded)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "PRODUCTION DEPLOYMENT COMPLETED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployment Summary:"
Write-Host "   ${APP_NAME}: Built successfully"
Write-Host "   S3 Upload: Synced to $S3_BUCKET"
Write-Host "   CloudFront: Cache invalidation created ($INVALIDATION_ID)"
Write-Host ""
Write-Host "Access URLs:"
Write-Host "   - Customer Web (PROD): $CLOUDFRONT_URL"
Write-Host "   - Alternate Domain: https://customer.warmpawz.com"
Write-Host "   - Direct S3: s3://$S3_BUCKET"
Write-Host ""
Write-Host "Next Steps:"
Write-Host "   1. Wait 5-15 minutes for CloudFront propagation"
Write-Host "   2. Test the deployed application at $CLOUDFRONT_URL"
Write-Host "   3. Verify all features work correctly in production"
Write-Host ""
