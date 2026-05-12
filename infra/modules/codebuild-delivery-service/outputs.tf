output "codebuild_project_name" {
  value       = aws_codebuild_project.delivery.name
  description = "Pass to: aws codebuild start-build --project-name <value>"
}

output "codebuild_project_arn" {
  value = aws_codebuild_project.delivery.arn
}

output "codestar_connection_arn" {
  value       = local.connection_arn
  description = "If status is PENDING, open AWS Console Developer Tools → Connections and complete GitHub OAuth"
}

output "cloudwatch_log_group" {
  value = aws_cloudwatch_log_group.codebuild.name
}
