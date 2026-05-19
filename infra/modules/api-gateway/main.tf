# API Gateway Module - HTTP API for serverless REST endpoints

locals {
  is_prod = var.environment == "prod"
  # Align with Lambda CORS (backend/lambda/src/handler/index.ts); x-customer-phone is required for /chat/* browser calls.
  cors_allow_headers = [
    "content-type",
    "authorization",
    "x-api-key",
    "x-uat-mode",
    "x-uat-token",
    "x-requested-with",
    "x-customer-phone",
  ]
  cors_origins_json       = jsonencode(var.cors_allowed_origins)
  cors_allow_headers_json = jsonencode(local.cors_allow_headers)
}

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
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
    allow_headers     = local.cors_allow_headers
    expose_headers    = ["content-length", "x-request-id"]
    max_age           = 86400
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

# ============================================================================
# CORS Configuration for Existing API Gateway
# ============================================================================
# When using an existing API Gateway, we need to update its CORS configuration
# using the AWS CLI since data sources are read-only.
# This runs on every apply to ensure CORS stays correctly configured.

resource "null_resource" "update_existing_api_cors" {
  count = var.existing_api_gateway_id != null ? 1 : 0
  
  triggers = {
    cors_origins = local.cors_origins_json
    cors_headers = local.cors_allow_headers_json
    api_id       = var.existing_api_gateway_id
  }
  
  provisioner "local-exec" {
    command = <<-EOT
      aws apigatewayv2 update-api \
        --api-id ${var.existing_api_gateway_id} \
        --region ${var.aws_region} \
        --cors-configuration '{
          "AllowOrigins": ${local.cors_origins_json},
          "AllowMethods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
          "AllowHeaders": ${local.cors_allow_headers_json},
          "ExposeHeaders": ["content-length", "x-request-id"],
          "AllowCredentials": true,
          "MaxAge": 86400
        }'
    EOT
    
    environment = {
      AWS_DEFAULT_REGION = var.aws_region
    }
  }
}

# Local value to get the API Gateway ID (either from data source or resource)
locals {
  api_gateway_id = var.existing_api_gateway_id != null ? data.aws_apigatewayv2_api.existing[0].id : aws_apigatewayv2_api.main[0].id
  api_gateway_execution_arn = var.existing_api_gateway_id != null ? data.aws_apigatewayv2_api.existing[0].execution_arn : aws_apigatewayv2_api.main[0].execution_arn
  api_gateway_api_endpoint = var.existing_api_gateway_id != null ? data.aws_apigatewayv2_api.existing[0].api_endpoint : aws_apigatewayv2_api.main[0].api_endpoint

  delivery_java_route_defaults = [
    "ANY /delivery/{proxy+}",
    "ANY /logistics/pidge/{proxy+}",
    # Meal Pidge dispatch (Lambda → Java or direct smoke via API Gateway when split is on)
    "ANY /logistics/meal/dispatch",
    "ANY /webhooks/pidge",
    "ANY /admin/logistics/pidge/{proxy+}",
    # Smoke / docs (narrower than Lambda catch-all when split is enabled)
    "ANY /swagger-ui",
    "ANY /swagger-ui/{proxy+}",
    "ANY /swagger-ui.html",
    "ANY /v3/api-docs",
    "ANY /v3/api-docs/{proxy+}",
    "ANY /v3/api-docs.yaml",
  ]

  customer_java_route_defaults = [
    "ANY /customer/{proxy+}",
    "ANY /customers/{proxy+}",
    "ANY /pets/{proxy+}",
  ]

  booking_java_route_defaults = [
    "ANY /bookings/{proxy+}",
    "ANY /booking/{proxy+}",
  ]
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

  # CRITICAL: Prevent duplicate integrations - ONE integration per function per environment
  lifecycle {
    create_before_destroy = true
  }
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

  # CRITICAL: Prevent duplicate routes - ONE route per path per environment
  lifecycle {
    create_before_destroy = true
  }
  route_key = each.value.route_key
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.value.integration_key].id}"

  # Authorization temporarily disabled until Cognito authorizer is added
  authorization_type = "NONE"
  authorizer_id      = null
}

# ---------------------------------------------------------------------------
# Java delivery-service (HTTP_PROXY + VPC_LINK → internal ALB)
# Routes are more specific than ANY /{proxy+} → Lambda when present.
# ---------------------------------------------------------------------------
resource "aws_apigatewayv2_vpc_link" "delivery_java" {
  count = var.delivery_java_integration != null ? 1 : 0

  name               = "warmpawz-${var.environment}-delivery-java"
  security_group_ids = var.delivery_java_integration.vpc_link_security_group_ids
  subnet_ids         = var.delivery_java_integration.vpc_link_subnet_ids

  tags = {
    Name        = "warmpawz-${var.environment}-delivery-vpc-link"
    Environment = var.environment
  }
}

resource "aws_apigatewayv2_vpc_link" "customer_java" {
  count = var.customer_java_integration != null ? 1 : 0

  name               = "warmpawz-${var.environment}-customer-java"
  security_group_ids = var.customer_java_integration.vpc_link_security_group_ids
  subnet_ids         = var.customer_java_integration.vpc_link_subnet_ids

  tags = {
    Name        = "warmpawz-${var.environment}-customer-vpc-link"
    Environment = var.environment
  }
}

resource "aws_apigatewayv2_vpc_link" "booking_java" {
  count = var.booking_java_integration != null ? 1 : 0

  name               = "warmpawz-${var.environment}-booking-java"
  security_group_ids = var.booking_java_integration.vpc_link_security_group_ids
  subnet_ids         = var.booking_java_integration.vpc_link_subnet_ids

  tags = {
    Name        = "warmpawz-${var.environment}-booking-vpc-link"
    Environment = var.environment
  }
}

resource "aws_apigatewayv2_integration" "delivery_java" {
  count = var.delivery_java_integration != null ? 1 : 0

  api_id             = local.api_gateway_id
  integration_type   = "HTTP_PROXY"
  integration_uri    = var.delivery_java_integration.alb_listener_arn
  integration_method = "ANY"
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.delivery_java[0].id

  timeout_milliseconds = var.delivery_java_integration.timeout_ms

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apigatewayv2_integration" "customer_java" {
  count = var.customer_java_integration != null ? 1 : 0

  api_id             = local.api_gateway_id
  integration_type   = "HTTP_PROXY"
  integration_uri    = var.customer_java_integration.alb_listener_arn
  integration_method = "ANY"
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.customer_java[0].id

  timeout_milliseconds = var.customer_java_integration.timeout_ms

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apigatewayv2_integration" "booking_java" {
  count = var.booking_java_integration != null ? 1 : 0

  api_id             = local.api_gateway_id
  integration_type   = "HTTP_PROXY"
  integration_uri    = var.booking_java_integration.alb_listener_arn
  integration_method = "ANY"
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.booking_java[0].id

  timeout_milliseconds = var.booking_java_integration.timeout_ms

  lifecycle {
    create_before_destroy = true
  }
}

locals {
  delivery_java_route_sel = var.delivery_java_integration == null ? [] : coalesce(var.delivery_java_integration.route_keys, [])
  delivery_java_route_keys = var.delivery_java_integration == null ? toset([]) : (
    length(local.delivery_java_route_sel) > 0 ? toset(local.delivery_java_route_sel) : toset(local.delivery_java_route_defaults)
  )
  customer_java_route_sel = var.customer_java_integration == null ? [] : coalesce(var.customer_java_integration.route_keys, [])
  customer_java_route_keys = var.customer_java_integration == null ? toset([]) : (
    length(local.customer_java_route_sel) > 0 ? toset(local.customer_java_route_sel) : toset(local.customer_java_route_defaults)
  )
  booking_java_route_sel = var.booking_java_integration == null ? [] : coalesce(var.booking_java_integration.route_keys, [])
  booking_java_route_keys = var.booking_java_integration == null ? toset([]) : (
    length(local.booking_java_route_sel) > 0 ? toset(local.booking_java_route_sel) : toset(local.booking_java_route_defaults)
  )
}

resource "aws_apigatewayv2_route" "delivery_java" {
  for_each = local.delivery_java_route_keys

  api_id    = local.api_gateway_id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.delivery_java[0].id}"

  authorization_type = "NONE"

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [aws_apigatewayv2_integration.delivery_java]
}

resource "aws_apigatewayv2_route" "customer_java" {
  for_each = local.customer_java_route_keys

  api_id    = local.api_gateway_id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.customer_java[0].id}"

  authorization_type = "NONE"

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [aws_apigatewayv2_integration.customer_java]
}

resource "aws_apigatewayv2_route" "booking_java" {
  for_each = local.booking_java_route_keys

  api_id    = local.api_gateway_id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.booking_java[0].id}"

  authorization_type = "NONE"

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [aws_apigatewayv2_integration.booking_java]
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

  # CRITICAL: Prevent duplicate domain - ONE domain per name per environment
  lifecycle {
    prevent_destroy = true # Prevent accidental deletion (set to false for dev/staging if needed)
    create_before_destroy = true
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

