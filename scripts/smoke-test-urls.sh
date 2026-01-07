#!/bin/bash
# Smoke test all deployment URLs

set -e

cd "$(dirname "$0")/../infra/envs/dev"

echo "🧪 Running smoke tests on deployment URLs..."
echo ""

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
  terraform init -backend-config=backend.hcl > /dev/null 2>&1
fi

# Get URLs
API_ENDPOINT=$(terraform output -raw api_endpoint 2>/dev/null || echo "")
ADMIN_CF=$(terraform output -raw admin_cloudfront_url 2>/dev/null | sed 's|https://||' || echo "")
VENDOR_CF=$(terraform output -raw vendor_cloudfront_url 2>/dev/null | sed 's|https://||' || echo "")
CUSTOMER_CF=$(terraform output -raw customer_cloudfront_url 2>/dev/null | sed 's|https://||' || echo "")

ADMIN_URL="dev.admin.warmpawz.com"
VENDOR_URL="dev.vendor.warmpawz.com"
CUSTOMER_URL="dev.customer.warmpawz.com"
API_URL="dev.api.warmpawz.com"

# Test function
test_url() {
  local name=$1
  local url=$2
  local expected_status=${3:-200}
  
  if [ -z "$url" ]; then
    echo "❌ $name: URL not available"
    return 1
  fi
  
  echo -n "🔍 Testing $name ($url)... "
  
  # Try with curl
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$url" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "$expected_status" ] || [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "✅ OK (HTTP $HTTP_CODE)"
    return 0
  elif [ "$HTTP_CODE" = "000" ]; then
    echo "⚠️  TIMEOUT/ERROR (connection failed)"
    return 1
  else
    echo "❌ FAILED (HTTP $HTTP_CODE)"
    return 1
  fi
}

# Test API Gateway
echo "═══════════════════════════════════════════════════════════════"
echo "🔌 API GATEWAY TESTS:"
echo "═══════════════════════════════════════════════════════════════"
if [ -n "$API_ENDPOINT" ]; then
  API_HOST=$(echo "$API_ENDPOINT" | sed 's|https://||' | sed 's|/.*||')
  test_url "API Gateway (Default)" "$API_HOST" || true
else
  echo "⚠️  API Gateway endpoint not available"
fi

# Test custom API domain
test_url "API Gateway (Custom)" "$API_URL" || true

echo ""

# Test CloudFront URLs
echo "═══════════════════════════════════════════════════════════════"
echo "🌐 CLOUDFRONT URL TESTS (Direct):"
echo "═══════════════════════════════════════════════════════════════"
test_url "Admin (CloudFront)" "$ADMIN_CF" || true
test_url "Vendor (CloudFront)" "$VENDOR_CF" || true
test_url "Customer (CloudFront)" "$CUSTOMER_CF" || true

echo ""

# Test Custom Domain URLs
echo "═══════════════════════════════════════════════════════════════"
echo "🌍 CUSTOM DOMAIN URL TESTS (Route53):"
echo "═══════════════════════════════════════════════════════════════"
test_url "Admin (Custom)" "$ADMIN_URL" || true
test_url "Vendor (Custom)" "$VENDOR_URL" || true
test_url "Customer (Custom)" "$CUSTOMER_URL" || true

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Smoke tests complete"
echo ""
echo "Note: CloudFront distributions may take 5-15 minutes to fully propagate"
echo "      Route53 DNS changes may take 1-5 minutes to propagate"

