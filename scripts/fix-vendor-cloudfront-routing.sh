#!/bin/bash
# Fix vendor CloudFront routing by creating and attaching URL rewrite function
# This ensures /auth routes to /auth.html instead of index.html

set -e

DISTRIBUTION_ID="E95171GX1I6HN"
FUNCTION_NAME="warmpawz-dev-vendor-url-rewrite"
REGION="ap-south-1"

echo "🔧 Fixing vendor CloudFront routing..."
echo ""

# Read the function code
FUNCTION_CODE=$(cat << 'EOF'
// CloudFront Function: URL Rewrite for Next.js Static Export
// Rewrites /ecommerce to /ecommerce.html, /catalog to /catalog.html, etc.
// This allows Next.js static export files to be served correctly

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  
  // Skip if URI already has an extension (e.g., .html, .js, .css, .png)
  if (uri.match(/\.[a-zA-Z0-9]+$/)) {
    return request;
  }
  
  // Skip root path
  if (uri === '/') {
    return request;
  }
  
  // Skip if URI ends with a slash (directory)
  if (uri.endsWith('/')) {
    return request;
  }
  
  // Skip API paths and special paths
  if (uri.startsWith('/api/') || 
      uri.startsWith('/_next/') || 
      uri.startsWith('/static/') ||
      uri.startsWith('/runtime-config.js') ||
      uri.startsWith('/favicon.ico') ||
      uri.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json)$/i)) {
    return request;
  }
  
  // Rewrite /auth to /auth.html, /onboarding to /onboarding.html, etc.
  // This handles Next.js static export routing
  request.uri = uri + '.html';
  
  return request;
}
EOF
)

# Save function code to temp file
echo "$FUNCTION_CODE" > /tmp/cf-function-code.js

# Check if function already exists
EXISTING_FUNC=$(aws cloudfront list-functions --query "FunctionList.Items[?Name=='$FUNCTION_NAME'].FunctionARN" --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_FUNC" ]; then
  echo "📋 Updating existing CloudFront function..."
  # Get current function config
  aws cloudfront get-function --name "$FUNCTION_NAME" --stage DEVELOPMENT > /tmp/cf-function-dev.json 2>/dev/null || true
  
  # Update function code
  UPDATE_OUTPUT=$(aws cloudfront update-function \
    --name "$FUNCTION_NAME" \
    --if-match "$(aws cloudfront get-function --name "$FUNCTION_NAME" --stage DEVELOPMENT --query 'ETag' --output text 2>/dev/null || echo '')" \
    --function-code fileb:///tmp/cf-function-code.js \
    --function-config "Comment=URL rewrite function for vendor - adds .html extension for Next.js static export,Runtime=cloudfront-js-1.0" \
    --query 'FunctionSummary.{Name:Name,Status:Status}' \
    --output json 2>&1)
  
  echo "   ✅ Function updated"
else
  echo "📋 Creating new CloudFront function..."
  # Create function
  CREATE_OUTPUT=$(aws cloudfront create-function \
    --name "$FUNCTION_NAME" \
    --function-code fileb:///tmp/cf-function-code.js \
    --function-config "Comment=URL rewrite function for vendor - adds .html extension for Next.js static export,Runtime=cloudfront-js-1.0" \
    --query 'FunctionSummary.{Name:Name,Status:Status,FunctionARN:FunctionARN}' \
    --output json 2>&1)
  
  echo "   ✅ Function created"
  EXISTING_FUNC=$(echo "$CREATE_OUTPUT" | python3 -c "import json, sys; print(json.load(sys.stdin).get('FunctionARN', ''))" 2>/dev/null || echo "")
fi

# Publish function
echo "📋 Publishing CloudFront function..."
DEV_ETAG=$(aws cloudfront get-function --name "$FUNCTION_NAME" --stage DEVELOPMENT --query 'ETag' --output text 2>/dev/null || echo "")
if [ -n "$DEV_ETAG" ]; then
  aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$DEV_ETAG" --output text > /tmp/cf-publish-output.txt 2>&1
  echo "   ✅ Function published"
else
  echo "   ⚠️  Could not get function ETag for publishing"
fi

# Get function ARN
FUNCTION_ARN=$(aws cloudfront get-function --name "$FUNCTION_NAME" --stage DEVELOPMENT --query 'FunctionSummary.FunctionARN' --output text 2>/dev/null || echo "")

if [ -z "$FUNCTION_ARN" ]; then
  echo "   ❌ Could not get function ARN"
  exit 1
fi

echo ""
echo "📋 Getting CloudFront distribution configuration..."
aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" > /tmp/cf-config.json
ETAG=$(python3 -c "import json; print(json.load(open('/tmp/cf-config.json'))['ETag'])")
CONFIG=$(python3 -c "import json; print(json.dumps(json.load(open('/tmp/cf-config.json'))['DistributionConfig']))")

# Update configuration to add function association
echo "📋 Updating CloudFront distribution with function association..."
python3 << EOF
import json
import sys

config = json.loads('''$CONFIG''')
function_arn = '''$FUNCTION_ARN'''

# Add function association to default cache behavior
config['DefaultCacheBehavior']['FunctionAssociations'] = {
    'Quantity': 1,
    'Items': [
        {
            'FunctionARN': function_arn,
            'EventType': 'viewer-request'
        }
    ]
}

with open('/tmp/cf-config-updated.json', 'w') as f:
    json.dump(config, f)
EOF

# Update distribution
echo "📋 Updating CloudFront distribution..."
UPDATE_OUTPUT=$(aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/cf-config-updated.json \
  --query 'Distribution.{Id:Id,Status:Status}' \
  --output json)

echo "   ✅ CloudFront distribution update initiated"
echo ""

# Cleanup
rm -f /tmp/cf-config.json /tmp/cf-config-updated.json /tmp/cf-function-code.js /tmp/cf-function-dev.json

# Display results
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ✅ CLOUDFRONT ROUTING FIX INITIATED                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Update Details:"
echo "$UPDATE_OUTPUT" | python3 -m json.tool
echo ""
echo "🔧 Function: $FUNCTION_NAME"
echo "   ARN: $FUNCTION_ARN"
echo ""
echo "🌐 Test URLs (after deployment):"
echo "   • https://dev.vendor.warmpawz.com/auth (should load auth page)"
echo "   • https://dev.vendor.warmpawz.com/onboarding (should load onboarding page)"
echo ""
echo "⏰ Note: Distribution changes take 15-20 minutes to deploy"
echo "   You can check status with:"
echo "   aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"
echo ""
