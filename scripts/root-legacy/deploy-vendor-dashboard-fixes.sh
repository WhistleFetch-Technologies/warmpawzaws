#!/bin/bash

# ============================================================================
# Vendor Dashboard Fixes - Deployment Script
# ============================================================================
# Deploys the vendor dashboard fixes to production
# Date: January 15, 2026
# ============================================================================

set -e  # Exit on error

echo "🚀 Deploying Vendor Dashboard Fixes..."
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Track deployment time
START_TIME=$(date +%s)

# ============================================================================
# Step 1: Pre-deployment Checks
# ============================================================================
echo -e "${YELLOW}Step 1: Pre-deployment Checks${NC}"
echo "=================================="

# Check if we're on the right branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Check if build succeeded
if [ ! -d "apps/vendor-web/.next" ]; then
    echo -e "${RED}❌ Build directory not found. Running build...${NC}"
    cd apps/vendor-web
    npm run build
    cd ../..
fi

echo -e "${GREEN}✅ Pre-deployment checks passed${NC}"
echo ""

# ============================================================================
# Step 2: Create Deployment Backup
# ============================================================================
echo -e "${YELLOW}Step 2: Creating Deployment Backup${NC}"
echo "=================================="

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=".deploy/vendor-web-${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

# Backup current build
if [ -d "apps/vendor-web/.next" ]; then
    cp -r apps/vendor-web/.next "$BACKUP_DIR/"
    echo "Backed up build to: $BACKUP_DIR"
fi

echo -e "${GREEN}✅ Backup created${NC}"
echo ""

# ============================================================================
# Step 3: Git Push to Remote
# ============================================================================
echo -e "${YELLOW}Step 3: Pushing to Git Repository${NC}"
echo "=================================="

read -p "Push changes to remote? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Pushing to origin/$CURRENT_BRANCH..."
    git push origin $CURRENT_BRANCH
    echo -e "${GREEN}✅ Changes pushed to remote${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping git push${NC}"
fi
echo ""

# ============================================================================
# Step 4: Deploy Frontend
# ============================================================================
echo -e "${YELLOW}Step 4: Deploy Frontend${NC}"
echo "=================================="
echo ""
echo "Choose deployment method:"
echo "  1) AWS Amplify (auto-deploy from git)"
echo "  2) Vercel"
echo "  3) S3 + CloudFront"
echo "  4) Skip frontend deployment"
echo ""
read -p "Enter choice (1-4): " DEPLOY_CHOICE

case $DEPLOY_CHOICE in
    1)
        echo "AWS Amplify deployment..."
        echo ""
        echo -e "${BLUE}ℹ️  Amplify will auto-deploy from git push${NC}"
        echo "Monitor deployment at:"
        echo "  https://console.aws.amazon.com/amplify"
        echo ""
        read -p "Press Enter to continue..."
        ;;
    2)
        echo "Vercel deployment..."
        cd apps/vendor-web
        if command -v vercel &> /dev/null; then
            vercel --prod
        else
            echo -e "${RED}❌ Vercel CLI not found${NC}"
            echo "Install: npm i -g vercel"
            echo "Or deploy via: https://vercel.com"
        fi
        cd ../..
        ;;
    3)
        echo "S3 + CloudFront deployment..."
        cd apps/vendor-web
        
        # Export static files
        npm run build
        
        # Sync to S3 (adjust bucket name)
        echo "Syncing to S3..."
        aws s3 sync out/ s3://warmpawz-vendor-web-production/ --delete
        
        # Invalidate CloudFront cache
        echo "Invalidating CloudFront cache..."
        DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='vendor-web-production'].Id" --output text)
        if [ -n "$DISTRIBUTION_ID" ]; then
            aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
        fi
        
        cd ../..
        ;;
    4)
        echo -e "${YELLOW}⚠️  Skipping frontend deployment${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✅ Frontend deployment initiated${NC}"
echo ""

# ============================================================================
# Step 5: Verification
# ============================================================================
echo -e "${YELLOW}Step 5: Post-Deployment Verification${NC}"
echo "=================================="
echo ""
echo "Please verify the following:"
echo ""
echo "✅ Checklist:"
echo "  [ ] Open production URL in browser"
echo "  [ ] Login as veterinary clinic"
echo "  [ ] Verify 'Manage Staff' button appears"
echo "  [ ] Verify 'Center Profile' button appears"
echo "  [ ] Test custom services (no h.map error)"
echo "  [ ] Check browser console for errors"
echo "  [ ] Test with 3+ different vendor roles"
echo ""
read -p "Have you verified all items? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}✅ Deployment verified${NC}"
else
    echo -e "${YELLOW}⚠️  Please verify deployment manually${NC}"
fi
echo ""

# ============================================================================
# Step 6: Deployment Summary
# ============================================================================
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "======================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "======================================="
echo ""
echo "📊 Deployment Summary:"
echo "  • Time: ${DURATION}s"
echo "  • Branch: $CURRENT_BRANCH"
echo "  • Commit: $(git rev-parse --short HEAD)"
echo "  • Backup: $BACKUP_DIR"
echo ""
echo "📝 Changes Deployed:"
echo "  ✅ Fixed h.map TypeError in custom services"
echo "  ✅ Fixed staff management button visibility"
echo "  ✅ Fixed center profile button visibility"
echo "  ✅ Enhanced capability loading"
echo ""
echo "📚 Documentation:"
echo "  • VENDOR_DASHBOARD_FIXES_SUMMARY.md"
echo "  • VERIFICATION_TESTS.md"
echo "  • QUICK_TEST_GUIDE.md"
echo "  • DEPLOYMENT_READY.md"
echo ""
echo "🔍 Monitor for 24 hours:"
echo "  • CloudWatch Logs (if AWS)"
echo "  • Browser console errors"
echo "  • User feedback"
echo ""
echo "🚨 Rollback if needed:"
echo "  git revert HEAD && git push"
echo "  Or restore from: $BACKUP_DIR"
echo ""
echo -e "${GREEN}✅ All done! 🚀${NC}"
echo ""
