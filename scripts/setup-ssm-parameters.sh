#!/bin/bash
# ============================================================================
# SSM Parameter Store Setup Script
# ============================================================================
# Interactive script to set up all required SSM parameters for Warmpawz
# Usage: ./scripts/setup-ssm-parameters.sh [stage] [region]
# Example: ./scripts/setup-ssm-parameters.sh dev ap-south-1
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

echo ""
echo "🔧 SSM Parameter Store Setup"
echo "============================"
echo "Stage: ${CYAN}${STAGE}${NC}"
echo "Region: ${CYAN}${REGION}${NC}"
echo "Base Path: ${CYAN}${BASE_PATH}${NC}"
echo ""
echo -e "${YELLOW}⚠️  This script will create or update SSM parameters.${NC}"
echo -e "${YELLOW}⚠️  SecureString parameters will be encrypted.${NC}"
echo ""

# Confirm before proceeding
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Function to create or update parameter
put_parameter() {
    local param_name=$1
    local param_value=$2
    local param_type=${3:-String}
    local description=$4
    
    echo -n "  Setting: ${param_name}... "
    
    if aws ssm put-parameter \
        --name "${param_name}" \
        --value "${param_value}" \
        --type "${param_type}" \
        --description "${description}" \
        --overwrite \
        --region "${REGION}" \
        >/dev/null 2>&1; then
        echo -e "${GREEN}✅ DONE${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        return 1
    fi
}

# Function to prompt for parameter value
prompt_parameter() {
    local param_name=$1
    local param_type=${2:-String}
    local description=$3
    local default_value=${4:-}
    local is_secret=${5:-false}
    
    echo ""
    echo -e "${CYAN}${description}${NC}"
    echo "  Parameter: ${param_name}"
    echo "  Type: ${param_type}"
    
    # Check if parameter already exists
    local existing_value=""
    if aws ssm get-parameter \
        --name "${param_name}" \
        --region "${REGION}" \
        --with-decryption \
        >/dev/null 2>&1; then
        existing_value=$(aws ssm get-parameter \
            --name "${param_name}" \
            --region "${REGION}" \
            --with-decryption \
            --query 'Parameter.Value' \
            --output text 2>/dev/null || echo "")
        echo -e "  ${YELLOW}Current value: ${existing_value:0:20}...${NC}"
        echo -e "  ${YELLOW}(Press Enter to keep current value)${NC}"
    fi
    
    if [ "$is_secret" = "true" ]; then
        read -sp "  Enter value (hidden): " value
        echo ""
    else
        if [ -n "$default_value" ]; then
            read -p "  Enter value [${default_value}]: " value
            value=${value:-$default_value}
        else
            read -p "  Enter value: " value
        fi
    fi
    
    # Use existing value if user pressed Enter
    if [ -z "$value" ] && [ -n "$existing_value" ]; then
        value="$existing_value"
        echo -e "  ${GREEN}Keeping existing value${NC}"
        return 0
    fi
    
    # Validate non-empty for required parameters
    if [ -z "$value" ]; then
        echo -e "  ${RED}Skipping (empty value)${NC}"
        return 1
    fi
    
    # Set the parameter
    put_parameter "${param_name}" "${value}" "${param_type}" "${description}"
}

# ============================================================================
# DATABASE PARAMETERS
# ============================================================================
echo ""
echo -e "${BLUE}📊 Database Configuration${NC}"
echo "===================================="
prompt_parameter \
    "${BASE_PATH}/db/host" \
    "String" \
    "RDS Database Host (e.g., warmpawz-db.xxxxx.rds.amazonaws.com)" \
    "" \
    false

prompt_parameter \
    "${BASE_PATH}/db/port" \
    "String" \
    "RDS Database Port" \
    "5432" \
    false

prompt_parameter \
    "${BASE_PATH}/db/name" \
    "String" \
    "Database Name" \
    "warmpawz" \
    false

prompt_parameter \
    "${BASE_PATH}/db/user" \
    "String" \
    "Database Username" \
    "warmpawz_user" \
    false

prompt_parameter \
    "${BASE_PATH}/db/password" \
    "SecureString" \
    "Database Password" \
    "" \
    true

# ============================================================================
# COGNITO PARAMETERS
# ============================================================================
echo ""
echo -e "${BLUE}🔐 Cognito Configuration${NC}"
echo "===================================="
prompt_parameter \
    "${BASE_PATH}/cognito/userPoolId" \
    "String" \
    "Cognito User Pool ID (e.g., ap-south-1_XXXXXXXXX)" \
    "" \
    false

prompt_parameter \
    "${BASE_PATH}/cognito/clientId" \
    "String" \
    "Cognito Client ID" \
    "" \
    false

# ============================================================================
# RAZORPAY PARAMETERS
# ============================================================================
echo ""
echo -e "${BLUE}💳 Razorpay Configuration${NC}"
echo "===================================="
prompt_parameter \
    "${BASE_PATH}/razorpay/keyId" \
    "String" \
    "Razorpay Key ID (e.g., rzp_test_...)" \
    "" \
    false

prompt_parameter \
    "${BASE_PATH}/razorpay/keySecret" \
    "SecureString" \
    "Razorpay Key Secret" \
    "" \
    true

prompt_parameter \
    "${BASE_PATH}/razorpay/webhookSecret" \
    "SecureString" \
    "Razorpay Webhook Secret" \
    "" \
    true

# ============================================================================
# SNS PARAMETERS
# ============================================================================
echo ""
echo -e "${BLUE}📱 SNS Configuration${NC}"
echo "===================================="
prompt_parameter \
    "${BASE_PATH}/sns/smsTopicArn" \
    "String" \
    "SNS SMS Topic ARN (e.g., arn:aws:sns:region:account:topic-name)" \
    "" \
    false

# ============================================================================
# VPC PARAMETERS
# ============================================================================
echo ""
echo -e "${BLUE}🌐 VPC Configuration${NC}"
echo "===================================="
prompt_parameter \
    "${BASE_PATH}/vpc/securityGroupId" \
    "String" \
    "VPC Security Group ID (e.g., sg-xxxxxxxxx)" \
    "" \
    false

prompt_parameter \
    "${BASE_PATH}/vpc/subnetId1" \
    "String" \
    "VPC Subnet ID 1 (e.g., subnet-xxxxxxxxx)" \
    "" \
    false

prompt_parameter \
    "${BASE_PATH}/vpc/subnetId2" \
    "String" \
    "VPC Subnet ID 2 (e.g., subnet-xxxxxxxxx)" \
    "" \
    false

# ============================================================================
# CORS PARAMETERS
# ============================================================================
echo ""
echo -e "${BLUE}🌍 CORS Configuration${NC}"
echo "===================================="
if [ "$STAGE" = "prod" ]; then
    default_origin="https://warmpawz.com"
else
    default_origin="*"
fi

prompt_parameter \
    "${BASE_PATH}/cors/allowedOrigins" \
    "String" \
    "CORS Allowed Origins (comma-separated)" \
    "${default_origin}" \
    false

# ============================================================================
# CLOUDFRONT PARAMETERS
# ============================================================================
echo ""
echo -e "${BLUE}☁️  CloudFront Configuration${NC}"
echo "===================================="
prompt_parameter \
    "${BASE_PATH}/cloudfront/distributionId" \
    "String" \
    "CloudFront Distribution ID (e.g., E1234567890ABC)" \
    "" \
    false

# ============================================================================
# FEATURE FLAGS
# ============================================================================
echo ""
echo -e "${BLUE}🚩 Feature Flags${NC}"
echo "===================================="
prompt_parameter \
    "${BASE_PATH}/features/uatMode" \
    "String" \
    "UAT Mode (true/false)" \
    "false" \
    false

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "===================================="
echo -e "${GREEN}✅ SSM Parameter Setup Complete!${NC}"
echo "===================================="
echo ""
echo "Next steps:"
echo "  1. Verify parameters: ./scripts/verify-ssm-parameters.sh ${STAGE} ${REGION}"
echo "  2. Deploy Lambda: serverless deploy --stage ${STAGE} --region ${REGION}"
echo ""
echo -e "${YELLOW}⚠️  Security Reminder:${NC}"
echo "  - SecureString parameters are encrypted at rest"
echo "  - Only IAM roles with ssm:GetParameter permission can read them"
echo "  - Review IAM policies to ensure proper access control"
echo ""
