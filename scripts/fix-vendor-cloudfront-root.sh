#!/bin/bash
# Fix CloudFront root object path for vendor-web
# The index.html is at server/app/index.html, so we need to either:
# 1. Update DefaultRootObject, or 
# 2. Create a root index.html that redirects

set -e

BUCKET_NAME="warmpawz-dev-vendor-frontend-ap-south-1"
DISTRIBUTION_ID="E95171GX1I6HN"
REGION="ap-south-1"

echo "🔧 Fixing CloudFront root object for vendor-web..."
echo ""

# Option 1: Create a root index.html that redirects to the auth page
# This is simpler than updating CloudFront distribution config
echo "📋 Creating root index.html redirect..."

# Download the actual index.html to see its structure
aws s3 cp "s3://${BUCKET_NAME}/server/app/index.html" /tmp/vendor-index.html --region ${REGION} 2>/dev/null || echo "Could not download existing index.html"

# Create a simple root index.html that redirects to auth
cat > /tmp/root-index.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Warmpawz Vendor</title>
    <meta http-equiv="refresh" content="0; url=/server/app/index.html">
    <script>
        // Immediate redirect
        window.location.replace('/server/app/index.html');
    </script>
</head>
<body>
    <p>Redirecting to <a href="/server/app/index.html">vendor application</a>...</p>
</body>
</html>
EOF

# Upload root index.html
aws s3 cp /tmp/root-index.html "s3://${BUCKET_NAME}/index.html" --region ${REGION} --content-type "text/html"
echo "   ✅ Root index.html uploaded"

# Cleanup
rm -f /tmp/root-index.html /tmp/vendor-index.html

# Invalidate CloudFront cache
echo ""
echo "📋 Creating CloudFront cache invalidation..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/index.html" "/*" \
  --query 'Invalidation.Id' \
  --output text \
  --region ${REGION})

echo "   ✅ Invalidation created: ${INVALIDATION_ID}"
echo ""

# Get CloudFront URL
CF_URL=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Id=='${DISTRIBUTION_ID}'].DomainName" \
  --output text --region ${REGION})

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ✅ ROOT OBJECT FIX COMPLETED                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   ✅ Root index.html: Created (redirects to /server/app/index.html)"
echo "   ✅ Cache Invalidation: ${INVALIDATION_ID}"
echo ""
echo "🌐 Test URL:"
echo "   https://${CF_URL}"
echo ""
echo "⏰ Note: Changes may take 5-15 minutes to fully propagate"
echo ""
