#!/bin/bash
# Test CORS configuration for production API Gateway
# Usage: ./scripts/test-cors-prod.sh [origin]
# Example: ./scripts/test-cors-prod.sh http://localhost:3003

ORIGIN=${1:-"http://localhost:3003"}
API_URL="https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/admin/auth/login"

echo "🧪 Testing CORS for origin: $ORIGIN"
echo "API: $API_URL"
echo ""

echo "1. Testing OPTIONS (preflight) request..."
OPTIONS_RESPONSE=$(curl -s -X OPTIONS \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" \
  -i "$API_URL")

echo "$OPTIONS_RESPONSE" | grep -i "access-control" || echo "❌ No CORS headers found"
echo ""

echo "2. Testing POST request..."
POST_RESPONSE=$(curl -s -X POST \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}' \
  -i "$API_URL")

echo "$POST_RESPONSE" | head -20
echo "$POST_RESPONSE" | grep -i "access-control" || echo "❌ No CORS headers found"
echo ""

echo "✅ CORS test complete"
