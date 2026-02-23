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
        if ($origin.DomainName -eq "$S3_BUCKET.s3.$REGION.amazonaws.com") {
            $CLOUDFRONT_DIST_ID = $dist.Id
            $CLOUDFRONT_URL = $dist.DomainName
            break
        }
    }
    if ($CLOUDFRONT_DIST_ID) { break }
}

if (-not $CLOUDFRONT_DIST_ID) {
    Write-Host "❌ Error: Could not find CloudFront distribution for $S3_BUCKET" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found CloudFront distribution: $CLOUDFRONT_DIST_ID" -ForegroundColor Green
Write-Host "   URL: $CLOUDFRONT_URL" -ForegroundColor Green

# Get project root
$SCRIPT_DIR = $PSScriptRoot
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$APP_DIR = Join-Path $PROJECT_ROOT "apps" $APP_NAME

# Step 1: Clean previous build and build the app
Write-Host "🧹 Cleaning previous build..." -ForegroundColor Blue
Set-Location $APP_DIR

# Remove dist folder to ensure clean build
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "✅ Cleaned previous build" -ForegroundColor Green
}

# Clean Next.js cache
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "✅ Cleaned Next.js cache" -ForegroundColor Green
}

Write-Host "📦 Building $APP_NAME..." -ForegroundColor Blue
npm run build

if (-not (Test-Path "dist")) {
    Write-Host "❌ Error: dist directory not found after build!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully" -ForegroundColor Green

# Verify critical files exist
$criticalFiles = @(
    "dist/index.html",
    "_next/static"
)
$missingFiles = @()
foreach ($file in $criticalFiles) {
    $fullPath = Join-Path $APP_DIR "dist" $file
    if (-not (Test-Path $fullPath)) {
        $missingFiles += $file
    }
}
if ($missingFiles.Count -gt 0) {
    Write-Host "⚠️  Warning: Some critical files may be missing: $($missingFiles -join ', ')" -ForegroundColor Yellow
}

# Step 1.5: Inject runtime-config.js
Write-Host "🔧 Injecting runtime-config.js..." -ForegroundColor Blue
Set-Location $PROJECT_ROOT

# Get API Gateway endpoint - Priority: config/urls.json apiGatewayDefaultUrl → AWS query → fallback
$API_ENDPOINT = ""
$urlsConfigPath = Join-Path $PROJECT_ROOT "config" "urls.json"

# Priority 1: Read from config/urls.json
if (Test-Path $urlsConfigPath) {
    try {
        $urlsConfig = Get-Content $urlsConfigPath | ConvertFrom-Json
        if ($urlsConfig.apiGatewayDefaultUrl) {
            $API_ENDPOINT = $urlsConfig.apiGatewayDefaultUrl
            Write-Host "✅ API Gateway endpoint (from config): $API_ENDPOINT" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Could not read config/urls.json" -ForegroundColor Yellow
    }
}

# Priority 2: Query AWS if not found in config
if (-not $API_ENDPOINT) {
    try {
        $apis = aws apigatewayv2 get-apis --region $REGION --output json | ConvertFrom-Json
        $api = $apis.Items | Where-Object { $_.Name -eq "warmpawz-dev-api" } | Select-Object -First 1
        if ($api -and $api.ApiEndpoint) {
            $API_ENDPOINT = $api.ApiEndpoint
            Write-Host "✅ API Gateway endpoint (from AWS): $API_ENDPOINT" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Could not fetch API Gateway endpoint from AWS" -ForegroundColor Yellow
    }
}

# Priority 3: Fallback to known API Gateway endpoint
if (-not $API_ENDPOINT) {
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
Write-Host "📤 Uploading to S3 bucket: $S3_BUCKET..." -ForegroundColor Blue
$distPath = Join-Path $APP_DIR "dist"

# First, remove all files from S3 to ensure clean state
Write-Host "🧹 Cleaning S3 bucket..." -ForegroundColor Blue
aws s3 rm "s3://$S3_BUCKET/" --recursive --region $REGION | Out-Null

# Upload all files (excluding source maps for production)
Write-Host "📤 Uploading new build..." -ForegroundColor Blue
aws s3 sync "$distPath/" "s3://$S3_BUCKET/" --exclude "*.map" --region $REGION --cache-control "public, max-age=0, must-revalidate"

if ($?) {
    Write-Host "✅ S3 upload completed successfully" -ForegroundColor Green
    
    # Verify chunk files were uploaded
    $chunkCount = (aws s3 ls "s3://$S3_BUCKET/_next/static/chunks/" --recursive --region $REGION 2>$null | Measure-Object -Line).Lines
    Write-Host "   📊 Uploaded $chunkCount chunk files" -ForegroundColor Cyan
} else {
    Write-Host "❌ Error: S3 upload failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Invalidate CloudFront cache (aggressive invalidation)
Write-Host "🔄 Invalidating CloudFront cache..." -ForegroundColor Blue

# Invalidate all paths including chunks - use wildcard to catch everything
$invalidation = aws cloudfront create-invalidation `
    --distribution-id "$CLOUDFRONT_DIST_ID" `
    --paths "/*" `
    --region $REGION `
    --output json | ConvertFrom-Json

if ($?) {
    $INVALIDATION_ID = $invalidation.Invalidation.Id
    Write-Host "✅ CloudFront invalidation created: $INVALIDATION_ID" -ForegroundColor Green
    Write-Host "⏳ Full propagation may take 5-15 minutes" -ForegroundColor Yellow
    Write-Host "💡 Tip: Hard refresh (Ctrl+Shift+R) after propagation completes" -ForegroundColor Yellow
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
Write-Host "   ✅ $APP_NAME: Built successfully" -ForegroundColor Green
Write-Host "   ✅ S3 Upload: Synced to $S3_BUCKET" -ForegroundColor Green
Write-Host "   ✅ CloudFront: Cache invalidation created ($CLOUDFRONT_DIST_ID)" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Access URLs:" -ForegroundColor Cyan
Write-Host "   - Vendor Web: $CLOUDFRONT_URL" -ForegroundColor White
Write-Host "   - Direct S3: s3://$S3_BUCKET" -ForegroundColor White
Write-Host ""
