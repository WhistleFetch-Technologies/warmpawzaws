output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "rds_endpoint" {
  description = "RDS cluster endpoint"
  value       = module.rds.cluster_endpoint
  sensitive   = true
}

output "rds_reader_endpoint" {
  description = "RDS cluster reader endpoint"
  value       = module.rds.cluster_reader_endpoint
  sensitive   = true
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

