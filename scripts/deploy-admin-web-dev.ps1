# Direct AWS CLI deployment script for admin-web (DEV)
# Usage: .\scripts\deploy-admin-web-dev.ps1 [-DeployOnly]
#   -DeployOnly  Skip build; inject config and upload existing dist (fails if dist missing).
#
# This script deploys to DEV environment!

param(
    [switch]$DeployOnly
)

$ErrorActionPreference = "Stop"

Write-Host "Deploying admin-web to AWS dev environment..." -ForegroundColor Cyan

# Configuration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$APP_NAME = "admin-web"
$S3_BUCKET = "warmpawz-dev-admin-frontend-ap-south-1"
$CLOUDFRONT_DIST_ID = "E1WPXL8WBOWOE8"
$CLOUDFRONT_URL = "https://dfof7mguaa0a5.cloudfront.net"
$ALTERNATE_DOMAIN = "dev.admin.warmpawz.com"
$REGION = "ap-south-1"
$API_BASE_URL = "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"  # Dev API Gateway

# Verify API endpoint
if ([string]::IsNullOrEmpty($API_BASE_URL)) {
    Write-Host "Getting API endpoint from AWS..." -ForegroundColor Yellow
    try {
        $apis = aws apigatewayv2 get-apis --region $REGION --output json | ConvertFrom-Json
        $api = $apis.Items | Where-Object { $_.Name -eq "warmpawz-dev-api" } | Select-Object -First 1
        if ($api -and $api.ApiEndpoint) {
            $API_BASE_URL = $api.ApiEndpoint
        }
    } catch {
        Write-Host "Error: Could not get API Gateway endpoint" -ForegroundColor Red
        exit 1
    }
}
$API_BASE_URL = $API_BASE_URL.TrimEnd('/')

Write-Host "Dev Configuration:" -ForegroundColor Blue
Write-Host "   S3 Bucket: $S3_BUCKET"
Write-Host "   CloudFront ID: $CLOUDFRONT_DIST_ID"
Write-Host "   CloudFront URL: $CLOUDFRONT_URL"
Write-Host "   Alternate Domain: $ALTERNATE_DOMAIN"
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

    # Build with retry on failure
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

$runtimeConfig = "// Runtime Configuration for Warmpawz $APP_NAME (DEV)`n" +
"// Injected at deployment - API base is API Gateway (backend), not CloudFront`n" +
"(function() {`n" +
"  window.__WARMPAWZ_RUNTIME_CONFIG__ = {`n" +
"    apiBaseUrl: `"$API_BASE_URL`",`n" +
"    uatMode: true,`n" +
"    environment: `"development`"`n" +
"  };`n" +
"  console.log('Runtime config loaded (DEV):', window.__WARMPAWZ_RUNTIME_CONFIG__);`n" +
"})();`n"

$runtimeConfig | Out-File -FilePath "apps\$APP_NAME\dist\runtime-config.js" -Encoding utf8 -NoNewline

Write-Host "runtime-config.js injected (apiBaseUrl -> API Gateway)" -ForegroundColor Green

# Step 1.6: Replace inline runtime-config in HTML files
Write-Host "Replacing inline runtime-config in HTML files..." -ForegroundColor Blue
$INLINE_CONFIG = "window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: '$API_BASE_URL', uatMode: true, environment: 'development' };"
Get-ChildItem -Path "apps\$APP_NAME\dist" -Filter "*.html" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'runtime-config-inline') {
        $content = $content -replace "window\.__WARMPAWZ_RUNTIME_CONFIG__ = \{[^}]+\};", $INLINE_CONFIG
        $content | Set-Content $_.FullName -NoNewline
    }
}
Write-Host "Inline runtime-config replaced in HTML files (dev values)" -ForegroundColor Green

# Step 2: Deploy to S3
Write-Host "Uploading to S3 bucket: $S3_BUCKET..." -ForegroundColor Blue
aws s3 sync "apps\$APP_NAME\dist\" "s3://$S3_BUCKET/" --delete --exclude "*.map" --region $REGION

# Upload runtime-config.js with no-cache headers
Write-Host "Uploading runtime-config.js with no-cache headers..." -ForegroundColor Blue
aws s3 cp "apps\$APP_NAME\dist\runtime-config.js" "s3://$S3_BUCKET/runtime-config.js" `
    --content-type "application/javascript" `
    --cache-control "no-cache, no-store, must-revalidate" `
    --metadata-directive REPLACE `
    --region $REGION

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
    --output text `
    --region $REGION

if ($LASTEXITCODE -eq 0) {
    Write-Host "CloudFront invalidation created: $INVALIDATION_ID" -ForegroundColor Green
    Write-Host "Full propagation may take 5-15 minutes" -ForegroundColor Yellow
} else {
    Write-Host "Warning: CloudFront invalidation failed (but files are uploaded)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "DEV DEPLOYMENT COMPLETED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployment Summary:"
Write-Host "   ${APP_NAME}: Built successfully"
Write-Host "   S3 Upload: Synced to $S3_BUCKET"
Write-Host "   CloudFront: Cache invalidation created ($INVALIDATION_ID)"
Write-Host ""
Write-Host "Access URLs:"
Write-Host "   - Admin Web (DEV): $CLOUDFRONT_URL"
Write-Host "   - Alternate Domain: https://$ALTERNATE_DOMAIN"
Write-Host "   - Direct S3: s3://$S3_BUCKET"
Write-Host ""
Write-Host "Next Steps:"
Write-Host "   1. Wait 5-15 minutes for CloudFront propagation"
Write-Host "   2. Test the deployed application at $CLOUDFRONT_URL"
Write-Host "   3. Verify API calls are using: $API_BASE_URL"
Write-Host ""
