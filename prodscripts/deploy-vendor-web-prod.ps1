# Direct AWS CLI deployment script for vendor-web (PRODUCTION)
# Usage: .\prodscripts\deploy-vendor-web-prod.ps1 [--deploy-only] [--yes]
#   --deploy-only  Skip build; use existing dist (fails if dist missing).
#   --yes          Skip confirmation prompt
#
# ⚠️  WARNING: This script deploys to PRODUCTION environment!
# Make sure you have tested in dev/staging before running this.

$ErrorActionPreference = "Stop"

# Parse command line arguments
$DEPLOY_ONLY = $false
$SKIP_CONFIRM = $false
foreach ($arg in $args) {
    if ($arg -eq "--deploy-only" -or $arg -eq "--skip-build") {
        $DEPLOY_ONLY = $true
    }
    if ($arg -eq "--yes" -or $arg -eq "-y") {
        $SKIP_CONFIRM = $true
    }
}

# Safety confirmation for PROD (skip if --yes flag is provided)
if (-not $SKIP_CONFIRM) {
    Write-Host "WARNING: PRODUCTION DEPLOYMENT" -ForegroundColor Red
    Write-Host "This will deploy vendor-web to PRODUCTION environment!" -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "Are you sure you want to continue? Type 'yes' to proceed"
    if ($confirm -ne "yes") {
        Write-Host "Deployment cancelled" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Deploying vendor-web to AWS PRODUCTION environment..." -ForegroundColor Cyan

# Production Configuration
$SCRIPT_DIR = $PSScriptRoot
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$APP_NAME = "vendor-web"
$S3_BUCKET = "warmpawz-prod-vendor-frontend-ap-south-1"
$CLOUDFRONT_DIST_ID = "E3JDHOY1XIFOWE"
$CLOUDFRONT_URL = "https://d1y5ywletev82x.cloudfront.net"
$API_BASE_URL = "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
$REGION = "ap-south-1"

# Verify API endpoint
if ([string]::IsNullOrEmpty($API_BASE_URL)) {
    Write-Host "Getting API endpoint from AWS..." -ForegroundColor Yellow
    try {
        $apis = aws apigatewayv2 get-apis --region $REGION --output json | ConvertFrom-Json
        $api = $apis.Items | Where-Object { $_.Name -eq "warmpawz-prod-api" } | Select-Object -First 1
        if ($api -and $api.ApiEndpoint) {
            $API_BASE_URL = $api.ApiEndpoint
        }
    } catch {
        Write-Host "Error: Could not get API Gateway endpoint" -ForegroundColor Red
        exit 1
    }
}

if ([string]::IsNullOrEmpty($API_BASE_URL)) {
    Write-Host "Error: API Gateway endpoint is required" -ForegroundColor Red
    exit 1
}

$API_BASE_URL = $API_BASE_URL.TrimEnd('/')

Write-Host "Production Configuration:" -ForegroundColor Blue
Write-Host "   S3 Bucket: $S3_BUCKET"
Write-Host "   CloudFront ID: $CLOUDFRONT_DIST_ID"
Write-Host "   CloudFront URL: $CLOUDFRONT_URL"
Write-Host "   API Endpoint: $API_BASE_URL"
Write-Host ""

# Step 1: Build the app
$APP_DIR = Join-Path (Join-Path $PROJECT_ROOT "apps") $APP_NAME
Set-Location $APP_DIR

if ($DEPLOY_ONLY -and (Test-Path "dist")) {
    Write-Host "Skipping build (--deploy-only, dist exists)" -ForegroundColor Green
} else {
    Write-Host "Building $APP_NAME..." -ForegroundColor Blue
    
    # Clean stale build artifacts to prevent issues
    Write-Host "Cleaning stale build artifacts..." -ForegroundColor Blue
    if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    if (Test-Path "node_modules\.cache") { Remove-Item -Recurse -Force "node_modules\.cache" }
    Start-Sleep -Seconds 2
    
    # Build with retry on failure
    $buildSuccess = $false
    try {
        npm run build
        $buildSuccess = $true
    } catch {
        Write-Host "First build failed, retrying with full clean..." -ForegroundColor Yellow
        if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
        if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
        if (Test-Path "node_modules\.cache") { Remove-Item -Recurse -Force "node_modules\.cache" }
        Start-Sleep -Seconds 3
        npm run build
        $buildSuccess = $true
    }
    
    if (-not (Test-Path "dist")) {
        Write-Host "Error: dist directory not found after build!" -ForegroundColor Red
        exit 1
    }
    
    # Verify critical files exist
    if (-not (Test-Path "dist\index.html")) {
        Write-Host "Error: dist\index.html not found!" -ForegroundColor Red
        exit 1
    }
    
    # Check if _next/static directory exists
    if (-not (Test-Path "dist\_next\static")) {
        Write-Host "Warning: dist\_next\static directory not found" -ForegroundColor Yellow
        Write-Host "   This might cause JavaScript loading issues" -ForegroundColor Yellow
    } else {
        $jsFiles = (Get-ChildItem -Path "dist\_next\static" -Filter "*.js" -Recurse).Count
        Write-Host "Found $jsFiles JavaScript files in build" -ForegroundColor Green
    }
    
    Write-Host "Build completed successfully" -ForegroundColor Green
}

# Step 1.5: Inject runtime-config.js with API Gateway URL
Write-Host "Injecting runtime-config.js..." -ForegroundColor Blue
Set-Location $PROJECT_ROOT

# Inject runtime-config.js into dist folder
$runtimeConfigPath = Join-Path (Join-Path $APP_DIR "dist") "runtime-config.js"
$runtimeConfigContent = @"
// Runtime Configuration for Warmpawz $APP_NAME (PRODUCTION)
// Injected at deployment - API base is API Gateway (backend), not CloudFront
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "$API_BASE_URL",
    uatMode: false,
    environment: "production"
  };
  console.log('Runtime config loaded (PROD):', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
"@

Set-Content -Path $runtimeConfigPath -Value $runtimeConfigContent -Encoding UTF8
Write-Host "runtime-config.js injected (apiBaseUrl -> API Gateway)" -ForegroundColor Green

# Step 2: Deploy to S3
Write-Host "Uploading to S3 bucket: $S3_BUCKET..." -ForegroundColor Blue

$distPath = Join-Path $APP_DIR "dist"

# Upload all files except source maps
aws s3 sync "$distPath/" "s3://$S3_BUCKET/" --delete --exclude "*.map" --region $REGION

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: S3 sync failed!" -ForegroundColor Red
    exit 1
}

# FIX: Explicitly upload runtime-config.js with no-cache headers to prevent browser caching
Write-Host "Uploading runtime-config.js with no-cache headers..." -ForegroundColor Blue
$runtimeConfigS3Path = Join-Path (Join-Path $APP_DIR "dist") "runtime-config.js"
aws s3 cp "$runtimeConfigS3Path" "s3://$S3_BUCKET/runtime-config.js" `
    --content-type "application/javascript" `
    --cache-control "no-cache, no-store, must-revalidate" `
    --metadata-directive REPLACE `
    --region $REGION

# Set proper cache headers for _next/static files (immutable)
if (Test-Path (Join-Path (Join-Path $APP_DIR "dist") "_next\static")) {
    Write-Host "Setting cache headers for _next/static files..." -ForegroundColor Blue
    $staticFiles = Get-ChildItem -Path (Join-Path $APP_DIR "dist\_next\static") -Recurse -File | Where-Object { $_.Extension -eq ".js" -or $_.Extension -eq ".css" }
    foreach ($file in $staticFiles) {
        $relativePath = $file.FullName.Replace($distPath, "").Replace("\", "/").TrimStart("/")
        aws s3 cp $file.FullName "s3://$S3_BUCKET/$relativePath" `
            --cache-control "public, max-age=31536000, immutable" `
            --metadata-directive REPLACE `
            --region $REGION | Out-Null
    }
}

# Verify critical files were uploaded
Write-Host "Verifying uploaded files..." -ForegroundColor Blue
$indexExists = aws s3 ls "s3://$S3_BUCKET/index.html" --region $REGION 2>$null
if ($indexExists) {
    Write-Host "index.html uploaded" -ForegroundColor Green
} else {
    Write-Host "Error: index.html not found in S3!" -ForegroundColor Red
    exit 1
}

$staticExists = aws s3 ls "s3://$S3_BUCKET/_next/static/" --region $REGION 2>$null
if ($staticExists) {
    $jsCount = (aws s3 ls "s3://$S3_BUCKET/_next/static/" --recursive --region $REGION | Select-String "\.js$").Count
    Write-Host "Found $jsCount JavaScript files in S3" -ForegroundColor Green
} else {
    Write-Host "Warning: _next/static directory not found in S3" -ForegroundColor Yellow
}

Write-Host "S3 upload completed successfully" -ForegroundColor Green

# Step 3: Invalidate CloudFront cache
Write-Host "Invalidating CloudFront cache..." -ForegroundColor Blue
try {
    $invalidation = aws cloudfront create-invalidation `
        --distribution-id $CLOUDFRONT_DIST_ID `
        --paths "/*" `
        --region $REGION `
        --output json | ConvertFrom-Json
    
    $INVALIDATION_ID = $invalidation.Invalidation.Id
    Write-Host "CloudFront invalidation created: $INVALIDATION_ID" -ForegroundColor Green
    Write-Host "Full propagation may take 5-15 minutes" -ForegroundColor Yellow
} catch {
    Write-Host "Warning: CloudFront invalidation failed (but files are uploaded)" -ForegroundColor Yellow
    $INVALIDATION_ID = "unknown"
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "PRODUCTION DEPLOYMENT COMPLETED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployment Summary:" -ForegroundColor Cyan
Write-Host "   ${APP_NAME}: Built successfully" -ForegroundColor Green
Write-Host "   S3 Upload: Synced to $S3_BUCKET" -ForegroundColor Green
Write-Host "   CloudFront: Cache invalidation created ($INVALIDATION_ID)" -ForegroundColor Green
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host "   - Vendor Web (PROD): $CLOUDFRONT_URL" -ForegroundColor White
Write-Host "   - Alternate Domain: https://vendor.warmpawz.com" -ForegroundColor White
Write-Host "   - Direct S3: s3://$S3_BUCKET" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Wait 5-15 minutes for CloudFront propagation" -ForegroundColor White
Write-Host "   2. Test the deployed application at $CLOUDFRONT_URL" -ForegroundColor White
Write-Host "   3. Verify all features work correctly in production" -ForegroundColor White
Write-Host ""
