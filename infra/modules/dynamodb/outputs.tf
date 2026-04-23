output "sessions_table_name" {
  description = "Sessions table name"
  value       = aws_dynamodb_table.sessions.name
}

output "sessions_table_arn" {
  description = "Sessions table ARN"
  value       = aws_dynamodb_table.sessions.arn
}

output "cache_table_name" {
  description = "Cache table name"
  value       = aws_dynamodb_table.cache.name
}

output "cache_table_arn" {
  description = "Cache table ARN"
  value       = aws_dynamodb_table.cache.arn
}

output "rate_limits_table_name" {
  description = "Rate limits table name"
  value       = aws_dynamodb_table.rate_limits.name
}

output "rate_limits_table_arn" {
  description = "Rate limits table ARN"
  value       = aws_dynamodb_table.rate_limits.arn
}

