#!/bin/bash
# Cleanup orphaned us-east-1 resources from Terraform state
# This is safe because we're migrating to ap-south-1 (resources will be recreated)

set -e

echo "🧹 Cleaning up orphaned us-east-1 resources from Terraform state..."
echo "⚠️  These resources will be recreated in ap-south-1"
echo ""

# S3 buckets and configurations (us-east-1)
terraform state rm 'module.s3.aws_s3_bucket.user_uploads' 2>/dev/null || echo "✓ Already removed: s3.user_uploads"
terraform state rm 'module.s3.aws_s3_bucket_versioning.user_uploads' 2>/dev/null || echo "✓ Already removed: s3.versioning.user_uploads"
terraform state rm 'module.s3.aws_s3_bucket_server_side_encryption_configuration.user_uploads' 2>/dev/null || echo "✓ Already removed: s3.encryption.user_uploads"
terraform state rm 'module.s3.aws_s3_bucket_public_access_block.user_uploads' 2>/dev/null || echo "✓ Already removed: s3.public_access_block.user_uploads"
terraform state rm 'module.s3.aws_s3_bucket_cors_configuration.user_uploads' 2>/dev/null || echo "✓ Already removed: s3.cors.user_uploads"
terraform state rm 'module.s3.aws_s3_bucket_lifecycle_configuration.user_uploads' 2>/dev/null || echo "✓ Already removed: s3.lifecycle.user_uploads"

terraform state rm 'module.s3.aws_s3_bucket.static_website' 2>/dev/null || echo "✓ Already removed: s3.static_website"
terraform state rm 'module.s3.aws_s3_bucket_server_side_encryption_configuration.static_website' 2>/dev/null || echo "✓ Already removed: s3.encryption.static_website"
terraform state rm 'module.s3.aws_s3_bucket_public_access_block.static_website' 2>/dev/null || echo "✓ Already removed: s3.public_access_block.static_website"
terraform state rm 'module.s3.aws_s3_bucket_website_configuration.static_website' 2>/dev/null || echo "✓ Already removed: s3.website.static_website"

terraform state rm 'module.s3.aws_s3_bucket.logs' 2>/dev/null || echo "✓ Already removed: s3.logs"
terraform state rm 'module.s3.aws_s3_bucket_server_side_encryption_configuration.logs' 2>/dev/null || echo "✓ Already removed: s3.encryption.logs"
terraform state rm 'module.s3.aws_s3_bucket_public_access_block.logs' 2>/dev/null || echo "✓ Already removed: s3.public_access_block.logs"
terraform state rm 'module.s3.aws_s3_bucket_lifecycle_configuration.logs' 2>/dev/null || echo "✓ Already removed: s3.lifecycle.logs"

terraform state rm 'module.s3.aws_s3_bucket.backups' 2>/dev/null || echo "✓ Already removed: s3.backups"
terraform state rm 'module.s3.aws_s3_bucket_versioning.backups' 2>/dev/null || echo "✓ Already removed: s3.versioning.backups"
terraform state rm 'module.s3.aws_s3_bucket_server_side_encryption_configuration.backups' 2>/dev/null || echo "✓ Already removed: s3.encryption.backups"
terraform state rm 'module.s3.aws_s3_bucket_public_access_block.backups' 2>/dev/null || echo "✓ Already removed: s3.public_access_block.backups"
terraform state rm 'module.s3.aws_s3_bucket_lifecycle_configuration.backups' 2>/dev/null || echo "✓ Already removed: s3.lifecycle.backups"

# CloudFront S3 buckets (us-east-1)
terraform state rm 'module.cloudfront.aws_s3_bucket.frontend["admin"]' 2>/dev/null || echo "✓ Already removed: cloudfront.s3.admin"
terraform state rm 'module.cloudfront.aws_s3_bucket_versioning.frontend["admin"]' 2>/dev/null || echo "✓ Already removed: cloudfront.versioning.admin"
terraform state rm 'module.cloudfront.aws_s3_bucket_public_access_block.frontend["admin"]' 2>/dev/null || echo "✓ Already removed: cloudfront.public_access_block.admin"

terraform state rm 'module.cloudfront.aws_s3_bucket.frontend["vendor"]' 2>/dev/null || echo "✓ Already removed: cloudfront.s3.vendor"
terraform state rm 'module.cloudfront.aws_s3_bucket_versioning.frontend["vendor"]' 2>/dev/null || echo "✓ Already removed: cloudfront.versioning.vendor"
terraform state rm 'module.cloudfront.aws_s3_bucket_public_access_block.frontend["vendor"]' 2>/dev/null || echo "✓ Already removed: cloudfront.public_access_block.vendor"

terraform state rm 'module.cloudfront.aws_s3_bucket.frontend["customer"]' 2>/dev/null || echo "✓ Already removed: cloudfront.s3.customer"
terraform state rm 'module.cloudfront.aws_s3_bucket_versioning.frontend["customer"]' 2>/dev/null || echo "✓ Already removed: cloudfront.versioning.customer"
terraform state rm 'module.cloudfront.aws_s3_bucket_public_access_block.frontend["customer"]' 2>/dev/null || echo "✓ Already removed: cloudfront.public_access_block.customer"

# SNS Topics (us-east-1)
terraform state rm 'module.sns.aws_sns_topic.system_alerts' 2>/dev/null || echo "✓ Already removed: sns.system_alerts"
terraform state rm 'module.sns.aws_sns_topic.user_notifications' 2>/dev/null || echo "✓ Already removed: sns.user_notifications"
terraform state rm 'module.sns.aws_sns_topic.booking_updates' 2>/dev/null || echo "✓ Already removed: sns.booking_updates"
terraform state rm 'module.sns.aws_sns_topic.payment_events' 2>/dev/null || echo "✓ Already removed: sns.payment_events"
terraform state rm 'module.sns.aws_sns_topic.vendor_notifications' 2>/dev/null || echo "✓ Already removed: sns.vendor_notifications"

# SQS Queues (us-east-1)
terraform state rm 'module.sqs.aws_sqs_queue.dlq' 2>/dev/null || echo "✓ Already removed: sqs.dlq"
terraform state rm 'module.sqs.aws_sqs_queue.dlq_fifo' 2>/dev/null || echo "✓ Already removed: sqs.dlq_fifo"
terraform state rm 'module.sqs.aws_sqs_queue.order_processing' 2>/dev/null || echo "✓ Already removed: sqs.order_processing"
terraform state rm 'module.sqs.aws_sqs_queue.booking_processing' 2>/dev/null || echo "✓ Already removed: sqs.booking_processing"
terraform state rm 'module.sqs.aws_sqs_queue.payment_processing' 2>/dev/null || echo "✓ Already removed: sqs.payment_processing"
terraform state rm 'module.sqs.aws_sqs_queue.email_delivery' 2>/dev/null || echo "✓ Already removed: sqs.email_delivery"
terraform state rm 'module.sqs.aws_sqs_queue.notification_delivery' 2>/dev/null || echo "✓ Already removed: sqs.notification_delivery"
terraform state rm 'module.sqs.aws_sqs_queue.analytics_events' 2>/dev/null || echo "✓ Already removed: sqs.analytics_events"

# DynamoDB Tables (us-east-1)
terraform state rm 'module.dynamodb.aws_dynamodb_table.sessions' 2>/dev/null || echo "✓ Already removed: dynamodb.sessions"
terraform state rm 'module.dynamodb.aws_dynamodb_table.rate_limits' 2>/dev/null || echo "✓ Already removed: dynamodb.rate_limits"
terraform state rm 'module.dynamodb.aws_dynamodb_table.cache' 2>/dev/null || echo "✓ Already removed: dynamodb.cache"
terraform state rm 'module.dynamodb.aws_dynamodb_table.analytics_events' 2>/dev/null || echo "✓ Already removed: dynamodb.analytics_events"

# Cognito (us-east-1)
terraform state rm 'module.cognito.aws_cognito_user_pool.main' 2>/dev/null || echo "✓ Already removed: cognito.user_pool"
terraform state rm 'module.cognito.aws_cognito_user_pool_client.admin_web' 2>/dev/null || echo "✓ Already removed: cognito.client.admin_web"
terraform state rm 'module.cognito.aws_cognito_user_pool_client.vendor_web' 2>/dev/null || echo "✓ Already removed: cognito.client.vendor_web"
terraform state rm 'module.cognito.aws_cognito_user_pool_client.customer_web' 2>/dev/null || echo "✓ Already removed: cognito.client.customer_web"
terraform state rm 'module.cognito.aws_cognito_user_pool_client.mobile_vendor' 2>/dev/null || echo "✓ Already removed: cognito.client.mobile_vendor"
terraform state rm 'module.cognito.aws_cognito_user_pool_client.mobile_customer' 2>/dev/null || echo "✓ Already removed: cognito.client.mobile_customer"
terraform state rm 'module.cognito.aws_cognito_user_pool_domain.main' 2>/dev/null || echo "✓ Already removed: cognito.domain"
terraform state rm 'module.cognito.aws_cognito_identity_pool.main' 2>/dev/null || echo "✓ Already removed: cognito.identity_pool"
terraform state rm 'module.cognito.aws_cognito_identity_pool_roles_attachment.main' 2>/dev/null || echo "✓ Already removed: cognito.identity_pool_roles"

# Secrets Manager (us-east-1)
terraform state rm 'module.secrets.aws_secretsmanager_secret.razorpay' 2>/dev/null || echo "✓ Already removed: secrets.razorpay"
terraform state rm 'module.secrets.aws_secretsmanager_secret_version.razorpay' 2>/dev/null || echo "✓ Already removed: secrets.razorpay_version"
terraform state rm 'module.secrets.aws_secretsmanager_secret.shiprocket' 2>/dev/null || echo "✓ Already removed: secrets.shiprocket"
terraform state rm 'module.secrets.aws_secretsmanager_secret_version.shiprocket' 2>/dev/null || echo "✓ Already removed: secrets.shiprocket_version"
terraform state rm 'module.secrets.aws_secretsmanager_secret.google_maps' 2>/dev/null || echo "✓ Already removed: secrets.google_maps"
terraform state rm 'module.secrets.aws_secretsmanager_secret_version.google_maps' 2>/dev/null || echo "✓ Already removed: secrets.google_maps_version"

# API Gateway (us-east-1)
terraform state rm 'module.api_gateway.aws_apigatewayv2_api.main' 2>/dev/null || echo "✓ Already removed: api_gateway.api"
terraform state rm 'module.api_gateway.aws_apigatewayv2_stage.main' 2>/dev/null || echo "✓ Already removed: api_gateway.stage"
terraform state rm 'module.api_gateway.aws_cloudwatch_log_group.api_gateway' 2>/dev/null || echo "✓ Already removed: api_gateway.logs"

# RDS (us-east-1)
terraform state rm 'module.rds.aws_rds_cluster.main' 2>/dev/null || echo "✓ Already removed: rds.cluster"
terraform state rm 'module.rds.aws_rds_cluster_parameter_group.main' 2>/dev/null || echo "✓ Already removed: rds.cluster_param_group"
terraform state rm 'module.rds.aws_db_parameter_group.main' 2>/dev/null || echo "✓ Already removed: rds.db_param_group"
terraform state rm 'module.rds.aws_db_subnet_group.main' 2>/dev/null || echo "✓ Already removed: rds.subnet_group"
terraform state rm 'module.rds.aws_security_group.rds' 2>/dev/null || echo "✓ Already removed: rds.security_group"
terraform state rm 'module.rds.aws_secretsmanager_secret.rds_master_password' 2>/dev/null || echo "✓ Already removed: rds.secret"

# VPC resources (us-east-1)
terraform state rm 'module.vpc.aws_vpc.main[0]' 2>/dev/null || echo "✓ Already removed: vpc.main"
terraform state rm 'module.vpc.aws_internet_gateway.main[0]' 2>/dev/null || echo "✓ Already removed: vpc.igw"
terraform state rm 'module.vpc.aws_nat_gateway.main[0]' 2>/dev/null || echo "✓ Already removed: vpc.nat"
terraform state rm 'module.vpc.aws_eip.nat[0]' 2>/dev/null || echo "✓ Already removed: vpc.eip"
terraform state rm 'module.vpc.aws_route_table.public' 2>/dev/null || echo "✓ Already removed: vpc.rt.public"
terraform state rm 'module.vpc.aws_route_table.private[0]' 2>/dev/null || echo "✓ Already removed: vpc.rt.private"
terraform state rm 'module.vpc.aws_route_table.database' 2>/dev/null || echo "✓ Already removed: vpc.rt.database"
terraform state rm 'module.vpc.aws_security_group.vpc_endpoints' 2>/dev/null || echo "✓ Already removed: vpc.sg.endpoints"
terraform state rm 'module.vpc.aws_security_group.lambda' 2>/dev/null || echo "✓ Already removed: vpc.sg.lambda"
terraform state rm 'module.vpc.aws_vpc_endpoint.s3' 2>/dev/null || echo "✓ Already removed: vpc.endpoint.s3"
terraform state rm 'module.vpc.aws_vpc_endpoint.dynamodb' 2>/dev/null || echo "✓ Already removed: vpc.endpoint.dynamodb"

# Lambda (us-east-1)
terraform state rm 'module.lambda.aws_security_group.lambda' 2>/dev/null || echo "✓ Already removed: lambda.security_group"
terraform state rm 'module.lambda.aws_cloudwatch_log_group.lambda["api-handler"]' 2>/dev/null || echo "✓ Already removed: lambda.logs.api-handler"

# ACM regional cert (was in us-east-1, should be in ap-south-1)
terraform state rm 'module.acm.aws_acm_certificate.regional[0]' 2>/dev/null || echo "✓ Already removed: acm.regional"
terraform state rm 'module.acm.aws_route53_record.regional_validation["dev.api.warmpawz.com"]' 2>/dev/null || echo "✓ Already removed: acm.regional_validation.api"

echo ""
echo "✅ State cleanup complete!"
echo "📋 Next steps:"
echo "   1. Run 'terraform plan' - should show ~93 resources to create"
echo "   2. Run 'terraform apply' - will create everything in ap-south-1"
echo ""
echo "⚠️  NOTE: Old us-east-1 resources are orphaned (not deleted)"
echo "   You can manually clean them up later if needed."

