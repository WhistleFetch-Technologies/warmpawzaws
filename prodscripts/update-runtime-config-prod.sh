#!/bin/bash
# Quick fix: Update runtime-config.js in PRODUCTION S3 buckets with actual API Gateway endpoint
# This fixes "Failed to fetch" errors without a full redeployment
# Usage: ./prodscripts/update-runtime-config-prod.sh
#
# ⚠️  WARNING: This script updates PRODUCTION environment!
# This is a quick fix script - use with caution.

set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"

# Safety confirmation for PROD
echo "⚠️  ⚠️  ⚠️  WARNING: PRODUCTION UPDATE ⚠️  ⚠️  ⚠️"
echo "This will update runtime-config.js in PRODUCTION S3 buckets!"
echo ""
read -p "Are you sure you want to continue? Type 'yes' to proceed: " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Update cancelled"
  exit 1
fi

echo "🔧 Updating runtime-config.js in PRODUCTION S3 buckets with API Gateway endpoint..."

# Production Configuration (from AWS CLI queries)
S3_BUCKET_ADMIN="warmpawz-prod-admin-frontend-ap-south-1"
S3_BUCKET_VENDOR="warmpawz-prod-vendor-frontend-ap-south-1"
S3_BUCKET_CUSTOMER="warmpawz-prod-customer-frontend-ap-south-1"
CLOUDFRONT_DIST_ID_ADMIN="E2NHO6UUI5UIHW"
CLOUDFRONT_DIST_ID_VENDOR="E3JDHOY1XIFOWE"
CLOUDFRONT_DIST_ID_CUSTOMER="E2F29N49KVOOBP"
API_ENDPOINT="https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"

# Get API Gateway endpoint from Terraform or AWS
if command -v terraform &> /dev/null; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  TERRAFORM_DIR="$PROJECT_ROOT/infra/envs/prod"
  if [ -d "$TERRAFORM_DIR" ]; then
    cd "$TERRAFORM_DIR"
    if [ -f "backend.hcl" ] || [ -f ".terraform/terraform.tfstate" ]; then
      terraform init -backend-config=backend.hcl > /dev/null 2>&1 || true
      API_ENDPOINT=$(terraform output -raw api_endpoint 2>/dev/null || echo "$API_ENDPOINT")
    fi
    cd - > /dev/null
  fi
fi

# Fallback: Get from AWS directly
if [ -z "${API_ENDPOINT:-}" ] || [ "$API_ENDPOINT" = "null" ]; then
  echo "   Getting API endpoint from AWS..."
  API_ENDPOINT=$(aws apigatewayv2 get-apis --region "$AWS_REGION" \
    --query "Items[?Name=='warmpawz-prod-api'].ApiEndpoint" \
    --output text 2>/dev/null | head -1 || echo "")
fi

# Final validation
if [ -z "${API_ENDPOINT:-}" ] || [ "$API_ENDPOINT" = "None" ]; then
  echo "   ❌ Error: Could not get API Gateway endpoint"
  exit 1
else
  echo "   ✅ API Gateway endpoint: $API_ENDPOINT"
fi

# Ensure no trailing slash
API_ENDPOINT="${API_ENDPOINT%/}"

# Create runtime-config.js content
RUNTIME_CONFIG=$(cat <<EOF
// Runtime Configuration - Updated via script (PRODUCTION)
// API Gateway endpoint injected at: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "${API_ENDPOINT}",
    uatMode: false,
    environment: "production"
  };
  console.log('🔧 Runtime config loaded (PROD):', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
EOF
)

# Update each S3 bucket
for bucket_name in "$S3_BUCKET_ADMIN" "$S3_BUCKET_VENDOR" "$S3_BUCKET_CUSTOMER"; do
  echo ""
  echo "📦 Updating $bucket_name..."
  
  # Upload runtime-config.js
  echo "$RUNTIME_CONFIG" | aws s3 cp - \
    "s3://$bucket_name/runtime-config.js" \
    --content-type "application/javascript" \
    --region "$AWS_REGION" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --metadata-directive REPLACE
  
  if [ $? -eq 0 ]; then
    echo "   ✅ Updated runtime-config.js in $bucket_name"
  else
    echo "   ❌ Failed to update $bucket_name"
  fi
done

echo ""
echo "🔄 Invalidating CloudFront cache..."
echo "   (This ensures browsers get the updated runtime-config.js)"

# Invalidate CloudFront
for dist_id in "$CLOUDFRONT_DIST_ID_ADMIN" "$CLOUDFRONT_DIST_ID_VENDOR" "$CLOUDFRONT_DIST_ID_CUSTOMER"; do
  if [ -n "$dist_id" ]; then
    echo "   Invalidating CloudFront distribution $dist_id..."
    aws cloudfront create-invalidation \
      --distribution-id "$dist_id" \
      --paths "/runtime-config.js" \
      --region "$AWS_REGION" > /dev/null 2>&1 || echo "     ⚠️  Failed to invalidate"
  fi
done

echo ""
echo "✅ Runtime config update complete (PRODUCTION)!"
echo ""
echo "📝 Next steps:"
echo "   1. Wait 1-2 minutes for CloudFront invalidation"
echo "   2. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)"
echo "   3. Check browser console for '🔧 Runtime config loaded (PROD)' message"
echo "   4. Verify API calls work correctly in production"
echo ""
