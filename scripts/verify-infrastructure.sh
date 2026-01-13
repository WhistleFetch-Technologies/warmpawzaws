#!/bin/bash

# ============================================================================
# COMPREHENSIVE INFRASTRUCTURE VERIFICATION SCRIPT
# ============================================================================
# Verifies:
# 1. CloudFront distributions and their S3 origins
# 2. S3 bucket contents and deployment status
# 3. URL accessibility and routing
# 4. Code deployment correctness
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REGION="ap-south-1"
ENVIRONMENT="dev"

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     INFRASTRUCTURE VERIFICATION & CODE DEPLOYMENT CHECK    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Initialize report
REPORT_FILE="infrastructure-verification-report-$(date +%Y%m%d-%H%M%S).txt"
{
  echo "Infrastructure Verification Report"
  echo "Generated: $(date)"
  echo "Environment: $ENVIRONMENT"
  echo "Region: $REGION"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
} > "$REPORT_FILE"

# Function to log results
log_result() {
  local status=$1
  local message=$2
  if [ "$status" = "PASS" ]; then
    echo -e "${GREEN}✅ $message${NC}"
    echo "✅ $message" >> "$REPORT_FILE"
  elif [ "$status" = "FAIL" ]; then
    echo -e "${RED}❌ $message${NC}"
    echo "❌ $message" >> "$REPORT_FILE"
  elif [ "$status" = "WARN" ]; then
    echo -e "${YELLOW}⚠️  $message${NC}"
    echo "⚠️  $message" >> "$REPORT_FILE"
  else
    echo -e "${BLUE}ℹ️  $message${NC}"
    echo "ℹ️  $message" >> "$REPORT_FILE"
  fi
}

# Function to check URL status
check_url() {
  local url=$1
  local app=$2
  
  echo -e "${BLUE}   Testing: $url${NC}"
  
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    log_result "PASS" "$app URL accessible: $url (HTTP $HTTP_CODE)"
    return 0
  elif [ "$HTTP_CODE" = "000" ]; then
    log_result "FAIL" "$app URL unreachable: $url (Connection failed)"
    return 1
  else
    log_result "WARN" "$app URL returned: $url (HTTP $HTTP_CODE)"
    return 1
  fi
}

# ============================================================================
# STEP 1: Get Terraform Outputs
# ============================================================================

echo -e "${CYAN}📊 STEP 1: Fetching Terraform Configuration${NC}"
echo "────────────────────────────────────────────────────────────"

cd "$(dirname "$0")/../infra/envs/dev" 2>/dev/null || {
  log_result "WARN" "Terraform directory not found, using AWS API directly"
  cd "$(dirname "$0")/.."
}

# Try to get Terraform outputs
if [ -d ".terraform" ] || terraform init -backend=false >/dev/null 2>&1; then
  ADMIN_BUCKET=$(terraform output -raw s3_admin_bucket 2>/dev/null || echo "")
  VENDOR_BUCKET=$(terraform output -raw s3_vendor_bucket 2>/dev/null || echo "")
  CUSTOMER_BUCKET=$(terraform output -raw s3_customer_bucket 2>/dev/null || echo "")
  
  ADMIN_CF_ID=$(terraform output -raw cloudfront_admin_distribution_id 2>/dev/null || echo "")
  VENDOR_CF_ID=$(terraform output -raw cloudfront_vendor_distribution_id 2>/dev/null || echo "")
  CUSTOMER_CF_ID=$(terraform output -raw cloudfront_customer_distribution_id 2>/dev/null || echo "")
  
  ADMIN_CF_URL=$(terraform output -raw admin_cloudfront_url 2>/dev/null || echo "")
  VENDOR_CF_URL=$(terraform output -raw vendor_cloudfront_url 2>/dev/null || echo "")
  CUSTOMER_CF_URL=$(terraform output -raw customer_cloudfront_url 2>/dev/null || echo "")
fi

# Fallback to expected bucket names if Terraform outputs unavailable
if [ -z "$ADMIN_BUCKET" ]; then
  ADMIN_BUCKET="warmpawz-${ENVIRONMENT}-admin-frontend-${REGION}"
fi
if [ -z "$VENDOR_BUCKET" ]; then
  VENDOR_BUCKET="warmpawz-${ENVIRONMENT}-vendor-frontend-${REGION}"
fi
if [ -z "$CUSTOMER_BUCKET" ]; then
  CUSTOMER_BUCKET="warmpawz-${ENVIRONMENT}-customer-frontend-${REGION}"
fi

log_result "INFO" "Admin Bucket: $ADMIN_BUCKET"
log_result "INFO" "Vendor Bucket: $VENDOR_BUCKET"
log_result "INFO" "Customer Bucket: $CUSTOMER_BUCKET"
echo ""

# ============================================================================
# STEP 2: Verify S3 Buckets Exist
# ============================================================================

echo -e "${CYAN}📦 STEP 2: Verifying S3 Buckets${NC}"
echo "────────────────────────────────────────────────────────────"

check_bucket() {
  local bucket=$1
  local app=$2
  
  if aws s3api head-bucket --bucket "$bucket" --region "$REGION" >/dev/null 2>&1; then
    log_result "PASS" "$app S3 bucket exists: $bucket"
    
    # Check bucket contents
    OBJECT_COUNT=$(aws s3 ls "s3://$bucket" --recursive --summarize --region "$REGION" 2>/dev/null | grep "Total Objects" | awk '{print $3}' || echo "0")
    
    if [ "$OBJECT_COUNT" != "0" ] && [ -n "$OBJECT_COUNT" ]; then
      log_result "PASS" "$app bucket contains $OBJECT_COUNT objects"
      
      # Check for index.html
      if aws s3 ls "s3://$bucket/index.html" --region "$REGION" >/dev/null 2>&1; then
        log_result "PASS" "$app bucket has index.html"
      else
        log_result "WARN" "$app bucket missing index.html"
      fi
    else
      log_result "WARN" "$app bucket appears empty or inaccessible"
    fi
    
    return 0
  else
    log_result "FAIL" "$app S3 bucket NOT FOUND: $bucket"
    return 1
  fi
}

check_bucket "$ADMIN_BUCKET" "Admin"
check_bucket "$VENDOR_BUCKET" "Vendor"
check_bucket "$CUSTOMER_BUCKET" "Customer"
echo ""

# ============================================================================
# STEP 3: Verify CloudFront Distributions
# ============================================================================

echo -e "${CYAN}🌐 STEP 3: Verifying CloudFront Distributions${NC}"
echo "────────────────────────────────────────────────────────────"

check_cloudfront() {
  local cf_id=$1
  local app=$2
  
  if [ -z "$cf_id" ] || [ "$cf_id" = "N/A" ]; then
    # Try to find distribution by bucket name
    local bucket=$3
    cf_id=$(aws cloudfront list-distributions --region "$REGION" --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, '$bucket')].Id" --output text 2>/dev/null | head -1 || echo "")
  fi
  
  if [ -z "$cf_id" ]; then
    log_result "WARN" "$app CloudFront distribution ID not found"
    return 1
  fi
  
  log_result "INFO" "$app CloudFront Distribution ID: $cf_id"
  
  # Get distribution details
  CF_DETAILS=$(aws cloudfront get-distribution --id "$cf_id" --region "$REGION" 2>/dev/null || echo "")
  
  if [ -n "$CF_DETAILS" ]; then
    CF_STATUS=$(echo "$CF_DETAILS" | jq -r '.Distribution.Status' 2>/dev/null || echo "UNKNOWN")
    CF_DOMAIN=$(echo "$CF_DETAILS" | jq -r '.Distribution.DomainName' 2>/dev/null || echo "")
    CF_ENABLED=$(echo "$CF_DETAILS" | jq -r '.Distribution.DistributionConfig.Enabled' 2>/dev/null || echo "false")
    CF_ORIGIN=$(echo "$CF_DETAILS" | jq -r '.Distribution.DistributionConfig.Origins.Items[0].DomainName' 2>/dev/null || echo "")
    
    if [ "$CF_STATUS" = "Deployed" ]; then
      log_result "PASS" "$app CloudFront is deployed"
    else
      log_result "WARN" "$app CloudFront status: $CF_STATUS"
    fi
    
    if [ "$CF_ENABLED" = "true" ]; then
      log_result "PASS" "$app CloudFront is enabled"
    else
      log_result "FAIL" "$app CloudFront is DISABLED"
    fi
    
    if [ -n "$CF_DOMAIN" ]; then
      log_result "INFO" "$app CloudFront Domain: $CF_DOMAIN"
      echo "$CF_DOMAIN"
    fi
    
    if [ -n "$CF_ORIGIN" ]; then
      log_result "INFO" "$app CloudFront Origin: $CF_ORIGIN"
      
      # Verify origin matches S3 bucket
      if echo "$CF_ORIGIN" | grep -q "$bucket"; then
        log_result "PASS" "$app CloudFront origin correctly points to S3 bucket"
      else
        log_result "WARN" "$app CloudFront origin may not match expected bucket"
      fi
    fi
    
    return 0
  else
    log_result "FAIL" "$app CloudFront distribution not accessible"
    return 1
  fi
}

ADMIN_CF_DOMAIN=$(check_cloudfront "$ADMIN_CF_ID" "Admin" "$ADMIN_BUCKET")
VENDOR_CF_DOMAIN=$(check_cloudfront "$VENDOR_CF_ID" "Vendor" "$VENDOR_BUCKET")
CUSTOMER_CF_DOMAIN=$(check_cloudfront "$CUSTOMER_CF_ID" "Customer" "$CUSTOMER_BUCKET")
echo ""

# ============================================================================
# STEP 4: Verify CloudFront to S3 Routing
# ============================================================================

echo -e "${CYAN}🔗 STEP 4: Verifying CloudFront → S3 Routing${NC}"
echo "────────────────────────────────────────────────────────────"

verify_routing() {
  local cf_id=$1
  local bucket=$2
  local app=$3
  
  if [ -z "$cf_id" ] || [ "$cf_id" = "N/A" ]; then
    log_result "WARN" "$app Cannot verify routing - CloudFront ID missing"
    return 1
  fi
  
  CF_CONFIG=$(aws cloudfront get-distribution-config --id "$cf_id" --region "$REGION" 2>/dev/null || echo "")
  
  if [ -n "$CF_CONFIG" ]; then
    ORIGIN_DOMAIN=$(echo "$CF_CONFIG" | jq -r '.DistributionConfig.Origins.Items[0].DomainName' 2>/dev/null || echo "")
    ORIGIN_ID=$(echo "$CF_CONFIG" | jq -r '.DistributionConfig.Origins.Items[0].Id' 2>/dev/null || echo "")
    OAC_ID=$(echo "$CF_CONFIG" | jq -r '.DistributionConfig.Origins.Items[0].OriginAccessControlId' 2>/dev/null || echo "")
    
    # Expected S3 domain format: bucket-name.s3.region.amazonaws.com
    EXPECTED_DOMAIN="${bucket}.s3.${REGION}.amazonaws.com"
    
    if [ "$ORIGIN_DOMAIN" = "$EXPECTED_DOMAIN" ]; then
      log_result "PASS" "$app CloudFront origin correctly configured: $ORIGIN_DOMAIN"
    else
      log_result "WARN" "$app CloudFront origin: $ORIGIN_DOMAIN (expected: $EXPECTED_DOMAIN)"
    fi
    
    if [ -n "$OAC_ID" ]; then
      log_result "PASS" "$app Origin Access Control (OAC) configured: $OAC_ID"
    else
      log_result "WARN" "$app Origin Access Control (OAC) not found"
    fi
    
    # Check bucket policy allows CloudFront
    BUCKET_POLICY=$(aws s3api get-bucket-policy --bucket "$bucket" --region "$REGION" 2>/dev/null || echo "")
    if [ -n "$BUCKET_POLICY" ]; then
      POLICY_JSON=$(echo "$BUCKET_POLICY" | jq -r '.Policy' 2>/dev/null || echo "")
      if echo "$POLICY_JSON" | grep -q "cloudfront.amazonaws.com"; then
        log_result "PASS" "$app S3 bucket policy allows CloudFront access"
      else
        log_result "WARN" "$app S3 bucket policy may not allow CloudFront"
      fi
    else
      log_result "WARN" "$app S3 bucket policy not found or inaccessible"
    fi
    
    return 0
  else
    log_result "FAIL" "$app Cannot retrieve CloudFront configuration"
    return 1
  fi
}

verify_routing "$ADMIN_CF_ID" "$ADMIN_BUCKET" "Admin"
verify_routing "$VENDOR_CF_ID" "$VENDOR_BUCKET" "Vendor"
verify_routing "$CUSTOMER_CF_ID" "$CUSTOMER_BUCKET" "Customer"
echo ""

# ============================================================================
# STEP 5: Test URL Accessibility
# ============================================================================

echo -e "${CYAN}🌍 STEP 5: Testing URL Accessibility${NC}"
echo "────────────────────────────────────────────────────────────"

# Test CloudFront URLs
if [ -n "$ADMIN_CF_URL" ] && [ "$ADMIN_CF_URL" != "N/A" ]; then
  check_url "$ADMIN_CF_URL" "Admin (CloudFront)"
elif [ -n "$ADMIN_CF_DOMAIN" ]; then
  check_url "https://$ADMIN_CF_DOMAIN" "Admin (CloudFront)"
fi

if [ -n "$VENDOR_CF_URL" ] && [ "$VENDOR_CF_URL" != "N/A" ]; then
  check_url "$VENDOR_CF_URL" "Vendor (CloudFront)"
elif [ -n "$VENDOR_CF_DOMAIN" ]; then
  check_url "https://$VENDOR_CF_DOMAIN" "Vendor (CloudFront)"
fi

if [ -n "$CUSTOMER_CF_URL" ] && [ "$CUSTOMER_CF_URL" != "N/A" ]; then
  check_url "$CUSTOMER_CF_URL" "Customer (CloudFront)"
elif [ -n "$CUSTOMER_CF_DOMAIN" ]; then
  check_url "https://$CUSTOMER_CF_DOMAIN" "Customer (CloudFront)"
fi

# Test custom domain URLs
check_url "https://dev.admin.warmpawz.com" "Admin (Custom Domain)"
check_url "https://dev.vendor.warmpawz.com" "Vendor (Custom Domain)"
check_url "https://dev.customer.warmpawz.com" "Customer (Custom Domain)"
echo ""

# ============================================================================
# STEP 6: Verify Code Deployment
# ============================================================================

echo -e "${CYAN}📝 STEP 6: Verifying Code Deployment${NC}"
echo "────────────────────────────────────────────────────────────"

check_deployment() {
  local bucket=$1
  local app=$2
  
  # Check for key files
  KEY_FILES=("index.html" "_next/static" "static" "runtime-config.js")
  
  for file in "${KEY_FILES[@]}"; do
    if aws s3 ls "s3://$bucket/$file" --region "$REGION" >/dev/null 2>&1 || \
       aws s3 ls "s3://$bucket/$file/" --region "$REGION" >/dev/null 2>&1; then
      log_result "PASS" "$app has $file deployed"
    else
      log_result "WARN" "$app missing $file"
    fi
  done
  
  # Check deployment timestamp (last modified file)
  LAST_MODIFIED=$(aws s3 ls "s3://$bucket" --recursive --region "$REGION" 2>/dev/null | \
    sort -k1,2 | tail -1 | awk '{print $1, $2}' || echo "")
  
  if [ -n "$LAST_MODIFIED" ]; then
    log_result "INFO" "$app last deployment: $LAST_MODIFIED"
  fi
}

check_deployment "$ADMIN_BUCKET" "Admin"
check_deployment "$VENDOR_BUCKET" "Vendor"
check_deployment "$CUSTOMER_BUCKET" "Customer"
echo ""

# ============================================================================
# STEP 7: Check Recent Deployments
# ============================================================================

echo -e "${CYAN}🕐 STEP 7: Checking Recent Deployments${NC}"
echo "────────────────────────────────────────────────────────────"

check_recent_deployment() {
  local bucket=$1
  local app=$2
  
  # Get files modified in last 24 hours
  RECENT_FILES=$(aws s3 ls "s3://$bucket" --recursive --region "$REGION" 2>/dev/null | \
    awk -v cutoff="$(date -u -d '24 hours ago' +%Y-%m-%d)" '$1 >= cutoff {print $0}' | wc -l || echo "0")
  
  if [ "$RECENT_FILES" -gt 0 ]; then
    log_result "INFO" "$app has $RECENT_FILES files modified in last 24 hours"
  else
    log_result "WARN" "$app no recent deployments (last 24 hours)"
  fi
}

check_recent_deployment "$ADMIN_BUCKET" "Admin"
check_recent_deployment "$VENDOR_BUCKET" "Vendor"
check_recent_deployment "$CUSTOMER_BUCKET" "Customer"
echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 VERIFICATION SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Full report saved to: $REPORT_FILE"
echo ""
echo -e "${GREEN}✅ Infrastructure verification complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the report: $REPORT_FILE"
echo "  2. Fix any FAIL or WARN items"
echo "  3. Re-run this script to verify fixes"
echo ""
