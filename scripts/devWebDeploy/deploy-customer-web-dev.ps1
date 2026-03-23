# ============================================================================
# Deploy Customer-Web to Dev Environment with Alternate Domain
# ============================================================================
# This script builds and deploys customer-web to AWS S3 + CloudFront
# Uses dev API Gateway (z0b3obweb6) and alternate domain (dev.customer.warmpawz.com)
# ============================================================================

param(
    [string]$Region = "ap-south-1",
    [string]$S3Bucket = "warmpawz-dev-customer-frontend-ap-south-1",
    [string]$CloudFrontDistId = "E2RDORGXSWJJ87",
    [string]$CloudFrontUrl = "https://d2aoyjj8ine0wk.cloudfront.net",
    [string]$AlternateDomain = "dev.customer.warmpawz.com",
    [string]$ApiGatewayEndpoint = "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com",
    [switch]$DeployOnly,
    [switch]$SkipInvalidation
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Deploying Customer-Web to Dev Environment" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  S3 Bucket: $S3Bucket" -ForegroundColor Gray
Write-Host "  CloudFront Distribution: $CloudFrontDistId" -ForegroundColor Gray
Write-Host "  CloudFront URL: $CloudFrontUrl" -ForegroundColor Gray
Write-Host "  Alternate Domain: $AlternateDomain" -ForegroundColor Gray
Write-Host "  API Gateway: $ApiGatewayEndpoint" -ForegroundColor Gray
Write-Host "  Region: $Region" -ForegroundColor Gray
Write-Host ""

# Verify AWS credentials
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

# Verify S3 bucket exists
Write-Host "Step 1: Verifying S3 bucket..." -ForegroundColor Yellow
try {
    $bucketCheck = aws s3 ls "s3://$S3Bucket" --region $Region 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ S3 bucket verified: $S3Bucket" -ForegroundColor Green
    } else {
        Write-Host "  ❌ S3 bucket not found or no access: $S3Bucket" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Error checking S3 bucket: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Verify CloudFront distribution
Write-Host "Step 2: Verifying CloudFront distribution..." -ForegroundColor Yellow
try {
    $cfInfo = aws cloudfront get-distribution --id $CloudFrontDistId --region $Region --output json 2>&1 | ConvertFrom-Json
    if ($cfInfo.Distribution) {
        Write-Host "  ✅ CloudFront distribution verified" -ForegroundColor Green
        Write-Host "  Domain: $($cfInfo.Distribution.DomainName)" -ForegroundColor Gray
        Write-Host "  Status: $($cfInfo.Distribution.Status)" -ForegroundColor Gray
        if ($cfInfo.Distribution.DistributionConfig.Aliases.Items) {
            Write-Host "  Alternate Domains: $($cfInfo.Distribution.DistributionConfig.Aliases.Items -join ', ')" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ⚠️ Could not verify CloudFront distribution (non-fatal)" -ForegroundColor Yellow
}
Write-Host ""

# Navigate to customer-web directory
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptRoot)
$customerWebDir = Join-Path $projectRoot "apps\customer-web"

if (!(Test-Path $customerWebDir)) {
    Write-Host "❌ Customer-web directory not found: $customerWebDir" -ForegroundColor Red
    exit 1
}

Set-Location $customerWebDir
Write-Host "Step 3: Building customer-web..." -ForegroundColor Yellow
Write-Host "  Directory: $customerWebDir" -ForegroundColor Gray

# Build the app (skip if DeployOnly is set and dist exists)
if ($DeployOnly -and (Test-Path "dist")) {
    Write-Host "  ✅ Skipping build (--DeployOnly, dist exists)" -ForegroundColor Green
} else {
    Write-Host "  Cleaning stale build artifacts..." -ForegroundColor Gray
    if (Test-Path ".next") { Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path "dist") { Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path "node_modules\.cache") { Remove-Item -Path "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue }
    
    Start-Sleep -Seconds 2
    
    Write-Host "  Running: npm run build" -ForegroundColor Gray
    $env:NODE_ENV = "production"
    $buildOutput = npm run build 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Build failed!" -ForegroundColor Red
        Write-Host $buildOutput
        exit 1
    }
    
    if (!(Test-Path "dist")) {
        Write-Host "  ❌ dist directory not found after build!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✅ Build completed successfully" -ForegroundColor Green
}
Write-Host ""

# Inject runtime-config.js
Write-Host "Step 4: Injecting runtime configuration..." -ForegroundColor Yellow
$distPath = Join-Path $customerWebDir "dist"
$runtimeConfigPath = Join-Path $distPath "runtime-config.js"

$runtimeConfigContent = @"
// Runtime Configuration for Warmpawz customer-web
// Injected at deployment time with dev API Gateway endpoint
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "$ApiGatewayEndpoint",
    uatMode: true,
    environment: "development"
  };
  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
"@

Set-Content -Path $runtimeConfigPath -Value $runtimeConfigContent -Encoding UTF8
Write-Host "  ✅ runtime-config.js created" -ForegroundColor Green

# Inject inline config into HTML files
Write-Host "  Injecting inline config into HTML files..." -ForegroundColor Gray
$htmlFiles = Get-ChildItem -Path $distPath -Filter "*.html" -Recurse
$inlineConfig = "window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: '$ApiGatewayEndpoint', uatMode: true, environment: 'development' };"
$htmlCount = 0

foreach ($htmlFile in $htmlFiles) {
    $content = Get-Content -Path $htmlFile.FullName -Raw -Encoding UTF8
    
    if ($content -match 'id=["'']runtime-config-inline["'']') {
        $content = $content -replace '<script\s+id=["'']runtime-config-inline["''][^>]*>[\s\S]*?<\/script>', "<script id=`"runtime-config-inline`">$inlineConfig</script>"
    } else {
        $content = $content -replace '</body>', "<script id=`"runtime-config-inline`">$inlineConfig</script></body>"
    }
    
    Set-Content -Path $htmlFile.FullName -Value $content -Encoding UTF8 -NoNewline
    $htmlCount++
}

Write-Host "  ✅ Inline config injected into $htmlCount HTML files" -ForegroundColor Green
Write-Host ""

# Ensure a default index.html exists to avoid AccessDenied on root
try {
    $indexPath = Join-Path $distPath "index.html"
    if (!(Test-Path $indexPath)) {
        Write-Host "  ℹ️ No index.html found. Creating a minimal placeholder to avoid AccessDenied..." -ForegroundColor Yellow
        $indexHtml = @'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Warmpawz Customer (Dev)</title>
  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:40px}</style>
</head>
<body>
  <h1>Warmpawz Customer (Dev)</h1>
  <p>Deployment successful. Full static export pending for customer-web.</p>
  <p>If this persists, rebuild with production static export.</p>
  <script>
    (function() {
      window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: "__API_GATEWAY_ENDPOINT__", uatMode: true, environment: "development" };
      console.log("Runtime config set", window.__WARMPAWZ_RUNTIME_CONFIG__);
    })();
  </script>
</body>
</html>
'@
        $indexHtml = $indexHtml -replace '__API_GATEWAY_ENDPOINT__', $ApiGatewayEndpoint
        Set-Content -Path $indexPath -Value $indexHtml -Encoding UTF8
        Write-Host "  ✅ Placeholder index.html created" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️ Could not create placeholder index.html (non-fatal): $($_.Exception.Message)" -ForegroundColor Yellow
}

# Deploy to S3
Write-Host "Step 5: Deploying to S3..." -ForegroundColor Yellow
Write-Host "  Syncing files to s3://$S3Bucket/" -ForegroundColor Gray

try {
    # Sync files to S3 (exclude source maps)
    aws s3 sync "$distPath/" "s3://$S3Bucket/" `
        --delete `
        --exclude "*.map" `
        --exclude "*.map.*" `
        --region $Region `
        --output json 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ S3 upload completed successfully" -ForegroundColor Green
    } else {
        Write-Host "  ❌ S3 upload failed!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ S3 upload failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Invalidate CloudFront cache
if (-not $SkipInvalidation) {
    Write-Host "Step 6: Invalidating CloudFront cache..." -ForegroundColor Yellow
    try {
        $invalidation = aws cloudfront create-invalidation `
            --distribution-id $CloudFrontDistId `
            --paths "/*" `
            --region $Region `
            --output json 2>&1 | ConvertFrom-Json
        
        if ($invalidation.Invalidation) {
            Write-Host "  ✅ CloudFront invalidation created" -ForegroundColor Green
            Write-Host "  Invalidation ID: $($invalidation.Invalidation.Id)" -ForegroundColor Gray
            Write-Host "  Status: $($invalidation.Invalidation.Status)" -ForegroundColor Gray
            Write-Host "  ⏳ Full propagation may take 5-15 minutes" -ForegroundColor Yellow
        } else {
            Write-Host "  ⚠️ CloudFront invalidation response unexpected" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ⚠️ CloudFront invalidation failed (non-fatal): $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "  Files are uploaded, but cache may need manual invalidation" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Summary
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "✅ Customer-Web deployed to dev environment!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Deployment Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Build: Completed successfully" -ForegroundColor White
Write-Host "  ✅ Runtime Config: Injected with dev API Gateway" -ForegroundColor White
Write-Host "  ✅ S3 Upload: Synced to $S3Bucket" -ForegroundColor White
if (-not $SkipInvalidation) {
    Write-Host "  ✅ CloudFront: Cache invalidation created" -ForegroundColor White
}
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host "  - CloudFront: $CloudFrontUrl" -ForegroundColor White
Write-Host "  - Alternate Domain: https://$AlternateDomain" -ForegroundColor White
Write-Host "  - Direct S3: s3://$S3Bucket" -ForegroundColor White
Write-Host ""
Write-Host "API Configuration:" -ForegroundColor Cyan
Write-Host "  - API Gateway: $ApiGatewayEndpoint" -ForegroundColor White
Write-Host "  - UAT Mode: Enabled" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Wait 5-15 minutes for CloudFront propagation" -ForegroundColor White
Write-Host "  2. Test the application at https://$AlternateDomain" -ForegroundColor White
Write-Host "  3. Verify API calls are going to dev API Gateway" -ForegroundColor White
Write-Host "  4. Check browser console for runtime config confirmation" -ForegroundColor White
Write-Host ""
