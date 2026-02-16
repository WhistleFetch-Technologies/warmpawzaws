#!/bin/bash

# ============================================================================
# Deep Diagnosis of Production API Gateway Issues
# ============================================================================
# This script performs comprehensive checks to identify API Gateway problems
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
API_ID="${API_ID:-mss9sa4y01}"
API_URL="https://${API_ID}.execute-api.ap-south-1.amazonaws.com"
LAMBDA_FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-warmpawz-api-prod}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Production API Gateway Deep Diagnosis${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "API Gateway ID: ${API_ID}"
echo "API URL: ${API_URL}"
echo "Lambda Function: ${LAMBDA_FUNCTION_NAME}"
echo "Region: ${AWS_REGION}"
echo ""

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ AWS CLI not found. Please install it.${NC}"
  exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
  echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure'${NC}"
  exit 1
fi

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}1. API Gateway Configuration${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check if API Gateway exists
echo -e "${YELLOW}[1.1] Checking if API Gateway exists...${NC}"
API_INFO=$(aws apigatewayv2 get-api --api-id "${API_ID}" --region "${AWS_REGION}" 2>&1) || {
  echo -e "${RED}❌ API Gateway ${API_ID} not found or not accessible${NC}"
  echo "Error: ${API_INFO}"
  echo ""
  echo "Available APIs:"
  aws apigatewayv2 get-apis --region "${AWS_REGION}" --query "Items[*].[ApiId,Name,ApiEndpoint]" --output table
  exit 1
}

echo -e "${GREEN}✅ API Gateway exists${NC}"
API_NAME=$(echo "$API_INFO" | jq -r '.Name // "unknown"')
API_PROTOCOL=$(echo "$API_INFO" | jq -r '.ProtocolType // "unknown"')
echo "  Name: ${API_NAME}"
echo "  Protocol: ${API_PROTOCOL}"
echo ""

# Check API Gateway routes
echo -e "${YELLOW}[1.2] Checking API Gateway routes...${NC}"
ROUTES=$(aws apigatewayv2 get-routes --api-id "${API_ID}" --region "${AWS_REGION}" 2>&1) || {
  echo -e "${RED}❌ Failed to get routes${NC}"
  echo "Error: ${ROUTES}"
  exit 1
}

ROUTE_COUNT=$(echo "$ROUTES" | jq '.Items | length')
echo "Found ${ROUTE_COUNT} route(s):"
echo "$ROUTES" | jq -r '.Items[] | "  - \(.RouteKey) -> \(.Target // "no target")"' || echo "  No routes found"
echo ""

# Check for /health route specifically
HEALTH_ROUTE=$(echo "$ROUTES" | jq -r '.Items[] | select(.RouteKey == "GET /health") | .RouteId // empty')
if [ -z "$HEALTH_ROUTE" ]; then
  echo -e "${YELLOW}⚠️  /health route not found in API Gateway${NC}"
  echo "This might be the issue - the route may not be configured"
else
  echo -e "${GREEN}✅ /health route exists (Route ID: ${HEALTH_ROUTE})${NC}"
fi
echo ""

# Check integrations
echo -e "${YELLOW}[1.3] Checking API Gateway integrations...${NC}"
INTEGRATIONS=$(aws apigatewayv2 get-integrations --api-id "${API_ID}" --region "${AWS_REGION}" 2>&1) || {
  echo -e "${RED}❌ Failed to get integrations${NC}"
  echo "Error: ${INTEGRATIONS}"
  exit 1
}

INTEGRATION_COUNT=$(echo "$INTEGRATIONS" | jq '.Items | length')
echo "Found ${INTEGRATION_COUNT} integration(s):"
echo "$INTEGRATIONS" | jq -r '.Items[] | "  - \(.IntegrationId): \(.IntegrationType) -> \(.IntegrationUri // "no URI")"' || echo "  No integrations found"
echo ""

# Check if Lambda integration exists
LAMBDA_INTEGRATION=$(echo "$INTEGRATIONS" | jq -r '.Items[] | select(.IntegrationType == "AWS_PROXY" or .IntegrationType == "AWS") | .IntegrationUri // empty' | head -1)
if [ -z "$LAMBDA_INTEGRATION" ]; then
  echo -e "${RED}❌ No Lambda integration found!${NC}"
  echo "This is likely the problem - API Gateway is not connected to Lambda"
else
  echo -e "${GREEN}✅ Lambda integration found: ${LAMBDA_INTEGRATION}${NC}"
  
  # Extract Lambda function name from ARN
  LAMBDA_ARN=$(echo "$LAMBDA_INTEGRATION" | grep -oP 'arn:aws:lambda:[^:]+:\d+:function:[^:]+' || echo "")
  if [ -n "$LAMBDA_ARN" ]; then
    INTEGRATED_FUNCTION=$(echo "$LAMBDA_ARN" | grep -oP 'function:\K[^:]+')
    echo "  Integrated Lambda Function: ${INTEGRATED_FUNCTION}"
    
    if [ "$INTEGRATED_FUNCTION" != "$LAMBDA_FUNCTION_NAME" ]; then
      echo -e "${YELLOW}⚠️  Warning: Integrated function (${INTEGRATED_FUNCTION}) differs from expected (${LAMBDA_FUNCTION_NAME})${NC}"
    fi
  fi
fi
echo ""

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}2. Lambda Function Configuration${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check Lambda function exists
echo -e "${YELLOW}[2.1] Checking Lambda function...${NC}"
LAMBDA_INFO=$(aws lambda get-function --function-name "${LAMBDA_FUNCTION_NAME}" --region "${AWS_REGION}" 2>&1) || {
  echo -e "${RED}❌ Lambda function ${LAMBDA_FUNCTION_NAME} not found${NC}"
  echo "Error: ${LAMBDA_INFO}"
  echo ""
  echo "Available Lambda functions:"
  aws lambda list-functions --region "${AWS_REGION}" --query "Functions[?contains(FunctionName, 'warmpawz') || contains(FunctionName, 'api')].[FunctionName,Runtime,LastModified]" --output table
  exit 1
}

echo -e "${GREEN}✅ Lambda function exists${NC}"
LAMBDA_RUNTIME=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.Runtime // "unknown"')
LAMBDA_TIMEOUT=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.Timeout // "unknown"')
LAMBDA_MEMORY=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.MemorySize // "unknown"')
LAMBDA_STATE=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.State // "unknown"')
LAMBDA_LAST_MODIFIED=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.LastModified // "unknown"')

echo "  Runtime: ${LAMBDA_RUNTIME}"
echo "  Timeout: ${LAMBDA_TIMEOUT}s"
echo "  Memory: ${LAMBDA_MEMORY}MB"
echo "  State: ${LAMBDA_STATE}"
echo "  Last Modified: ${LAMBDA_LAST_MODIFIED}"
echo ""

if [ "$LAMBDA_STATE" != "Active" ]; then
  echo -e "${RED}❌ Lambda function is not in Active state!${NC}"
  echo "This could be the problem."
fi

# Check Lambda VPC configuration
echo -e "${YELLOW}[2.2] Checking Lambda VPC configuration...${NC}"
VPC_CONFIG=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.VpcConfig // empty')
if [ -n "$VPC_CONFIG" ] && [ "$VPC_CONFIG" != "null" ]; then
  VPC_ID=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.VpcConfig.VpcId // "unknown"')
  SUBNET_IDS=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.VpcConfig.SubnetIds[]? // empty' | tr '\n' ',' | sed 's/,$//')
  SG_IDS=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.VpcConfig.SecurityGroupIds[]? // empty' | tr '\n' ',' | sed 's/,$//')
  
  echo "  VPC ID: ${VPC_ID}"
  echo "  Subnet IDs: ${SUBNET_IDS}"
  echo "  Security Group IDs: ${SG_IDS}"
  
  if [ -z "$SUBNET_IDS" ] || [ "$SUBNET_IDS" = "unknown" ]; then
    echo -e "${YELLOW}⚠️  Warning: Lambda has VPC config but subnet IDs are missing${NC}"
  fi
else
  echo "  Lambda is not in a VPC (using default network)"
fi
echo ""

# Check Lambda environment variables
echo -e "${YELLOW}[2.3] Checking Lambda environment variables...${NC}"
ENV_VARS=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.Environment.Variables // {}')
UAT_MODE=$(echo "$ENV_VARS" | jq -r '.UAT_MODE // "not set"')
NODE_ENV=$(echo "$ENV_VARS" | jq -r '.NODE_ENV // "not set"')
DB_HOST=$(echo "$ENV_VARS" | jq -r '.DB_HOST // "not set"')

echo "  UAT_MODE: ${UAT_MODE}"
echo "  NODE_ENV: ${NODE_ENV}"
echo "  DB_HOST: ${DB_HOST}"
echo ""

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}3. IAM Permissions${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check Lambda execution role
echo -e "${YELLOW}[3.1] Checking Lambda execution role...${NC}"
LAMBDA_ROLE=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.Role // "unknown"')
echo "  Role ARN: ${LAMBDA_ROLE}"

if [ "$LAMBDA_ROLE" != "unknown" ] && [ -n "$LAMBDA_ROLE" ]; then
  ROLE_NAME=$(echo "$LAMBDA_ROLE" | grep -oP 'role/\K[^/]+')
  echo "  Role Name: ${ROLE_NAME}"
  
  # Check if role has necessary permissions
  ROLE_POLICIES=$(aws iam list-role-policies --role-name "${ROLE_NAME}" 2>&1) || {
    echo -e "${YELLOW}⚠️  Could not list inline policies (may need permissions)${NC}"
  }
  
  ATTACHED_POLICIES=$(aws iam list-attached-role-policies --role-name "${ROLE_NAME}" 2>&1) || {
    echo -e "${YELLOW}⚠️  Could not list attached policies (may need permissions)${NC}"
  }
  
  echo "  Policies configured"
else
  echo -e "${RED}❌ Lambda role not found!${NC}"
fi
echo ""

# Check API Gateway permissions to invoke Lambda
echo -e "${YELLOW}[3.2] Checking API Gateway permissions to invoke Lambda...${NC}"
LAMBDA_ARN=$(echo "$LAMBDA_INFO" | jq -r '.Configuration.FunctionArn')
POLICY=$(aws lambda get-policy --function-name "${LAMBDA_FUNCTION_NAME}" --region "${AWS_REGION}" 2>&1) || {
  echo -e "${YELLOW}⚠️  Could not get Lambda resource policy (may not have permissions)${NC}"
  echo "  This might be the issue - API Gateway may not have permission to invoke Lambda"
}

if echo "$POLICY" | grep -q "Policy"; then
  echo -e "${GREEN}✅ Lambda has resource-based policy${NC}"
  # Check if API Gateway is in the policy
  if echo "$POLICY" | grep -q "apigateway" || echo "$POLICY" | grep -q "${API_ID}"; then
    echo -e "${GREEN}✅ API Gateway has permission to invoke Lambda${NC}"
  else
    echo -e "${RED}❌ API Gateway may not have permission to invoke Lambda${NC}"
    echo "  Policy exists but API Gateway may not be included"
  fi
else
  echo -e "${YELLOW}⚠️  No resource-based policy found${NC}"
  echo "  API Gateway may need explicit permission to invoke Lambda"
fi
echo ""

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}4. CloudWatch Logs${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check recent CloudWatch logs
echo -e "${YELLOW}[4.1] Checking recent CloudWatch logs (last 5 minutes)...${NC}"
LOG_GROUP="/aws/lambda/${LAMBDA_FUNCTION_NAME}"
LOG_START_TIME=$(date -u -d '5 minutes ago' +%s)000
LOG_END_TIME=$(date -u +%s)000

RECENT_LOGS=$(aws logs filter-log-events \
  --log-group-name "${LOG_GROUP}" \
  --start-time "${LOG_START_TIME}" \
  --end-time "${LOG_END_TIME}" \
  --region "${AWS_REGION}" \
  --max-items 10 2>&1) || {
  echo -e "${YELLOW}⚠️  Could not fetch recent logs${NC}"
  echo "  Error: ${RECENT_LOGS}"
  echo "  This might mean:"
  echo "    - Log group doesn't exist"
  echo "    - No recent invocations"
  echo "    - Insufficient permissions"
}

if echo "$RECENT_LOGS" | grep -q "events"; then
  EVENT_COUNT=$(echo "$RECENT_LOGS" | jq '.events | length')
  echo "  Found ${EVENT_COUNT} log event(s) in last 5 minutes"
  
  if [ "$EVENT_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ No recent Lambda invocations!${NC}"
    echo "  This suggests API Gateway is not invoking Lambda, or Lambda is not being triggered"
  else
    echo -e "${GREEN}✅ Lambda is being invoked${NC}"
    echo ""
    echo "  Recent log entries:"
    echo "$RECENT_LOGS" | jq -r '.events[-3:] | .[] | "    [\(.timestamp | tonumber / 1000 | strftime("%Y-%m-%d %H:%M:%S"))] \(.message)"' || echo "    (Could not parse logs)"
  fi
else
  echo -e "${YELLOW}⚠️  No logs found or log group may not exist${NC}"
fi
echo ""

# Check for errors in logs
echo -e "${YELLOW}[4.2] Checking for errors in logs (last 1 hour)...${NC}"
ERROR_LOGS=$(aws logs filter-log-events \
  --log-group-name "${LOG_GROUP}" \
  --start-time $(date -u -d '1 hour ago' +%s)000 \
  --end-time $(date -u +%s)000 \
  --filter-pattern "ERROR" \
  --region "${AWS_REGION}" \
  --max-items 5 2>&1) || {
  echo "  Could not filter error logs"
}

if echo "$ERROR_LOGS" | grep -q "events"; then
  ERROR_COUNT=$(echo "$ERROR_LOGS" | jq '.events | length')
  if [ "$ERROR_COUNT" -gt 0 ]; then
    echo -e "${RED}❌ Found ${ERROR_COUNT} error(s) in logs${NC}"
    echo "$ERROR_LOGS" | jq -r '.events[] | "    [\(.timestamp | tonumber / 1000 | strftime("%Y-%m-%d %H:%M:%S"))] \(.message)"' | head -3
  else
    echo -e "${GREEN}✅ No errors found in recent logs${NC}"
  fi
else
  echo "  No error logs found or log group doesn't exist"
fi
echo ""

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}5. Network & Security${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check security groups if Lambda is in VPC
if [ -n "$VPC_CONFIG" ] && [ "$VPC_CONFIG" != "null" ]; then
  echo -e "${YELLOW}[5.1] Checking security groups...${NC}"
  for SG_ID in $(echo "$SG_IDS" | tr ',' ' '); do
    if [ -n "$SG_ID" ] && [ "$SG_ID" != "unknown" ]; then
      SG_INFO=$(aws ec2 describe-security-groups --group-ids "${SG_ID}" --region "${AWS_REGION}" 2>&1) || {
        echo "  Could not get security group ${SG_ID} details"
        continue
      }
      
      SG_NAME=$(echo "$SG_INFO" | jq -r '.SecurityGroups[0].GroupName // "unknown"')
      echo "  Security Group: ${SG_ID} (${SG_NAME})"
      
      # Check inbound rules
      INBOUND=$(echo "$SG_INFO" | jq -r '.SecurityGroups[0].IpPermissions // []')
      INBOUND_COUNT=$(echo "$INBOUND" | jq 'length')
      echo "    Inbound rules: ${INBOUND_COUNT}"
      
      # Check outbound rules
      OUTBOUND=$(echo "$SG_INFO" | jq -r '.SecurityGroups[0].IpPermissionsEgress // []')
      OUTBOUND_COUNT=$(echo "$OUTBOUND" | jq 'length')
      echo "    Outbound rules: ${OUTBOUND_COUNT}"
      
      # Check if outbound allows HTTPS (for API Gateway, SNS, etc.)
      HTTPS_ALLOWED=$(echo "$OUTBOUND" | jq '[.[] | select(.IpProtocol == "tcp" and (.FromPort <= 443 and .ToPort >= 443))] | length')
      if [ "$HTTPS_ALLOWED" -eq 0 ]; then
        echo -e "${YELLOW}    ⚠️  Warning: May not allow HTTPS outbound (port 443)${NC}"
      else
        echo -e "${GREEN}    ✅ HTTPS outbound allowed${NC}"
      fi
    fi
  done
  echo ""
fi

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}6. Summary & Recommendations${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${BLUE}Key Findings:${NC}"
echo ""

# Generate summary
ISSUES_FOUND=0

if [ -z "$HEALTH_ROUTE" ]; then
  echo -e "${RED}❌ ISSUE: /health route not configured in API Gateway${NC}"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ -z "$LAMBDA_INTEGRATION" ]; then
  echo -e "${RED}❌ ISSUE: No Lambda integration found in API Gateway${NC}"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ "$LAMBDA_STATE" != "Active" ]; then
  echo -e "${RED}❌ ISSUE: Lambda function is not in Active state${NC}"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ "$EVENT_COUNT" -eq 0 ] 2>/dev/null; then
  echo -e "${RED}❌ ISSUE: No recent Lambda invocations detected${NC}"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ "$ISSUES_FOUND" -eq 0 ]; then
  echo -e "${GREEN}✅ No obvious configuration issues found${NC}"
  echo ""
  echo "The timeout might be due to:"
  echo "  - Cold start (first request after inactivity)"
  echo "  - Database connection timeout"
  echo "  - VPC cold start (5-10 seconds)"
  echo ""
  echo "Try testing with a longer timeout (30 seconds) or check CloudWatch logs for execution details."
else
  echo ""
  echo -e "${YELLOW}Found ${ISSUES_FOUND} potential issue(s) that need to be fixed.${NC}"
fi

echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Review the findings above"
echo "2. Fix any identified issues"
echo "3. Test the /health endpoint again"
echo "4. Check CloudWatch logs for detailed error messages"
echo ""
