# CloudFront Module - Static website hosting for frontend apps
#
# ARCHITECTURE DECISION: BROWNFIELD-SAFE S3 BUCKET HANDLING
#
# This module assumes S3 buckets ALREADY EXIST and are managed outside Terraform.
# Buckets are created manually or via CI/CD deployment scripts.
#
# WHY:
# - Prevents "BucketAlreadyOwnedByYou" errors on repeated deploys
# - Allows independent bucket lifecycle management
# - Makes Terraform fully idempotent (can run apply repeatedly)
# - Separates storage infrastructure from CDN infrastructure
#
# TERRAFORM MANAGES:
# ✅ CloudFront distributions
# ✅ Origin Access Control (OAC)
# ✅ Bucket policies (for CloudFront access)
# ✅ Public access blocks
# ✅ CloudWatch alarms
#
# EXTERNAL (NOT MANAGED):
# ❌ S3 bucket creation/deletion
# ❌ Bucket lifecycle rules
# ❌ Bucket contents

# Reference existing S3 buckets (BROWNFIELD - buckets must already exist)
data "aws_s3_bucket" "frontend" {
  for_each = var.frontend_apps

  # Bucket names are passed as input (see variables.tf)
  bucket = each.value.bucket_name
}

# Manage bucket versioning (optional - only if buckets support it)
resource "aws_s3_bucket_versioning" "frontend" {
  for_each = var.enable_versioning ? var.frontend_apps : {}
  bucket   = data.aws_s3_bucket.frontend[each.key].id

  versioning_configuration {
    status = "Enabled"
  }
}

# Manage public access block (CRITICAL for security)
resource "aws_s3_bucket_public_access_block" "frontend" {
  for_each = var.frontend_apps
  bucket   = data.aws_s3_bucket.frontend[each.key].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "frontend" {
  for_each = var.frontend_apps

  name                              = "warmpawz-${var.environment}-${each.key}-oac"
  description                       = "OAC for ${each.key} frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 bucket policy to allow CloudFront access (Terraform-managed)
# IMPORTANT: This policy allows CloudFront to read from the bucket via OAC
resource "aws_s3_bucket_policy" "frontend" {
  for_each = var.frontend_apps
  bucket   = data.aws_s3_bucket.frontend[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${data.aws_s3_bucket.frontend[each.key].arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend[each.key].arn
          }
        }
      }
    ]
  })
}

# CloudFront Function: URL Rewrite for Next.js Static Export
# Rewrites /ecommerce to /ecommerce.html, /catalog to /catalog.html, etc.
resource "aws_cloudfront_function" "url_rewrite" {
  for_each = var.frontend_apps

  name    = "warmpawz-${var.environment}-${each.key}-url-rewrite"
  runtime = "cloudfront-js-1.0"
  comment = "URL rewrite function for ${each.key} - adds .html extension for Next.js static export"
  publish = true
  code    = file("${path.module}/url-rewrite-function.js")
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "frontend" {
  for_each = var.frontend_apps

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = var.price_class
  aliases             = each.value.domain != null ? [each.value.domain] : []

  origin {
    # Reference existing S3 bucket (brownfield)
    domain_name              = data.aws_s3_bucket.frontend[each.key].bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend[each.key].id
    origin_id                = "S3-${each.key}"
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${each.key}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
    
    # CloudFront Function for URL rewriting (Next.js static export)
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.url_rewrite[each.key].arn
    }
  }

  # Handle SPA routing - return index.html for 404s
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn            = each.value.domain != null ? var.certificate_arn : null
    cloudfront_default_certificate = each.value.domain == null
    ssl_support_method             = each.value.domain != null ? "sni-only" : null
    minimum_protocol_version       = each.value.domain != null ? "TLSv1.2_2021" : null
  }

  tags = {
    Name        = "warmpawz-${var.environment}-${each.key}-cdn"
    Environment = var.environment
    App         = each.key
  }
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "cloudfront_error_rate" {
  for_each = var.frontend_apps

  alarm_name          = "warmpawz-${var.environment}-${each.key}-cdn-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "5"
  alarm_description   = "CloudFront 5xx error rate for ${each.key}"
  alarm_actions       = var.alarm_actions

  dimensions = {
    DistributionId = aws_cloudfront_distribution.frontend[each.key].id
    Region         = "Global"
  }

  tags = {
    Name        = "warmpawz-${var.environment}-${each.key}-cdn-errors"
    Environment = var.environment
  }
}

