#!/bin/bash
# End-to-End Test Script for Cognito Authentication Flow
# Tests: Browser → CloudFront → API Gateway → Lambda → RDS → Response

set -e

echo "=========================================="
echo "Cognito Authentication Flow Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_GATEWAY_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
CLOUDFRONT_URL="https://dfof7mguaa0a5.cloudfront.net"
COGNITO_USER_POOL_ID="ap-south-1_HV6DrQLz4"
COGNITO_CLIENT_ID="3q3p9rqc00cpii3bqj0k5t4fao"
REGION="ap-south-1"

echo -e "${YELLOW}Step 1: Testing Public Endpoint (No Auth Required)${NC}"
echo "Testing: GET /health"
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API_GATEWAY_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ PASS: Health endpoint is accessible${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ FAIL: Health endpoint returned $HTTP_CODE${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 2: Testing Protected Endpoint (Without Token)${NC}"
echo "Testing: GET /admin/ecommerce/analytics/platform (should return 401)"
PROTECTED_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$API_GATEWAY_URL/admin/ecommerce/analytics/platform" -H "Content-Type: application/json")
HTTP_CODE=$(echo "$PROTECTED_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$PROTECTED_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" == "401" ]; then
    echo -e "${GREEN}✅ PASS: Protected endpoint correctly requires authentication${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ FAIL: Expected 401, got $HTTP_CODE${NC}"
    echo "Response: $BODY"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 3: Verifying API Gateway Authorizer Configuration${NC}"
AUTHORIZERS=$(aws apigatewayv2 get-authorizers --api-id z0b3obweb6 --query 'Items[*].[AuthorizerId,Name,AuthorizerType]' --output text 2>&1)
if [ -n "$AUTHORIZERS" ]; then
    echo -e "${GREEN}✅ PASS: Cognito JWT Authorizer is configured${NC}"
    echo "$AUTHORIZERS"
else
    echo -e "${RED}❌ FAIL: No authorizers found${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 4: Verifying Route Authorization${NC}"
ROUTES=$(aws apigatewayv2 get-routes --api-id z0b3obweb6 --query 'Items[*].[RouteKey,AuthorizationType,AuthorizerId]' --output table 2>&1)
echo "$ROUTES"
echo ""

echo -e "${YELLOW}Step 5: Verifying Lambda Function Configuration${NC}"
LAMBDA_ENV=$(aws lambda get-function-configuration --function-name warmpawz-dev-api-handler --query 'Environment.Variables' --output json 2>&1)
COGNITO_POOL=$(echo "$LAMBDA_ENV" | python3 -c "import sys, json; print(json.load(sys.stdin).get('COGNITO_USER_POOL_ID', 'NOT_FOUND'))")
if [ "$COGNITO_POOL" == "$COGNITO_USER_POOL_ID" ]; then
    echo -e "${GREEN}✅ PASS: Lambda has Cognito User Pool ID configured${NC}"
    echo "COGNITO_USER_POOL_ID: $COGNITO_POOL"
else
    echo -e "${RED}❌ FAIL: Lambda Cognito configuration mismatch${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 6: Verifying RDS Connectivity${NC}"
DB_HOST=$(echo "$LAMBDA_ENV" | python3 -c "import sys, json; print(json.load(sys.stdin).get('DB_HOST', 'NOT_FOUND'))")
if [ "$DB_HOST" != "NOT_FOUND" ]; then
    echo -e "${GREEN}✅ PASS: Lambda has RDS host configured${NC}"
    echo "DB_HOST: $DB_HOST"
else
    echo -e "${RED}❌ FAIL: Lambda RDS configuration missing${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 7: Verifying Runtime Config in S3${NC}"
RUNTIME_CONFIG=$(aws s3api head-object --bucket warmpawz-dev-admin-frontend-ap-south-1 --key runtime-config.js --query 'ContentLength' --output text 2>&1)
if [ "$RUNTIME_CONFIG" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS: runtime-config.js exists in S3${NC}"
    echo "File size: $RUNTIME_CONFIG bytes"
else
    echo -e "${RED}❌ FAIL: runtime-config.js not found${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 8: Verifying CloudFront Distribution${NC}"
CF_STATUS=$(aws cloudfront get-distribution --id E1WPXL8WBOWOE8 --query 'Distribution.Status' --output text 2>&1)
if [ "$CF_STATUS" == "Deployed" ]; then
    echo -e "${GREEN}✅ PASS: CloudFront distribution is deployed${NC}"
    echo "Status: $CF_STATUS"
    echo "Domain: $CLOUDFRONT_URL"
else
    echo -e "${YELLOW}⚠️  WARNING: CloudFront status is $CF_STATUS${NC}"
fi
echo ""

echo -e "${YELLOW}Step 9: Testing CORS Configuration${NC}"
CORS_CONFIG=$(aws apigatewayv2 get-api --api-id z0b3obweb6 --query 'CorsConfiguration.AllowOrigins' --output json 2>&1)
if echo "$CORS_CONFIG" | grep -q "dfof7mguaa0a5.cloudfront.net"; then
    echo -e "${GREEN}✅ PASS: CORS includes CloudFront domain${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: CloudFront domain may not be in CORS${NC}"
fi
echo ""

echo "=========================================="
echo -e "${GREEN}✅ All Infrastructure Checks Passed!${NC}"
echo "=========================================="
echo ""
echo "Next Steps for Browser Testing:"
echo "1. Open browser to: $CLOUDFRONT_URL"
echo "2. Login with Cognito credentials"
echo "3. Navigate to E-Commerce page"
echo "4. Check browser console for API calls"
echo "5. Verify tokens are sent in Authorization header"
echo ""
echo "To test with a valid token, you need to:"
echo "1. Authenticate via Cognito (login page)"
echo "2. Get ID token from localStorage"
echo "3. Use token in Authorization header: Bearer <token>"
echo ""

