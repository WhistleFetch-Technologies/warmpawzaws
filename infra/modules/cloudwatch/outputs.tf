output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.lambda.name
}

output "dashboard_url" {
  description = "CloudWatch dashboard URL"
  value = var.environment == "prod" || var.environment == "stage" ? 
    "https://console.aws.amazon.com/cloudwatch/home?region=ap-south-1#dashboards:name=${aws_cloudwatch_dashboard.pharmacy_monitoring[0].dashboard_name}" : 
    ""
}
