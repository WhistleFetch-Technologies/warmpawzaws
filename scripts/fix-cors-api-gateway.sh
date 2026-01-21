#!/bin/bash
# ============================================================================
# FIX CORS ON EXISTING API GATEWAY (z0b3obweb6)
# ============================================================================
# This script updates the CORS configuration on the existing API Gateway
# to fix the preflight OPTIONS request failure.
#
# Date: 2026-01-20
# ============================================================================

set -e

API_GATEWAY_ID="z0b3obweb6"
AWS_REGION="ap-south-1"

echo "🔧 Updating CORS configuration on API Gateway: $API_GATEWAY_ID"

# Update CORS configuration on the existing API Gateway
aws apigatewayv2 update-api \
  --api-id "$API_GATEWAY_ID" \
  --region "$AWS_REGION" \
  --cors-configuration '{
    "AllowOrigins": [
      "https://dfof7mguaa0a5.cloudfront.net",
      "https://d2aoyjj8ine0wk.cloudfront.net",
      "https://d1s6ykkj381k58.cloudfront.net",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      "http://localhost:5173",
      "https://dev.admin.warmpawz.com",
      "https://dev.vendor.warmpawz.com",
      "https://dev.customer.warmpawz.com",
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

echo ""
echo "✅ Done! The API Gateway now has proper CORS configuration."
echo "   Preflight OPTIONS requests should now work correctly."
