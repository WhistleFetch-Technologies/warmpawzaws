# CloudWatch Monitoring Module
# Provides CloudWatch alarms and dashboards for monitoring

variable "environment" {
  description = "Environment name (dev, stage, prod)"
  type        = string
}

variable "lambda_function_name" {
  description = "Name of the Lambda function to monitor"
  type        = string
}

variable "api_gateway_id" {
  description = "API Gateway ID to monitor"
  type        = string
  default     = ""
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for alarm notifications"
  type        = string
  default     = ""
}

# ============================================================================
# CLOUDWATCH LOG GROUPS
# ============================================================================

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.lambda_function_name}"
  retention_in_days = 30

  tags = {
    Name        = "warmpawz-${var.environment}-lambda-logs"
    Environment = var.environment
  }
}

# ============================================================================
# CLOUDWATCH METRICS - PHARMACY ORDERS
# ============================================================================

# Custom metric for pharmacy order errors
resource "aws_cloudwatch_metric_alarm" "pharmacy_no_pharmacy_found" {
  count = var.environment == "prod" || var.environment == "stage" ? 1 : 0

  alarm_name          = "warmpawz-${var.environment}-pharmacy-no-pharmacy-found"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "PharmacyOrderErrors"
  namespace           = "Warmpawz/Pharmacy"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Alert when no pharmacy found errors exceed threshold"
  treat_missing_data = "notBreaching"

  dimensions = {
    ErrorType = "no_pharmacy_found"
  }

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  tags = {
    Name        = "warmpawz-${var.environment}-pharmacy-no-pharmacy-found"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "pharmacy_all_rejected" {
  count = var.environment == "prod" || var.environment == "stage" ? 1 : 0

  alarm_name          = "warmpawz-${var.environment}-pharmacy-all-rejected"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "PharmacyOrderErrors"
  namespace           = "Warmpawz/Pharmacy"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "Alert when all pharmacies reject orders"
  treat_missing_data = "notBreaching"

  dimensions = {
    ErrorType = "all_rejected"
  }

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  tags = {
    Name        = "warmpawz-${var.environment}-pharmacy-all-rejected"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "pharmacy_payment_failures" {
  count = var.environment == "prod" || var.environment == "stage" ? 1 : 0

  alarm_name          = "warmpawz-${var.environment}-pharmacy-payment-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "PharmacyPaymentErrors"
  namespace           = "Warmpawz/Pharmacy"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Alert when payment failures exceed threshold"
  treat_missing_data = "notBreaching"

  dimensions = {
    ErrorType = "payment_failed"
  }

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  tags = {
    Name        = "warmpawz-${var.environment}-pharmacy-payment-failures"
    Environment = var.environment
  }
}

# Lambda error rate alarm
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count = var.environment == "prod" || var.environment == "stage" ? 1 : 0

  alarm_name          = "warmpawz-${var.environment}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Alert when Lambda errors exceed threshold"
  treat_missing_data = "notBreaching"

  dimensions = {
    FunctionName = var.lambda_function_name
  }

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  tags = {
    Name        = "warmpawz-${var.environment}-lambda-errors"
    Environment = var.environment
  }
}

# Lambda duration alarm
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  count = var.environment == "prod" || var.environment == "stage" ? 1 : 0

  alarm_name          = "warmpawz-${var.environment}-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = 10000 # 10 seconds
  alarm_description   = "Alert when Lambda duration exceeds 10 seconds"
  treat_missing_data = "notBreaching"

  dimensions = {
    FunctionName = var.lambda_function_name
  }

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  tags = {
    Name        = "warmpawz-${var.environment}-lambda-duration"
    Environment = var.environment
  }
}

# ============================================================================
# CLOUDWATCH DASHBOARD
# ============================================================================

resource "aws_cloudwatch_dashboard" "pharmacy_monitoring" {
  count = var.environment == "prod" || var.environment == "stage" ? 1 : 0

  dashboard_name = "warmpawz-${var.environment}-pharmacy-monitoring"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["Warmpawz/Pharmacy", "PharmacyOrderErrors", { stat = "Sum", label = "No Pharmacy Found" }],
            [".", ".", { stat = "Sum", label = "All Rejected" }],
            ["Warmpawz/Pharmacy", "PharmacyPaymentErrors", { stat = "Sum", label = "Payment Failures" }],
            ["AWS/Lambda", "Errors", { stat = "Sum", label = "Lambda Errors", dimensions = { FunctionName = var.lambda_function_name } }],
            ["AWS/Lambda", "Duration", { stat = "Average", label = "Lambda Duration", dimensions = { FunctionName = var.lambda_function_name } }],
          ]
          period = 300
          stat   = "Sum"
          region = "ap-south-1"
          title  = "Pharmacy Order Monitoring"
        }
      }
    ]
  })

  tags = {
    Name        = "warmpawz-${var.environment}-pharmacy-monitoring"
    Environment = var.environment
  }
}
