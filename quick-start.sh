#!/bin/bash
# Quick Start Script for Warmpawz CI/CD Infrastructure
# Run this script to set up everything from scratch

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "═══════════════════════════════════════════════"
echo "  Warmpawz CI/CD Infrastructure Setup"
echo "═══════════════════════════════════════════════"
echo -e "${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS CLI found${NC}"

if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform not found. Please install it first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Terraform found${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install it first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found${NC}"

# Get AWS Account ID
echo ""
echo -e "${YELLOW}Getting AWS Account information...${NC}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Unable to get AWS Account ID. Please configure AWS CLI first.${NC}"
    echo "Run: aws configure"
    exit 1
fi

echo -e "${GREEN}✓ AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"
AWS_REGION=$(aws configure get region || echo "us-east-1")
echo -e "${GREEN}✓ AWS Region: ${AWS_REGION}${NC}"

# Ask for confirmation
echo ""
echo -e "${YELLOW}This script will:${NC}"
echo "  1. Create Terraform state backend (S3 + DynamoDB)"
echo "  2. Update backend configurations with your account ID"
echo "  3. Set up AWS Secrets Manager secrets"
echo "  4. Initialize development environment"
echo ""
read -p "Do you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}Setup cancelled.${NC}"
    exit 0
fi

# Step 1: Create Terraform State Backend
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 1: Creating Terraform State Backend${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

cd infra/bootstrap

# Update backend.tf with account ID
sed -i.bak "s/YOUR_ACCOUNT_ID/${AWS_ACCOUNT_ID}/g" backend.tf
rm -f backend.tf.bak

echo -e "${YELLOW}Initializing Terraform...${NC}"
terraform init

echo -e "${YELLOW}Creating state backend...${NC}"
terraform apply \
  -var="create_state_backend=true" \
  -var="aws_account_id=${AWS_ACCOUNT_ID}" \
  -auto-approve

echo -e "${GREEN}✓ State backend created${NC}"

# Step 2: Update Environment Backend Configs
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 2: Updating Environment Configurations${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

cd ../..

for ENV in dev stage prod; do
    echo -e "${YELLOW}Updating ${ENV} backend config...${NC}"
    sed -i.bak "s/YOUR_ACCOUNT_ID/${AWS_ACCOUNT_ID}/g" "infra/envs/${ENV}/backend.hcl"
    rm -f "infra/envs/${ENV}/backend.hcl.bak"
    echo -e "${GREEN}✓ ${ENV} backend config updated${NC}"
done

# Step 3: Set Up Secrets
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 3: Setting Up AWS Secrets Manager${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo -e "${YELLOW}We'll set up secrets for the development environment.${NC}"
echo -e "${YELLOW}You can run this script again for stage and prod later.${NC}"
echo ""

read -p "Do you want to set up secrets now? (yes/no): " SETUP_SECRETS

if [ "$SETUP_SECRETS" == "yes" ]; then
    chmod +x scripts/setup-secrets.sh
    ./scripts/setup-secrets.sh dev
else
    echo -e "${YELLOW}⚠️  Skipping secrets setup. Run './scripts/setup-secrets.sh dev' later.${NC}"
fi

# Step 4: Install Dependencies
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 4: Installing Dependencies${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

if [ -f "package.json" ]; then
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️  No package.json found. Skipping npm install.${NC}"
fi

# Step 5: Initialize Dev Environment
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 5: Initialize Development Environment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

read -p "Do you want to deploy the development environment now? (yes/no): " DEPLOY_DEV

if [ "$DEPLOY_DEV" == "yes" ]; then
    cd infra/envs/dev
    
    echo -e "${YELLOW}Initializing Terraform for dev environment...${NC}"
    terraform init -backend-config=backend.hcl
    
    echo -e "${YELLOW}Planning infrastructure...${NC}"
    terraform plan
    
    echo ""
    read -p "Apply this plan? (yes/no): " APPLY_PLAN
    
    if [ "$APPLY_PLAN" == "yes" ]; then
        terraform apply
        echo -e "${GREEN}✓ Development environment deployed!${NC}"
    else
        echo -e "${YELLOW}⚠️  Skipping deployment. Run 'terraform apply' manually later.${NC}"
    fi
    
    cd ../../..
else
    echo -e "${YELLOW}⚠️  Skipping dev deployment. You can deploy later with:${NC}"
    echo "    cd infra/envs/dev"
    echo "    terraform init -backend-config=backend.hcl"
    echo "    terraform apply"
fi

# Final Summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}           ✅ Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}What's been set up:${NC}"
echo "  ✓ Terraform state backend (S3 + DynamoDB)"
echo "  ✓ Backend configurations updated"
echo "  ✓ Secrets configured (if selected)"
echo "  ✓ Dependencies installed"
echo "  ✓ Dev environment initialized (if selected)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Set up GitHub Secrets (see .github/SECRETS.md)"
echo "  2. Create GitHub Environments (dev, stage, prod)"
echo "  3. Push to 'develop' branch to trigger dev deployment"
echo "  4. Follow docs/DEPLOYMENT_GUIDE.md for stage/prod"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "  - Quick Start: README_CICD.md"
echo "  - Deployment Guide: docs/DEPLOYMENT_GUIDE.md"
echo "  - Bootstrap Guide: docs/BOOTSTRAP_GUIDE.md"
echo "  - Secrets Guide: .github/SECRETS.md"
echo ""
echo -e "${GREEN}Happy deploying! 🚀${NC}"

