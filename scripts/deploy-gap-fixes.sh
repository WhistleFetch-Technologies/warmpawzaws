#!/bin/bash

# ============================================================================
# DEPLOY GAP FIXES - Complete Deployment Script
# ============================================================================
# Runs migration, backend, and frontend deployment for gap fixes
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Configuration
ENVIRONMENT=${1:-dev}
STAGE=${ENVIRONMENT}
REGION=${2:-ap-south-1}

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Vendor Discovery Gap Fixes - Complete Deployment      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Region: ${REGION}${NC}"
echo ""

# ============================================================================
# STEP 1: DATABASE MIGRATION
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}[1/3] Running Database Migration 412${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

export ENVIRONMENT=${ENVIRONMENT}
export AWS_REGION=${REGION}

if node scripts/run-migration-412-gap-fixes.js; then
    echo -e "${GREEN}✅ Migration 412 completed successfully${NC}"
    echo ""
else
    echo -e "${RED}❌ Migration failed. Please check the error above.${NC}"
    exit 1
fi

# ============================================================================
# STEP 2: BACKEND DEPLOYMENT
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}[2/3] Deploying Backend (Lambda)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd backend/lambda

if ./scripts/deploy.sh ${STAGE} ${REGION}; then
    echo -e "${GREEN}✅ Backend deployment completed successfully${NC}"
    echo ""
    cd "$PROJECT_ROOT"
else
    echo -e "${RED}❌ Backend deployment failed. Please check the error above.${NC}"
    cd "$PROJECT_ROOT"
    exit 1
fi

# ============================================================================
# STEP 3: FRONTEND DEPLOYMENT
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}[3/3] Deploying Frontend (Customer Web)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if ./scripts/deploy-customer-web.sh; then
    echo -e "${GREEN}✅ Frontend deployment completed successfully${NC}"
    echo ""
else
    echo -e "${RED}❌ Frontend deployment failed. Please check the error above.${NC}"
    exit 1
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              🎉 DEPLOYMENT COMPLETE! 🎉                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Migration 412: Applied${NC}"
echo -e "${GREEN}✅ Backend: Deployed${NC}"
echo -e "${GREEN}✅ Frontend: Deployed${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo -e "   1. Run tests: ${BLUE}./scripts/test-gap-fixes.sh${NC}"
echo -e "   2. Verify endpoints are working"
echo -e "   3. Test tele consultation modal in customer app"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo -e "   - Deployment Guide: ${BLUE}DEPLOYMENT_GUIDE_GAP_FIXES.md${NC}"
echo -e "   - Summary: ${BLUE}GAP_FIXES_SUMMARY.md${NC}"
echo ""
