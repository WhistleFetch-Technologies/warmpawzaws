#!/bin/bash
# ============================================================================
# SSM Parameter Store Verification Script
# ============================================================================
# Verifies all required SSM parameters for Warmpawz Serverless deployment
# Usage: ./scripts/verify-ssm-parameters.sh [stage] [region]
# Example: ./scripts/verify-ssm-parameters.sh dev ap-south-1
# ============================================================================

set -e

# Configuration
STAGE=${1:-dev}
REGION=${2:-ap-south-1}
BASE_PATH="/warmpawz/${STAGE}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
TOTAL=0
EXISTS=0
MISSING=0
INVALID=0

# Arrays to store results
MISSING_PARAMS=()
INVALID_PARAMS=()

echo ""
echo "🔍 SSM Parameter Store Verification"
echo "===================================="
echo "Stage: ${CYAN}${STAGE}${NC}"
echo "Region: ${CYAN}${REGION}${NC}"
echo "Base Path: ${CYAN}${BASE_PATH}${NC}"
echo ""

# Function to check parameter
check_parameter() {
    local param_name=$1
    local param_type=${2:-String}
    local is_required=${3:-true}
    local description=$4
    
    TOTAL=$((TOTAL + 1))
    
    echo -n "  Checking: ${param_name}... "
    
    # Check if parameter exists
    if aws ssm get-parameter \
        --name "${param_name}" \
        --region "${REGION}" \
        --with-decryption \
        >/dev/null 2>&1; then
        
        # Get parameter value (truncated for display)
        local value=$(aws ssm get-parameter \
            --name "${param_name}" \
            --region "${REGION}" \
            --with-decryption \
            --query 'Parameter.Value' \
            --output text 2>/dev/null || echo "")
        
        # Validate value is not empty
        if [ -z "$value" ] || [ "$value" = "None" ]; then
            echo -e "${RED}❌ INVALID (empty value)${NC}"
            INVALID=$((INVALID + 1))
            INVALID_PARAMS+=("${param_name} (empty value)")
        else
            # Truncate long values for display
            local display_value="$value"
            if [ ${#display_value} -gt 50 ]; then
                display_value="${display_value:0:47}..."
            fi
            echo -e "${GREEN}✅ EXISTS${NC} (${display_value})"
            EXISTS=$((EXISTS + 1))
        fi
    else
        if [ "$is_required" = "true" ]; then
            echo -e "${RED}❌ MISSING${NC}"
            MISSING=$((MISSING + 1))
            MISSING_PARAMS+=("${param_name}")
        else
            echo -e "${YELLOW}⚠️  MISSING (optional)${NC}"
        fi
    fi
}

# ============================================================================
# DATABASE PARAMETERS
# ============================================================================
echo -e "${BLUE}📊 Database Configuration${NC}"
echo "----------------------------------------"
check_parameter "${BASE_PATH}/db/host" "String" "true" "RDS endpoint"
check_parameter "${BASE_PATH}/db/port" "String" "false" "RDS port (default: 5432)"
check_parameter "${BASE_PATH}/db/name" "String" "true" "Database name"
check_parameter "${BASE_PATH}/db/user" "String" "true" "Database username"
check_parameter "${BASE_PATH}/db/password" "SecureString" "true" "Database password"
echo ""

# ============================================================================
# COGNITO PARAMETERS
# ============================================================================
echo -e "${BLUE}🔐 Cognito Configuration${NC}"
echo "----------------------------------------"
check_parameter "${BASE_PATH}/cognito/userPoolId" "String" "true" "Cognito User Pool ID"
check_parameter "${BASE_PATH}/cognito/clientId" "String" "true" "Cognito Client ID"
echo ""

# ============================================================================
# RAZORPAY PARAMETERS
# ============================================================================
echo -e "${BLUE}💳 Razorpay Configuration${NC}"
echo "----------------------------------------"
check_parameter "${BASE_PATH}/razorpay/keyId" "String" "true" "Razorpay Key ID"
check_parameter "${BASE_PATH}/razorpay/keySecret" "SecureString" "true" "Razorpay Key Secret"
check_parameter "${BASE_PATH}/razorpay/webhookSecret" "SecureString" "true" "Razorpay Webhook Secret"
echo ""

# ============================================================================
# SNS PARAMETERS
# ============================================================================
echo -e "${BLUE}📱 SNS Configuration${NC}"
echo "----------------------------------------"
check_parameter "${BASE_PATH}/sns/smsTopicArn" "String" "true" "SNS SMS Topic ARN"
echo ""

# ============================================================================
# VPC PARAMETERS
# ============================================================================
echo -e "${BLUE}🌐 VPC Configuration${NC}"
echo "----------------------------------------"
check_parameter "${BASE_PATH}/vpc/securityGroupId" "String" "true" "VPC Security Group ID"
check_parameter "${BASE_PATH}/vpc/subnetId1" "String" "true" "VPC Subnet ID 1"
check_parameter "${BASE_PATH}/vpc/subnetId2" "String" "true" "VPC Subnet ID 2"
echo ""

# ============================================================================
# CORS PARAMETERS
# ============================================================================
echo -e "${BLUE}🌍 CORS Configuration${NC}"
echo "----------------------------------------"
check_parameter "${BASE_PATH}/cors/allowedOrigins" "String" "true" "CORS Allowed Origins"
echo ""

# ============================================================================
# CLOUDFRONT PARAMETERS
# ============================================================================
echo -e "${BLUE}☁️  CloudFront Configuration${NC}"
echo "----------------------------------------"
check_parameter "${BASE_PATH}/cloudfront/distributionId" "String" "false" "CloudFront Distribution ID"
echo ""

# ============================================================================
# FEATURE FLAGS
# ============================================================================
echo -e "${BLUE}🚩 Feature Flags${NC}"
echo "----------------------------------------"
check_parameter "${BASE_PATH}/features/uatMode" "String" "false" "UAT Mode flag (default: false)"
echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "===================================="
echo -e "${CYAN}📊 Verification Summary${NC}"
echo "===================================="
echo "Total Parameters: ${TOTAL}"
echo -e "✅ Exists: ${GREEN}${EXISTS}${NC}"
echo -e "❌ Missing: ${RED}${MISSING}${NC}"
echo -e "⚠️  Invalid: ${YELLOW}${INVALID}${NC}"
echo ""

# Report missing parameters
if [ ${#MISSING_PARAMS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing Required Parameters:${NC}"
    for param in "${MISSING_PARAMS[@]}"; do
        echo "  - ${param}"
    done
    echo ""
fi

# Report invalid parameters
if [ ${#INVALID_PARAMS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Invalid Parameters (empty values):${NC}"
    for param in "${INVALID_PARAMS[@]}"; do
        echo "  - ${param}"
    done
    echo ""
fi

# Final status
if [ $MISSING -eq 0 ] && [ $INVALID -eq 0 ]; then
    echo -e "${GREEN}✅ All required SSM parameters are configured correctly!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Verify parameter values are correct for ${STAGE} environment"
    echo "  2. Run: ./scripts/setup-ssm-parameters.sh ${STAGE} ${REGION} (if you need to update values)"
    echo "  3. Deploy with: serverless deploy --stage ${STAGE} --region ${REGION}"
    exit 0
else
    echo -e "${RED}❌ Some required parameters are missing or invalid!${NC}"
    echo ""
    echo "To fix missing parameters, run:"
    echo "  ./scripts/setup-ssm-parameters.sh ${STAGE} ${REGION}"
    echo ""
    exit 1
fi
