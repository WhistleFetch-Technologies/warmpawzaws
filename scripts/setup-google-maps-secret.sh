#!/bin/bash

# ============================================================================
# SETUP GOOGLE MAPS API KEY IN AWS SECRETS MANAGER
# ============================================================================
# This script creates or updates the Google Maps API key in AWS Secrets Manager
# Usage: ./scripts/setup-google-maps-secret.sh [api-key] [stage]
# ============================================================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
STAGE=${2:-dev}
REGION=${AWS_REGION:-ap-south-1}
SECRET_NAME="warmpawz/${STAGE}/google-maps/api-key"

# Check if API key is provided
if [ -z "${1:-}" ]; then
  echo -e "${YELLOW}Usage: $0 <google-maps-api-key> [stage]${NC}"
  echo -e "${YELLOW}Example: $0 AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx dev${NC}"
  echo ""
  echo -e "${BLUE}If API key is not provided, you can enter it interactively:${NC}"
  read -sp "Enter Google Maps API Key: " API_KEY
  echo ""
else
  API_KEY="$1"
fi

# Validate API key format
if [[ ! "$API_KEY" =~ ^AIza[0-9A-Za-z_-]{35}$ ]]; then
  echo -e "${YELLOW}⚠️  Warning: API key doesn't match expected format (AIza...), but continuing...${NC}"
fi

# Check if secret exists
echo -e "${BLUE}📦 Checking if secret exists...${NC}"
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" &>/dev/null; then
  echo -e "${GREEN}✅ Secret exists, updating...${NC}"
  
  # Update existing secret
  aws secretsmanager put-secret-value \
    --secret-id "$SECRET_NAME" \
    --secret-string "$API_KEY" \
    --region "$REGION" > /dev/null
  
  echo -e "${GREEN}✅ Secret updated successfully${NC}"
else
  echo -e "${BLUE}📦 Secret doesn't exist, creating...${NC}"
  
  # Create new secret
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --secret-string "$API_KEY" \
    --description "Google Maps API Key for Warmpawz ${STAGE} environment" \
    --region "$REGION" > /dev/null
  
  echo -e "${GREEN}✅ Secret created successfully${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ GOOGLE MAPS API KEY SETUP COMPLETE                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📦 Secret Details:"
echo -e "   Name: ${SECRET_NAME}"
echo -e "   Region: ${REGION}"
echo -e "   Stage: ${STAGE}"
echo ""
echo -e "🧪 Next Steps:"
echo -e "   1. Test the endpoint: GET /config/google-maps-key"
echo -e "   2. Verify in AWS Console: Secrets Manager"
echo ""
