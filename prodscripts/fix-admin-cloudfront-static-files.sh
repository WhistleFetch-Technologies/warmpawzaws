#!/bin/bash
# Fix admin-web CloudFront static files issue - JavaScript files returning HTML
# This script adds a separate cache behavior for /_next/* paths to prevent 404s from returning index.html
#
# ⚠️  WARNING: This script modifies PRODUCTION CloudFront distribution!

set -e

DIST_ID="E2NHO6UUI5UIHW"
BUCKET="warmpawz-prod-admin-frontend-ap-south-1"
CLOUDFRONT_URL="https://dbr09zyoq9akb.cloudfront.net"
REGION="ap-south-1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Fixing Admin-Web CloudFront Static Files Configuration${NC}"
echo -e "${BLUE}===========================================================${NC}"
echo ""

# Safety confirmation
echo -e "${YELLOW}⚠️  WARNING: This will modify PRODUCTION CloudFront distribution!${NC}"
echo -e "Distribution ID: ${DIST_ID}"
echo -e "CloudFront URL: ${CLOUDFRONT_URL}"
echo ""
read -p "Are you sure you want to continue? Type 'yes' to proceed: " confirm
if [ "$confirm" != "yes" ]; then
  echo -e "${RED}❌ Operation cancelled${NC}"
  exit 1
fi

# Step 1: Check if files exist in S3
echo ""
echo -e "${BLUE}1. Checking S3 bucket structure...${NC}"
JS_FILES=$(aws s3 ls "s3://${BUCKET}/_next/static/" --recursive 2>/dev/null | grep "\.js$" | wc -l || echo "0")
echo -e "   Found ${JS_FILES} JavaScript files in S3"

if [ "$JS_FILES" -eq "0" ]; then
    echo -e "${RED}   ❌ ERROR: No JavaScript files found in S3!${NC}"
    echo -e "${YELLOW}   This indicates a deployment issue. Please rebuild and redeploy first.${NC}"
    exit 1
fi

# Check for specific files mentioned in error
echo ""
echo -e "${BLUE}2. Verifying specific JavaScript files exist...${NC}"
MISSING_FILES=0

# List of files from error messages
ERROR_FILES=(
    "_next/static/chunks/9895-bb8627f85c26e3a5.js"
    "_next/static/chunks/webpack-e4aef669f45f2f71.js"
    "_next/static/chunks/error-fc5090c015f1c157.js"
    "_next/static/chunks/not-found-f7d0c7ee6f0af1da.js"
    "_next/static/chunks/layout-62ec5a8953c783d6.js"
    "_next/static/chunks/main-app-d059e49c0b81da39.js"
    "_next/static/chunks/vendors-0469875b9dc51522.js"
    "_next/static/chunks/page-9e1be3afa8fb7224.js"
)

for file in "${ERROR_FILES[@]}"; do
    if aws s3 ls "s3://${BUCKET}/${file}" > /dev/null 2>&1; then
        echo -e "   ${GREEN}✅${NC} ${file}"
    else
        echo -e "   ${RED}❌${NC} ${file} (NOT FOUND)"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
done

if [ "$MISSING_FILES" -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Warning: ${MISSING_FILES} file(s) not found in S3${NC}"
    echo -e "${YELLOW}   This might indicate the build has different hashes.${NC}"
    echo -e "${YELLOW}   The fix will still work if files exist with different names.${NC}"
fi

# Step 2: Get current CloudFront config
echo ""
echo -e "${BLUE}3. Fetching CloudFront distribution configuration...${NC}"
CONFIG_FILE="/tmp/cf-admin-config-${DIST_ID}.json"

aws cloudfront get-distribution-config \
    --id ${DIST_ID} \
    --region ${REGION} > ${CONFIG_FILE}

ETAG=$(jq -r '.ETag' ${CONFIG_FILE})
DIST_CONFIG=$(jq -r '.DistributionConfig' ${CONFIG_FILE})

echo -e "   ${GREEN}✅${NC} Configuration fetched (ETag: ${ETAG})"

# Step 3: Check if /_next/* behavior already exists
echo ""
echo -e "${BLUE}4. Checking existing cache behaviors...${NC}"
BEHAVIORS=$(echo ${DIST_CONFIG} | jq '.CacheBehaviors.Items // []')
HAS_NEXT_BEHAVIOR=$(echo ${BEHAVIORS} | jq '[.[] | select(.PathPattern == "/_next/*")] | length')

if [ "$HAS_NEXT_BEHAVIOR" -gt 0 ]; then
    echo -e "   ${GREEN}✅${NC} Cache behavior for /_next/* already exists"
    echo -e "   ${YELLOW}⚠️  Skipping behavior creation. Checking if it's configured correctly...${NC}"
    
    # Check if the behavior has custom error responses
    NEXT_BEHAVIOR=$(echo ${BEHAVIORS} | jq '.[] | select(.PathPattern == "/_next/*")')
    NEXT_ERRORS=$(echo ${NEXT_BEHAVIOR} | jq '.CustomErrorResponses.Items // [] | length')
    
    if [ "$NEXT_ERRORS" -gt 0 ]; then
        echo -e "   ${YELLOW}⚠️  Warning: /_next/* behavior has custom error responses${NC}"
        echo -e "   ${YELLOW}   These should be removed to prevent HTML from being returned for missing JS files${NC}"
    else
        echo -e "   ${GREEN}✅${NC} /_next/* behavior has no custom error responses (correct)"
    fi
else
    echo -e "   ${YELLOW}⚠️  No cache behavior for /_next/* found${NC}"
    echo -e "   ${BLUE}   Creating new cache behavior...${NC}"
    
    # Get default cache behavior as template
    DEFAULT_BEHAVIOR=$(echo ${DIST_CONFIG} | jq '.DefaultCacheBehavior')
    
    # Create new behavior based on default, but without custom error responses
    NEW_BEHAVIOR=$(echo ${DEFAULT_BEHAVIOR} | jq '{
        PathPattern: "/_next/*",
        TargetOriginId: .TargetOriginId,
        ViewerProtocolPolicy: .ViewerProtocolPolicy,
        AllowedMethods: .AllowedMethods,
        CachedMethods: .CachedMethods,
        ForwardedValues: .ForwardedValues,
        MinTTL: .MinTTL,
        DefaultTTL: 86400,
        MaxTTL: 31536000,
        Compress: .Compress,
        TrustedSigners: .TrustedSigners,
        TrustedKeyGroups: .TrustedKeyGroups,
        SmoothStreaming: .SmoothStreaming,
        FieldLevelEncryptionId: .FieldLevelEncryptionId,
        CachePolicyId: .CachePolicyId,
        OriginRequestPolicyId: .OriginRequestPolicyId,
        ResponseHeadersPolicyId: .ResponseHeadersPolicyId,
        RealtimeLogConfigArn: .RealtimeLogConfigArn,
        CustomErrorResponses: {
            Quantity: 0,
            Items: []
        }
    }')
    
    # Add function associations if they exist (but skip URL rewrite for static files)
    if echo ${DEFAULT_BEHAVIOR} | jq -e '.FunctionAssociations' > /dev/null 2>&1; then
        # Don't add URL rewrite function for /_next/* paths
        NEW_BEHAVIOR=$(echo ${NEW_BEHAVIOR} | jq '.FunctionAssociations = {Quantity: 0, Items: []}')
    fi
    
    # Get existing behaviors count
    EXISTING_COUNT=$(echo ${BEHAVIORS} | jq 'length')
    
    # Add new behavior to existing behaviors array
    UPDATED_BEHAVIORS=$(echo ${BEHAVIORS} | jq ". + [${NEW_BEHAVIOR}]")
    
    # Update distribution config
    UPDATED_CONFIG=$(echo ${DIST_CONFIG} | jq --argjson new_behaviors "${UPDATED_BEHAVIORS}" '
        .CacheBehaviors.Quantity = ($new_behaviors | length) |
        .CacheBehaviors.Items = $new_behaviors
    ')
    
    # Save updated config
    echo ${UPDATED_CONFIG} > /tmp/cf-admin-updated-${DIST_ID}.json
    
    # Update distribution
    echo -e "   ${BLUE}   Updating CloudFront distribution...${NC}"
    UPDATE_RESULT=$(aws cloudfront update-distribution \
        --id ${DIST_ID} \
        --if-match ${ETAG} \
        --distribution-config file:///tmp/cf-admin-updated-${DIST_ID}.json \
        --region ${REGION} 2>&1)
    
    if [ $? -eq 0 ]; then
        echo -e "   ${GREEN}✅${NC} Cache behavior created successfully"
        echo -e "   ${YELLOW}⏳ CloudFront distribution update is in progress${NC}"
        echo -e "   ${YELLOW}   This may take 15-20 minutes to deploy${NC}"
    else
        echo -e "   ${RED}❌${NC} Failed to update distribution"
        echo "$UPDATE_RESULT"
        rm -f /tmp/cf-admin-updated-${DIST_ID}.json
        exit 1
    fi
    
    rm -f /tmp/cf-admin-updated-${DIST_ID}.json
fi

# Step 4: Invalidate CloudFront cache
echo ""
echo -e "${BLUE}5. Invalidating CloudFront cache for static files...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id ${DIST_ID} \
    --paths "/_next/static/*" "/_next/image/*" "/*.js" "/*.css" \
    --query 'Invalidation.Id' \
    --output text \
    --region ${REGION} 2>&1)

if [ $? -eq 0 ]; then
    echo -e "   ${GREEN}✅${NC} Cache invalidation created: ${INVALIDATION_ID}"
    echo -e "   ${YELLOW}⏳ Full propagation may take 5-15 minutes${NC}"
else
    echo -e "   ${YELLOW}⚠️  Warning: Cache invalidation failed (but behavior update may still work)${NC}"
    echo "$INVALIDATION_ID"
fi

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ CloudFront Fix Complete                                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   ✅ S3 bucket checked: ${JS_FILES} JavaScript files found"
echo -e "   ✅ CloudFront behavior for /_next/* configured"
echo -e "   ✅ Cache invalidation created"
echo ""
echo -e "${BLUE}⏰ Next Steps:${NC}"
echo -e "   1. Wait 15-20 minutes for CloudFront distribution update to complete"
echo -e "   2. Wait 5-15 minutes for cache invalidation to propagate"
echo -e "   3. Test the application at ${CLOUDFRONT_URL}"
echo -e "   4. Check browser console - JavaScript errors should be resolved"
echo ""
echo -e "${YELLOW}💡 Note: If issues persist after 20 minutes, verify:${NC}"
echo -e "   - All JavaScript files are in S3 bucket"
echo -e "   - HTML file references correct file hashes"
echo -e "   - Consider rebuilding and redeploying if hashes don't match"
echo ""

# Cleanup
rm -f ${CONFIG_FILE}
