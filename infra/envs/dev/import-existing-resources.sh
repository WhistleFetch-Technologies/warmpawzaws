#!/bin/bash

# Script to import existing AWS resources into Terraform state
# Run this after fixing the certificate validation issue

set -e

echo "📦 Importing existing resources into Terraform state..."
echo "This prevents 'ResourceAlreadyExists' errors"

# S3 Buckets
echo "Importing S3 buckets..."
terraform import 'module.cloudfront.aws_s3_bucket.frontend["admin"]' warmpawz-dev-admin-frontend-ap-south-1 || echo "Bucket may not exist or already imported"
terraform import 'module.cloudfront.aws_s3_bucket.frontend["vendor"]' warmpawz-dev-vendor-frontend-ap-south-1 || echo "Bucket may not exist or already imported"
terraform import 'module.cloudfront.aws_s3_bucket.frontend["customer"]' warmpawz-dev-customer-frontend-ap-south-1 || echo "Bucket may not exist or already imported"
terraform import 'module.s3.aws_s3_bucket.user_uploads' warmpawz-dev-user-uploads-057442119249 || echo "Bucket may not exist or already imported"
terraform import 'module.s3.aws_s3_bucket.static_website' warmpawz-dev-static-057442119249 || echo "Bucket may not exist or already imported"
terraform import 'module.s3.aws_s3_bucket.logs' warmpawz-dev-logs-057442119249 || echo "Bucket may not exist or already imported"
terraform import 'module.s3.aws_s3_bucket.backups' warmpawz-dev-backups-057442119249 || echo "Bucket may not exist or already imported"

# DynamoDB Tables
echo "Importing DynamoDB tables..."
terraform import 'module.dynamodb.aws_dynamodb_table.sessions' warmpawz-dev-sessions || echo "Table may not exist or already imported"
terraform import 'module.dynamodb.aws_dynamodb_table.analytics_events' warmpawz-dev-analytics-events || echo "Table may not exist or already imported"
terraform import 'module.dynamodb.aws_dynamodb_table.cache' warmpawz-dev-cache || echo "Table may not exist or already imported"
terraform import 'module.dynamodb.aws_dynamodb_table.rate_limits' warmpawz-dev-rate-limits || echo "Table may not exist or already imported"

# CloudWatch Log Groups
echo "Importing CloudWatch log groups..."
terraform import 'module.api_gateway.aws_cloudwatch_log_group.api_gateway' /aws/apigateway/warmpawz-dev || echo "Log group may not exist or already imported"
terraform import 'module.lambda.aws_cloudwatch_log_group.lambda["api-handler"]' /aws/lambda/warmpawz-dev-api-handler || echo "Log group may not exist or already imported"

# CloudFront Origin Access Controls
echo "Importing CloudFront OACs..."
# OACs don't have a simple import - they're managed by CloudFront
# These will be recreated if needed

# Secrets Manager
echo "Importing Secrets Manager secrets..."
terraform import 'module.secrets.aws_secretsmanager_secret.razorpay' warmpawz/dev/razorpay || echo "Secret may not exist or already imported"
terraform import 'module.secrets.aws_secretsmanager_secret.google_maps' warmpawz/dev/google-maps || echo "Secret may not exist or already imported"
terraform import 'module.secrets.aws_secretsmanager_secret.shiprocket' warmpawz/dev/shiprocket || echo "Secret may not exist or already imported"
terraform import 'module.secrets.aws_secretsmanager_secret.aftership' warmpawz/dev/aftership || echo "Secret may not exist or already imported"

echo "✅ Import complete!"
echo "⚠️  Note: Some resources may need manual import or may not exist"
echo "Run 'terraform plan' to see what still needs to be created"

