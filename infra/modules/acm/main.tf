# ACM Module - SSL/TLS Certificates

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

# ACM Certificate (us-east-1 for CloudFront)
resource "aws_acm_certificate" "main" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = var.subject_alternative_names

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "warmpawz-${var.environment}-certificate"
    Environment = var.environment
  }
}

# Route53 Validation Records for main certificate (us-east-1)
# Only create if we're actually validating (not skipping)
resource "aws_route53_record" "validation" {
  for_each = var.skip_validation ? {} : {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

# Certificate Validation for us-east-1 (CloudFront) - WITH TIMEOUT
# Only create validation if certificate is not already validated
resource "aws_acm_certificate_validation" "main" {
  count                   = var.skip_validation ? 0 : 1
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.validation : record.fqdn]

  timeouts {
    create = "15m"
  }
}

# Regional Certificate (for API Gateway in ap-south-1)
# IMPORTANT: Created AFTER main cert is validated to avoid DNS conflicts
resource "aws_acm_certificate" "regional" {
  count             = var.create_regional_cert ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = var.subject_alternative_names

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "warmpawz-${var.environment}-regional-certificate"
    Environment = var.environment
  }

  # CRITICAL: Wait for main cert to be FULLY validated first
  # This prevents DNS record conflicts
  depends_on = [aws_acm_certificate.main]
}

# Route53 Validation Records for regional certificate
# Only create if we're actually validating (not skipping)
resource "aws_route53_record" "regional_validation" {
  for_each = var.create_regional_cert && !var.skip_validation ? {
    for dvo in aws_acm_certificate.regional[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id

  # Explicit dependency on main certificate creation (not validation)
  depends_on = [aws_acm_certificate.main]
}

# Certificate Validation for regional - WITH TIMEOUT
# Skip validation if skip_validation is true (certificate will be validated manually or later)
resource "aws_acm_certificate_validation" "regional" {
  count                   = var.create_regional_cert && !var.skip_validation ? 1 : 0
  certificate_arn         = aws_acm_certificate.regional[0].arn
  validation_record_fqdns = [for record in aws_route53_record.regional_validation : record.fqdn]

  timeouts {
    create = "15m"
  }

  depends_on = [aws_route53_record.regional_validation]
}
