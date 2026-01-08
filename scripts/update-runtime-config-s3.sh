#!/bin/bash
# Quick fix: Update runtime-config.js in S3 buckets with actual API Gateway endpoint
# This fixes "Failed to fetch" errors without a full redeployment

set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"

echo "🔧 Updating runtime-config.js in S3 buckets with API Gateway endpoint..."

# Get API Gateway endpoint from Terraform or AWS
if command -v terraform &> /dev/null; then
  cd infra/envs/dev 2>/dev/null || true
  if [ -f "backend.hcl" ] || [ -f ".terraform/terraform.tfstate" ]; then
    terraform init -backend-config=backend.hcl > /dev/null 2>&1 || true
    API_ENDPOINT=$(terraform output -raw api_endpoint 2>/dev/null || echo "")
  fi
  cd - > /dev/null
fi

# Fallback: Get from AWS directly
if [ -z "${API_ENDPOINT:-}" ]; then
  echo "   Getting API endpoint from AWS..."
  API_ENDPOINT=$(aws apigatewayv2 get-apis --region "$AWS_REGION" \
    --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" \
    --output text 2>/dev/null | head -1 || echo "")
fi

# Final fallback: Use secret or default
if [ -z "${API_ENDPOINT:-}" ]; then
  API_ENDPOINT="${DEV_API_URL:-https://dev.api.warmpawz.com}"
  echo "   ⚠️  Using fallback API endpoint: $API_ENDPOINT"
else
  echo "   ✅ API Gateway endpoint: $API_ENDPOINT"
fi

# Create runtime-config.js content
RUNTIME_CONFIG=$(cat <<EOF
// Runtime Configuration - Updated via script
// API Gateway endpoint injected at: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "${API_ENDPOINT}",
    uatMode: true
  };
  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
EOF
)

# Update each S3 bucket
for bucket_var in S3_BUCKET_ADMIN S3_BUCKET_VENDOR S3_BUCKET_CUSTOMER; do
  bucket_name="${!bucket_var:-}"
  
  if [ -z "$bucket_name" ]; then
    echo "   ⚠️  Skipping $bucket_var (not set)"
    continue
  fi
  
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

# Invalidate CloudFront (if distribution IDs are set)
for dist_var in CLOUDFRONT_DIST_ID_ADMIN CLOUDFRONT_DIST_ID_VENDOR CLOUDFRONT_DIST_ID_CUSTOMER; do
  dist_id="${!dist_var:-}"
  
  if [ -n "$dist_id" ]; then
    echo "   Invalidating $dist_var..."
    aws cloudfront create-invalidation \
      --distribution-id "$dist_id" \
      --paths "/runtime-config.js" \
      --region "$AWS_REGION" > /dev/null 2>&1 || echo "     ⚠️  Failed to invalidate"
  fi
done

echo ""
echo "✅ Runtime config update complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Wait 1-2 minutes for CloudFront invalidation"
echo "   2. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)"
echo "   3. Check browser console for '🔧 Runtime config loaded' message"
echo "   4. Verify API calls work correctly"

