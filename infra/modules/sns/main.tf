# SNS Module - Notification service

# SNS Topic for System Alerts
resource "aws_sns_topic" "system_alerts" {
  name              = "warmpawz-${var.environment}-system-alerts"
  display_name      = "Warmpawz System Alerts (${upper(var.environment)})"
  delivery_policy   = jsonencode({
    http = {
      defaultHealthyRetryPolicy = {
        minDelayTarget     = 20
        maxDelayTarget     = 20
        numRetries         = 3
        numMaxDelayRetries = 0
        numNoDelayRetries  = 0
        numMinDelayRetries = 0
        backoffFunction    = "linear"
      }
    }
  })
  
  tags = {
    Name        = "warmpawz-${var.environment}-system-alerts"
    Environment = var.environment
  }
}

# SNS Topic for User Notifications
resource "aws_sns_topic" "user_notifications" {
  name         = "warmpawz-${var.environment}-user-notifications"
  display_name = "Warmpawz User Notifications (${upper(var.environment)})"
  
  tags = {
    Name        = "warmpawz-${var.environment}-user-notifications"
    Environment = var.environment
  }
}

# SNS Topic for Booking Updates
resource "aws_sns_topic" "booking_updates" {
  name         = "warmpawz-${var.environment}-booking-updates"
  display_name = "Warmpawz Booking Updates (${upper(var.environment)})"
  
  tags = {
    Name        = "warmpawz-${var.environment}-booking-updates"
    Environment = var.environment
  }
}

# SNS Topic for Payment Events
resource "aws_sns_topic" "payment_events" {
  name         = "warmpawz-${var.environment}-payment-events"
  display_name = "Warmpawz Payment Events (${upper(var.environment)})"
  
  tags = {
    Name        = "warmpawz-${var.environment}-payment-events"
    Environment = var.environment
  }
}

# SNS Topic for Vendor Notifications
resource "aws_sns_topic" "vendor_notifications" {
  name         = "warmpawz-${var.environment}-vendor-notifications"
  display_name = "Warmpawz Vendor Notifications (${upper(var.environment)})"
  
  tags = {
    Name        = "warmpawz-${var.environment}-vendor-notifications"
    Environment = var.environment
  }
}

# Email subscription for system alerts (optional)
resource "aws_sns_topic_subscription" "system_alerts_email" {
  count     = length(var.alert_emails)
  topic_arn = aws_sns_topic.system_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_emails[count.index]
}

# SNS Topic Policy
resource "aws_sns_topic_policy" "system_alerts" {
  arn = aws_sns_topic.system_alerts.arn
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = [
            "cloudwatch.amazonaws.com",
            "events.amazonaws.com",
            "lambda.amazonaws.com"
          ]
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.system_alerts.arn
      }
    ]
  })
}

# CloudWatch Alarms for SNS
resource "aws_cloudwatch_metric_alarm" "sns_failed_notifications" {
  for_each = {
    system_alerts        = aws_sns_topic.system_alerts.name
    user_notifications   = aws_sns_topic.user_notifications.name
    booking_updates      = aws_sns_topic.booking_updates.name
    payment_events       = aws_sns_topic.payment_events.name
    vendor_notifications = aws_sns_topic.vendor_notifications.name
  }
  
  alarm_name          = "warmpawz-${var.environment}-sns-${each.key}-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "NumberOfNotificationsFailed"
  namespace           = "AWS/SNS"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "SNS notification failures for ${each.key}"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]
  
  dimensions = {
    TopicName = each.value
  }
  
  tags = {
    Name        = "warmpawz-${var.environment}-sns-${each.key}-failures"
    Environment = var.environment
  }
}

