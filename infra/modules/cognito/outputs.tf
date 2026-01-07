output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_endpoint" {
  description = "Cognito User Pool endpoint"
  value       = aws_cognito_user_pool.main.endpoint
}

output "user_pool_domain" {
  description = "Cognito User Pool domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "customer_web_client_id" {
  description = "Customer web app client ID"
  value       = aws_cognito_user_pool_client.customer_web.id
}

output "vendor_web_client_id" {
  description = "Vendor web app client ID"
  value       = aws_cognito_user_pool_client.vendor_web.id
}

output "admin_web_client_id" {
  description = "Admin web app client ID"
  value       = aws_cognito_user_pool_client.admin_web.id
}

output "mobile_customer_client_id" {
  description = "Mobile customer app client ID"
  value       = aws_cognito_user_pool_client.mobile_customer.id
}

output "mobile_vendor_client_id" {
  description = "Mobile vendor app client ID"
  value       = aws_cognito_user_pool_client.mobile_vendor.id
}

output "identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.main.id
}

