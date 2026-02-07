#!/bin/bash
# ============================================================================
# Apply VPC Endpoints for NAT Gateway Fix
# ============================================================================
# This script applies the VPC endpoint changes to fix Razorpay connectivity
# by enabling VPC endpoints for Secrets Manager (reduces NAT dependency)
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}

echo "🔧 Applying VPC Endpoints Configuration"
echo "========================================"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check prerequisites
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform not found. Please install Terraform first.${NC}"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured.${NC}"
    exit 1
fi

# Navigate to infrastructure directory
INFRA_DIR="infra/envs/$ENVIRONMENT"

if [ ! -d "$INFRA_DIR" ]; then
    echo -e "${RED}❌ Infrastructure directory not found: $INFRA_DIR${NC}"
    exit 1
fi

cd "$INFRA_DIR"

echo -e "${YELLOW}📋 Step 1: Initializing Terraform...${NC}"
terraform init

echo ""
echo -e "${YELLOW}📋 Step 2: Planning changes...${NC}"
if [ -f "terraform.tfvars" ]; then
    echo "  Using terraform.tfvars file"
    terraform plan -var-file=terraform.tfvars -out=tfplan
else
    echo "  ⚠️  terraform.tfvars not found, using default values"
    terraform plan -out=tfplan
fi

echo ""
echo -e "${YELLOW}📋 Step 3: Reviewing changes...${NC}"
echo "The following changes will be applied:"
echo "  - VPC Endpoints for Secrets Manager (if not exists)"
echo "  - VPC Endpoints for SNS (if not exists)"
echo "  - VPC Endpoints for SQS (if not exists)"
echo "  - Security Group for VPC Endpoints"
echo ""
read -p "Do you want to apply these changes? (y/n) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Changes cancelled${NC}"
    rm -f tfplan
    exit 0
fi

echo ""
echo -e "${YELLOW}📋 Step 4: Applying changes...${NC}"
terraform apply tfplan

echo ""
echo -e "${GREEN}✅ VPC Endpoints configuration applied successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify NAT Gateway routing (run: ./scripts/diagnose-nat-gateway.sh $ENVIRONMENT $AWS_REGION)"
echo "  2. Test Razorpay connectivity from Lambda"
echo "  3. Check CloudWatch logs for any errors"
echo ""

rm -f tfplan
