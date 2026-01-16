#!/bin/bash
# Fix static file paths for vendor-web
# The files are at /static/ but HTML references /_next/static/
# We need to copy them to the correct location

set -e

BUCKET_NAME="warmpawz-dev-vendor-frontend-ap-south-1"
DISTRIBUTION_ID="E95171GX1I6HN"
REGION="ap-south-1"

echo "🔧 Fixing static file paths for vendor-web..."
echo "   Moving files from /static/ to /_next/static/"
echo ""

# Step 1: Copy static directory to _next/static
echo "📋 Step 1: Copying static files to _next/static/..."

# Use S3 sync to copy static to _next/static
aws s3 sync "s3://${BUCKET_NAME}/static/" "s3://${BUCKET_NAME}/_next/static/" \
  --region ${REGION} \
  --exclude "*.map"

if [ $? -eq 0 ]; then
  echo "   ✅ Static files copied to _next/static/"
else
  echo "   ❌ Error copying files"
  exit 1
fi

# Step 2: Ensure runtime-config.js is at root
echo ""
echo "📋 Step 2: Ensuring runtime-config.js is at root..."

# Check if runtime-config.js exists in server/app
RUNTIME_IN_SERVER=$(aws s3 ls "s3://${BUCKET_NAME}/server/app/runtime-config.js" --region ${REGION} 2>&1 | grep -v "NoSuchKey" || echo "")

if [ -n "$RUNTIME_IN_SERVER" ]; then
  echo "   Found runtime-config.js in server/app/, copying to root..."
  aws s3 cp "s3://${BUCKET_NAME}/server/app/runtime-config.js" "s3://${BUCKET_NAME}/runtime-config.js" --region ${REGION}
  echo "   ✅ runtime-config.js copied to root"
elif aws s3 ls "s3://${BUCKET_NAME}/runtime-config.js" --region ${REGION} 2>&1 | grep -q "runtime-config.js"; then
  echo "   ✅ runtime-config.js already exists at root"
else
  echo "   ⚠️  runtime-config.js not found. Creating default..."
  # Create a default runtime-config.js
  cat > /tmp/runtime-config.js <<'EOF'
// Runtime Configuration for Warmpawz vendor-web
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com",
    uatMode: true
  };
  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
EOF
  aws s3 cp /tmp/runtime-config.js "s3://${BUCKET_NAME}/runtime-config.js" --region ${REGION} --content-type "application/javascript"
  rm /tmp/runtime-config.js
  echo "   ✅ Default runtime-config.js created at root"
fi

# Step 3: Create CloudFront invalidation
echo ""
echo "📋 Step 3: Creating CloudFront cache invalidation..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/_next/*" "/runtime-config.js" "/*" \
  --query 'Invalidation.Id' \
  --output text \
  --region ${REGION})

echo "   ✅ Invalidation created: ${INVALIDATION_ID}"

# Get CloudFront URL
CF_URL=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Id=='${DISTRIBUTION_ID}'].DomainName" \
  --output text --region ${REGION})

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ✅ STATIC PATHS FIX COMPLETED                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   ✅ Static files: Copied to /_next/static/"
echo "   ✅ runtime-config.js: Verified at root"
echo "   ✅ Cache Invalidation: ${INVALIDATION_ID}"
echo ""
echo "🌐 Test URL:"
echo "   https://${CF_URL}"
echo ""
echo "⏰ Note: Changes may take 5-15 minutes to fully propagate"
echo ""
