output "api_id" {
  description = "API Gateway ID"
  value       = local.api_gateway_id
}

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = local.api_gateway_api_endpoint
}

output "api_execution_arn" {
  description = "API Gateway execution ARN"
  value       = local.api_gateway_execution_arn
}

output "stage_id" {
  description = "API Gateway stage ID"
  value       = aws_apigatewayv2_stage.main.id
}

output "stage_invoke_url" {
  description = "API Gateway stage invoke URL"
  value       = aws_apigatewayv2_stage.main.invoke_url
}

output "custom_domain_url" {
  description = "Custom domain URL"
  value       = var.custom_domain_name != null ? "https://${var.custom_domain_name}" : null
}

output "authorizer_id" {
  description = "Cognito authorizer ID (temporarily disabled)"
  value       = null
}

