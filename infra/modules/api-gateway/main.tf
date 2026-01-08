# API Gateway Module - HTTP API for serverless REST endpoints

# Reference existing API Gateway (IMMUTABLE - do not create or modify)
# If existing_api_gateway_id is provided, use data source to reference it
# Otherwise, create a new one (for new environments)
data "aws_apigatewayv2_api" "existing" {
  count = var.existing_api_gateway_id != null ? 1 : 0
  api_id = var.existing_api_gateway_id
}

# API Gateway HTTP API (only created if existing_api_gateway_id is not provided)
resource "aws_apigatewayv2_api" "main" {
  count = var.existing_api_gateway_id == null ? 1 : 0
  
  name          = "warmpawz-${var.environment}-api"
  protocol_type = "HTTP"
  description   = "Warmpawz API Gateway for ${var.environment}"

  cors_configuration {
    allow_origins     = var.cors_allowed_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    allow_headers     = ["content-type", "authorization", "x-api-key"]
    expose_headers    = ["content-length", "x-request-id"]
    max_age           = 300
    allow_credentials = true
  }

  tags = {
    Name        = "warmpawz-${var.environment}-api"
    Environment = var.environment
  }
  
  lifecycle {
    prevent_destroy = true  # Prevent accidental deletion
  }
}

# Local value to get the API Gateway ID (either from data source or resource)
locals {
  api_gateway_id = var.existing_api_gateway_id != null ? data.aws_apigatewayv2_api.existing[0].id : aws_apigatewayv2_api.main[0].id
  api_gateway_execution_arn = var.existing_api_gateway_id != null ? data.aws_apigatewayv2_api.existing[0].execution_arn : aws_apigatewayv2_api.main[0].execution_arn
  api_gateway_api_endpoint = var.existing_api_gateway_id != null ? data.aws_apigatewayv2_api.existing[0].api_endpoint : aws_apigatewayv2_api.main[0].api_endpoint
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/warmpawz-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "warmpawz-${var.environment}-api-logs"
    Environment = var.environment
  }
}

# API Gateway Stage
resource "aws_apigatewayv2_stage" "main" {
  api_id      = local.api_gateway_id
  name        = var.stage_name
  auto_deploy = var.auto_deploy

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      protocol         = "$context.protocol"
      responseLength   = "$context.responseLength"
      errorMessage     = "$context.error.message"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  default_route_settings {
    throttling_burst_limit   = var.throttle_burst_limit
    throttling_rate_limit    = var.throttle_rate_limit
    detailed_metrics_enabled = true
  }

  tags = {
    Name        = "warmpawz-${var.environment}-api-stage"
    Environment = var.environment
  }
}

# API Gateway Authorizer (Cognito)
# Temporarily disabled to avoid circular dependency
# Will be added in a future deployment
# resource "aws_apigatewayv2_authorizer" "cognito" {
#   api_id           = aws_apigatewayv2_api.main.id
#   authorizer_type  = "JWT"
#   identity_sources = ["$request.header.Authorization"]
#   name             = "cognito-authorizer"
#   
#   jwt_configuration {
#     audience = [var.cognito_user_pool_client_id]
#     issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${var.cognito_user_pool_id}"
#   }
# }

# Lambda Integrations
resource "aws_apigatewayv2_integration" "lambda" {
  for_each = var.lambda_integrations

  api_id                 = local.api_gateway_id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = each.value.timeout_ms

  description = "Integration for ${each.key}"
}

# Lambda Permissions for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  for_each = var.lambda_integrations

  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${local.api_gateway_execution_arn}/*/*"

  lifecycle {
    ignore_changes = all  # NUCLEAR OPTION: Never modify after import
  }
}

# API Routes
resource "aws_apigatewayv2_route" "routes" {
  for_each = var.routes

  api_id    = local.api_gateway_id
  route_key = each.value.route_key
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.value.integration_key].id}"

  # Authorization temporarily disabled until Cognito authorizer is added
  authorization_type = "NONE"
  authorizer_id      = null
}

# Custom Domain (optional)
resource "aws_apigatewayv2_domain_name" "main" {
  count = var.custom_domain_name != null ? 1 : 0

  domain_name = var.custom_domain_name

  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = {
    Name        = "warmpawz-${var.environment}-domain"
    Environment = var.environment
  }
}

# API Mapping for Custom Domain
resource "aws_apigatewayv2_api_mapping" "main" {
  count = var.custom_domain_name != null ? 1 : 0

  api_id      = local.api_gateway_id
  domain_name = aws_apigatewayv2_domain_name.main[0].id
  stage       = aws_apigatewayv2_stage.main.id
}

# Route53 Record for Custom Domain
resource "aws_route53_record" "api" {
  count = var.custom_domain_name != null && var.route53_zone_id != null ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.custom_domain_name
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.main[0].domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.main[0].domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "warmpawz-${var.environment}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.error_5xx_threshold
  alarm_description   = "API Gateway 5XX error rate is high"
  alarm_actions       = var.alarm_actions

  dimensions = {
    ApiId = local.api_gateway_id
    Stage = aws_apigatewayv2_stage.main.name
  }

  tags = {
    Name        = "warmpawz-${var.environment}-api-5xx-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "api_4xx_errors" {
  alarm_name          = "warmpawz-${var.environment}-api-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.error_4xx_threshold
  alarm_description   = "API Gateway 4XX error rate is high"
  alarm_actions       = var.alarm_actions

  dimensions = {
    ApiId = local.api_gateway_id
    Stage = aws_apigatewayv2_stage.main.name
  }

  tags = {
    Name        = "warmpawz-${var.environment}-api-4xx-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "warmpawz-${var.environment}-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Average"
  threshold           = var.latency_threshold
  alarm_description   = "API Gateway latency is high"
  alarm_actions       = var.alarm_actions

  dimensions = {
    ApiId = local.api_gateway_id
    Stage = aws_apigatewayv2_stage.main.name
  }

  tags = {
    Name        = "warmpawz-${var.environment}-api-latency-alarm"
    Environment = var.environment
  }
}

