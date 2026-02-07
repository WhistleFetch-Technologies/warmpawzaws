#!/bin/bash

# ============================================================================
# Complete Plan Feature - Deployment Script
# ============================================================================
# This script deploys the Complete Plan feature step by step
# ============================================================================

set -e  # Exit on error

echo "🚀 Starting Complete Plan Feature Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Database Migration
echo -e "${YELLOW}Step 1: Database Migration${NC}"
echo "=================================="
read -p "Have you run the database migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}⚠️  Please run the database migration first:${NC}"
    echo ""
    echo "Option 1: Using RDS connection string"
    echo "   psql -h YOUR_RDS_ENDPOINT.rds.amazonaws.com -U your_user -d your_database -f db/migrations/059_create_care_plans_tables.sql"
    echo ""
    echo "Option 2: Using SSM parameters"
    echo "   Get connection details from AWS SSM and connect to RDS"
    echo ""
    echo "Option 3: Use AWS RDS Query Editor or database management tool"
    echo ""
    read -p "Press Enter after running the migration..."
fi
echo -e "${GREEN}✅ Database migration verified${NC}"
echo ""

# Step 2: Backend Build
echo -e "${YELLOW}Step 2: Backend Build${NC}"
echo "=================================="
cd backend/lambda
echo "Building backend..."
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend build successful${NC}"
else
    echo -e "${RED}❌ Backend build failed${NC}"
    exit 1
fi
echo ""

# Step 3: Backend Deployment
echo -e "${YELLOW}Step 3: Backend Deployment${NC}"
echo "=================================="
read -p "Deploy backend to AWS? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter stage (dev/staging/prod): " STAGE
    echo "Deploying to stage: $STAGE"
    serverless deploy --stage $STAGE
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backend deployment successful${NC}"
    else
        echo -e "${RED}❌ Backend deployment failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⏭️  Skipping backend deployment${NC}"
fi
echo ""

# Step 4: Frontend Build
echo -e "${YELLOW}Step 4: Frontend Build${NC}"
echo "=================================="
cd ../../apps/admin-web
echo "Building frontend..."
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend build successful${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi
echo ""

# Step 5: Frontend Deployment
echo -e "${YELLOW}Step 5: Frontend Deployment${NC}"
echo "=================================="
read -p "Deploy frontend? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Please deploy to your hosting platform:"
    echo "  - Vercel: vercel --prod"
    echo "  - Netlify: netlify deploy --prod"
    echo "  - Or use your platform's deployment command"
    read -p "Press Enter after deploying frontend..."
    echo -e "${GREEN}✅ Frontend deployment completed${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping frontend deployment${NC}"
fi
echo ""

# Step 6: Verification
echo -e "${YELLOW}Step 6: Post-Deployment Verification${NC}"
echo "=================================="
echo "Please verify:"
echo "1. ✅ Database tables created (pet_care_plans, care_plan_items, care_plan_templates)"
echo "2. ✅ Backend endpoints respond (check API Gateway)"
echo "3. ✅ Frontend builds without errors"
echo "4. ✅ 'Complete Plan' button appears in Support/CRM"
echo "5. ✅ Modal opens when button clicked"
echo ""
read -p "Press Enter when verification is complete..."

echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test the feature in Support/CRM"
echo "2. Generate a test plan"
echo "3. Verify plan is saved in database"
echo "4. Train support team on using the feature"
echo ""
