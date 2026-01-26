# Direct AWS CLI deployment script for vendor-web
# Usage: .\scripts\deploy-vendor-web.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying vendor-web to AWS dev environment..." -ForegroundColor Cyan

# Configuration
$APP_NAME = "vendor-web"
$S3_BUCKET = "warmpawz-dev-vendor-frontend-ap-south-1"
$REGION = "ap-south-1"

# Get CloudFront distribution ID
Write-Host "🔍 Finding CloudFront distribution..." -ForegroundColor Blue
$distributions = aws cloudfront list-distributions --region $REGION --output json | ConvertFrom-Json
$CLOUDFRONT_DIST_ID = $null
$CLOUDFRONT_URL = $null

foreach ($dist in $distributions.DistributionList.Items) {
    foreach ($origin in $dist.Origins.Items) {
        if ($origin.DomainName -eq "${S3_BUCKET}.s3.${REGION}.amazonaws.com") {
            $CLOUDFRONT_DIST_ID = $dist.Id
            $CLOUDFRONT_URL = $dist.DomainName
            break
        }
    }
    if ($CLOUDFRONT_DIST_ID) { break }
}

if (-not $CLOUDFRONT_DIST_ID) {
    Write-Host "❌ Error: Could not find CloudFront distribution for ${S3_BUCKET}" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found CloudFront distribution: $CLOUDFRONT_DIST_ID" -ForegroundColor Green
Write-Host "   URL: $CLOUDFRONT_URL" -ForegroundColor Green

# Get project root
$SCRIPT_DIR = $PSScriptRoot
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$APP_DIR = Join-Path $PROJECT_ROOT "apps" $APP_NAME

# Step 1: Build the app (if not already built)
Write-Host "📦 Building ${APP_NAME}..." -ForegroundColor Blue
Set-Location $APP_DIR
npm run build

if (-not (Test-Path "dist")) {
    Write-Host "❌ Error: dist directory not found after build!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully" -ForegroundColor Green

# Step 1.5: Inject runtime-config.js
Write-Host "🔧 Injecting runtime-config.js..." -ForegroundColor Blue
Set-Location $PROJECT_ROOT

# Get API Gateway endpoint (HTTP API v2)
$API_ENDPOINT = ""
try {
    $apis = aws apigatewayv2 get-apis --region $REGION --output json | ConvertFrom-Json
    $api = $apis.Items | Where-Object { $_.Name -eq "warmpawz-dev-api" } | Select-Object -First 1
    if ($api -and $api.ApiEndpoint) {
        $API_ENDPOINT = $api.ApiEndpoint
        Write-Host "✅ API Gateway endpoint: $API_ENDPOINT" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not fetch API Gateway endpoint from AWS" -ForegroundColor Yellow
}

if (-not $API_ENDPOINT) {
    # Fallback to known API Gateway endpoint
    $API_ENDPOINT = "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
    Write-Host "⚠️  Using fallback API endpoint: $API_ENDPOINT" -ForegroundColor Yellow
}

# Inject runtime-config.js into dist folder
$runtimeConfigPath = Join-Path $APP_DIR "dist" "runtime-config.js"
$runtimeConfigLines = @(
    '// Runtime Configuration for Warmpawz ' + $APP_NAME,
    '// Injected at deployment time with actual API Gateway endpoint',
    '(function() {',
    '  window.__WARMPAWZ_RUNTIME_CONFIG__ = {',
    '    apiBaseUrl: "' + $API_ENDPOINT + '",',
    '    uatMode: true',
    '  };',
    '  console.log(''Runtime config loaded:'', window.__WARMPAWZ_RUNTIME_CONFIG__);',
    '})();'
)
$runtimeConfigContent = $runtimeConfigLines -join "`n"

Set-Content -Path $runtimeConfigPath -Value $runtimeConfigContent -Encoding UTF8
Write-Host "✅ runtime-config.js injected" -ForegroundColor Green

# Step 2: Deploy to S3
Write-Host "📤 Uploading to S3 bucket: ${S3_BUCKET}..." -ForegroundColor Blue
$distPath = Join-Path $APP_DIR "dist"
aws s3 sync "${distPath}/" "s3://${S3_BUCKET}/" --delete --exclude "*.map" --region $REGION

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ S3 upload completed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Error: S3 upload failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Invalidate CloudFront cache
Write-Host "🔄 Invalidating CloudFront cache..." -ForegroundColor Blue
$invalidation = aws cloudfront create-invalidation `
    --distribution-id "${CLOUDFRONT_DIST_ID}" `
    --paths "/*" `
    --region $REGION `
    --output json | ConvertFrom-Json

if ($LASTEXITCODE -eq 0) {
    $INVALIDATION_ID = $invalidation.Invalidation.Id
    Write-Host "✅ CloudFront invalidation created: ${INVALIDATION_ID}" -ForegroundColor Green
    Write-Host "⏳ Full propagation may take 5-15 minutes" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Warning: CloudFront invalidation failed (but files are uploaded)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ DIRECT AWS DEPLOYMENT COMPLETED                          ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Deployment Summary:" -ForegroundColor Cyan
Write-Host "   ✅ ${APP_NAME}: Built successfully" -ForegroundColor Green
Write-Host "   ✅ S3 Upload: Synced to ${S3_BUCKET}" -ForegroundColor Green
Write-Host "   ✅ CloudFront: Cache invalidation created (${CLOUDFRONT_DIST_ID})" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Access URLs:" -ForegroundColor Cyan
Write-Host "   - Vendor Web: ${CLOUDFRONT_URL}" -ForegroundColor White
Write-Host "   - Direct S3: s3://${S3_BUCKET}" -ForegroundColor White
Write-Host ""
