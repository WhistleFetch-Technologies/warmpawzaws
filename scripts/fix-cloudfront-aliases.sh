#!/bin/bash
# Fix CloudFront distributions by adding custom domain aliases
# This script updates CloudFront distributions to accept custom domain requests

set -e

echo "🔧 Fixing CloudFront distributions to accept custom domains..."
echo ""

# CloudFront Distribution IDs
ADMIN_CF_ID="E1WPXL8WBOWOE8"
VENDOR_CF_ID="E95171GX1I6HN"
CUSTOMER_CF_ID="E2RDORGXSWJJ87"

# Custom domains
ADMIN_DOMAIN="dev.admin.warmpawz.com"
VENDOR_DOMAIN="dev.vendor.warmpawz.com"
CUSTOMER_DOMAIN="dev.customer.warmpawz.com"

# Function to update CloudFront distribution with alias
update_cf_alias() {
  local cf_id=$1
  local domain=$2
  local name=$3
  
  echo "📝 Updating $name CloudFront ($cf_id) with alias: $domain"
  
  # Get current distribution config
  ETAG=$(aws cloudfront get-distribution-config --id "$cf_id" --query "ETag" --output text 2>/dev/null)
  
  if [ -z "$ETAG" ]; then
    echo "❌ Failed to get distribution config for $cf_id"
    return 1
  fi
  
  # Get full config
  aws cloudfront get-distribution-config --id "$cf_id" > /tmp/cf-config.json 2>/dev/null
  
  # Check if alias already exists
  ALIASES=$(python3 -c "
import json
with open('/tmp/cf-config.json') as f:
    data = json.load(f)
    config = data['DistributionConfig']
    aliases = config.get('Aliases', {}).get('Items', [])
    print(','.join(aliases))
" 2>/dev/null || echo "")
  
  if echo "$ALIASES" | grep -q "$domain"; then
    echo "✅ Alias $domain already exists in distribution"
    return 0
  fi
  
  # Add alias to config
  python3 <<PYTHON_SCRIPT
import json

with open('/tmp/cf-config.json', 'r') as f:
    data = json.load(f)

config = data['DistributionConfig']
aliases = config.get('Aliases', {}).get('Items', [])

if '$domain' not in aliases:
    aliases.append('$domain')
    config['Aliases'] = {'Quantity': len(aliases), 'Items': aliases}
    print(f"✅ Added alias: $domain")
else:
    print(f"✅ Alias already exists: $domain")

# Write updated config
with open('/tmp/cf-config-updated.json', 'w') as f:
    json.dump(data, f, indent=2)

PYTHON_SCRIPT

  # Update distribution
  UPDATE_RESULT=$(aws cloudfront update-distribution \
    --id "$cf_id" \
    --if-match "$ETAG" \
    --distribution-config file:///tmp/cf-config-updated.json \
    --query "Distribution.{Id:Id,Status:Status,DomainName:DomainName}" \
    --output json 2>&1 || echo "ERROR")
  
  if echo "$UPDATE_RESULT" | grep -q "ERROR"; then
    echo "❌ Failed to update distribution: $UPDATE_RESULT"
    return 1
  else
    echo "✅ Distribution update initiated"
    echo "   Note: CloudFront updates take 15-20 minutes to deploy"
    return 0
  fi
}

# Update each distribution
update_cf_alias "$ADMIN_CF_ID" "$ADMIN_DOMAIN" "Admin"
update_cf_alias "$VENDOR_CF_ID" "$VENDOR_DOMAIN" "Vendor"
update_cf_alias "$CUSTOMER_CF_ID" "$CUSTOMER_DOMAIN" "Customer"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "⚠️  IMPORTANT: CloudFront distribution updates take 15-20 minutes"
echo "   The distributions are now being updated with custom domain aliases"
echo "   URLs will be accessible once the deployment completes"
echo ""
echo "📋 Check status with:"
echo "   aws cloudfront get-distribution --id $ADMIN_CF_ID --query 'Distribution.Status'"
echo "═══════════════════════════════════════════════════════════════"

