#!/bin/bash
# Fix vendor CloudFront distribution by adding custom domain alias and certificate
# This script updates the CloudFront distribution to use a validated ACM certificate

set -e

DISTRIBUTION_ID="E95171GX1I6HN"
CERT_ARN="arn:aws:acm:us-east-1:057442119249:certificate/02b216e5-4696-409a-b595-a4d0f5b6b04b"
CUSTOM_DOMAIN="dev.vendor.warmpawz.com"
REGION="ap-south-1"

echo "🔧 Fixing vendor CloudFront distribution..."
echo ""

# Check certificate status
echo "📋 Checking certificate status..."
CERT_STATUS=$(aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT_ARN" --query "Certificate.Status" --output text)

if [ "$CERT_STATUS" != "ISSUED" ]; then
  echo "   ⚠️  Certificate is not yet validated (Status: $CERT_STATUS)"
  echo "   ⏳ Waiting for certificate validation..."
  
  # Wait up to 10 minutes for validation
  MAX_WAIT=600
  ELAPSED=0
  while [ "$CERT_STATUS" != "ISSUED" ] && [ $ELAPSED -lt $MAX_WAIT ]; do
    sleep 30
    ELAPSED=$((ELAPSED + 30))
    CERT_STATUS=$(aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT_ARN" --query "Certificate.Status" --output text)
    echo "   ⏳ Certificate status: $CERT_STATUS (waited ${ELAPSED}s)"
  done
  
  if [ "$CERT_STATUS" != "ISSUED" ]; then
    echo "   ❌ Certificate validation timed out. Please check DNS records."
    exit 1
  fi
fi

echo "   ✅ Certificate is validated (Status: $CERT_STATUS)"
echo ""

# Get current distribution config
echo "📋 Getting current CloudFront distribution configuration..."
aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" > /tmp/cf-config.json
ETAG=$(python3 -c "import json, sys; print(json.load(sys.stdin)['ETag'])" < /tmp/cf-config.json)
CONFIG=$(python3 -c "import json, sys; print(json.dumps(json.load(sys.stdin)['DistributionConfig']))" < /tmp/cf-config.json)

# Update the configuration using Python
echo "📋 Updating CloudFront distribution configuration..."
python3 << EOF
import json
import sys

config = json.loads('''$CONFIG''')
config['Aliases'] = {
    'Quantity': 1,
    'Items': ['$CUSTOM_DOMAIN']
}
config['ViewerCertificate'] = {
    'CloudFrontDefaultCertificate': False,
    'ACMCertificateArn': '$CERT_ARN',
    'SSLSupportMethod': 'sni-only',
    'MinimumProtocolVersion': 'TLSv1.2_2021',
    'CertificateSource': 'acm'
}

with open('/tmp/cf-config-updated.json', 'w') as f:
    json.dump(config, f)
EOF

# Update the distribution
echo "📋 Updating CloudFront distribution..."
UPDATE_OUTPUT=$(aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/cf-config-updated.json \
  --query 'Distribution.{Id:Id,Status:Status,DomainName:DomainName,Aliases:Aliases.Items}' \
  --output json)

echo "   ✅ CloudFront distribution update initiated"
echo ""

# Cleanup
rm -f /tmp/cf-config.json /tmp/cf-config-updated.json

# Display results
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ✅ CLOUDFRONT DISTRIBUTION UPDATED                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Update Details:"
echo "$UPDATE_OUTPUT" | python3 -m json.tool
echo ""
echo "🌐 URLs:"
echo "   CloudFront: https://d1s6ykkj381k58.cloudfront.net"
echo "   Custom Domain: https://$CUSTOM_DOMAIN"
echo ""
echo "⏰ Note: Distribution changes take 15-20 minutes to deploy"
echo "   You can check status with:"
echo "   aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"
echo ""
