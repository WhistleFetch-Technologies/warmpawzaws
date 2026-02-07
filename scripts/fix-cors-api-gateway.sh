#!/bin/bash
# ============================================================================
# FIX CORS ON EXISTING API GATEWAY (z0b3obweb6)
# ============================================================================
# This script updates the CORS configuration on the existing API Gateway
# to fix the preflight OPTIONS request failure for customer/vendor/admin
# CloudFront origins (e.g. d2aoyjj8ine0wk.cloudfront.net).
#
# Run this if the customer page shows: "Response to preflight request doesn't
# pass access control check: It does not have HTTP ok status."
#
# Date: 2026-01-20
# ============================================================================

set -e

API_GATEWAY_ID="z0b3obweb6"
AWS_REGION="ap-south-1"
API_BASE="https://${API_GATEWAY_ID}.execute-api.${AWS_REGION}.amazonaws.com"
CUSTOMER_ORIGIN="https://d2aoyjj8ine0wk.cloudfront.net"

echo "🔧 Updating CORS configuration on API Gateway: $API_GATEWAY_ID"

# Update CORS configuration (must match infra/envs/dev main.tf cors_allowed_origins)
aws apigatewayv2 update-api \
  --api-id "$API_GATEWAY_ID" \
  --region "$AWS_REGION" \
  --cors-configuration '{
    "AllowOrigins": [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://dev.admin.warmpawz.com",
      "https://dev.vendor.warmpawz.com",
      "https://dev.customer.warmpawz.com",
      "https://dfof7mguaa0a5.cloudfront.net",
      "https://d1s6ykkj381k58.cloudfront.net",
      "https://d2aoyjj8ine0wk.cloudfront.net",
      "https://admin.warmpawz.com",
      "https://vendor.warmpawz.com",
      "https://customer.warmpawz.com",
      "https://warmpawz.com",
      "https://www.warmpawz.com"
    ],
    "AllowMethods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    "AllowHeaders": ["content-type", "authorization", "x-api-key", "x-uat-mode", "x-uat-token", "x-requested-with"],
    "ExposeHeaders": ["content-length", "x-request-id"],
    "AllowCredentials": true,
    "MaxAge": 86400
  }'

echo "✅ CORS configuration updated successfully!"

# Verify the update
echo ""
echo "🔍 Verifying CORS configuration..."
aws apigatewayv2 get-api \
  --api-id "$API_GATEWAY_ID" \
  --region "$AWS_REGION" \
  --query 'CorsConfiguration' \
  --output json

# Test OPTIONS preflight (same as browser) for customer origin
echo ""
echo "🧪 Testing OPTIONS preflight for customer origin..."
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
  "${API_BASE}/customer/profile?phone=8296414048" \
  -H "Origin: ${CUSTOMER_ORIGIN}" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type")
if [ "$HTTP" = "200" ]; then
  echo "   OPTIONS /customer/profile → $HTTP OK ✅"
else
  echo "   OPTIONS /customer/profile → $HTTP (expected 200) ⚠️"
fi

echo ""
echo "✅ Done! If preflight returned 200, reload the customer page (hard refresh: Cmd+Shift+R)."
echo "   If CORS errors persist, run: cd infra/envs/dev && terraform apply -target=module.api_gateway.null_resource.update_existing_api_cors"
