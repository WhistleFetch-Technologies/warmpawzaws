# Lambda Module - Serverless compute for all functions
# Includes VPC integration, IAM roles, and environment variables

# Security Group for Lambda
resource "aws_security_group" "lambda" {
  name_prefix = "warmpawz-${var.environment}-lambda-"
  description = "Security group for Lambda functions"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "warmpawz-${var.environment}-lambda-sg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# IAM Role for Lambda Execution
resource "aws_iam_role" "lambda" {
  name_prefix = "warmpawz-${var.environment}-lambda-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "warmpawz-${var.environment}-lambda-role"
    Environment = var.environment
  }
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Attach VPC execution policy
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Custom IAM Policy for Lambda
resource "aws_iam_role_policy" "lambda_custom" {
  name_prefix = "warmpawz-${var.environment}-lambda-custom-"
  role        = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.secrets_arns
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = var.s3_arns
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = var.dynamodb_arns
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = var.sns_arns
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = concat(var.sqs_arns, ["arn:aws:sqs:${var.aws_region}:*:warmpawz-${var.environment}-*"])
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:ListUsers"
        ]
        Resource = var.cognito_arns
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion" = var.aws_region
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "es:ESHttpPost",
          "es:ESHttpPut",
          "es:ESHttpGet",
          "es:ESHttpDelete"
        ]
        Resource = var.opensearch_arns
      }
    ]
  })
}

# Lambda Layer for shared dependencies
resource "aws_lambda_layer_version" "shared_dependencies" {
  count = var.create_shared_layer ? 1 : 0

  filename            = var.layer_zip_path
  layer_name          = "warmpawz-${var.environment}-shared-dependencies"
  compatible_runtimes = var.lambda_runtimes
  source_code_hash    = filebase64sha256(var.layer_zip_path)

  description = "Shared dependencies for Warmpawz Lambda functions"
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda" {
  for_each = var.lambda_functions

  name              = "/aws/lambda/warmpawz-${var.environment}-${each.key}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "warmpawz-${var.environment}-${each.key}-logs"
    Environment = var.environment
    Function    = each.key
  }
}

# Lambda Functions
resource "aws_lambda_function" "functions" {
  for_each = var.lambda_functions

  function_name = "warmpawz-${var.environment}-${each.key}"
  role          = aws_iam_role.lambda.arn
  handler       = each.value.handler
  runtime       = each.value.runtime
  timeout       = each.value.timeout
  memory_size   = each.value.memory_size

  filename         = each.value.zip_path
  source_code_hash = filebase64sha256(each.value.zip_path)

  # VPC Configuration
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  # Environment Variables
  environment {
    variables = merge(
      var.common_env_vars,
      each.value.env_vars,
      {
        ENVIRONMENT = var.environment
        LOG_LEVEL   = var.environment == "prod" ? "INFO" : "DEBUG"
      }
    )
  }

  # Lambda Layers
  layers = var.create_shared_layer ? [aws_lambda_layer_version.shared_dependencies[0].arn] : []

  # Reserved Concurrent Executions (optional)
  reserved_concurrent_executions = lookup(each.value, "reserved_concurrency", -1)

  # Dead Letter Queue (optional)
  dead_letter_config {
    target_arn = var.dlq_arn
  }

  # Tracing
  tracing_config {
    mode = var.enable_xray ? "Active" : "PassThrough"
  }

  tags = {
    Name        = "warmpawz-${var.environment}-${each.key}"
    Environment = var.environment
    Function    = each.key
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.lambda_vpc,
    aws_cloudwatch_log_group.lambda
  ]
}

# Lambda Function URLs (optional, for direct HTTP access)
resource "aws_lambda_function_url" "functions" {
  for_each = {
    for k, v in var.lambda_functions : k => v
    if try(v.enable_function_url, false) == true
  }

  function_name      = aws_lambda_function.functions[each.key].function_name
  authorization_type = "AWS_IAM"

  cors {
    allow_credentials = true
    allow_origins     = var.cors_allowed_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["content-type", "authorization"]
    max_age           = 86400
  }
}

# Lambda Aliases for blue/green deployments
resource "aws_lambda_alias" "live" {
  for_each = var.lambda_functions

  name             = "live"
  description      = "Live alias for ${each.key}"
  function_name    = aws_lambda_function.functions[each.key].function_name
  function_version = aws_lambda_function.functions[each.key].version

  lifecycle {
    ignore_changes = all  # NUCLEAR OPTION: Never modify after import
  }
}

# CloudWatch Alarms for Lambda
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = var.lambda_functions

  alarm_name          = "warmpawz-${var.environment}-${each.key}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.error_alarm_threshold
  alarm_description   = "Lambda function ${each.key} error rate is high"
  alarm_actions       = var.alarm_actions

  dimensions = {
    FunctionName = aws_lambda_function.functions[each.key].function_name
  }

  tags = {
    Name        = "warmpawz-${var.environment}-${each.key}-error-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  for_each = var.lambda_functions

  alarm_name          = "warmpawz-${var.environment}-${each.key}-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = each.value.timeout * 1000 * 0.8 # 80% of timeout
  alarm_description   = "Lambda function ${each.key} duration is high"
  alarm_actions       = var.alarm_actions

  dimensions = {
    FunctionName = aws_lambda_function.functions[each.key].function_name
  }

  tags = {
    Name        = "warmpawz-${var.environment}-${each.key}-duration-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = var.lambda_functions

  alarm_name          = "warmpawz-${var.environment}-${each.key}-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Lambda function ${each.key} is being throttled"
  alarm_actions       = var.alarm_actions

  dimensions = {
    FunctionName = aws_lambda_function.functions[each.key].function_name
  }

  tags = {
    Name        = "warmpawz-${var.environment}-${each.key}-throttle-alarm"
    Environment = var.environment
  }
}

