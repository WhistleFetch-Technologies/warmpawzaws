#!/bin/bash
# Get all deployment URLs from Terraform outputs and AWS

set -e

cd "$(dirname "$0")/../infra/envs/dev"

echo "🔍 Fetching deployment URLs..."
echo ""

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
  echo "📦 Initializing Terraform..."
  terraform init -backend-config=backend.hcl > /dev/null 2>&1
fi

# Get Terraform outputs
echo "📊 TERRAFORM OUTPUTS:"
echo "═══════════════════════════════════════════════════════════════"

# API Gateway
API_ENDPOINT=$(terraform output -raw api_endpoint 2>/dev/null || echo "N/A")
API_CUSTOM=$(terraform output -raw api_custom_domain 2>/dev/null || echo "N/A")
echo "🔌 API Gateway:"
echo "   Default: $API_ENDPOINT"
echo "   Custom:  $API_CUSTOM"
echo ""

# CloudFront URLs (actual)
ADMIN_CF=$(terraform output -raw admin_cloudfront_url 2>/dev/null || echo "N/A")
VENDOR_CF=$(terraform output -raw vendor_cloudfront_url 2>/dev/null || echo "N/A")
CUSTOMER_CF=$(terraform output -raw customer_cloudfront_url 2>/dev/null || echo "N/A")
echo "🌐 CloudFront URLs (Actual - No DNS Required):"
echo "   Admin:    $ADMIN_CF"
echo "   Vendor:   $VENDOR_CF"
echo "   Customer: $CUSTOMER_CF"
echo ""

# Custom Domain URLs (require DNS)
ADMIN_URL=$(terraform output -raw admin_url 2>/dev/null || echo "N/A")
VENDOR_URL=$(terraform output -raw vendor_url 2>/dev/null || echo "N/A")
CUSTOMER_URL=$(terraform output -raw customer_url 2>/dev/null || echo "N/A")
echo "🌍 Custom Domain URLs (Require Route53 DNS):"
echo "   Admin:    $ADMIN_URL"
echo "   Vendor:   $VENDOR_URL"
echo "   Customer: $CUSTOMER_URL"
echo ""

# CloudFront Distribution IDs
ADMIN_CF_ID=$(terraform output -raw cloudfront_admin_distribution_id 2>/dev/null || echo "N/A")
VENDOR_CF_ID=$(terraform output -raw cloudfront_vendor_distribution_id 2>/dev/null || echo "N/A")
CUSTOMER_CF_ID=$(terraform output -raw cloudfront_customer_distribution_id 2>/dev/null || echo "N/A")
echo "🆔 CloudFront Distribution IDs:"
echo "   Admin:    $ADMIN_CF_ID"
echo "   Vendor:   $VENDOR_CF_ID"
echo "   Customer: $CUSTOMER_CF_ID"
echo ""

# Check Route53 records
echo "🔍 ROUTE53 DNS RECORDS:"
echo "═══════════════════════════════════════════════════════════════"

ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='warmpawz.com.'].Id" --output text 2>/dev/null | sed 's|/hostedzone/||' || echo "")

if [ -z "$ZONE_ID" ]; then
  echo "⚠️  Route53 hosted zone 'warmpawz.com' not found"
else
  echo "✅ Found Route53 zone: $ZONE_ID"
  echo ""
  
  # Check API Gateway record
  API_RECORD=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='dev.api.warmpawz.com.']" --output json 2>/dev/null || echo "[]")
  if [ "$API_RECORD" != "[]" ]; then
    echo "✅ dev.api.warmpawz.com - EXISTS"
  else
    echo "❌ dev.api.warmpawz.com - MISSING"
  fi
  
  # Check Admin record
  ADMIN_RECORD=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='dev.admin.warmpawz.com.']" --output json 2>/dev/null || echo "[]")
  if [ "$ADMIN_RECORD" != "[]" ]; then
    ADMIN_TARGET=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='dev.admin.warmpawz.com.'].AliasTarget.DNSName" --output text 2>/dev/null || echo "N/A")
    echo "✅ dev.admin.warmpawz.com - EXISTS → $ADMIN_TARGET"
  else
    echo "❌ dev.admin.warmpawz.com - MISSING"
  fi
  
  # Check Vendor record
  VENDOR_RECORD=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='dev.vendor.warmpawz.com.']" --output json 2>/dev/null || echo "[]")
  if [ "$VENDOR_RECORD" != "[]" ]; then
    VENDOR_TARGET=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='dev.vendor.warmpawz.com.'].AliasTarget.DNSName" --output text 2>/dev/null || echo "N/A")
    echo "✅ dev.vendor.warmpawz.com - EXISTS → $VENDOR_TARGET"
  else
    echo "❌ dev.vendor.warmpawz.com - MISSING"
  fi
  
  # Check Customer record
  CUSTOMER_RECORD=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='dev.customer.warmpawz.com.']" --output json 2>/dev/null || echo "[]")
  if [ "$CUSTOMER_RECORD" != "[]" ]; then
    CUSTOMER_TARGET=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='dev.customer.warmpawz.com.'].AliasTarget.DNSName" --output text 2>/dev/null || echo "N/A")
    echo "✅ dev.customer.warmpawz.com - EXISTS → $CUSTOMER_TARGET"
  else
    echo "❌ dev.customer.warmpawz.com - MISSING"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ URL discovery complete"
echo ""

