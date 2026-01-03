# SQS Module - Message queues for async processing

# Dead Letter Queue
resource "aws_sqs_queue" "dlq" {
  name                       = "warmpawz-${var.environment}-dlq"
  message_retention_seconds  = 1209600 # 14 days
  visibility_timeout_seconds = 300

  tags = {
    Name        = "warmpawz-${var.environment}-dlq"
    Environment = var.environment
  }
}

# Queue for Booking Processing
resource "aws_sqs_queue" "booking_processing" {
  name                       = "warmpawz-${var.environment}-booking-processing"
  delay_seconds              = 0
  max_message_size           = 262144 # 256 KB
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20     # Long polling
  visibility_timeout_seconds = 300    # 5 minutes

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "warmpawz-${var.environment}-booking-processing"
    Environment = var.environment
  }
}

# Queue for Payment Processing
resource "aws_sqs_queue" "payment_processing" {
  name                       = "warmpawz-${var.environment}-payment-processing"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "warmpawz-${var.environment}-payment-processing"
    Environment = var.environment
  }
}

# Queue for Notification Delivery
resource "aws_sqs_queue" "notification_delivery" {
  name                       = "warmpawz-${var.environment}-notification-delivery"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 60 # Faster processing

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Name        = "warmpawz-${var.environment}-notification-delivery"
    Environment = var.environment
  }
}

# Queue for Analytics Events
resource "aws_sqs_queue" "analytics_events" {
  name                       = "warmpawz-${var.environment}-analytics-events"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 120

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "warmpawz-${var.environment}-analytics-events"
    Environment = var.environment
  }
}

# Queue for Email Delivery
resource "aws_sqs_queue" "email_delivery" {
  name                       = "warmpawz-${var.environment}-email-delivery"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 60

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Name        = "warmpawz-${var.environment}-email-delivery"
    Environment = var.environment
  }
}

# FIFO Queue for Order Processing (strict ordering)
resource "aws_sqs_queue" "order_processing" {
  name                        = "warmpawz-${var.environment}-order-processing.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  deduplication_scope         = "messageGroup"
  fifo_throughput_limit       = "perMessageGroupId"
  message_retention_seconds   = 345600
  receive_wait_time_seconds   = 20
  visibility_timeout_seconds  = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "warmpawz-${var.environment}-order-processing"
    Environment = var.environment
  }
}

# CloudWatch Alarms for SQS
resource "aws_cloudwatch_metric_alarm" "sqs_age_of_oldest_message" {
  for_each = {
    booking_processing    = aws_sqs_queue.booking_processing.name
    payment_processing    = aws_sqs_queue.payment_processing.name
    notification_delivery = aws_sqs_queue.notification_delivery.name
    analytics_events      = aws_sqs_queue.analytics_events.name
    email_delivery        = aws_sqs_queue.email_delivery.name
    order_processing      = aws_sqs_queue.order_processing.name
  }

  alarm_name          = "warmpawz-${var.environment}-sqs-${each.key}-age"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Maximum"
  threshold           = var.age_alarm_threshold
  alarm_description   = "SQS message age is high for ${each.key}"
  alarm_actions       = var.alarm_actions

  dimensions = {
    QueueName = each.value
  }

  tags = {
    Name        = "warmpawz-${var.environment}-sqs-${each.key}-age"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "sqs_dlq_messages" {
  alarm_name          = "warmpawz-${var.environment}-sqs-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Messages in DLQ"
  alarm_actions       = var.alarm_actions

  dimensions = {
    QueueName = aws_sqs_queue.dlq.name
  }

  tags = {
    Name        = "warmpawz-${var.environment}-sqs-dlq-messages"
    Environment = var.environment
  }
}

