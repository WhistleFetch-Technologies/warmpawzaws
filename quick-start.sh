#!/bin/bash

# ============================================================================
# Complete Plan Feature - Quick Start Script
# ============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Complete Plan Feature - Quick Start Deployment       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Database Migration
echo -e "${YELLOW}Step 1/3: Database Migration${NC}"
echo "─────────────────────────────────────"
read -p "Run RDS migration now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./db/migrations/run-migration-rds.sh
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database migration complete!${NC}"
    else
        echo -e "${YELLOW}⚠️  Migration had issues. Continue anyway? (y/n)${NC}"
        read -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⏭️  Skipping migration. Run manually: ./db/migrations/run-migration-rds.sh${NC}"
fi
echo ""

# Step 2: Backend Deployment
echo -e "${YELLOW}Step 2/3: Backend Deployment${NC}"
echo "─────────────────────────────────────"
read -p "Deploy backend to AWS? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter stage (dev/staging/prod) [default: dev]: " STAGE
    STAGE=${STAGE:-dev}
    
    echo "Building backend..."
    cd backend/lambda
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "Deploying to AWS Lambda..."
        serverless deploy --stage $STAGE
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Backend deployed successfully!${NC}"
        else
            echo -e "${YELLOW}⚠️  Deployment had issues. Check CloudWatch logs.${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Build failed. Check errors above.${NC}"
    fi
    cd ../..
else
    echo -e "${YELLOW}⏭️  Skipping backend deployment${NC}"
fi
echo ""

# Step 3: Frontend Deployment
echo -e "${YELLOW}Step 3/3: Frontend Deployment${NC}"
echo "─────────────────────────────────────"
read -p "Build frontend? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Building frontend..."
    cd apps/admin-web
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend build successful!${NC}"
        echo ""
        echo "Next: Deploy to your hosting platform:"
        echo "  - Vercel: vercel --prod"
        echo "  - Netlify: netlify deploy --prod"
        echo "  - Or your platform's command"
    else
        echo -e "${YELLOW}⚠️  Build failed. Check errors above.${NC}"
    fi
    cd ../..
else
    echo -e "${YELLOW}⏭️  Skipping frontend build${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Deployment Complete!                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "1. Test the feature: Support & CRM > Open ticket > Complete Plan"
echo "2. Verify plan generation works"
echo "3. Check database for created plans"
echo ""
echo -e "${GREEN}🎉 Complete Plan feature is ready!${NC}"
