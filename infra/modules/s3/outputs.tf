output "user_uploads_bucket_name" {
  description = "User uploads bucket name"
  value       = aws_s3_bucket.user_uploads.id
}

output "user_uploads_bucket_arn" {
  description = "User uploads bucket ARN"
  value       = aws_s3_bucket.user_uploads.arn
}

output "static_website_bucket_name" {
  description = "Static website bucket name"
  value       = aws_s3_bucket.static_website.id
}

output "static_website_bucket_arn" {
  description = "Static website bucket ARN"
  value       = aws_s3_bucket.static_website.arn
}

output "static_website_endpoint" {
  description = "Static website endpoint"
  value       = aws_s3_bucket_website_configuration.static_website.website_endpoint
}

output "logs_bucket_name" {
  description = "Logs bucket name"
  value       = aws_s3_bucket.logs.id
}

output "logs_bucket_arn" {
  description = "Logs bucket ARN"
  value       = aws_s3_bucket.logs.arn
}

output "backups_bucket_name" {
  description = "Backups bucket name"
  value       = aws_s3_bucket.backups.id
}

output "backups_bucket_arn" {
  description = "Backups bucket ARN"
  value       = aws_s3_bucket.backups.arn
}

