#!/bin/bash
# Fix CORS configuration for production API Gateway
# Usage: ./prodscripts/fix-cors-prod-api.sh

set -e

API_ID="mss9sa4y01"
REGION="ap-south-1"

echo "🔧 Fixing CORS configuration for production API Gateway..."
echo "API ID: ${API_ID}"
echo ""

# Create CORS configuration JSON
CORS_CONFIG=$(cat <<EOF
{
  "AllowOrigins": [
    "https://www.warmpawz.com",
    "https://dbr09zyoq9akb.cloudfront.net",
    "https://vendor.warmpawz.com",
    "https://customer.warmpawz.com",
    "https://admin.warmpawz.com",
    "https://d1y5ywletev82x.cloudfront.net",
    "https://dg69gqp2frh39.cloudfront.net"
  ],
  "AllowMethods": ["POST", "HEAD", "PUT", "OPTIONS", "PATCH", "GET", "DELETE"],
  "AllowHeaders": ["x-requested-with", "x-api-key", "x-uat-token", "authorization", "x-uat-mode", "content-type"],
  "ExposeHeaders": ["content-length", "x-request-id"],
  "MaxAge": 86400,
  "AllowCredentials": true
}
EOF
)

# Save to temp file
TEMP_FILE=$(mktemp)
echo "$CORS_CONFIG" > "$TEMP_FILE"

# Update API Gateway CORS configuration
echo "📝 Updating CORS configuration..."
aws apigatewayv2 update-api \
  --api-id "$API_ID" \
  --region "$REGION" \
  --cors-configuration "file://$TEMP_FILE"

if [ $? -eq 0 ]; then
  echo "✅ CORS configuration updated successfully!"
else
  echo "❌ Failed to update CORS configuration"
  rm -f "$TEMP_FILE"
  exit 1
fi

# Cleanup
rm -f "$TEMP_FILE"

# Verify the update
echo ""
echo "🔍 Verifying CORS configuration..."
aws apigatewayv2 get-api \
  --api-id "$API_ID" \
  --region "$REGION" \
  --query 'CorsConfiguration' \
  --output json

echo ""
echo "✅ CORS configuration fix complete!"
echo ""
echo "📋 Note: The OPTIONS preflight request may still return 500 if the Lambda"
echo "   doesn't handle OPTIONS requests. However, API Gateway should handle"
echo "   CORS preflight automatically when CORS is configured at the API level."
echo ""
echo "🧪 Test the CORS with:"
echo "   curl -X OPTIONS https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/auth/send-otp \\"
echo "     -H 'Origin: https://d1y5ywletev82x.cloudfront.net' \\"
echo "     -H 'Access-Control-Request-Method: POST' \\"
echo "     -H 'Access-Control-Request-Headers: content-type,authorization'"
echo ""
