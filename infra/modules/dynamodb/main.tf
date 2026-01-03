# DynamoDB Module - NoSQL tables for non-critical data and reporting

# DynamoDB Table for Sessions
resource "aws_dynamodb_table" "sessions" {
  name         = "warmpawz-${var.environment}-sessions"
  billing_mode = var.billing_mode
  hash_key     = "session_id"
  range_key    = "user_id"

  # On-demand capacity
  read_capacity  = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
  write_capacity = var.billing_mode == "PROVISIONED" ? var.write_capacity : null

  attribute {
    name = "session_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "expires_at"
    type = "N"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  global_secondary_index {
    name            = "UserIdIndex"
    hash_key        = "user_id"
    projection_type = "ALL"
    read_capacity   = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
    write_capacity  = var.billing_mode == "PROVISIONED" ? var.write_capacity : null
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = {
    Name        = "warmpawz-${var.environment}-sessions"
    Environment = var.environment
  }
}

# DynamoDB Table for Analytics Events
resource "aws_dynamodb_table" "analytics_events" {
  name         = "warmpawz-${var.environment}-analytics-events"
  billing_mode = var.billing_mode
  hash_key     = "event_id"
  range_key    = "timestamp"

  read_capacity  = var.billing_mode == "PROVISIONED" ? var.read_capacity * 2 : null
  write_capacity = var.billing_mode == "PROVISIONED" ? var.write_capacity * 2 : null

  attribute {
    name = "event_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "event_type"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  global_secondary_index {
    name            = "UserIdIndex"
    hash_key        = "user_id"
    range_key       = "timestamp"
    projection_type = "ALL"
    read_capacity   = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
    write_capacity  = var.billing_mode == "PROVISIONED" ? var.write_capacity : null
  }

  global_secondary_index {
    name            = "EventTypeIndex"
    hash_key        = "event_type"
    range_key       = "timestamp"
    projection_type = "ALL"
    read_capacity   = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
    write_capacity  = var.billing_mode == "PROVISIONED" ? var.write_capacity : null
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = {
    Name        = "warmpawz-${var.environment}-analytics-events"
    Environment = var.environment
  }
}

# DynamoDB Table for Cache
resource "aws_dynamodb_table" "cache" {
  name         = "warmpawz-${var.environment}-cache"
  billing_mode = var.billing_mode
  hash_key     = "cache_key"

  read_capacity  = var.billing_mode == "PROVISIONED" ? var.read_capacity * 3 : null
  write_capacity = var.billing_mode == "PROVISIONED" ? var.write_capacity : null

  attribute {
    name = "cache_key"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = {
    Name        = "warmpawz-${var.environment}-cache"
    Environment = var.environment
  }
}

# DynamoDB Table for Rate Limiting
resource "aws_dynamodb_table" "rate_limits" {
  name         = "warmpawz-${var.environment}-rate-limits"
  billing_mode = var.billing_mode
  hash_key     = "identifier"
  range_key    = "window_start"

  read_capacity  = var.billing_mode == "PROVISIONED" ? var.read_capacity * 5 : null
  write_capacity = var.billing_mode == "PROVISIONED" ? var.write_capacity * 5 : null

  attribute {
    name = "identifier"
    type = "S"
  }

  attribute {
    name = "window_start"
    type = "N"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "warmpawz-${var.environment}-rate-limits"
    Environment = var.environment
  }
}

# CloudWatch Alarms for DynamoDB
resource "aws_cloudwatch_metric_alarm" "dynamodb_read_throttles" {
  for_each = {
    sessions         = aws_dynamodb_table.sessions.name
    analytics_events = aws_dynamodb_table.analytics_events.name
    cache            = aws_dynamodb_table.cache.name
    rate_limits      = aws_dynamodb_table.rate_limits.name
  }

  alarm_name          = "warmpawz-${var.environment}-dynamodb-${each.key}-read-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReadThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "DynamoDB read throttles for ${each.key}"
  alarm_actions       = var.alarm_actions

  dimensions = {
    TableName = each.value
  }

  tags = {
    Name        = "warmpawz-${var.environment}-dynamodb-${each.key}-read-throttles"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_write_throttles" {
  for_each = {
    sessions         = aws_dynamodb_table.sessions.name
    analytics_events = aws_dynamodb_table.analytics_events.name
    cache            = aws_dynamodb_table.cache.name
    rate_limits      = aws_dynamodb_table.rate_limits.name
  }

  alarm_name          = "warmpawz-${var.environment}-dynamodb-${each.key}-write-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "WriteThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "DynamoDB write throttles for ${each.key}"
  alarm_actions       = var.alarm_actions

  dimensions = {
    TableName = each.value
  }

  tags = {
    Name        = "warmpawz-${var.environment}-dynamodb-${each.key}-write-throttles"
    Environment = var.environment
  }
}

