output "dlq_arn" {
  description = "Dead letter queue ARN"
  value       = aws_sqs_queue.dlq.arn
}

output "dlq_url" {
  description = "Dead letter queue URL"
  value       = aws_sqs_queue.dlq.url
}

output "dlq_fifo_arn" {
  description = "FIFO dead letter queue ARN"
  value       = aws_sqs_queue.dlq_fifo.arn
}

output "dlq_fifo_url" {
  description = "FIFO dead letter queue URL"
  value       = aws_sqs_queue.dlq_fifo.url
}

output "booking_processing_queue_arn" {
  description = "Booking processing queue ARN"
  value       = aws_sqs_queue.booking_processing.arn
}

output "booking_processing_queue_url" {
  description = "Booking processing queue URL"
  value       = aws_sqs_queue.booking_processing.url
}

output "payment_processing_queue_arn" {
  description = "Payment processing queue ARN"
  value       = aws_sqs_queue.payment_processing.arn
}

output "payment_processing_queue_url" {
  description = "Payment processing queue URL"
  value       = aws_sqs_queue.payment_processing.url
}

output "notification_delivery_queue_arn" {
  description = "Notification delivery queue ARN"
  value       = aws_sqs_queue.notification_delivery.arn
}

output "notification_delivery_queue_url" {
  description = "Notification delivery queue URL"
  value       = aws_sqs_queue.notification_delivery.url
}

output "analytics_events_queue_arn" {
  description = "Analytics events queue ARN"
  value       = aws_sqs_queue.analytics_events.arn
}

output "analytics_events_queue_url" {
  description = "Analytics events queue URL"
  value       = aws_sqs_queue.analytics_events.url
}

output "email_delivery_queue_arn" {
  description = "Email delivery queue ARN"
  value       = aws_sqs_queue.email_delivery.arn
}

output "email_delivery_queue_url" {
  description = "Email delivery queue URL"
  value       = aws_sqs_queue.email_delivery.url
}

output "order_processing_queue_arn" {
  description = "Order processing queue ARN"
  value       = aws_sqs_queue.order_processing.arn
}

output "order_processing_queue_url" {
  description = "Order processing queue URL"
  value       = aws_sqs_queue.order_processing.url
}

