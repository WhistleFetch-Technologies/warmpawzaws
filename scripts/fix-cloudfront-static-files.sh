#!/bin/bash
# Fix CloudFront static files issue - JavaScript files returning HTML
# This script fixes the CloudFront configuration to properly serve static files

set -e

DIST_ID="E95171GX1I6HN"
BUCKET="warmpawz-dev-vendor-frontend-ap-south-1"
REGION="ap-south-1"

echo "🔧 Fixing CloudFront Static Files Configuration"
echo "================================================"
echo ""

# Step 1: Check if files exist
echo "1. Checking S3 bucket structure..."
MAIN_JS_FILES=$(aws s3 ls "s3://${BUCKET}/_next/static/chunks/" --recursive | grep "main-app" | wc -l)
echo "   Found ${MAIN_JS_FILES} main-app.js files in S3"

if [ "$MAIN_JS_FILES" -eq 0 ]; then
    echo "   ⚠️  WARNING: No main-app.js files found in S3!"
    echo "   This might indicate a build/deployment issue."
    echo ""
fi

# Step 2: Get current CloudFront config
echo ""
echo "2. Fetching CloudFront distribution configuration..."
CONFIG_FILE="/tmp/cf-config-${DIST_ID}.json"
ETAG_FILE="/tmp/cf-etag-${DIST_ID}.txt"

aws cloudfront get-distribution-config \
    --id ${DIST_ID} \
    --region ${REGION} > ${CONFIG_FILE}

ETAG=$(jq -r '.ETag' ${CONFIG_FILE})
DIST_CONFIG=$(jq -r '.DistributionConfig' ${CONFIG_FILE})

echo "   ✅ Configuration fetched (ETag: ${ETAG})"

# Step 3: Check current custom error responses
echo ""
echo "3. Checking current custom error responses..."
CUSTOM_ERRORS=$(echo ${DIST_CONFIG} | jq '.DefaultCacheBehavior.CustomErrorResponses.Items // []')

ERROR_COUNT=$(echo ${CUSTOM_ERRORS} | jq 'length')
echo "   Found ${ERROR_COUNT} custom error response(s)"

if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "   Current error responses:"
    echo ${CUSTOM_ERRORS} | jq -r '.[] | "     - \(.ErrorCode) → \(.ResponsePagePath) (HTTP \(.ResponseCode))"'
fi

# Step 4: Update custom error responses to exclude _next paths
echo ""
echo "4. Updating custom error responses..."

# Check if there's a 404 custom error that returns index.html
HAS_404=$(echo ${CUSTOM_ERRORS} | jq '[.[] | select(.ErrorCode == 404)] | length')

if [ "$HAS_404" -gt 0 ]; then
    echo "   ⚠️  Found 404 custom error response(s)"
    echo "   These should NOT apply to /_next/* paths"
    echo ""
    echo "   📋 Recommendation: Update CloudFront behaviors manually:"
    echo ""
    echo "   Option A: Create separate behavior for /_next/* that has no custom error responses"
    echo "   Option B: Modify 404 error to exclude /_next/* paths (requires Lambda@Edge or regex)"
    echo ""
    echo "   Since CloudFront doesn't support path exclusions in custom error responses,"
    echo "   you need to create a separate cache behavior for /_next/* paths."
    echo ""
else
    echo "   ✅ No problematic 404 error responses found"
fi

# Step 5: Invalidate CloudFront cache
echo ""
echo "5. Invalidating CloudFront cache for static files..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id ${DIST_ID} \
    --paths "/_next/static/*" "/_next/image/*" \
    --query 'Invalidation.Id' \
    --output text \
    --region ${REGION})

echo "   ✅ Cache invalidation created: ${INVALIDATION_ID}"

# Step 6: Instructions for manual fix
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 MANUAL FIX REQUIRED: CloudFront Behaviors"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To fix the JavaScript files returning HTML issue:"
echo ""
echo "1. Go to CloudFront Console → Distribution ${DIST_ID}"
echo "2. Go to 'Behaviors' tab"
echo "3. Create a NEW behavior BEFORE the default behavior:"
echo "   - Path Pattern: /_next/*"
echo "   - Origin: Same as default"
echo "   - Viewer Protocol Policy: Redirect HTTP to HTTPS"
echo "   - Allowed HTTP Methods: GET, HEAD"
echo "   - Cache Policy: CachingOptimized"
echo "   - ❌ Custom Error Responses: NONE (or 404 → Error Page)"
echo ""
echo "4. This ensures /_next/* requests don't get index.html on 404"
echo ""
echo "5. If files are returning HTML, it might also be a cache issue:"
echo "   - Wait 5-15 minutes for invalidation to complete"
echo "   - Or rebuild and redeploy the application"
echo ""

# Step 7: Verify current HTML references
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Additional Diagnostics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "6. Checking if HTML file has outdated hashes..."
HTML_CONTENT=$(curl -s "https://d1s6ykkj381k58.cloudfront.net/server/app/index.html" 2>/dev/null || curl -s "https://d1s6ykkj381k58.cloudfront.net/index.html" 2>/dev/null || echo "")

if [ -n "$HTML_CONTENT" ]; then
    # Extract main-app hash from HTML
    HTML_HASH=$(echo "$HTML_CONTENT" | grep -oP 'main-app-\K[^"]+' | head -1 || echo "")
    if [ -n "$HTML_HASH" ]; then
        echo "   HTML references: main-app-${HTML_HASH}.js"
        
        # Check if this file exists in S3
        FILE_EXISTS=$(aws s3 ls "s3://${BUCKET}/_next/static/chunks/main-app-${HTML_HASH}.js" 2>/dev/null | wc -l || echo "0")
        
        if [ "$FILE_EXISTS" -gt 0 ]; then
            echo "   ✅ File exists in S3"
        else
            echo "   ❌ File NOT found in S3 - HTML is outdated!"
            echo "   💡 Solution: Rebuild and redeploy the application"
        fi
    else
        echo "   ⚠️  Could not extract hash from HTML"
    fi
else
    echo "   ⚠️  Could not fetch HTML content"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Diagnostic Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. If HTML has outdated hashes → Rebuild and redeploy"
echo "2. If CloudFront returns HTML for /_next/* → Create separate behavior (see above)"
echo "3. Wait for cache invalidation to complete (5-15 minutes)"
echo ""

# Cleanup
rm -f ${CONFIG_FILE} ${ETAG_FILE}
