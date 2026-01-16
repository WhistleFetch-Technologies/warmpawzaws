#!/bin/bash
# Fix CloudFront Access Denied issue for vendor-web
# This script ensures the S3 bucket policy and CloudFront OAC are properly configured

set -e

# Configuration
BUCKET_NAME="warmpawz-dev-vendor-frontend-ap-south-1"
DISTRIBUTION_ID="E95171GX1I6HN"
REGION="ap-south-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "🔧 Fixing CloudFront Access Denied for vendor-web..."
echo "   Bucket: ${BUCKET_NAME}"
echo "   Distribution: ${DISTRIBUTION_ID}"
echo "   Account: ${ACCOUNT_ID}"
echo ""

# Step 1: Get current OAC ID
echo "📋 Step 1: Getting CloudFront OAC configuration..."
OAC_ID=$(aws cloudfront get-distribution --id ${DISTRIBUTION_ID} --region ${REGION} \
  --query 'Distribution.DistributionConfig.Origins.Items[0].OriginAccessControlId' \
  --output text)

if [ -z "$OAC_ID" ] || [ "$OAC_ID" = "None" ]; then
  echo "❌ Error: Could not find OAC ID for distribution ${DISTRIBUTION_ID}"
  exit 1
fi

echo "   ✅ OAC ID: ${OAC_ID}"
echo ""

# Step 2: Update S3 bucket policy to allow CloudFront
echo "📋 Step 2: Updating S3 bucket policy..."
BUCKET_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAC",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DISTRIBUTION_ID}"
        }
      }
    }
  ]
}
EOF
)

echo "$BUCKET_POLICY" > /tmp/vendor-bucket-policy.json
aws s3api put-bucket-policy --bucket ${BUCKET_NAME} --policy file:///tmp/vendor-bucket-policy.json --region ${REGION}
rm /tmp/vendor-bucket-policy.json

echo "   ✅ Bucket policy updated"
echo ""

# Step 3: Verify bucket policy
echo "📋 Step 3: Verifying bucket policy..."
aws s3api get-bucket-policy --bucket ${BUCKET_NAME} --region ${REGION} --query Policy --output text | python3 -m json.tool > /dev/null
echo "   ✅ Bucket policy is valid JSON"
echo ""

# Step 4: Create CloudFront invalidation
echo "📋 Step 4: Creating CloudFront cache invalidation..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text \
  --region ${REGION})

echo "   ✅ Invalidation created: ${INVALIDATION_ID}"
echo ""

# Step 5: Verify CloudFront distribution status
echo "📋 Step 5: Verifying CloudFront distribution..."
STATUS=$(aws cloudfront get-distribution --id ${DISTRIBUTION_ID} --region ${REGION} \
  --query 'Distribution.Status' --output text)

if [ "$STATUS" = "Deployed" ]; then
  echo "   ✅ Distribution is deployed"
else
  echo "   ⚠️  Distribution status: ${STATUS}"
fi

# Get CloudFront URL
CF_URL=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Id=='${DISTRIBUTION_ID}'].DomainName" \
  --output text --region ${REGION})

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ✅ CLOUDFRONT ACCESS FIX COMPLETED                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   ✅ S3 Bucket Policy: Updated"
echo "   ✅ CloudFront Distribution: ${DISTRIBUTION_ID}"
echo "   ✅ OAC ID: ${OAC_ID}"
echo "   ✅ Cache Invalidation: ${INVALIDATION_ID}"
echo ""
echo "🌐 Test URL:"
echo "   ${CF_URL}"
echo ""
echo "⏰ Note: Changes may take 5-15 minutes to fully propagate"
echo ""
echo "🧪 Testing access..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${CF_URL}/" || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
  echo "   ✅ Access test: SUCCESS (HTTP ${HTTP_CODE})"
elif [ "$HTTP_CODE" = "403" ]; then
  echo "   ⚠️  Access test: Still returning 403 (may need to wait for propagation)"
  echo "   💡 Wait 5-15 minutes and try again"
else
  echo "   ⚠️  Access test: HTTP ${HTTP_CODE} (check after propagation)"
fi
echo ""
