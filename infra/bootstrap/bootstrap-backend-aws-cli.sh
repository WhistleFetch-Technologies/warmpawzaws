#!/usr/bin/env bash
# Create Terraform backend (S3 bucket + DynamoDB lock table) using AWS CLI only.
# Use this when terraform init fails with 403 on the state bucket (bucket missing or wrong account).
# Dev and prod use the SAME account (057442119249) and same bucket; run once per account.
#
# Usage:
#   # Dev/prod account (bucket: warmpawz-terraform-state-057442119249)
#   ./bootstrap-backend-aws-cli.sh 057442119249
#
#   # With profile
#   AWS_PROFILE=warmpawz ./bootstrap-backend-aws-cli.sh 057442119249

set -e

ACCOUNT_ID="${1:-}"
REGION="${AWS_REGION:-ap-south-1}"
BUCKET_PREFIX="warmpawz-terraform-state"
LOCK_TABLE="warmpawz-terraform-locks"

if [ -z "$ACCOUNT_ID" ]; then
  echo "Usage: $0 <aws_account_id>"
  echo "  e.g. $0 057442119249   # dev and prod (same account)"
  echo ""
  echo "Current identity:"
  aws sts get-caller-identity 2>/dev/null || { echo "AWS CLI not configured or no credentials."; exit 1; }
  exit 1
fi

BUCKET="${BUCKET_PREFIX}-${ACCOUNT_ID}"
echo "Creating Terraform backend in account ${ACCOUNT_ID} (region ${REGION})"
echo "  S3 bucket: ${BUCKET}"
echo "  DynamoDB table: ${LOCK_TABLE}"
echo ""

# Verify we're in the right account
CALLER=$(aws sts get-caller-identity --query Account --output text)
if [ "$CALLER" != "$ACCOUNT_ID" ]; then
  echo "Warning: Current credentials are for account ${CALLER}, not ${ACCOUNT_ID}. Continue? (y/N)"
  read -r r
  if [ "$r" != "y" ] && [ "$r" != "Y" ]; then
    exit 1
  fi
fi

# S3 bucket
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "S3 bucket ${BUCKET} already exists."
else
  echo "Creating S3 bucket ${BUCKET}..."
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null || \
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  echo "Enabling versioning..."
  aws s3api put-bucket-versioning --bucket "$BUCKET" \
    --versioning-configuration Status=Enabled
  echo "Enabling encryption..."
  aws s3api put-bucket-encryption --bucket "$BUCKET" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  echo "Blocking public access..."
  aws s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  echo "S3 bucket ${BUCKET} created."
fi

# DynamoDB table (global name, not per-region)
if aws dynamodb describe-table --table-name "$LOCK_TABLE" --region "$REGION" 2>/dev/null | grep -q TableName; then
  echo "DynamoDB table ${LOCK_TABLE} already exists."
else
  echo "Creating DynamoDB table ${LOCK_TABLE}..."
  aws dynamodb create-table --table-name "$LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" \
    --tags Key=Name,Value=TerraformStateLock Key=ManagedBy,Value=script
  echo "Waiting for table to be active..."
  aws dynamodb wait table-exists --table-name "$LOCK_TABLE" --region "$REGION"
  echo "DynamoDB table ${LOCK_TABLE} created."
fi

echo ""
echo "Backend resources ready. Ensure the IAM user/role used for 'terraform init' and CI has:"
echo "  - s3:ListBucket, s3:GetObject, s3:PutObject, s3:DeleteObject on arn:aws:s3:::${BUCKET}"
echo "  - dynamodb:GetItem, PutItem, DeleteItem, ConditionCheckItem on arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${LOCK_TABLE}"
echo ""
echo "Then run: terraform init -backend-config=backend.hcl"
echo "  (from infra/envs/prod for prod, or infra/envs/dev for dev)"
