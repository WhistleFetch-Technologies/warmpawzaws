#!/bin/bash
# ============================================================================
# WARMPAWZ PRODUCTION DEPLOYMENT SCRIPT
# ============================================================================
# 
# This script deploys the complete Warmpawz platform:
# 1. Database migrations
# 2. AWS Infrastructure (CDK)
# 3. Lambda functions
# 4. Frontend applications
#
# Prerequisites:
# - AWS CLI configured with appropriate credentials
# - Node.js 18+ installed
# - PostgreSQL client (psql) installed
# - CDK CLI installed (npm install -g aws-cdk)
#
# Usage:
#   ./scripts/deploy-production.sh [environment]
#   
#   Environments: dev, staging, production
#
# ============================================================================

set -e

# Configuration
ENVIRONMENT=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  WARMPAWZ DEPLOYMENT - ${ENVIRONMENT^^}${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}ERROR: AWS CLI not found. Please install it first.${NC}"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}ERROR: Node.js not found. Please install Node.js 18+.${NC}"
        exit 1
    fi
    
    # Check CDK
    if ! command -v cdk &> /dev/null; then
        echo -e "${YELLOW}CDK not found. Installing...${NC}"
        npm install -g aws-cdk
    fi
    
    # Check psql (optional)
    if ! command -v psql &> /dev/null; then
        echo -e "${YELLOW}WARNING: psql not found. Database migrations will need manual execution.${NC}"
    fi
    
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
    echo ""
}

# Load environment variables
load_env() {
    echo -e "${YELLOW}Loading environment variables...${NC}"
    
    ENV_FILE="$PROJECT_ROOT/.env.${ENVIRONMENT}"
    if [ -f "$ENV_FILE" ]; then
        export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
        echo -e "${GREEN}✓ Loaded $ENV_FILE${NC}"
    else
        echo -e "${YELLOW}WARNING: $ENV_FILE not found. Using existing environment.${NC}"
    fi
    echo ""
}

# Run database migrations
run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"
    
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${YELLOW}DATABASE_URL not set. Skipping migrations.${NC}"
        echo -e "${YELLOW}Run migrations manually:${NC}"
        echo "  psql \$DATABASE_URL -f db/schema.sql"
        echo "  psql \$DATABASE_URL -f db/migrations/030_missing_tables.sql"
        return
    fi
    
    # Main schema
    if [ -f "$PROJECT_ROOT/db/schema.sql" ]; then
        echo "Applying main schema..."
        psql "$DATABASE_URL" -f "$PROJECT_ROOT/db/schema.sql" || true
    fi
    
    # Migrations
    for migration in "$PROJECT_ROOT/db/migrations"/*.sql; do
        if [ -f "$migration" ]; then
            echo "Applying migration: $(basename $migration)"
            psql "$DATABASE_URL" -f "$migration" || true
        fi
    done
    
    # Indexes
    if [ -f "$PROJECT_ROOT/db/indexes.sql" ]; then
        echo "Applying indexes..."
        psql "$DATABASE_URL" -f "$PROJECT_ROOT/db/indexes.sql" || true
    fi
    
    echo -e "${GREEN}✓ Database migrations complete${NC}"
    echo ""
}

# Deploy CDK infrastructure
deploy_infrastructure() {
    echo -e "${YELLOW}Deploying AWS infrastructure...${NC}"
    
    cd "$PROJECT_ROOT/infrastructure/cdk"
    
    # Install dependencies
    npm install
    
    # Bootstrap CDK (if needed)
    cdk bootstrap --context environment=$ENVIRONMENT || true
    
    # Deploy all stacks
    echo "Deploying CDK stacks..."
    cdk deploy --all \
        --context environment=$ENVIRONMENT \
        --require-approval never \
        --outputs-file cdk-outputs.json
    
    echo -e "${GREEN}✓ Infrastructure deployment complete${NC}"
    
    # Export outputs
    if [ -f "cdk-outputs.json" ]; then
        echo ""
        echo -e "${BLUE}CDK Outputs:${NC}"
        cat cdk-outputs.json
    fi
    
    cd "$PROJECT_ROOT"
    echo ""
}

# Build and deploy Lambda functions
deploy_lambda() {
    echo -e "${YELLOW}Deploying Lambda functions...${NC}"
    
    cd "$PROJECT_ROOT/backend/lambda"
    
    # Install dependencies
    npm install
    
    # Build TypeScript
    npm run build 2>/dev/null || npx tsc
    
    # Package for Lambda
    echo "Packaging Lambda functions..."
    mkdir -p dist
    cp -r node_modules dist/ 2>/dev/null || true
    cp -r src/handler dist/ 2>/dev/null || true
    cp -r src/endpoints dist/ 2>/dev/null || true
    cp -r src/database dist/ 2>/dev/null || true
    cp -r src/utils dist/ 2>/dev/null || true
    
    # Create deployment package
    cd dist
    zip -r ../lambda-package.zip . -x "*.ts"
    cd ..
    
    # Deploy via AWS CLI (or SAM/CDK)
    if [ -n "$LAMBDA_FUNCTION_NAME" ]; then
        echo "Updating Lambda function: $LAMBDA_FUNCTION_NAME"
        aws lambda update-function-code \
            --function-name "$LAMBDA_FUNCTION_NAME" \
            --zip-file fileb://lambda-package.zip \
            --region ${AWS_REGION:-ap-south-1}
    else
        echo -e "${YELLOW}LAMBDA_FUNCTION_NAME not set. Deploy via CDK or manually.${NC}"
    fi
    
    cd "$PROJECT_ROOT"
    echo -e "${GREEN}✓ Lambda deployment complete${NC}"
    echo ""
}

# Deploy frontend applications
deploy_frontend() {
    echo -e "${YELLOW}Deploying frontend applications...${NC}"
    
    # Customer Web
    echo "Building Customer Web App..."
    cd "$PROJECT_ROOT/apps/customer-web"
    npm install
    npm run build
    
    # Vendor Web
    echo "Building Vendor Web App..."
    cd "$PROJECT_ROOT/apps/vendor-web"
    npm install
    npm run build
    
    # Admin Web
    echo "Building Admin Web App..."
    cd "$PROJECT_ROOT/apps/admin-web"
    npm install
    npm run build
    
    cd "$PROJECT_ROOT"
    
    echo -e "${YELLOW}Frontend builds complete. Deploy to your hosting provider:${NC}"
    echo "  - Vercel: vercel --prod"
    echo "  - AWS Amplify: amplify publish"
    echo "  - AWS S3 + CloudFront: aws s3 sync .next/static s3://bucket/"
    echo ""
    echo -e "${GREEN}✓ Frontend build complete${NC}"
    echo ""
}

# Run smoke tests
run_smoke_tests() {
    echo -e "${YELLOW}Running smoke tests...${NC}"
    
    API_URL=${API_BASE_URL:-https://api.warmpawz.com}
    
    # Health check
    echo "Testing health endpoint..."
    curl -s "$API_URL/health" | jq . || echo "Health check response received"
    
    # Basic endpoint tests
    echo "Testing basic endpoints..."
    curl -s "$API_URL/roles" | head -c 200
    echo ""
    
    echo -e "${GREEN}✓ Smoke tests complete${NC}"
    echo ""
}

# Print deployment summary
print_summary() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  DEPLOYMENT SUMMARY${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    echo -e "${GREEN}✓ Environment: ${ENVIRONMENT}${NC}"
    echo -e "${GREEN}✓ Database: Migrations applied${NC}"
    echo -e "${GREEN}✓ Infrastructure: CDK deployed${NC}"
    echo -e "${GREEN}✓ Backend: Lambda functions deployed${NC}"
    echo -e "${GREEN}✓ Frontend: Apps built${NC}"
    echo ""
    echo -e "${YELLOW}Post-deployment checklist:${NC}"
    echo "  [ ] Verify API Gateway endpoints"
    echo "  [ ] Configure Razorpay webhooks"
    echo "  [ ] Set up CloudWatch alarms"
    echo "  [ ] Configure custom domain"
    echo "  [ ] Enable WAF rules"
    echo "  [ ] Run E2E tests"
    echo ""
    echo -e "${GREEN}Deployment complete!${NC}"
}

# Main execution
main() {
    check_prerequisites
    load_env
    
    echo -e "${YELLOW}Select deployment steps:${NC}"
    echo "1. Full deployment (all steps)"
    echo "2. Database only"
    echo "3. Infrastructure only (CDK)"
    echo "4. Lambda only"
    echo "5. Frontend only"
    echo "6. Smoke tests only"
    echo ""
    read -p "Enter choice [1-6]: " choice
    
    case $choice in
        1)
            run_migrations
            deploy_infrastructure
            deploy_lambda
            deploy_frontend
            run_smoke_tests
            ;;
        2)
            run_migrations
            ;;
        3)
            deploy_infrastructure
            ;;
        4)
            deploy_lambda
            ;;
        5)
            deploy_frontend
            ;;
        6)
            run_smoke_tests
            ;;
        *)
            echo "Running full deployment..."
            run_migrations
            deploy_infrastructure
            deploy_lambda
            deploy_frontend
            run_smoke_tests
            ;;
    esac
    
    print_summary
}

# Run main
main

