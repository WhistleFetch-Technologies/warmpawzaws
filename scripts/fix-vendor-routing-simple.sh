#!/bin/bash
# Simple fix for vendor CloudFront routing - associate existing function

set -e

DISTRIBUTION_ID="E95171GX1I6HN"
FUNCTION_NAME="warmpawz-dev-vendor-url-rewrite"

echo "🔧 Fixing vendor CloudFront routing..."
echo ""

# Get function ARN
echo "📋 Getting CloudFront function..."
FUNCTION_ARN=$(aws cloudfront get-function --name "$FUNCTION_NAME" --stage DEVELOPMENT --query 'FunctionSummary.FunctionARN' --output text 2>/dev/null || echo "")

if [ -z "$FUNCTION_ARN" ]; then
  echo "   ❌ Function not found: $FUNCTION_NAME"
  exit 1
fi

echo "   ✅ Function found: $FUNCTION_ARN"
echo ""

# Get distribution config
echo "📋 Getting CloudFront distribution configuration..."
aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" > /tmp/cf-dist.json
ETAG=$(python3 -c "import json; print(json.load(open('/tmp/cf-dist.json'))['ETag'])")
CONFIG=$(python3 -c "import json; print(json.dumps(json.load(open('/tmp/cf-dist.json'))['DistributionConfig']))")

# Update config
echo "📋 Updating configuration..."
python3 << EOF
import json
import sys

config = json.loads('''$CONFIG''')
function_arn = '''$FUNCTION_ARN'''

# Add function association
config['DefaultCacheBehavior']['FunctionAssociations'] = {
    'Quantity': 1,
    'Items': [
        {
            'FunctionARN': function_arn,
            'EventType': 'viewer-request'
        }
    ]
}

with open('/tmp/cf-dist-updated.json', 'w') as f:
    json.dump(config, f)

print("✅ Configuration updated")
EOF

# Update distribution
echo "📋 Updating CloudFront distribution..."
UPDATE_OUTPUT=$(aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/cf-dist-updated.json \
  --query 'Distribution.{Id:Id,Status:Status}' \
  --output json)

echo "   ✅ Distribution update initiated"
echo ""

# Cleanup
rm -f /tmp/cf-dist.json /tmp/cf-dist-updated.json

# Display results
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ✅ CLOUDFRONT ROUTING FIX INITIATED                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "$UPDATE_OUTPUT" | python3 -m json.tool
echo ""
echo "⏰ Note: Distribution changes take 15-20 minutes to deploy"
echo ""
