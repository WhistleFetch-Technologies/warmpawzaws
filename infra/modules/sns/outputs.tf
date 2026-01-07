output "system_alerts_topic_arn" {
  description = "System alerts SNS topic ARN"
  value       = aws_sns_topic.system_alerts.arn
}

output "user_notifications_topic_arn" {
  description = "User notifications SNS topic ARN"
  value       = aws_sns_topic.user_notifications.arn
}

output "booking_updates_topic_arn" {
  description = "Booking updates SNS topic ARN"
  value       = aws_sns_topic.booking_updates.arn
}

output "payment_events_topic_arn" {
  description = "Payment events SNS topic ARN"
  value       = aws_sns_topic.payment_events.arn
}

output "vendor_notifications_topic_arn" {
  description = "Vendor notifications SNS topic ARN"
  value       = aws_sns_topic.vendor_notifications.arn
}

