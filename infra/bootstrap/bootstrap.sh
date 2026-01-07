#!/bin/bash

# Bootstrap Terraform Backend
# Creates S3 bucket and DynamoDB table for Terraform state management
# Run this once per AWS account before first deployment

set -e

echo "🚀 Bootstrapping Terraform backend for new AWS account..."
echo "This will create:"
echo "  - S3 bucket: warmpawz-terraform-state-057442119249"
echo "  - DynamoDB table: warmpawz-terraform-locks"
echo ""

cd "$(dirname "$0")"

# Check if AWS credentials are set
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "❌ Error: AWS credentials not set"
  echo "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
  exit 1
fi

# Initialize Terraform
echo "📦 Initializing Terraform..."
terraform init

# Plan
echo "📋 Planning backend resources..."
terraform plan -out=tfplan

# Apply
echo "🚀 Creating backend resources..."
terraform apply tfplan

echo ""
echo "✅ Bootstrap complete!"
echo ""
echo "Backend resources created:"
echo "  - S3 bucket: warmpawz-terraform-state-057442119249"
echo "  - DynamoDB table: warmpawz-terraform-locks"
echo ""
echo "You can now run the main deployment workflow."

