#!/bin/bash

# ============================================================================
# MIGRATION 255: Add Tax Fields to Package Purchases - Wrapper Script
# ============================================================================
# 
# This script applies migration 255 to add tax fields to package_purchases table
# 
# Usage:
#   ./scripts/apply-migration-255-tax-fields-package-purchases.sh
# 
# Environment Variables (optional):
#   - AWS_REGION (default: ap-south-1)
#   - DB_SECRET_NAME (default: warmpawz-db-credentials)
#   - RDS_CLUSTER_IDENTIFIER (optional, auto-discovered if not set)
# 
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}║   📦 MIGRATION 255: Add Tax Fields to Package Purchases      ║${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install AWS CLI first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "$PROJECT_ROOT/node_modules" ] || [ ! -d "$PROJECT_ROOT/scripts/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    cd "$PROJECT_ROOT"
    npm install --silent --legacy-peer-deps 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Installing dependencies in scripts folder...${NC}"
        cd "$SCRIPT_DIR"
        npm install --silent --legacy-peer-deps 2>/dev/null || true
    }
fi

# Check if required npm packages are installed
cd "$SCRIPT_DIR"
if [ ! -d "node_modules/@aws-sdk" ]; then
    echo -e "${YELLOW}📦 Installing AWS SDK packages...${NC}"
    npm install --save @aws-sdk/client-secrets-manager @aws-sdk/client-rds-data pg --silent --legacy-peer-deps 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Installing globally...${NC}"
        npm install -g @aws-sdk/client-secrets-manager @aws-sdk/client-rds-data pg 2>/dev/null || true
    }
fi

# Run the Node.js migration script
echo -e "${BLUE}🚀 Running migration script...${NC}"
echo ""

cd "$PROJECT_ROOT"
node "$SCRIPT_DIR/apply-migration-255-tax-fields-package-purchases.js"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migration script completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}❌ Migration script failed with exit code: $EXIT_CODE${NC}"
    exit $EXIT_CODE
fi
