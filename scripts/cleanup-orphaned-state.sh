#!/bin/bash
# ============================================================================
# CLEANUP ORPHANED TERRAFORM STATE ENTRIES
# ============================================================================
# This script removes state entries for resources that exist in a different
# region than the current deployment target. This happens when changing
# deployment regions.
#
# Usage: ./scripts/cleanup-orphaned-state.sh [environment]
# Example: ./scripts/cleanup-orphaned-state.sh dev
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
WORKING_DIR="infra/envs/${ENVIRONMENT}"

echo "============================================"
echo "🧹 Cleaning up orphaned Terraform state"
echo "Environment: ${ENVIRONMENT}"
echo "Working Directory: ${WORKING_DIR}"
echo "============================================"

# Check if we're in the right directory
if [ ! -f "${WORKING_DIR}/main.tf" ]; then
    echo "❌ Error: ${WORKING_DIR}/main.tf not found"
    echo "Please run this script from the repository root"
    exit 1
fi

cd "${WORKING_DIR}"

# Initialize Terraform if needed
echo "📦 Initializing Terraform..."
terraform init -backend-config=backend.hcl -reconfigure || true

# List of resource patterns that may be orphaned in wrong region
# These are resources that were created in us-east-1 but we're now deploying to ap-south-1

ORPHANED_RESOURCES=(
    # S3 buckets (globally named, but regionally stored)
    "module.s3.aws_s3_bucket.user_uploads"
    "module.s3.aws_s3_bucket.static_website"
    "module.s3.aws_s3_bucket.logs"
    "module.s3.aws_s3_bucket.backups"
    "module.s3.aws_s3_bucket_versioning.user_uploads"
    "module.s3.aws_s3_bucket_versioning.backups"
    "module.s3.aws_s3_bucket_server_side_encryption_configuration.user_uploads"
    "module.s3.aws_s3_bucket_server_side_encryption_configuration.static_website"
    "module.s3.aws_s3_bucket_server_side_encryption_configuration.logs"
    "module.s3.aws_s3_bucket_server_side_encryption_configuration.backups"
    "module.s3.aws_s3_bucket_public_access_block.user_uploads"
    "module.s3.aws_s3_bucket_public_access_block.static_website"
    "module.s3.aws_s3_bucket_public_access_block.logs"
    "module.s3.aws_s3_bucket_public_access_block.backups"
    "module.s3.aws_s3_bucket_cors_configuration.user_uploads"
    "module.s3.aws_s3_bucket_lifecycle_configuration.user_uploads"
    "module.s3.aws_s3_bucket_lifecycle_configuration.logs"
    "module.s3.aws_s3_bucket_lifecycle_configuration.backups"
    "module.s3.aws_s3_bucket_website_configuration.static_website"
    
    # CloudFront frontend buckets
    "module.cloudfront.aws_s3_bucket.frontend[\"admin\"]"
    "module.cloudfront.aws_s3_bucket.frontend[\"vendor\"]"
    "module.cloudfront.aws_s3_bucket.frontend[\"customer\"]"
    "module.cloudfront.aws_s3_bucket_versioning.frontend[\"admin\"]"
    "module.cloudfront.aws_s3_bucket_versioning.frontend[\"vendor\"]"
    "module.cloudfront.aws_s3_bucket_versioning.frontend[\"customer\"]"
    "module.cloudfront.aws_s3_bucket_public_access_block.frontend[\"admin\"]"
    "module.cloudfront.aws_s3_bucket_public_access_block.frontend[\"vendor\"]"
    "module.cloudfront.aws_s3_bucket_public_access_block.frontend[\"customer\"]"
    
    # SNS topics
    "module.sns.aws_sns_topic.system_alerts"
    "module.sns.aws_sns_topic.user_notifications"
    "module.sns.aws_sns_topic.booking_updates"
    "module.sns.aws_sns_topic.payment_events"
    "module.sns.aws_sns_topic.vendor_notifications"
    "module.sns.aws_sns_topic_subscription.system_alerts_email"
    
    # Cognito resources
    "module.cognito.aws_cognito_user_pool.main"
    "module.cognito.aws_cognito_user_pool_client.customer_web"
    "module.cognito.aws_cognito_user_pool_client.vendor_web"
    "module.cognito.aws_cognito_user_pool_client.admin_web"
    "module.cognito.aws_cognito_user_pool_client.customer_mobile"
    "module.cognito.aws_cognito_user_pool_client.vendor_mobile"
    "module.cognito.aws_cognito_user_pool_domain.main"
    "module.cognito.aws_cognito_identity_pool.main"
    "module.cognito.aws_cognito_identity_pool_roles_attachment.main"
    "module.cognito.aws_iam_role.authenticated"
    "module.cognito.aws_iam_role.unauthenticated"
    "module.cognito.aws_iam_role_policy.authenticated"
    "module.cognito.aws_iam_role_policy.unauthenticated"
    
    # RDS resources
    "module.rds.aws_rds_cluster.main"
    "module.rds.aws_rds_cluster_instance.main[0]"
    "module.rds.aws_db_subnet_group.main"
    "module.rds.aws_rds_cluster_parameter_group.main"
    "module.rds.aws_db_parameter_group.main"
    "module.rds.aws_security_group.rds"
    "module.rds.aws_secretsmanager_secret.rds_master_password"
    "module.rds.aws_secretsmanager_secret_version.rds_master_password"
    
    # Secrets Manager
    "module.secrets.aws_secretsmanager_secret.razorpay"
    "module.secrets.aws_secretsmanager_secret.google_maps"
    "module.secrets.aws_secretsmanager_secret.shiprocket"
    "module.secrets.aws_secretsmanager_secret_version.razorpay"
    "module.secrets.aws_secretsmanager_secret_version.google_maps"
    "module.secrets.aws_secretsmanager_secret_version.shiprocket"
    
    # API Gateway
    "module.api_gateway.aws_apigatewayv2_api.main"
    "module.api_gateway.aws_apigatewayv2_stage.main"
    "module.api_gateway.aws_apigatewayv2_integration.lambda[\"api-handler\"]"
    "module.api_gateway.aws_apigatewayv2_route.routes[\"health\"]"
    "module.api_gateway.aws_apigatewayv2_route.routes[\"proxy\"]"
    "module.api_gateway.aws_apigatewayv2_route.routes[\"root\"]"
    "module.api_gateway.aws_lambda_permission.api_gateway[\"api-handler\"]"
    
    # Lambda
    "module.lambda.aws_lambda_function.functions[\"api-handler\"]"
    "module.lambda.aws_lambda_alias.live[\"api-handler\"]"
    "module.lambda.aws_cloudwatch_log_group.lambda[\"api-handler\"]"
    "module.lambda.aws_cloudwatch_metric_alarm.lambda_errors[\"api-handler\"]"
    "module.lambda.aws_cloudwatch_metric_alarm.lambda_duration[\"api-handler\"]"
    "module.lambda.aws_cloudwatch_metric_alarm.lambda_throttles[\"api-handler\"]"
    "module.lambda.aws_security_group.lambda"
    "module.lambda.aws_iam_role.lambda"
    "module.lambda.aws_iam_role_policy.lambda_custom"
    "module.lambda.aws_iam_role_policy_attachment.lambda_basic"
    "module.lambda.aws_iam_role_policy_attachment.lambda_vpc"
    
    # VPC resources
    "module.vpc.aws_vpc.main[0]"
    "module.vpc.aws_subnet.public[0]"
    "module.vpc.aws_subnet.public[1]"
    "module.vpc.aws_subnet.private[0]"
    "module.vpc.aws_subnet.private[1]"
    "module.vpc.aws_subnet.database[0]"
    "module.vpc.aws_subnet.database[1]"
    "module.vpc.aws_internet_gateway.main[0]"
    "module.vpc.aws_nat_gateway.main[0]"
    "module.vpc.aws_eip.nat[0]"
    "module.vpc.aws_route_table.public"
    "module.vpc.aws_route_table.private[0]"
    "module.vpc.aws_route_table.database"
    "module.vpc.aws_route_table_association.public[0]"
    "module.vpc.aws_route_table_association.public[1]"
    "module.vpc.aws_route_table_association.private[0]"
    "module.vpc.aws_route_table_association.private[1]"
    "module.vpc.aws_route_table_association.database[0]"
    "module.vpc.aws_route_table_association.database[1]"
    "module.vpc.aws_vpc_endpoint.s3"
    "module.vpc.aws_vpc_endpoint.dynamodb"
    "module.vpc.aws_security_group.vpc_endpoints"
    
    # DynamoDB (global, but state may reference wrong region)
    "module.dynamodb.aws_dynamodb_table.sessions"
    "module.dynamodb.aws_dynamodb_table.cache"
    "module.dynamodb.aws_dynamodb_table.rate_limits"
    "module.dynamodb.aws_dynamodb_table.analytics_events"
    
    # SQS queues
    "module.sqs.aws_sqs_queue.booking_processing"
    "module.sqs.aws_sqs_queue.payment_processing"
    "module.sqs.aws_sqs_queue.notification_delivery"
    "module.sqs.aws_sqs_queue.email_delivery"
    "module.sqs.aws_sqs_queue.analytics_events"
    "module.sqs.aws_sqs_queue.order_processing"
    "module.sqs.aws_sqs_queue.dlq"
    "module.sqs.aws_sqs_queue.dlq_fifo"
    
    # ACM certificates
    "module.acm.aws_acm_certificate.main"
    "module.acm.aws_acm_certificate.regional"
    "module.acm.aws_acm_certificate_validation.main"
    "module.acm.aws_acm_certificate_validation.regional"
    "module.acm.aws_route53_record.cert_validation"
    
    # CloudFront distributions
    "module.cloudfront.aws_cloudfront_distribution.frontend[\"admin\"]"
    "module.cloudfront.aws_cloudfront_distribution.frontend[\"vendor\"]"
    "module.cloudfront.aws_cloudfront_distribution.frontend[\"customer\"]"
    "module.cloudfront.aws_cloudfront_origin_access_identity.frontend[\"admin\"]"
    "module.cloudfront.aws_cloudfront_origin_access_identity.frontend[\"vendor\"]"
    "module.cloudfront.aws_cloudfront_origin_access_identity.frontend[\"customer\"]"
    "module.cloudfront.aws_s3_bucket_policy.frontend[\"admin\"]"
    "module.cloudfront.aws_s3_bucket_policy.frontend[\"vendor\"]"
    "module.cloudfront.aws_s3_bucket_policy.frontend[\"customer\"]"
    
    # Route53 records
    "aws_route53_record.api"
    "aws_route53_record.admin"
    "aws_route53_record.vendor"
    "aws_route53_record.customer"
    "aws_apigatewayv2_domain_name.api"
    "aws_apigatewayv2_api_mapping.api"
)

echo ""
echo "🔍 Checking for orphaned resources in state..."
echo ""

REMOVED_COUNT=0

for resource in "${ORPHANED_RESOURCES[@]}"; do
    # Check if resource exists in state
    if terraform state list 2>/dev/null | grep -q "^${resource}$"; then
        echo "🗑️  Removing from state: ${resource}"
        terraform state rm "${resource}" 2>/dev/null || true
        ((REMOVED_COUNT++)) || true
    fi
done

echo ""
echo "============================================"
echo "✅ Cleanup complete!"
echo "Removed ${REMOVED_COUNT} orphaned state entries"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Run 'terraform plan' to see what will be created"
echo "2. Run 'terraform apply' to create fresh resources"
echo ""

