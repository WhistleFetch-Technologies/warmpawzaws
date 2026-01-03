# Secrets Module Outputs

output "razorpay_secret_arn" {
  description = "ARN of the Razorpay secret"
  value       = aws_secretsmanager_secret.razorpay.arn
}

output "google_maps_secret_arn" {
  description = "ARN of the Google Maps secret"
  value       = aws_secretsmanager_secret.google_maps.arn
}

output "shiprocket_secret_arn" {
  description = "ARN of the Shiprocket secret"
  value       = aws_secretsmanager_secret.shiprocket.arn
}

output "all_secret_arns" {
  description = "List of all secret ARNs"
  value = [
    aws_secretsmanager_secret.razorpay.arn,
    aws_secretsmanager_secret.google_maps.arn,
    aws_secretsmanager_secret.shiprocket.arn
  ]
}

output "sns_android_customer_arn" {
  description = "ARN of the Android customer SNS platform application"
  value       = aws_sns_platform_application.android_customer.arn
}

output "sns_android_vendor_arn" {
  description = "ARN of the Android vendor SNS platform application"
  value       = aws_sns_platform_application.android_vendor.arn
}

output "sns_ios_customer_arn" {
  description = "ARN of the iOS customer SNS platform application"
  value       = length(aws_sns_platform_application.ios_customer) > 0 ? aws_sns_platform_application.ios_customer[0].arn : null
}

output "sns_ios_vendor_arn" {
  description = "ARN of the iOS vendor SNS platform application"
  value       = length(aws_sns_platform_application.ios_vendor) > 0 ? aws_sns_platform_application.ios_vendor[0].arn : null
}

