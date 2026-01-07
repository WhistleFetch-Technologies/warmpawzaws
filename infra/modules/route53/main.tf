# Route53 Module - DNS Management

# Data source to get existing hosted zone
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# API Gateway Custom Domain
resource "aws_apigatewayv2_domain_name" "api" {
  count       = var.api_gateway_regional_endpoint != null ? 1 : 0
  domain_name = var.api_subdomain

  domain_name_configuration {
    certificate_arn = var.regional_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = {
    Name        = "warmpawz-${var.environment}-api-domain"
    Environment = var.environment
  }
}

# API Gateway Domain Mapping
resource "aws_apigatewayv2_api_mapping" "api" {
  count       = var.api_gateway_regional_endpoint != null ? 1 : 0
  api_id      = var.api_gateway_id
  domain_name = aws_apigatewayv2_domain_name.api[0].id
  stage       = var.api_stage_name
}

# DNS Records for CloudFront distributions (frontend apps)
resource "aws_route53_record" "cloudfront" {
  for_each = var.cloudfront_records

  zone_id = data.aws_route53_zone.main.zone_id
  name    = each.value.subdomain
  type    = "A"

  alias {
    name                   = each.value.cloudfront_domain
    zone_id                = each.value.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

# DNS Record for API Gateway
resource "aws_route53_record" "api" {
  count = var.api_gateway_regional_endpoint != null ? 1 : 0

  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.api_subdomain
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# Health check for API endpoint
resource "aws_route53_health_check" "api" {
  count             = var.enable_health_checks && var.api_gateway_regional_endpoint != null ? 1 : 0
  fqdn              = var.api_subdomain
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name        = "warmpawz-${var.environment}-api-health-check"
    Environment = var.environment
  }
}

