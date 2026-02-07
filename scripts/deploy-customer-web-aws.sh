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

# Configuration - ONLY official CloudFront URLs (do not create or discover new URLs)
# Official Customer: https://d2aoyjj8ine0wk.cloudfront.net
REGION="ap-south-1"
ENVIRONMENT="dev"
CLOUDFRONT_DIST_ID="E2RDORGXSWJJ87"
CLOUDFRONT_URL="https://d2aoyjj8ine0wk.cloudfront.net"
S3_BUCKET="warmpawz-dev-customer-frontend-ap-south-1"

# Verify bucket exists
echo -e "${BLUE}🔍 Verifying S3 bucket...${NC}"
if aws s3 ls "s3://${S3_BUCKET}" --region $REGION >/dev/null 2>&1; then
  echo -e "   Bucket: ${GREEN}$S3_BUCKET${NC}"
else
  echo -e "${YELLOW}⚠️  Bucket ${S3_BUCKET} not found or no access.${NC}"
  read -p "   S3 Bucket Name [${S3_BUCKET}]: " INPUT_BUCKET
  [ -n "$INPUT_BUCKET" ] && S3_BUCKET="$INPUT_BUCKET"
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
echo -e "${BLUE}🔄 Step 5: Invalidating CloudFront Cache (official Customer URL only)${NC}"
echo "────────────────────────────────────────────────────────────"

INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DIST_ID" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text 2>/dev/null || echo "")

if [ -n "$INVALIDATION_ID" ]; then
  echo -e "${GREEN}✅ CloudFront cache invalidation created: $INVALIDATION_ID${NC}"
  echo -e "   URL: ${CLOUDFRONT_URL}"
else
  echo -e "${YELLOW}⚠️  Could not create CloudFront invalidation${NC}"
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
echo -e "☁️  CloudFront: ${BLUE}${CLOUDFRONT_URL}${NC} (official)"
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
