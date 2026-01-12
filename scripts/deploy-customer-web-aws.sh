#!/bin/bash

# ============================================================================
# DEPLOY CUSTOMER WEB TO AWS SERVERLESS DEV ENVIRONMENT
# ============================================================================
# Builds and deploys customer web to AWS S3 + CloudFront
# Does NOT touch infrastructure - only deploys code
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   DEPLOY CUSTOMER WEB TO AWS SERVERLESS DEV              ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
REGION="ap-south-1"
ENVIRONMENT="dev"

# Try to detect S3 bucket name
S3_BUCKET=""
CLOUDFRONT_ID=""

# Check for existing bucket
echo -e "${BLUE}🔍 Detecting AWS Resources...${NC}"
BUCKETS=$(aws s3 ls --region $REGION 2>/dev/null | grep -iE "customer|warmpawz|web" | awk '{print $3}' | head -1)
if [ -n "$BUCKETS" ]; then
  S3_BUCKET="$BUCKETS"
  echo -e "   Found bucket: ${GREEN}$S3_BUCKET${NC}"
else
  # Try common naming patterns
  POTENTIAL_BUCKETS=(
    "warmpawz-customer-web-dev"
    "warmpawz-customer-web-$ENVIRONMENT"
    "warmpawz-dev-customer-web"
    "customer-web-$ENVIRONMENT"
  )
  
  for bucket in "${POTENTIAL_BUCKETS[@]}"; do
    if aws s3 ls "s3://$bucket" --region $REGION >/dev/null 2>&1; then
      S3_BUCKET="$bucket"
      echo -e "   Found bucket: ${GREEN}$S3_BUCKET${NC}"
      break
    fi
  done
fi

if [ -z "$S3_BUCKET" ]; then
  echo -e "${YELLOW}⚠️  S3 bucket not found. Please provide bucket name:${NC}"
  read -p "   S3 Bucket Name: " S3_BUCKET
fi

# Step 1: Test Backend Build
echo ""
echo -e "${BLUE}📦 Step 1: Testing Backend Build${NC}"
echo "────────────────────────────────────────────────────────────"
cd backend/lambda

if npm run build 2>&1 | tail -5; then
  echo -e "${GREEN}✅ Backend build successful${NC}"
else
  echo -e "${RED}❌ Backend build failed${NC}"
  exit 1
fi

cd ../..

# Step 2: Test Customer Web Build
echo ""
echo -e "${BLUE}📦 Step 2: Testing Customer Web Build${NC}"
echo "────────────────────────────────────────────────────────────"
cd apps/customer-web

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo -e "${YELLOW}⚠️  .env.local not found. Creating from template...${NC}"
  if [ -f .env.example ]; then
    cp .env.example .env.local
  fi
fi

# Build
if npm run build 2>&1 | tail -10; then
  echo -e "${GREEN}✅ Customer web build successful${NC}"
else
  echo -e "${RED}❌ Customer web build failed${NC}"
  exit 1
fi

# Check if .next directory exists
if [ ! -d ".next" ]; then
  echo -e "${RED}❌ Build output (.next) not found${NC}"
  exit 1
fi

cd ../..

# Step 3: Prepare for Deployment
echo ""
echo -e "${BLUE}📦 Step 3: Preparing Deployment${NC}"
echo "────────────────────────────────────────────────────────────"

# Create deployment directory
DEPLOY_DIR=".deploy/customer-web-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOY_DIR"

# Copy build output
echo "   Copying build files..."
cp -r apps/customer-web/.next/standalone/* "$DEPLOY_DIR/" 2>/dev/null || \
cp -r apps/customer-web/.next/static "$DEPLOY_DIR/" 2>/dev/null || \
cp -r apps/customer-web/.next "$DEPLOY_DIR/" 2>/dev/null || \
cp -r apps/customer-web/out/* "$DEPLOY_DIR/" 2>/dev/null || \
cp -r apps/customer-web/.next/* "$DEPLOY_DIR/" 2>/dev/null

# Copy public assets
if [ -d "apps/customer-web/public" ]; then
  cp -r apps/customer-web/public "$DEPLOY_DIR/"
fi

# Copy necessary files
if [ -f "apps/customer-web/package.json" ]; then
  cp apps/customer-web/package.json "$DEPLOY_DIR/"
fi

echo -e "${GREEN}✅ Deployment package prepared${NC}"

# Step 4: Deploy to S3
echo ""
echo -e "${BLUE}🚀 Step 4: Deploying to S3${NC}"
echo "────────────────────────────────────────────────────────────"
echo "   Bucket: $S3_BUCKET"
echo "   Region: $REGION"

# Sync files to S3
if aws s3 sync "$DEPLOY_DIR" "s3://$S3_BUCKET" \
  --region $REGION \
  --delete \
  --exclude "*.map" \
  --exclude ".git/*" \
  --cache-control "public, max-age=31536000, immutable" 2>&1 | tail -10; then
  echo -e "${GREEN}✅ Files uploaded to S3${NC}"
else
  echo -e "${RED}❌ S3 upload failed${NC}"
  exit 1
fi

# Step 5: Invalidate CloudFront (if distribution exists)
echo ""
echo -e "${BLUE}🔄 Step 5: Invalidating CloudFront Cache${NC}"
echo "────────────────────────────────────────────────────────────"

# Try to find CloudFront distribution
DISTRIBUTIONS=$(aws cloudfront list-distributions --region $REGION --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, '$S3_BUCKET')].Id" --output text 2>/dev/null || echo "")

if [ -z "$DISTRIBUTIONS" ]; then
  # Try alternative method
  DISTRIBUTIONS=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment && contains(Comment, 'customer') || contains(Comment, 'Customer')].Id" --output text 2>/dev/null || echo "")
fi

if [ -n "$DISTRIBUTIONS" ]; then
  DIST_ID=$(echo $DISTRIBUTIONS | awk '{print $1}')
  echo "   Found CloudFront distribution: $DIST_ID"
  
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DIST_ID" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$INVALIDATION_ID" ]; then
    echo -e "${GREEN}✅ CloudFront cache invalidation created: $INVALIDATION_ID${NC}"
  else
    echo -e "${YELLOW}⚠️  Could not create CloudFront invalidation${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  CloudFront distribution not found. Skipping cache invalidation.${NC}"
fi

# Step 6: Summary
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    DEPLOYMENT SUMMARY                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Backend build: Successful${NC}"
echo -e "${GREEN}✅ Customer web build: Successful${NC}"
echo -e "${GREEN}✅ S3 deployment: Complete${NC}"
echo -e "${GREEN}✅ CloudFront invalidation: ${INVALIDATION_ID:-Skipped}${NC}"
echo ""
echo -e "📦 S3 Bucket: ${BLUE}$S3_BUCKET${NC}"
echo -e "🌐 Region: ${BLUE}$REGION${NC}"
if [ -n "$DIST_ID" ]; then
  echo -e "☁️  CloudFront: ${BLUE}$DIST_ID${NC}"
fi
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
