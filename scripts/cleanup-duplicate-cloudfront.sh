#!/bin/bash

# ============================================================================
# CLEANUP DUPLICATE CLOUDFRONT DISTRIBUTIONS
# ============================================================================
# This script disables and prepares for deletion of duplicate CloudFront
# distributions, keeping only the 3 OFFICIAL distributions:
# - Admin: E1WPXL8WBOWOE8 → dfof7mguaa0a5.cloudfront.net
# - Customer: E2RDORGXSWJJ87 → d2aoyjj8ine0wk.cloudfront.net
# - Vendor: E95171GX1I6HN → d1s6ykkj381k58.cloudfront.net
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REGION="ap-south-1"

# OFFICIAL CloudFront Distribution IDs (DO NOT DELETE)
OFFICIAL_ADMIN_ID="E1WPXL8WBOWOE8"
OFFICIAL_CUSTOMER_ID="E2RDORGXSWJJ87"
OFFICIAL_VENDOR_ID="E95171GX1I6HN"

OFFICIAL_IDS=("$OFFICIAL_ADMIN_ID" "$OFFICIAL_CUSTOMER_ID" "$OFFICIAL_VENDOR_ID")

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     CLOUDFRONT DUPLICATE CLEANUP SCRIPT                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Official CloudFront Distributions (KEEP):${NC}"
echo "  Admin:    $OFFICIAL_ADMIN_ID → dfof7mguaa0a5.cloudfront.net"
echo "  Customer: $OFFICIAL_CUSTOMER_ID → d2aoyjj8ine0wk.cloudfront.net"
echo "  Vendor:   $OFFICIAL_VENDOR_ID → d1s6ykkj381k58.cloudfront.net"
echo ""

# Get all CloudFront distributions
echo -e "${CYAN}📊 Fetching all CloudFront distributions...${NC}"
ALL_DISTRIBUTIONS=$(aws cloudfront list-distributions --region "$REGION" --query "DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName,Status,Enabled]" --output json)

# Parse and identify duplicates
echo -e "${CYAN}🔍 Identifying duplicate distributions...${NC}"
echo ""

DUPLICATES_FOUND=0
DUPLICATES_TO_DISABLE=()

# Check Admin distributions
ADMIN_DISTRIBUTIONS=$(echo "$ALL_DISTRIBUTIONS" | jq -r '.[] | select(.[2] | contains("admin-frontend")) | .[0]')
echo -e "${BLUE}Admin Frontend Distributions:${NC}"
for DIST_ID in $ADMIN_DISTRIBUTIONS; do
  DOMAIN=$(echo "$ALL_DISTRIBUTIONS" | jq -r ".[] | select(.[0] == \"$DIST_ID\") | .[1]")
  if [[ " ${OFFICIAL_IDS[@]} " =~ " ${DIST_ID} " ]]; then
    echo -e "  ${GREEN}✅ $DIST_ID → $DOMAIN (OFFICIAL - KEEP)${NC}"
  else
    echo -e "  ${RED}❌ $DIST_ID → $DOMAIN (DUPLICATE - WILL DISABLE)${NC}"
    DUPLICATES_TO_DISABLE+=("$DIST_ID")
    ((DUPLICATES_FOUND++))
  fi
done
echo ""

# Check Customer distributions
CUSTOMER_DISTRIBUTIONS=$(echo "$ALL_DISTRIBUTIONS" | jq -r '.[] | select(.[2] | contains("customer-frontend")) | .[0]')
echo -e "${BLUE}Customer Frontend Distributions:${NC}"
for DIST_ID in $CUSTOMER_DISTRIBUTIONS; do
  DOMAIN=$(echo "$ALL_DISTRIBUTIONS" | jq -r ".[] | select(.[0] == \"$DIST_ID\") | .[1]")
  if [[ " ${OFFICIAL_IDS[@]} " =~ " ${DIST_ID} " ]]; then
    echo -e "  ${GREEN}✅ $DIST_ID → $DOMAIN (OFFICIAL - KEEP)${NC}"
  else
    echo -e "  ${RED}❌ $DIST_ID → $DOMAIN (DUPLICATE - WILL DISABLE)${NC}"
    DUPLICATES_TO_DISABLE+=("$DIST_ID")
    ((DUPLICATES_FOUND++))
  fi
done
echo ""

# Check Vendor distributions
VENDOR_DISTRIBUTIONS=$(echo "$ALL_DISTRIBUTIONS" | jq -r '.[] | select(.[2] | contains("vendor-frontend")) | .[0]')
echo -e "${BLUE}Vendor Frontend Distributions:${NC}"
for DIST_ID in $VENDOR_DISTRIBUTIONS; do
  DOMAIN=$(echo "$ALL_DISTRIBUTIONS" | jq -r ".[] | select(.[0] == \"$DIST_ID\") | .[1]")
  if [[ " ${OFFICIAL_IDS[@]} " =~ " ${DIST_ID} " ]]; then
    echo -e "  ${GREEN}✅ $DIST_ID → $DOMAIN (OFFICIAL - KEEP)${NC}"
  else
    echo -e "  ${RED}❌ $DIST_ID → $DOMAIN (DUPLICATE - WILL DISABLE)${NC}"
    DUPLICATES_TO_DISABLE+=("$DIST_ID")
    ((DUPLICATES_FOUND++))
  fi
done
echo ""

if [ $DUPLICATES_FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ No duplicate distributions found. All good!${NC}"
  exit 0
fi

echo -e "${YELLOW}⚠️  Found $DUPLICATES_FOUND duplicate distribution(s)${NC}"
echo ""
echo -e "${YELLOW}This script will DISABLE (not delete) the duplicate distributions.${NC}"
echo -e "${YELLOW}CloudFront distributions must be disabled before they can be deleted.${NC}"
echo -e "${YELLOW}After disabling, you can manually delete them from AWS Console after 15+ days.${NC}"
echo ""
read -p "Continue with disabling duplicates? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo -e "${BLUE}Operation cancelled.${NC}"
  exit 0
fi

echo ""
echo -e "${CYAN}🔄 Disabling duplicate distributions...${NC}"
echo ""

DISABLED_COUNT=0
for DIST_ID in "${DUPLICATES_TO_DISABLE[@]}"; do
  echo -e "${BLUE}Disabling: $DIST_ID${NC}"
  
  # Get current distribution config
  CONFIG_ETAG=$(aws cloudfront get-distribution-config --id "$DIST_ID" --region "$REGION" --query 'ETag' --output text)
  CONFIG=$(aws cloudfront get-distribution-config --id "$DIST_ID" --region "$REGION" --query 'DistributionConfig' --output json)
  
  # Disable the distribution
  DISABLED_CONFIG=$(echo "$CONFIG" | jq '.Enabled = false')
  
  # Update distribution
  if aws cloudfront update-distribution \
    --id "$DIST_ID" \
    --if-match "$CONFIG_ETAG" \
    --distribution-config "$DISABLED_CONFIG" \
    --region "$REGION" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Disabled $DIST_ID${NC}"
    ((DISABLED_COUNT++))
  else
    echo -e "  ${RED}❌ Failed to disable $DIST_ID${NC}"
  fi
done

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Cleanup Summary${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo "  Disabled: $DISABLED_COUNT distribution(s)"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "  1. Disabled distributions will stop serving traffic immediately"
echo "  2. After 15+ days, you can delete them from AWS Console"
echo "  3. Only the 3 OFFICIAL distributions remain active:"
echo "     - Admin: $OFFICIAL_ADMIN_ID"
echo "     - Customer: $OFFICIAL_CUSTOMER_ID"
echo "     - Vendor: $OFFICIAL_VENDOR_ID"
echo ""
