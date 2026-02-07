#!/bin/bash

# ============================================================================
# DEPLOY FRONTEND AND BACKEND FIXES
# ============================================================================
# This script deploys both frontend error handling improvements and backend
# error handling fixes to AWS
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   🚀 DEPLOYING FRONTEND & BACKEND FIXES                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Deploy Frontend (Customer Web)
echo -e "${BLUE}[1/2] Deploying Customer Web Frontend...${NC}"
echo -e "${YELLOW}   This includes:${NC}"
echo -e "${YELLOW}   - Improved CORS error handling${NC}"
echo -e "${YELLOW}   - Better error recovery with cached data${NC}"
echo -e "${YELLOW}   - Reduced console noise${NC}"
echo ""

if [ -f "scripts/deploy-customer-web.sh" ]; then
  bash scripts/deploy-customer-web.sh
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend deployment successful${NC}"
  else
    echo -e "${RED}❌ Frontend deployment failed${NC}"
    exit 1
  fi
else
  echo -e "${RED}❌ Frontend deployment script not found${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}[2/2] Deploying Backend Lambda...${NC}"
echo -e "${YELLOW}   This includes:${NC}"
echo -e "${YELLOW}   - Improved error handling in customer-profile endpoints${NC}"
echo -e "${YELLOW}   - Better database query error recovery${NC}"
echo -e "${YELLOW}   - Graceful degradation when tables are missing${NC}"
echo ""

# Step 2: Deploy Backend Lambda
cd "$PROJECT_ROOT/backend/lambda"

if [ -f "deploy.sh" ]; then
  bash deploy.sh dev ap-south-1
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend deployment successful${NC}"
  else
    echo -e "${RED}❌ Backend deployment failed${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠️  deploy.sh not found, trying serverless directly...${NC}"
  if command -v serverless &> /dev/null; then
    serverless deploy --stage dev --region ap-south-1
  else
    echo -e "${RED}❌ Serverless Framework not found. Please install it:${NC}"
    echo -e "${YELLOW}   npm install -g serverless${NC}"
    exit 1
  fi
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ DEPLOYMENT COMPLETE                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📝 Summary:${NC}"
echo -e "   ✅ Frontend: Error handling improvements deployed"
echo -e "   ✅ Backend: Error handling improvements deployed"
echo ""
echo -e "${YELLOW}⏳ Note: CloudFront cache invalidation may take 5-15 minutes${NC}"
echo -e "${YELLOW}   Backend Lambda changes are live immediately${NC}"
echo ""
