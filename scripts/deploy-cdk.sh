#!/bin/bash
# ============================================================================
# WARMPAWZ - AWS CDK DEPLOYMENT SCRIPT
# ============================================================================
# 
# Deploys the entire Warmpawz infrastructure to AWS
#
# Usage:
#   ./scripts/deploy-cdk.sh dev       # Deploy to development
#   ./scripts/deploy-cdk.sh staging   # Deploy to staging
#   ./scripts/deploy-cdk.sh prod      # Deploy to production
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CDK_DIR="$PROJECT_ROOT/infrastructure/cdk"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT="${1:-dev}"

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}WARMPAWZ - AWS CDK Deployment${NC}"
echo -e "${GREEN}============================================${NC}"
echo "Environment: $ENVIRONMENT"
echo ""

# Validate environment
if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "prod" ]; then
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'${NC}"
    echo "Usage: ./scripts/deploy-cdk.sh [dev|staging|prod]"
    exit 1
fi

# ============================================================================
# PRE-DEPLOYMENT CHECKS
# ============================================================================
echo -e "${BLUE}Running pre-deployment checks...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not found. Please install AWS CLI.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured.${NC}"
    echo "Run: aws configure"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

echo -e "${GREEN}✓ AWS CLI configured${NC}"
echo "  Account: $AWS_ACCOUNT"
echo "  Region: $AWS_REGION"

# Check CDK
if ! command -v cdk &> /dev/null; then
    echo -e "${YELLOW}Installing AWS CDK CLI...${NC}"
    npm install -g aws-cdk
fi

echo -e "${GREEN}✓ AWS CDK available${NC}"

# ============================================================================
# BUILD BACKEND LAMBDA
# ============================================================================
echo ""
echo -e "${BLUE}Building Lambda function...${NC}"

cd "$PROJECT_ROOT/backend/lambda"
npm install
npm run build

if [ -d "dist" ]; then
    echo -e "${GREEN}✓ Lambda build complete${NC}"
else
    echo -e "${RED}Error: Lambda build failed - dist directory not found${NC}"
    exit 1
fi

# ============================================================================
# CDK DEPLOYMENT
# ============================================================================
echo ""
echo -e "${BLUE}Deploying CDK stack...${NC}"

cd "$CDK_DIR"
npm install

# Bootstrap CDK (if needed)
echo "Checking CDK bootstrap status..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
    echo -e "${YELLOW}Bootstrapping CDK...${NC}"
    cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION
fi

# Synthesize and deploy
STACK_NAME="WarmpawzStack-$ENVIRONMENT"

echo ""
echo -e "${BLUE}Synthesizing CloudFormation template...${NC}"
cdk synth $STACK_NAME

echo ""
if [ "$ENVIRONMENT" == "prod" ]; then
    echo -e "${YELLOW}⚠️  PRODUCTION DEPLOYMENT${NC}"
    echo "You are about to deploy to PRODUCTION."
    read -p "Are you sure you want to continue? (yes/N): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

echo -e "${GREEN}Deploying $STACK_NAME...${NC}"
cdk deploy $STACK_NAME --require-approval never

# ============================================================================
# POST-DEPLOYMENT
# ============================================================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Get API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" \
    --output text 2>/dev/null || echo "Not available")

echo "Stack: $STACK_NAME"
echo "API URL: $API_URL"
echo ""

# Health check
if [ "$API_URL" != "Not available" ]; then
    echo -e "${BLUE}Running health check...${NC}"
    HEALTH_RESPONSE=$(curl -s "$API_URL/health" || echo "Failed")
    echo "Health check response: $HEALTH_RESPONSE"
fi

echo ""
echo -e "${GREEN}Deployment successful!${NC}"
echo ""
echo "Next steps:"
echo "1. Update mobile app API_BASE_URL to: $API_URL"
echo "2. Run database migrations if needed"
echo "3. Test all endpoints"

