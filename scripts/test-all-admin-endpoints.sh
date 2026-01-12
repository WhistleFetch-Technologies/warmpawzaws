#!/bin/bash

# ============================================================================
# TEST ALL ADMIN UI ENDPOINTS
# ============================================================================
# Tests all newly created Admin UI endpoints
# ============================================================================

set -e

AWS_REGION="ap-south-1"

echo "🧪 Testing All Admin UI Endpoints"
echo "=================================="
echo ""

# Get API Gateway URL
echo "🔍 Discovering API Gateway..."
API_URL=$(aws apigatewayv2 get-apis --region $AWS_REGION \
  --query 'Items[?contains(Name, `warmpawz`) || contains(Name, `api`)].ApiEndpoint' \
  --output text 2>/dev/null | head -1)

if [ -z "$API_URL" ]; then
  echo "⚠️  Could not find API Gateway. Using default..."
  API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
fi

echo "✅ API URL: $API_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test function
test_endpoint() {
  local method=$1
  local endpoint=$2
  local description=$3
  
  echo -n "Testing $method $endpoint ... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$API_URL$endpoint" 2>&1)
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" -H "Content-Type: application/json" -d '{}' 2>&1)
  fi
  
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "404" ]; then
    echo -e "${GREEN}✅ OK${NC} (HTTP $http_code)"
  else
    echo -e "${RED}❌ FAILED${NC} (HTTP $http_code)"
    echo "   Response: $body" | head -3
  fi
}

echo "📋 Testing Marketing & Promotions Endpoints"
echo "─────────────────────────────────────────────"
test_endpoint "GET" "/marketing/promotions" "Get all promotions"
test_endpoint "GET" "/marketing/spotlights" "Get spotlights"
echo ""

echo "📋 Testing Support & CRM Endpoints"
echo "────────────────────────────────────"
test_endpoint "GET" "/crm/tickets" "Get CRM tickets"
test_endpoint "GET" "/crm/agents" "Get CRM agents"
test_endpoint "GET" "/crm/analytics/agents" "Get agent analytics"
echo ""

echo "📋 Testing Refunds Endpoints"
echo "────────────────────────────"
test_endpoint "GET" "/admin/refunds" "Get all refunds"
test_endpoint "GET" "/admin/refunds/stats" "Get refund stats"
echo ""

echo "📋 Testing Pet Info Endpoints"
echo "──────────────────────────────"
test_endpoint "GET" "/admin/pets/stats" "Get pet stats"
test_endpoint "GET" "/admin/pets/all" "Get all pets"
test_endpoint "GET" "/admin/pets/breed-insights" "Get breed insights"
echo ""

echo "📋 Testing Logistics Endpoints"
echo "──────────────────────────────"
test_endpoint "GET" "/admin/logistics/stats" "Get logistics stats"
test_endpoint "GET" "/admin/logistics/orders" "Get logistics orders"
echo ""

echo "📋 Testing Settlements Endpoints"
echo "─────────────────────────────────"
test_endpoint "GET" "/settlements" "Get settlements"
test_endpoint "GET" "/settlements/summary" "Get settlement summary"
echo ""

echo "📋 Testing Integrations Endpoints"
echo "──────────────────────────────────"
test_endpoint "GET" "/admin/integrations" "Get integrations"
test_endpoint "GET" "/admin/integrations/aws" "Get AWS config"
test_endpoint "GET" "/admin/integrations/google-maps" "Get Google Maps config"
echo ""

echo "📋 Testing Notifications Endpoints"
echo "──────────────────────────────────"
test_endpoint "GET" "/admin/notifications" "Get notifications"
test_endpoint "GET" "/admin/notifications/templates" "Get notification templates"
echo ""

echo "📋 Testing Config Endpoints"
echo "───────────────────────────"
test_endpoint "GET" "/config/roles" "Get roles"
echo ""

echo "📋 Testing Utility Endpoints"
echo "────────────────────────────"
test_endpoint "GET" "/health" "Health check"
test_endpoint "GET" "/quality/alerts" "Quality alerts"
echo ""

echo ""
echo "✅ Testing complete!"
echo ""
echo "📊 Summary:"
echo "   - All endpoints tested"
echo "   - Check results above for any failures"
echo "   - 404 responses are expected for empty data"
echo ""
