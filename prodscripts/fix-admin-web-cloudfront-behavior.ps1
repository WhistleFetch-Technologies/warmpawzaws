# PowerShell script to fix CloudFront cache behavior for /_next/* paths
# This ensures missing JS files return 404 instead of index.html

$DIST_ID = "E2NHO6UUI5UIHW"
$REGION = "ap-south-1"

Write-Host "🔧 Fixing CloudFront cache behavior for /_next/* paths..." -ForegroundColor Blue
Write-Host ""

# Get current distribution config
Write-Host "1. Fetching CloudFront distribution configuration..." -ForegroundColor Blue
$config = aws cloudfront get-distribution-config --id $DIST_ID --region $REGION --output json | ConvertFrom-Json

if (-not $config) {
    Write-Host "❌ Error: Could not fetch CloudFront configuration" -ForegroundColor Red
    exit 1
}

$etag = $config.ETag
$distConfig = $config.DistributionConfig

# Check if /_next/* behavior exists
$cacheBehaviors = $distConfig.CacheBehaviors
$hasNextBehavior = $false

if ($cacheBehaviors.Items) {
    foreach ($behavior in $cacheBehaviors.Items) {
        if ($behavior.PathPattern -eq "/_next/*") {
            $hasNextBehavior = $true
            Write-Host "✅ Found existing /_next/* cache behavior" -ForegroundColor Green
            Write-Host "   Path Pattern: $($behavior.PathPattern)" -ForegroundColor Yellow
            Write-Host "   Custom Error Responses: $($behavior.CustomErrorResponses.Quantity)" -ForegroundColor Yellow
            break
        }
    }
}

if (-not $hasNextBehavior) {
    Write-Host "⚠️  No separate cache behavior found for /_next/* paths" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 RECOMMENDATION:" -ForegroundColor Blue
    Write-Host "   Create a separate cache behavior for /_next/* that:" -ForegroundColor Yellow
    Write-Host "   1. Has NO custom error responses (404s should return 404, not index.html)" -ForegroundColor Yellow
    Write-Host "   2. Uses longer TTL for static assets" -ForegroundColor Yellow
    Write-Host "   3. Is ordered BEFORE the default behavior" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   This can be done via:" -ForegroundColor Blue
    Write-Host "   - AWS Console: CloudFront → Behaviors → Create Behavior" -ForegroundColor Cyan
    Write-Host "   - Terraform: infra/modules/cloudfront/main.tf (ordered_cache_behavior)" -ForegroundColor Cyan
    Write-Host ""
}

# Check default behavior custom error responses
Write-Host ""
Write-Host "2. Checking default behavior custom error responses..." -ForegroundColor Blue
$defaultBehavior = $distConfig.DefaultCacheBehavior
$customErrors = $defaultBehavior.CustomErrorResponses

if ($customErrors.Items) {
    foreach ($error in $customErrors.Items) {
        if ($error.ErrorCode -eq 404) {
            Write-Host "⚠️  Found 404 custom error response:" -ForegroundColor Yellow
            Write-Host "   Response Code: $($error.ResponseCode)" -ForegroundColor Yellow
            Write-Host "   Response Page: $($error.ResponsePagePath)" -ForegroundColor Yellow
            if ($error.ResponsePagePath -eq "/index.html") {
                Write-Host ""
                Write-Host "   ❌ PROBLEM: 404s return index.html" -ForegroundColor Red
                Write-Host "   This causes missing JS files to return HTML instead of 404!" -ForegroundColor Red
                Write-Host ""
                Write-Host "   💡 SOLUTION: Ensure /_next/* behavior has NO custom error responses" -ForegroundColor Green
            }
        }
    }
} else {
    Write-Host "✅ No custom error responses in default behavior" -ForegroundColor Green
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "📋 SUMMARY" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host ""
Write-Host "The root cause is:" -ForegroundColor Yellow
Write-Host "  1. HTML references JS files that don't exist in S3" -ForegroundColor Yellow
Write-Host "  2. CloudFront returns index.html for 404s (custom error response)" -ForegroundColor Yellow
Write-Host "  3. Browser tries to execute HTML as JS → 'Unexpected token <'" -ForegroundColor Yellow
Write-Host ""
Write-Host "IMMEDIATE FIX:" -ForegroundColor Green
Write-Host "  Rebuild and redeploy admin-web:" -ForegroundColor Cyan
Write-Host "    cd warmpawzApp\warmpawzaws" -ForegroundColor White
Write-Host "    .\prodscripts\deploy-admin-web-prod.sh --yes" -ForegroundColor White
Write-Host ""
Write-Host "LONG-TERM FIX:" -ForegroundColor Green
Write-Host "  Ensure /_next/* cache behavior exists with NO custom error responses" -ForegroundColor Cyan
Write-Host ""
