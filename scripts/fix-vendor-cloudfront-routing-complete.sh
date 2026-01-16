#!/bin/bash
# Complete fix for vendor CloudFront routing
# Publishes CloudFront function and associates it with distribution

set -e

DISTRIBUTION_ID="E95171GX1I6HN"
FUNCTION_NAME="warmpawz-dev-vendor-url-rewrite"

echo "🔧 Fixing vendor CloudFront routing (complete fix)..."
echo ""

# Step 1: Get function details from DEVELOPMENT stage
echo "📋 Step 1: Getting CloudFront function from DEVELOPMENT stage..."
FUNC_DESC=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --stage DEVELOPMENT --output json 2>&1)
DEV_ETAG=$(echo "$FUNC_DESC" | python3 -c "import json, sys; print(json.load(sys.stdin)['ETag'])" 2>/dev/null || echo "")
FUNCTION_ARN_FROM_DESC=$(echo "$FUNC_DESC" | python3 -c "import json, sys; print(json.load(sys.stdin)['FunctionSummary']['FunctionMetadata']['FunctionARN'])" 2>/dev/null || echo "")

if [ -z "$DEV_ETAG" ]; then
  echo "   ❌ Could not get function from DEVELOPMENT stage"
  echo "   Error: $FUNC_DESC"
  exit 1
fi

echo "   ✅ Function found (ETag: $DEV_ETAG)"
echo "   ✅ Function ARN: $FUNCTION_ARN_FROM_DESC"
echo ""

# Step 2: Publish function to LIVE stage
echo "📋 Step 2: Publishing function to LIVE stage..."
PUBLISH_OUTPUT=$(aws cloudfront publish-function \
  --name "$FUNCTION_NAME" \
  --if-match "$DEV_ETAG" \
  --output json 2>&1)
PUBLISH_EXIT=$?

if [ $? -eq 0 ]; then
  # Get LIVE stage description to get ETag and ARN
  LIVE_DESC=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --stage LIVE --output json 2>&1)
  LIVE_ETAG=$(echo "$LIVE_DESC" | python3 -c "import json, sys; print(json.load(sys.stdin)['ETag'])" 2>/dev/null || echo "")
  FUNCTION_ARN=$(echo "$LIVE_DESC" | python3 -c "import json, sys; print(json.load(sys.stdin)['FunctionSummary']['FunctionMetadata']['FunctionARN'])" 2>/dev/null || echo "$FUNCTION_ARN_FROM_DESC")
  echo "   ✅ Function published to LIVE stage"
  echo "   ✅ Function ARN: $FUNCTION_ARN"
else
  # If publish fails, try to get LIVE stage function
  echo "   ⚠️  Publish may have failed, checking LIVE stage..."
  LIVE_DESC=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --stage LIVE --output json 2>&1)
  if [ $? -eq 0 ]; then
    LIVE_ETAG=$(echo "$LIVE_DESC" | python3 -c "import json, sys; print(json.load(sys.stdin)['ETag'])" 2>/dev/null || echo "")
    FUNCTION_ARN=$(echo "$LIVE_DESC" | python3 -c "import json, sys; print(json.load(sys.stdin)['FunctionSummary']['FunctionMetadata']['FunctionARN'])" 2>/dev/null || echo "$FUNCTION_ARN_FROM_DESC")
    echo "   ✅ Function already exists in LIVE stage"
    echo "   ✅ Function ARN: $FUNCTION_ARN"
  else
    echo "   ❌ Could not publish or find function in LIVE stage"
    echo "   Error: $PUBLISH_OUTPUT"
    echo "   Using ARN from DEVELOPMENT: $FUNCTION_ARN_FROM_DESC"
    FUNCTION_ARN="$FUNCTION_ARN_FROM_DESC"
  fi
fi

if [ -z "$FUNCTION_ARN" ]; then
  # Construct ARN from account ID and function name
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  FUNCTION_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:function/${FUNCTION_NAME}"
  echo "   ⚠️  Constructed ARN: $FUNCTION_ARN"
fi

echo ""

# Step 3: Get distribution configuration
echo "📋 Step 3: Getting CloudFront distribution configuration..."
aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" > /tmp/cf-dist.json
DIST_ETAG=$(python3 -c "import json; print(json.load(open('/tmp/cf-dist.json'))['ETag'])")
CONFIG=$(python3 -c "import json; print(json.dumps(json.load(open('/tmp/cf-dist.json'))['DistributionConfig']))")

echo "   ✅ Distribution config retrieved (ETag: $DIST_ETAG)"
echo ""

# Step 4: Update configuration with function association
echo "📋 Step 4: Updating configuration with function association..."
python3 << EOF
import json
import sys

config = json.loads('''$CONFIG''')
function_arn = '''$FUNCTION_ARN'''

# Check if function is already associated
existing_funcs = config['DefaultCacheBehavior'].get('FunctionAssociations', {})
existing_items = existing_funcs.get('Items', [])

# Check if this function is already associated
already_associated = any(
    item.get('FunctionARN') == function_arn 
    for item in existing_items
)

if already_associated:
    print("   ⚠️  Function already associated, updating anyway...")
else:
    print("   ✅ Adding function association...")

# Set function association
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

print("   ✅ Configuration updated")
EOF

echo ""

# Step 5: Update distribution
echo "📋 Step 5: Updating CloudFront distribution..."
UPDATE_OUTPUT=$(aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --if-match "$DIST_ETAG" \
  --distribution-config file:///tmp/cf-dist-updated.json \
  --query 'Distribution.{Id:Id,Status:Status,DomainName:DomainName}' \
  --output json 2>&1)

if [ $? -eq 0 ]; then
  echo "   ✅ Distribution update initiated successfully"
  echo ""
  
  # Display results
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║   ✅ CLOUDFRONT ROUTING FIX COMPLETE                           ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "📊 Update Details:"
  echo "$UPDATE_OUTPUT" | python3 -m json.tool
  echo ""
  echo "🔧 Function Details:"
  echo "   Name: $FUNCTION_NAME"
  echo "   ARN: $FUNCTION_ARN"
  echo "   Event: viewer-request"
  echo ""
  echo "🌐 What This Fixes:"
  echo "   • /auth → /auth.html (rewrites correctly)"
  echo "   • /onboarding → /onboarding.html"
  echo "   • All Next.js static export routes work"
  echo ""
  echo "⏰ Deployment:"
  echo "   Distribution changes take 15-20 minutes to deploy"
  echo "   Check status: aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"
  echo ""
  echo "🧪 Test After Deployment:"
  echo "   • https://dev.vendor.warmpawz.com/auth (should load auth page)"
  echo "   • https://dev.vendor.warmpawz.com/onboarding (should load onboarding page)"
  echo "   • https://dev.vendor.warmpawz.com/ (should redirect to /auth if no session)"
  echo ""
else
  echo "   ❌ Distribution update failed"
  echo "   Error: $UPDATE_OUTPUT"
  exit 1
fi

# Cleanup
rm -f /tmp/cf-dist.json /tmp/cf-dist-updated.json

echo "✅ Script completed successfully!"
echo ""
