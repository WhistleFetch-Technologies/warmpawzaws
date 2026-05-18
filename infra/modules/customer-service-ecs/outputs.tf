output "ecr_repository_url" {
  value       = aws_ecr_repository.customer_service.repository_url
  description = "docker push target"
}

output "ecr_repository_name" {
  value       = aws_ecr_repository.customer_service.name
  description = "ECR repository name (pass to CodeBuild)"
}

output "alb_listener_arn" {
  value       = aws_lb_listener.http.arn
  description = "Use as API Gateway HTTP_PROXY integration_uri (VPC link)"
}

output "alb_security_group_id" {
  value       = aws_security_group.alb_internal.id
  description = "Internal ALB security group"
}

output "ecs_task_security_group_id" {
  value       = aws_security_group.ecs_tasks.id
  description = "Attach aws_security_group_rule allowing 5432 from this SG to RDS"
}

output "internal_alb_dns_name" {
  value       = aws_lb.internal.dns_name
  description = "Smoke tests from a bastion in the same VPC"
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.customer.name
}

output "ecs_service_name" {
  value = aws_ecs_service.customer.name
}
