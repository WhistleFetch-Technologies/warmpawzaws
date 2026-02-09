#!/bin/bash
# Fix CloudFront configuration for vendor-web PRODUCTION
# Adds a separate cache behavior for /_next/* paths to prevent HTML from being returned for JS files
# Usage: ./prodscripts/fix-vendor-cloudfront-prod.sh

set -e

CLOUDFRONT_DIST_ID="E3JDHOY1XIFOWE"
REGION="ap-south-1"
S3_BUCKET="warmpawz-prod-vendor-frontend-ap-south-1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Fixing CloudFront Configuration for Vendor Web PROD${NC}"
echo "================================================================"
echo ""

# Step 1: Get current distribution configuration
echo -e "${BLUE}📋 Fetching CloudFront distribution configuration...${NC}"
CONFIG_FILE="/tmp/cf-config-${CLOUDFRONT_DIST_ID}.json"

aws cloudfront get-distribution-config \
    --id ${CLOUDFRONT_DIST_ID} \
    --region ${REGION} > ${CONFIG_FILE}

ETAG=$(jq -r '.ETag' ${CONFIG_FILE})
DIST_CONFIG=$(jq -r '.DistributionConfig' ${CONFIG_FILE})

echo -e "${GREEN}✅ Configuration fetched (ETag: ${ETAG})${NC}"

# Step 2: Check if /_next/* behavior already exists
echo ""
echo -e "${BLUE}🔍 Checking for existing /_next/* cache behavior...${NC}"
HAS_NEXT_BEHAVIOR=$(echo ${DIST_CONFIG} | jq '[.CacheBehaviors.Items[]? | select(.PathPattern == "/_next/*")] | length')

if [ "$HAS_NEXT_BEHAVIOR" -gt 0 ]; then
    echo -e "${GREEN}✅ /_next/* cache behavior already exists${NC}"
    echo -e "${YELLOW}⚠️  Skipping CloudFront update (already configured)${NC}"
    rm -f ${CONFIG_FILE}
    exit 0
fi

echo -e "${YELLOW}⚠️  /_next/* cache behavior not found - will create it${NC}"

# Step 3: Get origin ID from default behavior
ORIGIN_ID=$(echo ${DIST_CONFIG} | jq -r '.DefaultCacheBehavior.TargetOriginId')
echo -e "${BLUE}📋 Origin ID: ${ORIGIN_ID}${NC}"

# Step 4: Create updated configuration with new cache behavior
echo ""
echo -e "${BLUE}📝 Creating updated configuration...${NC}"

# Get default cache behavior as template
DEFAULT_BEHAVIOR=$(echo ${DIST_CONFIG} | jq '.DefaultCacheBehavior')

# Create new behavior for /_next/* without custom error responses
NEW_BEHAVIOR=$(echo ${DEFAULT_BEHAVIOR} | jq '{
    PathPattern: "/_next/*",
    TargetOriginId: .TargetOriginId,
    ViewerProtocolPolicy: .ViewerProtocolPolicy,
    AllowedMethods: .AllowedMethods,
    CachedMethods: .CachedMethods,
    ForwardedValues: .ForwardedValues,
    MinTTL: .MinTTL,
    DefaultTTL: .DefaultTTL,
    MaxTTL: .MaxTTL,
    Compress: .Compress,
    TrustedSigners: .TrustedSigners,
    TrustedKeyGroups: .TrustedKeyGroups,
    SmoothStreaming: .SmoothStreaming,
    FieldLevelEncryptionId: .FieldLevelEncryptionId,
    CachePolicyId: .CachePolicyId,
    OriginRequestPolicyId: .OriginRequestPolicyId,
    ResponseHeadersPolicyId: .ResponseHeadersPolicyId,
    RealtimeLogConfigArn: .RealtimeLogConfigArn
} | del(.CustomErrorResponses)')

# Add function association if it exists in default behavior
if echo ${DEFAULT_BEHAVIOR} | jq -e '.FunctionAssociations' > /dev/null 2>&1; then
    NEW_BEHAVIOR=$(echo ${NEW_BEHAVIOR} | jq --argjson funcs "$(echo ${DEFAULT_BEHAVIOR} | jq '.FunctionAssociations')" '. + {FunctionAssociations: $funcs}')
fi

# Update the distribution config
UPDATED_CONFIG=$(echo ${DIST_CONFIG} | jq --argjson new_behavior "${NEW_BEHAVIOR}" '
    .CacheBehaviors.Quantity = (.CacheBehaviors.Items | length + 1) |
    .CacheBehaviors.Items += [$new_behavior]
')

# Write updated config to file
echo ${UPDATED_CONFIG} > /tmp/cf-config-updated.json

# Step 5: Update CloudFront distribution
echo ""
echo -e "${BLUE}🚀 Updating CloudFront distribution...${NC}"
echo -e "${YELLOW}⚠️  This will take 5-15 minutes to propagate${NC}"

UPDATE_OUTPUT=$(aws cloudfront update-distribution \
    --id ${CLOUDFRONT_DIST_ID} \
    --if-match ${ETAG} \
    --distribution-config file:///tmp/cf-config-updated.json \
    --query 'Distribution.{Id:Id,Status:Status}' \
    --output json 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ CloudFront distribution update initiated${NC}"
    echo "${UPDATE_OUTPUT}" | jq '.'
    echo ""
    echo -e "${YELLOW}⏳ Distribution update is in progress${NC}"
    echo -e "${YELLOW}   This typically takes 5-15 minutes to complete${NC}"
    echo -e "${YELLOW}   You can check status in AWS Console${NC}"
else
    echo -e "${RED}❌ Failed to update CloudFront distribution${NC}"
    echo "${UPDATE_OUTPUT}"
    rm -f ${CONFIG_FILE} /tmp/cf-config-updated.json
    exit 1
fi

# Cleanup
rm -f ${CONFIG_FILE} /tmp/cf-config-updated.json

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ CLOUDFRONT CONFIGURATION UPDATE INITIATED                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📋 Summary:"
echo -e "   ✅ Added cache behavior for /_next/* paths"
echo -e "   ✅ This behavior has NO custom error responses"
echo -e "   ✅ JavaScript files will now return proper 404s instead of HTML"
echo ""
echo -e "⏰ Next Steps:"
echo -e "   1. Wait 5-15 minutes for CloudFront update to complete"
echo -e "   2. Deploy vendor-web using: ./prodscripts/deploy-vendor-web-prod.sh"
echo -e "   3. Test the application after deployment"
echo ""
