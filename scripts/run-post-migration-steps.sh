#!/bin/bash

# ============================================================================
# Run Post-Migration Steps 1, 2, and 3 (Non-Interactive)
# ============================================================================
# This script executes the three post-migration steps
# Usage: ./scripts/run-post-migration-steps.sh [environment] [region] [api_url]
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"
API_BASE_URL="${3:-}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "Post-Migration Steps Execution"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Step 1: Verify Migration Success
echo -e "${BLUE}=== Step 1: Verify Migration Success ===${NC}"
echo ""

if [ ! -f "scripts/run-migration-300-customer-phone.js" ]; then
    echo -e "${RED}❌ Migration script not found${NC}"
    exit 1
fi

echo "Migration script found. Checking if migration needs to be run..."
echo ""
echo -e "${YELLOW}To run migration, execute:${NC}"
echo "  node scripts/run-migration-300-customer-phone.js $ENVIRONMENT $REGION"
echo ""
echo -e "${BLUE}If migration is already complete, proceed to Step 2.${NC}"
echo ""

# Step 2: Deploy Backend Code
echo -e "${BLUE}=== Step 2: Deploy Backend Code ===${NC}"
echo ""

# Check for Lambda deployment
if [ -f "scripts/deploy-lambda-direct.sh" ]; then
    echo -e "${GREEN}✅ Found Lambda deployment script${NC}"
    echo ""
    echo -e "${YELLOW}To deploy Lambda, run:${NC}"
    echo "  ./scripts/deploy-lambda-direct.sh"
    echo ""
elif [ -f "scripts/deploy-production.sh" ]; then
    echo -e "${GREEN}✅ Found production deployment script${NC}"
    echo ""
    echo -e "${YELLOW}To deploy, run:${NC}"
    echo "  ./scripts/deploy-production.sh $ENVIRONMENT"
    echo ""
else
    echo -e "${YELLOW}⚠️  No deployment script found${NC}"
    echo "Please deploy using your CI/CD pipeline or deployment method."
    echo ""
fi

# Step 3: Run Verification
echo -e "${BLUE}=== Step 3: Run Verification ===${NC}"
echo ""

# Determine API base URL if not provided
if [ -z "$API_BASE_URL" ]; then
    case $ENVIRONMENT in
        "dev")
            API_BASE_URL="http://localhost:3000"
            ;;
        "staging")
            API_BASE_URL="https://staging-api.warmpawz.com"
            ;;
        "prod"|"production")
            API_BASE_URL="https://api.warmpawz.com"
            ;;
        *)
            API_BASE_URL="http://localhost:3000"
            ;;
    esac
fi

echo "API Base URL: $API_BASE_URL"
echo ""

if [ -f "scripts/post-migration-verification.sh" ]; then
    echo -e "${GREEN}✅ Found verification script${NC}"
    echo ""
    echo -e "${YELLOW}To run verification, execute:${NC}"
    echo "  ./scripts/post-migration-verification.sh $ENVIRONMENT $API_BASE_URL"
    echo ""
elif [ -f "scripts/verify-api-fixes.sh" ]; then
    echo -e "${GREEN}✅ Found verification script${NC}"
    echo ""
    echo -e "${YELLOW}To run verification, execute:${NC}"
    echo "  ./scripts/verify-api-fixes.sh $API_BASE_URL"
    echo ""
else
    echo -e "${RED}❌ Verification script not found${NC}"
fi

echo "=========================================="
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next: Execute the commands shown above in order."
echo ""
