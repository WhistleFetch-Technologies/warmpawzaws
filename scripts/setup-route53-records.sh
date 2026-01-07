#!/bin/bash
# Setup Route53 DNS records for dev environment
# This script creates Route53 A records pointing to CloudFront and API Gateway

set -e

ZONE_ID="Z07857473SRNOUZ0V7594"  # warmpawz.com hosted zone
REGION="ap-south-1"

echo "🌍 Setting up Route53 DNS records for dev environment..."
echo ""

# Get CloudFront distributions
echo "📦 Fetching CloudFront distributions..."
ADMIN_CF_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Comment, 'admin') || contains(Comment, 'Admin')].Id" --output text 2>/dev/null | head -1)
VENDOR_CF_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Comment, 'vendor') || contains(Comment, 'Vendor')].Id" --output text 2>/dev/null | head -1)
CUSTOMER_CF_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Comment, 'customer') || contains(Comment, 'Customer')].Id" --output text 2>/dev/null | head -1)

if [ -z "$ADMIN_CF_ID" ] || [ -z "$VENDOR_CF_ID" ] || [ -z "$CUSTOMER_CF_ID" ]; then
  echo "⚠️  Could not find all CloudFront distributions. Listing all distributions:"
  aws cloudfront list-distributions --query "DistributionList.Items[].{Id:Id,DomainName:DomainName,Comment:Comment}" --output table
  echo ""
  echo "Please provide the CloudFront distribution IDs manually:"
  read -p "Admin CF ID: " ADMIN_CF_ID
  read -p "Vendor CF ID: " VENDOR_CF_ID
  read -p "Customer CF ID: " CUSTOMER_CF_ID
fi

# Get CloudFront domain names and hosted zone IDs
get_cf_info() {
  local cf_id=$1
  aws cloudfront get-distribution --id "$cf_id" --query "Distribution.{DomainName:DomainName,HostedZoneId:DistributionConfig.Aliases.Items[0]}" --output json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"{d['DomainName']}\")
print(f\"Z2FDTNDATAQYW2\")  # CloudFront always uses this hosted zone ID
" 2>/dev/null || echo ""
}

echo "Admin CF: $ADMIN_CF_ID"
ADMIN_CF_DOMAIN=$(aws cloudfront get-distribution --id "$ADMIN_CF_ID" --query "Distribution.DomainName" --output text 2>/dev/null || echo "")
echo "  Domain: $ADMIN_CF_DOMAIN"

echo "Vendor CF: $VENDOR_CF_ID"
VENDOR_CF_DOMAIN=$(aws cloudfront get-distribution --id "$VENDOR_CF_ID" --query "Distribution.DomainName" --output text 2>/dev/null || echo "")
echo "  Domain: $VENDOR_CF_DOMAIN"

echo "Customer CF: $CUSTOMER_CF_ID"
CUSTOMER_CF_DOMAIN=$(aws cloudfront get-distribution --id "$CUSTOMER_CF_ID" --query "Distribution.DomainName" --output text 2>/dev/null || echo "")
echo "  Domain: $CUSTOMER_CF_DOMAIN"

# CloudFront hosted zone ID (always the same)
CF_HOSTED_ZONE_ID="Z2FDTNDATAQYW2"

# Get API Gateway domain
echo ""
echo "🔌 Fetching API Gateway domain..."
API_DOMAIN_NAME=$(aws apigatewayv2 get-domain-names --query "Items[?contains(DomainName, 'dev.api')].DomainName" --output text 2>/dev/null | head -1)

if [ -z "$API_DOMAIN_NAME" ]; then
  echo "⚠️  API Gateway custom domain not found. Using default API endpoint..."
  API_ENDPOINT=$(aws apigatewayv2 get-apis --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" --output text 2>/dev/null | head -1)
  echo "  API Endpoint: $API_ENDPOINT"
  API_DOMAIN_TARGET=$(echo "$API_ENDPOINT" | sed 's|https://||' | sed 's|/.*||')
  API_HOSTED_ZONE_ID=$(aws apigatewayv2 get-apis --query "Items[?Name=='warmpawz-dev-api'].ApiId" --output text 2>/dev/null | head -1)
else
  echo "  Found API domain: $API_DOMAIN_NAME"
  API_DOMAIN_TARGET=$(aws apigatewayv2 get-domain-name --domain-name "$API_DOMAIN_NAME" --query "DomainNameConfigurations[0].TargetDomainName" --output text 2>/dev/null || echo "")
  API_HOSTED_ZONE_ID=$(aws apigatewayv2 get-domain-name --domain-name "$API_DOMAIN_NAME" --query "DomainNameConfigurations[0].HostedZoneId" --output text 2>/dev/null || echo "")
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📝 ROUTE53 RECORDS TO CREATE:"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Function to create Route53 record
create_route53_record() {
  local name=$1
  local type=$2
  local target=$3
  local hosted_zone_id=$4
  
  # Check if record already exists
  EXISTING=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='${name}.']" --output json 2>/dev/null | python3 -c "import sys, json; print('EXISTS' if json.load(sys.stdin) else 'MISSING')" 2>/dev/null || echo "MISSING")
  
  if [ "$EXISTING" = "EXISTS" ]; then
    echo "✅ $name - Already exists (skipping)"
    return 0
  fi
  
  echo -n "📝 Creating $name... "
  
  CHANGE_BATCH=$(cat <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "${name}",
      "Type": "${type}",
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
    echo "✅ Created (Change ID: $CHANGE_ID)"
    return 0
  else
    echo "❌ Failed"
    return 1
  fi
}

# Create records
create_route53_record "dev.admin.warmpawz.com" "A" "$ADMIN_CF_DOMAIN" "$CF_HOSTED_ZONE_ID"
create_route53_record "dev.vendor.warmpawz.com" "A" "$VENDOR_CF_DOMAIN" "$CF_HOSTED_ZONE_ID"
create_route53_record "dev.customer.warmpawz.com" "A" "$CUSTOMER_CF_DOMAIN" "$CF_HOSTED_ZONE_ID"

if [ -n "$API_DOMAIN_TARGET" ] && [ -n "$API_HOSTED_ZONE_ID" ]; then
  create_route53_record "dev.api.warmpawz.com" "A" "$API_DOMAIN_TARGET" "$API_HOSTED_ZONE_ID"
else
  echo "⚠️  dev.api.warmpawz.com - API Gateway domain not configured (skipping)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Route53 setup complete!"
echo ""
echo "📋 URLs:"
echo "   Admin:    https://dev.admin.warmpawz.com"
echo "   Vendor:   https://dev.vendor.warmpawz.com"
echo "   Customer: https://dev.customer.warmpawz.com"
echo "   API:      https://dev.api.warmpawz.com"
echo ""
echo "⏱️  DNS changes may take 1-5 minutes to propagate"

