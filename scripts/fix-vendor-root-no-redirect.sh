#!/bin/bash
# Fix vendor root to serve app directly instead of redirecting (prevents refresh loop)

set -e

BUCKET_NAME="warmpawz-dev-vendor-frontend-ap-south-1"
DISTRIBUTION_ID="E95171GX1I6HN"
REGION="ap-south-1"

echo "🔧 Fixing vendor root to serve app directly (no redirect)..."
echo ""

# Step 1: Copy the actual app index.html to root
echo "📋 Step 1: Copying app index.html to root..."

aws s3 cp "s3://${BUCKET_NAME}/server/app/index.html" "s3://${BUCKET_NAME}/index.html" \
  --region ${REGION} \
  --content-type "text/html" \
  --metadata-directive COPY

if [ $? -eq 0 ]; then
  echo "   ✅ App index.html copied to root (no redirect)"
else
  echo "   ❌ Error copying index.html"
  exit 1
fi

# Step 2: Create CloudFront invalidation
echo ""
echo "📋 Step 2: Creating CloudFront cache invalidation..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/index.html" "/" \
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
echo "║   ✅ ROOT FIX COMPLETED (NO REDIRECT)                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   ✅ Root index.html: Now serves app directly (no redirect)"
echo "   ✅ Cache Invalidation: ${INVALIDATION_ID}"
echo ""
echo "🌐 Test URL:"
echo "   https://${CF_URL}"
echo ""
echo "⏰ Note: Changes may take 5-15 minutes to fully propagate"
echo "   The app will now load directly without redirect loops"
echo ""
