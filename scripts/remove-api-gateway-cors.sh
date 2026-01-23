#!/bin/bash
# Remove CORS configuration from API Gateway to let Lambda handle it
# This fixes the issue where API Gateway intercepts OPTIONS and returns 204

set -e

API_GATEWAY_ID="z0b3obweb6"
AWS_REGION="ap-south-1"

echo "🔧 Removing CORS configuration from API Gateway: $API_GATEWAY_ID"
echo "   This will allow Lambda to handle all CORS responses (including OPTIONS)"

# For HTTP API v2, we need to update with an empty/null CORS config
# Using AWS CLI with proper JSON escaping
aws apigatewayv2 update-api \
  --api-id "$API_GATEWAY_ID" \
  --region "$AWS_REGION" \
  --cors-configuration '{
    "AllowOrigins": [],
    "AllowMethods": [],
    "AllowHeaders": [],
    "AllowCredentials": false,
    "MaxAge": 0
  }' 2>&1

# Verify removal
echo ""
echo "🔍 Verifying CORS configuration..."
CORS_CONFIG=$(aws apigatewayv2 get-api \
  --api-id "$API_GATEWAY_ID" \
  --region "$AWS_REGION" \
  --query 'CorsConfiguration.AllowOrigins' \
  --output text 2>&1)

if [ -z "$CORS_CONFIG" ] || [ "$CORS_CONFIG" = "None" ] || [ "$CORS_CONFIG" = "[]" ]; then
  echo "✅ CORS configuration removed successfully!"
  echo "   Lambda will now handle all CORS responses (including OPTIONS returning 200)"
else
  echo "⚠️  CORS configuration still present. Trying alternative method..."
  # Alternative: Update via patch
  aws apigatewayv2 update-api \
    --api-id "$API_GATEWAY_ID" \
    --region "$AWS_REGION" \
    --cors-configuration '{}' 2>&1
fi

echo ""
echo "✅ Done! API Gateway will now pass OPTIONS requests to Lambda."
