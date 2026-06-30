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

output "rds_security_group_id" {
  description = "RDS security group ID (for adding GitHub Actions IP ranges)"
  value       = module.rds.security_group_id
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint (for migrations from within VPC)"
  value       = module.rds.proxy_endpoint
  sensitive   = true
}

output "rds_proxy_security_group_id" {
  description = "RDS Proxy security group ID (for adding GitHub Actions IP ranges)"
  value       = module.rds.proxy_security_group_id
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

# Prod CloudFront – mark once created (three URLs for admin, vendor, customer)
output "cloudfront_distribution_ids" {
  description = "Prod CloudFront distribution IDs (admin, vendor, customer)"
  value       = module.cloudfront.distribution_ids
}

output "cloudfront_urls" {
  description = "Prod CloudFront URLs (mark once created)"
  value = {
    for k, v in module.cloudfront.distributions : k => "https://${v.domain_name}"
  }
}

output "prod_frontend_bucket_names" {
  description = "Prod frontend S3 bucket names for deploy"
  value = {
    admin    = aws_s3_bucket.prod_frontend["admin"].id
    vendor   = aws_s3_bucket.prod_frontend["vendor"].id
    customer = aws_s3_bucket.prod_frontend["customer"].id
  }
}

output "delivery_ecr_repository_url" {
  description = "ECR base URI (tag with :latest after build)"
  value       = local.delivery_stack_live ? module.delivery_service_ecs[0].ecr_repository_url : null
}

output "delivery_ecs_cluster_name" {
  value = local.delivery_stack_live ? module.delivery_service_ecs[0].ecs_cluster_name : null
}

output "delivery_ecs_service_name" {
  value = local.delivery_stack_live ? module.delivery_service_ecs[0].ecs_service_name : null
}

output "delivery_internal_alb_dns" {
  description = "Internal ALB DNS (Lambda DELIVERY_SERVICE_BASE_URL host)"
  value       = local.delivery_stack_live ? module.delivery_service_ecs[0].internal_alb_dns_name : null
}

output "delivery_codebuild_project_name" {
  value = local.delivery_codebuild_live ? module.delivery_codebuild[0].codebuild_project_name : null
}

