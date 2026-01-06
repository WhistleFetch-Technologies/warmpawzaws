#!/bin/bash
# Get all deployment URLs, test them, and setup Route53 if needed

set -e

ZONE_ID="Z07857473SRNOUZ0V7594"  # warmpawz.com
REGION="ap-south-1"

echo "🔍 Discovering deployment URLs..."
echo ""

# Find CloudFront distributions by S3 bucket origin
find_cf_by_bucket() {
  local bucket_name=$1
  aws cloudfront list-distributions --output json 2>/dev/null | python3 -c "
import sys, json
dists = json.load(sys.stdin)['DistributionList']['Items']
for d in dists:
    if d.get('Status') != 'Deployed':
        continue
    origins = d.get('Origins', {}).get('Items', [])
    for origin in origins:
        domain = origin.get('DomainName', '')
        if '$bucket_name' in domain:
            print(f\"{d['Id']}|{d['DomainName']}\")
            break
" 2>/dev/null | head -1
}

echo "📦 Finding CloudFront distributions..."
ADMIN_CF=$(find_cf_by_bucket "warmpawz-dev-admin-frontend")
VENDOR_CF=$(find_cf_by_bucket "warmpawz-dev-vendor-frontend")
CUSTOMER_CF=$(find_cf_by_bucket "warmpawz-dev-customer-frontend")

if [ -n "$ADMIN_CF" ]; then
  ADMIN_CF_ID=$(echo "$ADMIN_CF" | cut -d'|' -f1)
  ADMIN_CF_DOMAIN=$(echo "$ADMIN_CF" | cut -d'|' -f2)
  echo "✅ Admin: $ADMIN_CF_ID -> $ADMIN_CF_DOMAIN"
else
  echo "❌ Admin CloudFront not found"
fi

if [ -n "$VENDOR_CF" ]; then
  VENDOR_CF_ID=$(echo "$VENDOR_CF" | cut -d'|' -f1)
  VENDOR_CF_DOMAIN=$(echo "$VENDOR_CF" | cut -d'|' -f2)
  echo "✅ Vendor: $VENDOR_CF_ID -> $VENDOR_CF_DOMAIN"
else
  echo "❌ Vendor CloudFront not found"
fi

if [ -n "$CUSTOMER_CF" ]; then
  CUSTOMER_CF_ID=$(echo "$CUSTOMER_CF" | cut -d'|' -f1)
  CUSTOMER_CF_DOMAIN=$(echo "$CUSTOMER_CF" | cut -d'|' -f2)
  echo "✅ Customer: $CUSTOMER_CF_ID -> $CUSTOMER_CF_DOMAIN"
else
  echo "❌ Customer CloudFront not found"
fi

# Get API Gateway
echo ""
echo "🔌 Finding API Gateway..."
API_ENDPOINT=$(aws apigatewayv2 get-apis --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" --output text 2>/dev/null | head -1)
if [ -n "$API_ENDPOINT" ]; then
  echo "✅ API: $API_ENDPOINT"
else
  echo "❌ API Gateway not found"
fi

# Check existing Route53 records
echo ""
echo "🌍 Checking Route53 records..."
EXISTING_RECORDS=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?contains(Name, 'dev.')].Name" --output text 2>/dev/null || echo "")

check_record() {
  local name=$1
  if echo "$EXISTING_RECORDS" | grep -q "$name"; then
    echo "✅ $name - EXISTS"
    return 0
  else
    echo "❌ $name - MISSING"
    return 1
  fi
}

check_record "dev.admin.warmpawz.com"
check_record "dev.vendor.warmpawz.com"
check_record "dev.customer.warmpawz.com"
check_record "dev.api.warmpawz.com"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🧪 SMOKE TESTS:"
echo "═══════════════════════════════════════════════════════════════"

test_url() {
  local name=$1
  local url=$2
  if [ -z "$url" ]; then
    echo "⚠️  $name: URL not available"
    return 1
  fi
  
  echo -n "🔍 $name... "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "✅ OK (HTTP $HTTP_CODE)"
    return 0
  elif [ "$HTTP_CODE" = "000" ]; then
    echo "⚠️  TIMEOUT"
    return 1
  else
    echo "❌ FAILED (HTTP $HTTP_CODE)"
    return 1
  fi
}

# Test CloudFront URLs
if [ -n "$ADMIN_CF_DOMAIN" ]; then
  test_url "Admin (CloudFront)" "https://$ADMIN_CF_DOMAIN"
fi
if [ -n "$VENDOR_CF_DOMAIN" ]; then
  test_url "Vendor (CloudFront)" "https://$VENDOR_CF_DOMAIN"
fi
if [ -n "$CUSTOMER_CF_DOMAIN" ]; then
  test_url "Customer (CloudFront)" "https://$CUSTOMER_CF_DOMAIN"
fi

# Test Custom Domain URLs
test_url "Admin (Custom)" "https://dev.admin.warmpawz.com"
test_url "Vendor (Custom)" "https://dev.vendor.warmpawz.com"
test_url "Customer (Custom)" "https://dev.customer.warmpawz.com"

# Test API
if [ -n "$API_ENDPOINT" ]; then
  test_url "API (Default)" "$API_ENDPOINT/health" || test_url "API (Default)" "$API_ENDPOINT"
fi
test_url "API (Custom)" "https://dev.api.warmpawz.com/health" || test_url "API (Custom)" "https://dev.api.warmpawz.com"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📋 SUMMARY:"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "CloudFront URLs (Direct - Always Work):"
[ -n "$ADMIN_CF_DOMAIN" ] && echo "  Admin:    https://$ADMIN_CF_DOMAIN"
[ -n "$VENDOR_CF_DOMAIN" ] && echo "  Vendor:   https://$VENDOR_CF_DOMAIN"
[ -n "$CUSTOMER_CF_DOMAIN" ] && echo "  Customer: https://$CUSTOMER_CF_DOMAIN"
echo ""
echo "Custom Domain URLs (Require Route53):"
echo "  Admin:    https://dev.admin.warmpawz.com"
echo "  Vendor:   https://dev.vendor.warmpawz.com"
echo "  Customer: https://dev.customer.warmpawz.com"
echo "  API:      https://dev.api.warmpawz.com"
echo ""
[ -n "$API_ENDPOINT" ] && echo "API Gateway (Default):"
[ -n "$API_ENDPOINT" ] && echo "  $API_ENDPOINT"
echo ""

