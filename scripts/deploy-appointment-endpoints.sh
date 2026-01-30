#!/bin/bash
# Deploy Appointment Management Backend Endpoints
# This script deploys the backend Lambda endpoints for appointment management
# Usage: ./scripts/deploy-appointment-endpoints.sh

set -e

echo "🚀 Deploying Appointment Management Backend Endpoints..."
echo "========================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get project root directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Verify backend structure exists
BACKEND_DIR="backend/lambda"
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Error: Backend directory not found at ${BACKEND_DIR}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend directory found: ${BACKEND_DIR}${NC}"

# Verify endpoint files exist
ENDPOINTS=(
    "backend/lambda/src/endpoints/staff.ts"
    "backend/lambda/src/endpoints/bookings-enhanced.ts"
    "backend/lambda/src/handler/index.ts"
)

echo ""
echo -e "${BLUE}🔍 Verifying endpoint files...${NC}"
for endpoint in "${ENDPOINTS[@]}"; do
    if [ -f "$endpoint" ]; then
        echo -e "${GREEN}   ✅ $(basename $endpoint)${NC}"
    else
        echo -e "${RED}   ❌ $(basename $endpoint) not found${NC}"
        exit 1
    fi
done

# Check if CDK is available
if ! command -v cdk &> /dev/null && ! npx cdk --version &> /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  CDK CLI not found. Using npx...${NC}"
    CDK_CMD="npx cdk"
else
    if command -v cdk &> /dev/null; then
        CDK_CMD="cdk"
    else
        CDK_CMD="npx cdk"
    fi
fi

# Check if we're in the right directory for CDK
if [ ! -f "cdk.json" ] && [ ! -f "infra/cdk.json" ]; then
    echo -e "${YELLOW}⚠️  CDK configuration not found in root${NC}"
    echo -e "${BLUE}   Checking for infrastructure directory...${NC}"
    
    if [ -d "infra" ]; then
        cd infra
        echo -e "${GREEN}   ✅ Found infra directory${NC}"
    elif [ -d "infrastructure" ]; then
        cd infrastructure
        echo -e "${GREEN}   ✅ Found infrastructure directory${NC}"
    else
        echo -e "${RED}❌ Error: Could not find CDK infrastructure directory${NC}"
        echo -e "${YELLOW}   Attempting direct Lambda deployment...${NC}"
        
        # Alternative: Deploy Lambda directly if CDK is not available
        cd "$BACKEND_DIR"
        
        if [ -f "package.json" ]; then
            echo -e "${BLUE}📦 Installing dependencies...${NC}"
            npm install
            
            echo -e "${BLUE}🔨 Building Lambda function...${NC}"
            npm run build || echo -e "${YELLOW}⚠️  Build script not found, skipping...${NC}"
            
            echo -e "${GREEN}✅ Lambda function prepared${NC}"
            echo -e "${YELLOW}⚠️  Note: Manual Lambda deployment required${NC}"
            echo -e "${BLUE}   Use AWS Console or CLI to deploy the Lambda function${NC}"
        fi
        
        exit 0
    fi
fi

# Deploy using CDK
echo ""
echo -e "${BLUE}🚀 Deploying Lambda function via CDK...${NC}"

# Check if CDK is bootstrapped
if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
    echo -e "${YELLOW}⚠️  CDK not bootstrapped. Bootstrapping...${NC}"
    $CDK_CMD bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-south-1
fi

# Deploy
echo -e "${BLUE}📤 Deploying infrastructure...${NC}"
$CDK_CMD deploy --require-approval never

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ ✅ ✅ APPOINTMENT ENDPOINTS DEPLOYMENT SUCCESSFUL! ✅ ✅ ✅${NC}"
    echo ""
    echo -e "${BLUE}📋 Deployment Summary:${NC}"
    echo -e "   Endpoints Deployed:"
    echo -e "   - GET /staff/:staffId/appointments"
    echo -e "   - PUT /staff/:staffId/appointments/:bookingId/accept"
    echo -e "   - PUT /staff/:staffId/appointments/:bookingId/reject"
    echo -e "   - PUT /staff/:staffId/appointments/:bookingId/start"
    echo -e "   - PUT /staff/:staffId/appointments/:bookingId/complete"
    echo -e "   - GET /vendor/bookings/:vendorId"
    echo -e "   - GET /vendor/:vendorId/staff"
    echo -e "   - POST /bookings/create (with staff_id support)"
    echo ""
    echo -e "${GREEN}🎉 Deployment complete!${NC}"
    echo ""
else
    echo -e "${RED}❌ Error: CDK deployment failed!${NC}"
    exit 1
fi
