output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "rds_endpoint" {
  description = "RDS cluster endpoint"
  value       = module.rds.cluster_endpoint
}

output "rds_database_name" {
  description = "RDS database name"
  value       = module.rds.database_name
}

output "rds_port" {
  description = "RDS cluster port"
  value       = module.rds.cluster_port
}

output "rds_secret_arn" {
  description = "RDS credentials secret ARN"
  value       = module.rds.secret_arn
}

output "api_endpoint" {
  description = "API Gateway endpoint"
  value       = module.api_gateway.stage_invoke_url
}

output "api_custom_domain" {
  description = "API custom domain"
  value       = "https://dev.api.warmpawz.com"
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_customer_client_id" {
  description = "Cognito customer app client ID"
  value       = module.cognito.customer_web_client_id
}

output "cognito_vendor_client_id" {
  description = "Cognito vendor app client ID"
  value       = module.cognito.vendor_web_client_id
}

output "cognito_admin_client_id" {
  description = "Cognito admin app client ID"
  value       = module.cognito.admin_web_client_id
}

output "s3_uploads_bucket" {
  description = "S3 uploads bucket name"
  value       = module.s3.user_uploads_bucket_name
}

output "opensearch_endpoint" {
  description = "OpenSearch endpoint"
  value       = var.enable_opensearch ? module.opensearch[0].domain_endpoint : null
}

# Frontend Deployment Outputs

output "cloudfront_admin_distribution_id" {
  description = "CloudFront distribution ID for admin app"
  value       = module.cloudfront.distribution_ids["admin"]
}

output "cloudfront_vendor_distribution_id" {
  description = "CloudFront distribution ID for vendor app"
  value       = module.cloudfront.distribution_ids["vendor"]
}

output "cloudfront_customer_distribution_id" {
  description = "CloudFront distribution ID for customer app"
  value       = module.cloudfront.distribution_ids["customer"]
}

output "s3_admin_bucket" {
  description = "S3 bucket for admin frontend"
  value       = module.cloudfront.bucket_names["admin"]
}

output "s3_vendor_bucket" {
  description = "S3 bucket for vendor frontend"
  value       = module.cloudfront.bucket_names["vendor"]
}

output "s3_customer_bucket" {
  description = "S3 bucket for customer frontend"
  value       = module.cloudfront.bucket_names["customer"]
}

# Domain URLs

output "admin_url" {
  description = "Admin dashboard URL"
  value       = "https://dev.admin.warmpawz.com"
}

output "vendor_url" {
  description = "Vendor portal URL"
  value       = "https://dev.vendor.warmpawz.com"
}

output "customer_url" {
  description = "Customer app URL"
  value       = "https://dev.customer.warmpawz.com"
}

# SNS Topics for Notifications

output "sns_notifications_topic_arn" {
  description = "SNS topic ARN for user notifications"
  value       = module.sns.user_notifications_topic_arn
}

output "sns_booking_updates_topic_arn" {
  description = "SNS topic ARN for booking updates"
  value       = module.sns.booking_updates_topic_arn
}

# Secrets ARNs

output "razorpay_secret_arn" {
  description = "Razorpay secret ARN"
  value       = module.secrets.razorpay_secret_arn
}

output "google_maps_secret_arn" {
  description = "Google Maps secret ARN"
  value       = module.secrets.google_maps_secret_arn
}

output "shiprocket_secret_arn" {
  description = "Shiprocket secret ARN"
  value       = module.secrets.shiprocket_secret_arn
}
