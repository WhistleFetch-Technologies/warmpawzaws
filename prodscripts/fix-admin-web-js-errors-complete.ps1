# PowerShell script to fix admin-web JavaScript errors
# Fixes CloudFront configuration and rebuilds/redeploys if needed

$DIST_ID = "E2NHO6UUI5UIHW"
$BUCKET = "warmpawz-prod-admin-frontend-ap-south-1"
$REGION = "ap-south-1"
$CLOUDFRONT_URL = "https://dbr09zyoq9akb.cloudfront.net"
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$APP_DIR = Join-Path $PROJECT_ROOT "apps\admin-web"

Write-Host "🔧 Fixing Admin-Web JavaScript Errors" -ForegroundColor Blue
Write-Host "=====================================" -ForegroundColor Blue
Write-Host ""

# Step 1: Check S3 files
Write-Host "1. Checking S3 bucket for JavaScript files..." -ForegroundColor Blue
$jsFiles = aws s3 ls "s3://$BUCKET/_next/static/" --recursive 2>&1 | Select-String "\.js$"
$jsCount = ($jsFiles | Measure-Object).Count
Write-Host "   Found $jsCount JavaScript files in S3" -ForegroundColor Yellow

# Check for specific missing files
$missingFiles = @(
    "_next/static/chunks/9895-bb8627f85c26e3a5.js",
    "_next/static/chunks/webpack-e4aef669f45f2f71.js",
    "_next/static/chunks/main-app-d059e49c0b81da39.js"
)

Write-Host ""
Write-Host "2. Checking for missing files referenced in HTML..." -ForegroundColor Blue
$missingCount = 0
foreach ($file in $missingFiles) {
    $exists = aws s3 ls "s3://$BUCKET/$file" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ $file (NOT FOUND)" -ForegroundColor Red
        $missingCount++
    } else {
        Write-Host "   ✅ $file" -ForegroundColor Green
    }
}

if ($missingCount -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Found $missingCount missing file(s) - rebuild required" -ForegroundColor Yellow
}

# Step 2: Check CloudFront configuration
Write-Host ""
Write-Host "3. Checking CloudFront distribution configuration..." -ForegroundColor Blue
$configJson = aws cloudfront get-distribution-config --id $DIST_ID --region $REGION --output json | ConvertFrom-Json

if (-not $configJson) {
    Write-Host "   ❌ Error: Could not fetch CloudFront configuration" -ForegroundColor Red
    exit 1
}

$etag = $configJson.ETag
$distConfig = $configJson.DistributionConfig

# Check for /_next/* behavior
$hasNextBehavior = $false
if ($distConfig.CacheBehaviors.Items) {
    foreach ($behavior in $distConfig.CacheBehaviors.Items) {
        if ($behavior.PathPattern -eq "/_next/*") {
            $hasNextBehavior = $true
            Write-Host "   ✅ Found /_next/* cache behavior" -ForegroundColor Green
            
            # Check if it has custom error responses
            if ($behavior.CustomErrorResponses.Quantity -gt 0) {
                Write-Host "   ⚠️  Warning: /_next/* behavior has custom error responses" -ForegroundColor Yellow
                Write-Host "      This may cause HTML to be returned for missing JS files" -ForegroundColor Yellow
            } else {
                Write-Host "   ✅ No custom error responses (correct)" -ForegroundColor Green
            }
            break
        }
    }
}

if (-not $hasNextBehavior) {
    Write-Host "   ⚠️  No /_next/* cache behavior found" -ForegroundColor Yellow
    Write-Host "   This can cause missing JS files to return index.html" -ForegroundColor Yellow
}

# Check default behavior for 404 custom error
$defaultBehavior = $distConfig.DefaultCacheBehavior
$has404Error = $false
if ($defaultBehavior.CustomErrorResponses.Items) {
    foreach ($error in $defaultBehavior.CustomErrorResponses.Items) {
        if ($error.ErrorCode -eq 404 -and $error.ResponsePagePath -eq "/index.html") {
            $has404Error = $true
            Write-Host "   ⚠️  Default behavior returns index.html for 404s" -ForegroundColor Yellow
            break
        }
    }
}

# Step 3: Determine fix strategy
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "📋 DIAGNOSIS" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host ""

$needsRebuild = $missingCount -gt 0
$needsCloudFrontFix = -not $hasNextBehavior -or ($hasNextBehavior -and $has404Error)

if ($needsRebuild) {
    Write-Host "❌ ISSUE 1: File hash mismatch" -ForegroundColor Red
    Write-Host "   HTML references JS files that don't exist in S3" -ForegroundColor Yellow
    Write-Host "   SOLUTION: Rebuild and redeploy admin-web" -ForegroundColor Green
    Write-Host ""
}

if ($needsCloudFrontFix) {
    Write-Host "❌ ISSUE 2: CloudFront configuration" -ForegroundColor Red
    Write-Host "   Missing or incorrect /_next/* cache behavior" -ForegroundColor Yellow
    Write-Host "   SOLUTION: Add/update CloudFront cache behavior" -ForegroundColor Green
    Write-Host ""
}

if (-not $needsRebuild -and -not $needsCloudFrontFix) {
    Write-Host "✅ Configuration looks correct" -ForegroundColor Green
    Write-Host "   If errors persist, try invalidating CloudFront cache" -ForegroundColor Yellow
    Write-Host ""
    
    # Invalidate cache anyway
    Write-Host "4. Invalidating CloudFront cache..." -ForegroundColor Blue
    $invId = aws cloudfront create-invalidation `
        --distribution-id $DIST_ID `
        --paths "/_next/static/*" "/*.js" "/*.css" "/index.html" `
        --query 'Invalidation.Id' `
        --output text `
        --region $REGION
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Cache invalidation created: $invId" -ForegroundColor Green
        Write-Host "   ⏳ Propagation may take 5-15 minutes" -ForegroundColor Yellow
    }
    
    exit 0
}

# Step 4: Fix CloudFront if needed
if ($needsCloudFrontFix) {
    Write-Host ""
    Write-Host "4. Fixing CloudFront configuration..." -ForegroundColor Blue
    
    # Save current config to temp file
    $tempConfig = [System.IO.Path]::GetTempFileName()
    $configJson | ConvertTo-Json -Depth 100 | Out-File -FilePath $tempConfig -Encoding utf8
    
    Write-Host "   ⚠️  CloudFront fix requires manual update or bash script" -ForegroundColor Yellow
    Write-Host "   Run: bash prodscripts/fix-admin-cloudfront-static-files.sh" -ForegroundColor Cyan
    Write-Host "   OR update via AWS Console: CloudFront → Behaviors → Create Behavior" -ForegroundColor Cyan
    Write-Host ""
}

# Step 5: Rebuild and redeploy if needed
if ($needsRebuild) {
    Write-Host ""
    Write-Host "5. Rebuilding and redeploying admin-web..." -ForegroundColor Blue
    
    if (-not (Test-Path $APP_DIR)) {
        Write-Host "   ❌ Error: admin-web directory not found at $APP_DIR" -ForegroundColor Red
        exit 1
    }
    
    Push-Location $APP_DIR
    
    try {
        # Clean build artifacts
        Write-Host "   🧹 Cleaning build artifacts..." -ForegroundColor Yellow
        if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
        if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
        if (Test-Path "dist-export") { Remove-Item -Recurse -Force "dist-export" }
        if (Test-Path "node_modules\.cache") { Remove-Item -Recurse -Force "node_modules\.cache" }
        
        # Build
        Write-Host "   📦 Building admin-web..." -ForegroundColor Yellow
        npm run build
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "   ❌ Build failed!" -ForegroundColor Red
            exit 1
        }
        
        if (-not (Test-Path "dist")) {
            Write-Host "   ❌ Error: dist directory not found after build!" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "   ✅ Build completed successfully" -ForegroundColor Green
        
        # Deploy using the deployment script
        Write-Host ""
        Write-Host "   📤 Deploying to S3..." -ForegroundColor Yellow
        Push-Location $PROJECT_ROOT
        bash prodscripts/deploy-admin-web-prod.sh --yes
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Deployment completed successfully" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Deployment may have issues, check output above" -ForegroundColor Yellow
        }
        
    } finally {
        Pop-Location
    }
}

# Summary
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ FIX COMPLETE" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Blue
if ($needsCloudFrontFix) {
    Write-Host "   1. Fix CloudFront configuration (see step 4 above)" -ForegroundColor Yellow
}
if ($needsRebuild) {
    Write-Host "   2. Wait 5-15 minutes for CloudFront propagation" -ForegroundColor Yellow
    Write-Host "   3. Test application at $CLOUDFRONT_URL" -ForegroundColor Yellow
} else {
    Write-Host "   1. Wait 5-15 minutes for cache invalidation" -ForegroundColor Yellow
    Write-Host "   2. Test application at $CLOUDFRONT_URL" -ForegroundColor Yellow
}
Write-Host ""
