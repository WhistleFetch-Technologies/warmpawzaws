output "vpc_id" {
  description = "VPC ID (using dev VPC)"
  value       = local.dev_vpc_id
}

output "rds_endpoint" {
  description = "RDS cluster endpoint (using dev cluster)"
  value       = local.rds_cluster_endpoint
  sensitive   = true
}

output "rds_reader_endpoint" {
  description = "RDS cluster reader endpoint (using dev cluster)"
  value       = local.rds_cluster_reader_endpoint
  sensitive   = true
}

output "rds_database_name" {
  description = "RDS database name (using dev cluster)"
  value       = local.rds_database_name
}

output "rds_port" {
  description = "RDS cluster port (using dev cluster)"
  value       = local.rds_cluster_port
}

output "rds_secret_arn" {
  description = "RDS credentials secret ARN (using dev secret)"
  value       = local.rds_secret_arn
}

output "api_endpoint" {
  description = "API Gateway endpoint"
  value       = module.api_gateway.stage_invoke_url
}

output "custom_domain_url" {
  description = "Custom domain URL"
  value       = module.api_gateway.custom_domain_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "opensearch_endpoint" {
  description = "OpenSearch endpoint"
  value       = module.opensearch.domain_endpoint
  sensitive   = true
}

output "lambda_security_group_id" {
  description = "Lambda security group ID (needed for Phase 5: Security Group Configuration)"
  value       = module.lambda.lambda_security_group_id
}