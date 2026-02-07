#!/bin/bash
# Migrate onboarding forms for all active roles
# Usage: ./scripts/migrate-onboarding-forms.sh

set -euo pipefail

echo "🔄 Migrating onboarding forms for all active roles..."

# Configuration
API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
UAT_TOKEN="${UAT_TOKEN:-uat-token-admin-123}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📤 Calling migration endpoint...${NC}"

RESPONSE=$(curl -s -X POST "${API_BASE_URL}/admin/onboarding-fields/migrate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${UAT_TOKEN}" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: ${UAT_TOKEN}" \
  -H "x-api-key: ${API_KEY:-}" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✅ Migration completed successfully!${NC}"
  echo ""
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Migration failed with HTTP ${HTTP_CODE}${NC}"
  echo "$BODY"
  exit 1
fi
