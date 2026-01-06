#!/bin/bash
# Create Route53 DNS records for dev environment

set -e

ZONE_ID="Z07857473SRNOUZ0V7594"  # warmpawz.com
CF_HOSTED_ZONE_ID="Z2FDTNDATAQYW2"  # CloudFront always uses this

# CloudFront Distribution IDs (discovered)
ADMIN_CF_ID="E1WPXL8WBOWOE8"
VENDOR_CF_ID="E95171GX1I6HN"
CUSTOMER_CF_ID="E2RDORGXSWJJ87"

echo "🌍 Creating Route53 DNS records..."
echo ""

# Get CloudFront domain names
ADMIN_CF_DOMAIN=$(aws cloudfront get-distribution --id "$ADMIN_CF_ID" --query "Distribution.DomainName" --output text 2>/dev/null)
VENDOR_CF_DOMAIN=$(aws cloudfront get-distribution --id "$VENDOR_CF_ID" --query "Distribution.DomainName" --output text 2>/dev/null)
CUSTOMER_CF_DOMAIN=$(aws cloudfront get-distribution --id "$CUSTOMER_CF_ID" --query "Distribution.DomainName" --output text 2>/dev/null)

echo "CloudFront Domains:"
echo "  Admin:    $ADMIN_CF_DOMAIN"
echo "  Vendor:   $VENDOR_CF_DOMAIN"
echo "  Customer: $CUSTOMER_CF_DOMAIN"
echo ""

# Function to create Route53 A record
create_record() {
  local name=$1
  local target=$2
  local hosted_zone_id=$3
  
  # Check if exists
  EXISTING=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='${name}.']" --output json 2>/dev/null | python3 -c "import sys, json; print('EXISTS' if json.load(sys.stdin) else 'MISSING')" 2>/dev/null || echo "MISSING")
  
  if [ "$EXISTING" = "EXISTS" ]; then
    echo "✅ $name - Already exists"
    return 0
  fi
  
  echo -n "📝 Creating $name... "
  
  CHANGE_BATCH=$(cat <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "${name}",
      "Type": "A",
      "AliasTarget": {
        "DNSName": "${target}",
        "HostedZoneId": "${hosted_zone_id}",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF
)
  
  CHANGE_ID=$(aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "$CHANGE_BATCH" --query "ChangeInfo.Id" --output text 2>/dev/null || echo "")
  
  if [ -n "$CHANGE_ID" ]; then
    echo "✅ Created (Change: $CHANGE_ID)"
    return 0
  else
    echo "❌ Failed"
    return 1
  fi
}

# Create CloudFront records
create_record "dev.admin.warmpawz.com" "$ADMIN_CF_DOMAIN" "$CF_HOSTED_ZONE_ID"
create_record "dev.vendor.warmpawz.com" "$VENDOR_CF_DOMAIN" "$CF_HOSTED_ZONE_ID"
create_record "dev.customer.warmpawz.com" "$CUSTOMER_CF_DOMAIN" "$CF_HOSTED_ZONE_ID"

# Get API Gateway domain (if exists)
API_DOMAIN=$(aws apigatewayv2 get-domain-names --query "Items[?contains(DomainName, 'dev.api')].DomainName" --output text 2>/dev/null | head -1)

if [ -n "$API_DOMAIN" ]; then
  API_TARGET=$(aws apigatewayv2 get-domain-name --domain-name "$API_DOMAIN" --query "DomainNameConfigurations[0].TargetDomainName" --output text 2>/dev/null || echo "")
  API_HOSTED_ZONE=$(aws apigatewayv2 get-domain-name --domain-name "$API_DOMAIN" --query "DomainNameConfigurations[0].HostedZoneId" --output text 2>/dev/null || echo "")
  
  if [ -n "$API_TARGET" ] && [ -n "$API_HOSTED_ZONE" ]; then
    create_record "dev.api.warmpawz.com" "$API_TARGET" "$API_HOSTED_ZONE"
  else
    echo "⚠️  dev.api.warmpawz.com - API Gateway domain not fully configured"
  fi
else
  echo "⚠️  dev.api.warmpawz.com - API Gateway custom domain not found (using default endpoint)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Route53 setup complete!"
echo ""
echo "📋 Public URLs:"
echo "   Admin:    https://dev.admin.warmpawz.com"
echo "   Vendor:   https://dev.vendor.warmpawz.com"
echo "   Customer: https://dev.customer.warmpawz.com"
echo "   API:      https://dev.api.warmpawz.com"
echo ""
echo "⏱️  DNS changes may take 1-5 minutes to propagate"

