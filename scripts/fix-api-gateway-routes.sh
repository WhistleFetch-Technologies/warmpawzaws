#!/bin/bash
# ============================================================================
# Fix API Gateway Routes to Use Correct Lambda Integration
# ============================================================================
# Updates all routes to use the correct Lambda function (warmpawz-dev-api-handler)
# ============================================================================

set -e

API_ID=${1:-z0b3obweb6}
CORRECT_INTEGRATION_ID=${2:-jrsc8v3}
AWS_REGION=${3:-ap-south-1}

echo "🔧 Fixing API Gateway Routes"
echo "==========================="
echo "API ID: $API_ID"
echo "Correct Integration: $CORRECT_INTEGRATION_ID"
echo "Region: $AWS_REGION"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Getting all routes...${NC}"
ROUTES=$(aws apigatewayv2 get-routes --api-id "$API_ID" --region "$AWS_REGION" --query 'Items[*].[RouteId,RouteKey,Target]' --output text 2>&1)

echo "$ROUTES" | while read -r ROUTE_ID ROUTE_KEY TARGET; do
  if [ -z "$ROUTE_ID" ]; then continue; fi
  
  echo ""
  echo -e "${BLUE}Route: $ROUTE_KEY${NC}"
  echo "  Current Target: $TARGET"
  
  # Extract integration ID from target
  CURRENT_INTEGRATION=$(echo "$TARGET" | sed 's|integrations/||')
  
  if [ "$CURRENT_INTEGRATION" != "$CORRECT_INTEGRATION_ID" ]; then
    echo -e "${YELLOW}  ⚠️  Using wrong integration, updating...${NC}"
    
    if aws apigatewayv2 update-route \
      --api-id "$API_ID" \
      --route-id "$ROUTE_ID" \
      --target "integrations/$CORRECT_INTEGRATION_ID" \
      --region "$AWS_REGION" \
      --output json > /tmp/route-update.json 2>&1; then
      
      echo -e "${GREEN}  ✅ Updated to use integration $CORRECT_INTEGRATION_ID${NC}"
    else
      echo -e "${RED}  ❌ Failed to update route${NC}"
      cat /tmp/route-update.json | head -5
    fi
  else
    echo -e "${GREEN}  ✅ Already using correct integration${NC}"
  fi
done

echo ""
echo -e "${GREEN}✅ Route update complete!${NC}"
echo ""
echo -e "${BLUE}Verifying routes...${NC}"
aws apigatewayv2 get-routes --api-id "$API_ID" --region "$AWS_REGION" --query 'Items[*].[RouteKey,Target]' --output table 2>&1 | head -10
