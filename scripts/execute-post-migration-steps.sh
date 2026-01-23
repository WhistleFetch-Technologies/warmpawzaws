#!/bin/bash

# ============================================================================
# Execute Post-Migration Steps 1, 2, and 3
# ============================================================================
# Step 1: Verify Migration Success
# Step 2: Deploy Backend Code
# Step 3: Run Verification
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

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

# Check if migration was run
echo "Checking migration status..."
echo ""
echo "To verify migration, run:"
echo -e "${YELLOW}  node scripts/run-migration-300-customer-phone.js $ENVIRONMENT $REGION${NC}"
echo ""

read -p "Have you already run the migration? (y/n): " MIGRATION_RUN

if [ "$MIGRATION_RUN" != "y" ] && [ "$MIGRATION_RUN" != "Y" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Migration not run yet.${NC}"
    echo ""
    echo "Would you like to run it now? (y/n)"
    read -p "> " RUN_NOW
    
    if [ "$RUN_NOW" = "y" ] || [ "$RUN_NOW" = "Y" ]; then
        echo ""
        echo -e "${BLUE}Running migration...${NC}"
        node scripts/run-migration-300-customer-phone.js "$ENVIRONMENT" "$REGION"
        
        if [ $? -eq 0 ]; then
            echo ""
            echo -e "${GREEN}✅ Migration completed successfully!${NC}"
        else
            echo ""
            echo -e "${RED}❌ Migration failed. Please check the errors above.${NC}"
            exit 1
        fi
    else
        echo ""
        echo -e "${YELLOW}⚠️  Please run the migration first, then run this script again.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Migration status confirmed${NC}"
fi

echo ""
echo "=========================================="

# Step 2: Deploy Backend Code
echo -e "${BLUE}=== Step 2: Deploy Backend Code ===${NC}"
echo ""

# Check deployment method
echo "Checking available deployment methods..."
echo ""

# Check for AWS CDK
if [ -d "infra" ] || [ -d "infrastructure" ]; then
    echo -e "${GREEN}✅ Found infrastructure directory${NC}"
    DEPLOY_METHOD="cdk"
elif [ -f "scripts/deploy-lambda-direct.sh" ]; then
    echo -e "${GREEN}✅ Found Lambda deployment script${NC}"
    DEPLOY_METHOD="lambda"
elif [ -f "scripts/deploy-backend.sh" ]; then
    echo -e "${GREEN}✅ Found backend deployment script${NC}"
    DEPLOY_METHOD="backend"
else
    echo -e "${YELLOW}⚠️  No deployment script found${NC}"
    DEPLOY_METHOD="manual"
fi

echo ""
echo "Deployment method: $DEPLOY_METHOD"
echo ""

if [ "$DEPLOY_METHOD" != "manual" ]; then
    read -p "Deploy to $ENVIRONMENT now? (y/n): " DEPLOY_NOW
    
    if [ "$DEPLOY_NOW" = "y" ] || [ "$DEPLOY_NOW" = "Y" ]; then
        echo ""
        echo -e "${BLUE}Deploying backend...${NC}"
        
        case $DEPLOY_METHOD in
            "cdk")
                if [ -f "scripts/deploy-cdk.sh" ]; then
                    ./scripts/deploy-cdk.sh "$ENVIRONMENT"
                else
                    echo "CDK deployment script not found. Please deploy manually."
                fi
                ;;
            "lambda")
                ./scripts/deploy-lambda-direct.sh "$ENVIRONMENT"
                ;;
            "backend")
                ./scripts/deploy-backend.sh
                ;;
        esac
        
        if [ $? -eq 0 ]; then
            echo ""
            echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
        else
            echo ""
            echo -e "${RED}❌ Deployment failed. Please check the errors above.${NC}"
            echo "You can continue with verification, but endpoints may not work."
            read -p "Continue with verification? (y/n): " CONTINUE
            if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
                exit 1
            fi
        fi
    else
        echo ""
        echo -e "${YELLOW}⚠️  Skipping deployment. You can deploy manually later.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Manual deployment required.${NC}"
    echo "Please deploy using your CI/CD pipeline or deployment method."
    echo ""
    read -p "Press Enter to continue with verification..."
fi

echo ""
echo "=========================================="

# Step 3: Run Verification
echo -e "${BLUE}=== Step 3: Run Verification ===${NC}"
echo ""

# Determine API base URL
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
        read -p "Enter API base URL (default: http://localhost:3000): " CUSTOM_URL
        API_BASE_URL="${CUSTOM_URL:-http://localhost:3000}"
        ;;
esac

echo "API Base URL: $API_BASE_URL"
echo ""

read -p "Run verification now? (y/n): " RUN_VERIFY

if [ "$RUN_VERIFY" = "y" ] || [ "$RUN_VERIFY" = "Y" ]; then
    echo ""
    echo -e "${BLUE}Running verification...${NC}"
    echo ""
    
    if [ -f "scripts/post-migration-verification.sh" ]; then
        ./scripts/post-migration-verification.sh "$ENVIRONMENT" "$API_BASE_URL"
    elif [ -f "scripts/verify-api-fixes.sh" ]; then
        ./scripts/verify-api-fixes.sh "$API_BASE_URL"
    else
        echo -e "${RED}❌ Verification script not found${NC}"
        echo "Please run verification manually:"
        echo "  ./scripts/verify-api-fixes.sh $API_BASE_URL"
    fi
else
    echo ""
    echo -e "${YELLOW}⚠️  Skipping verification. Run manually:${NC}"
    echo "  ./scripts/post-migration-verification.sh $ENVIRONMENT $API_BASE_URL"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Post-migration steps execution complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Monitor CloudWatch for 24-48 hours"
echo "  2. Test customer flows manually"
echo "  3. Gather customer feedback"
echo ""
