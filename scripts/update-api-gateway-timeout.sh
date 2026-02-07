#!/bin/bash
# ============================================================================
# Update API Gateway Integration Timeout
# ============================================================================
# Attempts to update API Gateway HTTP API integration timeout
# Note: HTTP APIs have a hard 30s limit, but we can try to optimize
# ============================================================================

set -e

API_ID=${1:-z0b3obweb6}
INTEGRATION_ID=${2:-jrsc8v3}
AWS_REGION=${3:-ap-south-1}
TIMEOUT_MS=${4:-29000}  # 29s (max for HTTP API)

echo "🔧 Updating API Gateway Integration Timeout"
echo "==========================================="
echo "API ID: $API_ID"
echo "Integration ID: $INTEGRATION_ID"
echo "Region: $AWS_REGION"
echo "Timeout: ${TIMEOUT_MS}ms"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Attempting to update integration timeout...${NC}"

# Note: HTTP APIs have a hard 30s limit, but we can try to set it to 29s
# This might help if there's any buffer issues
if aws apigatewayv2 update-integration \
  --api-id "$API_ID" \
  --integration-id "$INTEGRATION_ID" \
  --timeout-in-millis $TIMEOUT_MS \
  --region "$AWS_REGION" \
  --output json > /tmp/integration-update.json 2>&1; then
  
  echo -e "${GREEN}✅ Integration timeout updated${NC}"
  cat /tmp/integration-update.json | grep -E "(TimeoutInMillis|IntegrationId)" || true
else
  echo -e "${YELLOW}⚠️  Could not update integration timeout${NC}"
  echo "   This is expected for HTTP APIs (30s hard limit)"
  cat /tmp/integration-update.json | head -10
fi

echo ""
echo -e "${BLUE}Note: HTTP APIs have a hard 30-second timeout limit.${NC}"
echo -e "${BLUE}If timeout persists, consider:${NC}"
echo "   1. Switching to REST API (can increase timeout)"
echo "   2. Using async pattern (already implemented)"
echo "   3. Optimizing Lambda cold starts"
echo ""
