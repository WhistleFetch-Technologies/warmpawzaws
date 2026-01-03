output "domain_id" {
  description = "OpenSearch domain ID"
  value       = aws_opensearch_domain.main.domain_id
}

output "domain_arn" {
  description = "OpenSearch domain ARN"
  value       = aws_opensearch_domain.main.arn
}

output "domain_endpoint" {
  description = "OpenSearch domain endpoint"
  value       = aws_opensearch_domain.main.endpoint
}

output "kibana_endpoint" {
  description = "OpenSearch Dashboards endpoint"
  value       = aws_opensearch_domain.main.dashboard_endpoint
}

output "security_group_id" {
  description = "Security group ID for OpenSearch"
  value       = aws_security_group.opensearch.id
}

