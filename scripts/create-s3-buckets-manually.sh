#!/bin/bash

# Manual S3 Bucket Creation for Warmpawz Dev Frontend Apps
# This pre-creates buckets so Terraform can import them instead of waiting to create

set -e

ENVIRONMENT="dev"
REGION="ap-south-1"
ACCOUNT_ID="057442119249"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║      Manual S3 Bucket Creation - Frontend Apps              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Region: ${REGION}"
echo "Environment: ${ENVIRONMENT}"
echo ""

# Define buckets to create
BUCKETS=(
  "warmpawz-dev-admin-frontend-ap-south-1"
  "warmpawz-dev-vendor-frontend-ap-south-1"
  "warmpawz-dev-customer-frontend-ap-south-1"
)

APPS=("admin" "vendor" "customer")

for i in "${!BUCKETS[@]}"; do
  BUCKET="${BUCKETS[$i]}"
  APP="${APPS[$i]}"
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Creating bucket: $BUCKET"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Check if bucket already exists
  if aws s3 ls "s3://$BUCKET" --region "$REGION" 2>/dev/null; then
    echo "  ✅ Bucket already exists: $BUCKET"
    echo ""
    continue
  fi
  
  echo "  📦 Creating S3 bucket..."
  
  # Create bucket (ap-south-1 requires LocationConstraint)
  aws s3api create-bucket \
    --bucket "$BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" \
    --output json
  
  echo "  ✅ Bucket created"
  
  # Enable versioning (suspended by default for frontend static assets)
  echo "  🔧 Configuring versioning (suspended)..."
  aws s3api put-bucket-versioning \
    --bucket "$BUCKET" \
    --versioning-configuration Status=Suspended \
    --region "$REGION"
  echo "  ✅ Versioning configured"
  
  # Block public access (CloudFront will use OAC)
  echo "  🔒 Blocking public access..."
  aws s3api put-public-access-block \
    --bucket "$BUCKET" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
    --region "$REGION"
  echo "  ✅ Public access blocked"
  
  # Enable server-side encryption
  echo "  🔐 Enabling server-side encryption..."
  aws s3api put-bucket-encryption \
    --bucket "$BUCKET" \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        },
        "BucketKeyEnabled": false
      }]
    }' \
    --region "$REGION"
  echo "  ✅ Encryption enabled"
  
  # Add tags
  echo "  🏷️  Adding tags..."
  aws s3api put-bucket-tagging \
    --bucket "$BUCKET" \
    --tagging "TagSet=[
      {Key=Name,Value=$BUCKET},
      {Key=Environment,Value=$ENVIRONMENT},
      {Key=App,Value=$APP},
      {Key=ManagedBy,Value=Terraform},
      {Key=CreatedBy,Value=manual-script}
    ]" \
    --region "$REGION"
  echo "  ✅ Tags added"
  
  # Enable intelligent tiering lifecycle policy (cost optimization)
  echo "  ♻️  Adding lifecycle policy..."
  aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET" \
    --lifecycle-configuration '{
      "Rules": [
        {
          "ID": "intelligent-tiering-30-days",
          "Status": "Enabled",
          "Filter": {
            "Prefix": ""
          },
          "Transitions": [
            {
              "Days": 30,
              "StorageClass": "INTELLIGENT_TIERING"
            }
          ]
        },
        {
          "ID": "delete-old-versions",
          "Status": "Enabled",
          "Filter": {
            "Prefix": ""
          },
          "NoncurrentVersionExpiration": {
            "NoncurrentDays": 30
          }
        }
      ]
    }' \
    --region "$REGION"
  echo "  ✅ Lifecycle policy added"
  
  echo ""
  echo "  ✅ Bucket $BUCKET fully configured!"
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL BUCKETS CREATED AND CONFIGURED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Created buckets:"
for BUCKET in "${BUCKETS[@]}"; do
  echo "  ✅ $BUCKET"
done
echo ""
echo "📋 Next steps:"
echo "1. The deployment's S3 edge case handler will detect these buckets"
echo "2. Terraform will import them into state (instant)"
echo "3. Terraform apply will configure CloudFront to use them"
echo "4. NO WAITING for S3 bucket creation!"
echo ""
echo "Verify buckets exist:"
echo "  aws s3 ls --region $REGION | grep warmpawz-dev-.*-frontend"
echo ""

