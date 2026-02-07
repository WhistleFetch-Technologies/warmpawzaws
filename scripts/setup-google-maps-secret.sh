#!/bin/bash

# ============================================================================
# SETUP GOOGLE MAPS SECRET IN AWS SECRETS MANAGER
# ============================================================================
# Creates/updates the google-maps secret in JSON format (apiKey + optional mapId)
# Usage: ./scripts/setup-google-maps-secret.sh <api-key> [map-id] [stage]
#
# Examples:
#   ./scripts/setup-google-maps-secret.sh AIzaSyB... dev
#   ./scripts/setup-google-maps-secret.sh AIzaSyB... 91ba2b86f2fafdb672497f7c dev
# ============================================================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Default Tracker map style ID (Google Cloud Console - Light Tracker)
DEFAULT_MAP_ID="91ba2b86f2fafdb672497f7c"

# Parse args: api-key [map-id|stage] [stage]
REGION=${AWS_REGION:-ap-south-1}
MAP_ID="$DEFAULT_MAP_ID"
STAGE="dev"
if [[ -n "${3:-}" ]]; then
  MAP_ID="${2:-$DEFAULT_MAP_ID}"
  STAGE="$3"
elif [[ -n "${2:-}" ]]; then
  if [[ "${2}" =~ ^[0-9a-fA-F]{24}$ ]]; then
    MAP_ID="$2"
  else
    STAGE="$2"
  fi
fi

SECRET_NAME="warmpawz/${STAGE}/google-maps"

# Check if API key is provided
if [ -z "${1:-}" ]; then
  echo -e "${YELLOW}Usage: $0 <google-maps-api-key> [map-id] [stage]${NC}"
  echo -e "${YELLOW}Example: $0 AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx dev${NC}"
  echo -e "${YELLOW}Example: $0 AIzaSyB... 91ba2b86f2fafdb672497f7c dev${NC}"
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

# Build JSON secret value (use jq if available, else printf)
if command -v jq &>/dev/null; then
  SECRET_JSON=$(jq -n --arg apiKey "$API_KEY" --arg mapId "$MAP_ID" '{ apiKey: $apiKey, mapId: $mapId }')
else
  SECRET_JSON="{\"apiKey\":\"$API_KEY\",\"mapId\":\"$MAP_ID\"}"
fi

# Check if secret exists
echo -e "${BLUE}📦 Checking if secret exists...${NC}"
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" &>/dev/null; then
  echo -e "${GREEN}✅ Secret exists, updating...${NC}"
  
  aws secretsmanager put-secret-value \
    --secret-id "$SECRET_NAME" \
    --secret-string "$SECRET_JSON" \
    --region "$REGION" > /dev/null
  
  echo -e "${GREEN}✅ Secret updated successfully${NC}"
else
  echo -e "${BLUE}📦 Secret doesn't exist, creating...${NC}"
  
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --secret-string "$SECRET_JSON" \
    --description "Google Maps API key and map style (Tracker) for Warmpawz ${STAGE}" \
    --region "$REGION" > /dev/null
  
  echo -e "${GREEN}✅ Secret created successfully${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ GOOGLE MAPS SECRET SETUP COMPLETE                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📦 Secret Details:"
echo -e "   Name: ${SECRET_NAME}"
echo -e "   Region: ${REGION}"
echo -e "   Stage: ${STAGE}"
echo -e "   Format: JSON { apiKey, mapId }"
echo ""
echo -e "🧪 Next Steps:"
echo -e "   1. Test: GET /config/google-maps-key"
echo -e "   2. Verify in AWS Console: Secrets Manager"
echo ""
