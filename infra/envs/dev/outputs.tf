output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "rds_endpoint" {
  description = "RDS cluster endpoint"
  value       = module.rds.cluster_endpoint
}

output "rds_secret_arn" {
  description = "RDS credentials secret ARN"
  value       = module.rds.secret_arn
}

output "api_endpoint" {
  description = "API Gateway endpoint"
  value       = module.api_gateway.stage_invoke_url
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

