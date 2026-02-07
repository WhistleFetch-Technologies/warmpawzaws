# S3 Module - Object storage for media, static files, and logs

locals {
  is_prod = var.environment == "prod"
}

# S3 Bucket for User Uploads (Profile pictures, documents, etc.)
resource "aws_s3_bucket" "user_uploads" {
  bucket = "warmpawz-${var.environment}-user-uploads-${var.account_id}"

  tags = {
    Name        = "warmpawz-${var.environment}-user-uploads"
    Environment = var.environment
    Purpose     = "user-uploads"
  }

  lifecycle {
    prevent_destroy = true # Prevent accidental deletion (set to false for dev/staging if needed)
    create_before_destroy = true # Ensure no downtime during updates
  }
}

resource "aws_s3_bucket_versioning" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    filter {
      prefix = ""
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}

# S3 Bucket for Static Website Content
resource "aws_s3_bucket" "static_website" {
  bucket = "warmpawz-${var.environment}-static-${var.account_id}"

  tags = {
    Name        = "warmpawz-${var.environment}-static"
    Environment = var.environment
    Purpose     = "static-website"
  }

  lifecycle {
    prevent_destroy = true # Prevent accidental deletion (set to false for dev/staging if needed)
    create_before_destroy = true # Ensure no downtime during updates
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static_website" {
  bucket = aws_s3_bucket.static_website.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "static_website" {
  bucket = aws_s3_bucket.static_website.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "static_website" {
  bucket = aws_s3_bucket.static_website.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }
}

# S3 Bucket for Application Logs
resource "aws_s3_bucket" "logs" {
  bucket = "warmpawz-${var.environment}-logs-${var.account_id}"

  tags = {
    Name        = "warmpawz-${var.environment}-logs"
    Environment = var.environment
    Purpose     = "logs"
  }

  lifecycle {
    prevent_destroy = true # Prevent accidental deletion (set to false for dev/staging if needed)
    create_before_destroy = true # Ensure no downtime during updates
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket = aws_s3_bucket.logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "delete-old-logs"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = var.log_retention_days
    }
  }

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 30
      storage_class = "GLACIER"
    }
  }
}

# S3 Bucket for Backups
resource "aws_s3_bucket" "backups" {
  bucket = "warmpawz-${var.environment}-backups-${var.account_id}"

  tags = {
    Name        = "warmpawz-${var.environment}-backups"
    Environment = var.environment
    Purpose     = "backups"
  }

  lifecycle {
    prevent_destroy = true # Always protect backups
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_id
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket     = aws_s3_bucket.backups.id
  depends_on = [aws_s3_bucket.backups]

  rule {
    id     = "archive-old-backups"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    transition {
      days          = 180  # Must be at least 90 days more than GLACIER (30 + 90 = 120 minimum)
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = max(var.backup_retention_days, 181)  # Must be greater than last transition (180)
    }
  }
}

# CloudWatch Alarms for S3
resource "aws_cloudwatch_metric_alarm" "s3_4xx_errors" {
  for_each = {
    user_uploads = aws_s3_bucket.user_uploads.id
    static       = aws_s3_bucket.static_website.id
  }

  alarm_name          = "warmpawz-${var.environment}-s3-${each.key}-4xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "4xxErrors"
  namespace           = "AWS/S3"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "S3 4XX error rate is high for ${each.key}"
  alarm_actions       = var.alarm_actions

  dimensions = {
    BucketName = each.value
  }

  tags = {
    Name        = "warmpawz-${var.environment}-s3-${each.key}-4xx-alarm"
    Environment = var.environment
  }
}

