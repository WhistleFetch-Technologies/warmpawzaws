output "lambda_function_arns" {
  description = "ARNs of Lambda functions"
  value       = { for k, v in aws_lambda_function.functions : k => v.arn }
}

output "lambda_function_names" {
  description = "Names of Lambda functions"
  value       = { for k, v in aws_lambda_function.functions : k => v.function_name }
}

output "lambda_function_invoke_arns" {
  description = "Invoke ARNs of Lambda functions (for API Gateway)"
  value       = { for k, v in aws_lambda_function.functions : k => v.invoke_arn }
}

output "lambda_role_arn" {
  description = "IAM role ARN for Lambda functions"
  value       = aws_iam_role.lambda.arn
}

output "lambda_security_group_id" {
  description = "Security group ID for Lambda functions"
  value       = aws_security_group.lambda.id
}

output "lambda_function_urls" {
  description = "Function URLs for Lambda functions"
  value       = { for k, v in aws_lambda_function_url.functions : k => v.function_url }
}

output "lambda_alias_arns" {
  description = "ARNs of Lambda aliases"
  value       = { for k, v in aws_lambda_alias.live : k => v.arn }
}

output "lambda_log_groups" {
  description = "CloudWatch log group names"
  value       = { for k, v in aws_cloudwatch_log_group.lambda : k => v.name }
}

