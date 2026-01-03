output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "rds_endpoint" {
  description = "RDS cluster endpoint"
  value       = module.rds.cluster_endpoint
}

output "api_endpoint" {
  description = "API Gateway endpoint"
  value       = module.api_gateway.stage_invoke_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "opensearch_endpoint" {
  description = "OpenSearch endpoint"
  value       = module.opensearch.domain_endpoint
}

