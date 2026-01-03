# Secrets Module - AWS Secrets Manager for external integrations

# Razorpay Credentials
resource "aws_secretsmanager_secret" "razorpay" {
  name                    = "warmpawz/${var.environment}/razorpay"
  description             = "Razorpay API credentials"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Name        = "warmpawz-${var.environment}-razorpay"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "razorpay" {
  secret_id = aws_secretsmanager_secret.razorpay.id
  secret_string = jsonencode({
    key_id     = var.razorpay_key_id
    key_secret = var.razorpay_key_secret
  })
}

# Google Maps API Key
resource "aws_secretsmanager_secret" "google_maps" {
  name                    = "warmpawz/${var.environment}/google-maps"
  description             = "Google Maps API key"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Name        = "warmpawz-${var.environment}-google-maps"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "google_maps" {
  secret_id = aws_secretsmanager_secret.google_maps.id
  secret_string = jsonencode({
    api_key = var.google_maps_api_key
  })
}

# Shiprocket Credentials
resource "aws_secretsmanager_secret" "shiprocket" {
  name                    = "warmpawz/${var.environment}/shiprocket"
  description             = "Shiprocket API credentials"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Name        = "warmpawz-${var.environment}-shiprocket"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "shiprocket" {
  secret_id = aws_secretsmanager_secret.shiprocket.id
  secret_string = jsonencode({
    email    = var.shiprocket_email
    password = var.shiprocket_password
  })
}

# SNS Platform Application for Push Notifications (Android)
# Note: These are optional and only created if push notifications are enabled
resource "aws_sns_platform_application" "android_customer" {
  count               = var.enable_push_notifications ? 1 : 0
  name                = "warmpawz-${var.environment}-android-customer"
  platform            = "GCM"
  platform_credential = var.fcm_server_key

  tags = {
    Name        = "warmpawz-${var.environment}-android-customer"
    Environment = var.environment
  }
}

resource "aws_sns_platform_application" "android_vendor" {
  count               = var.enable_push_notifications ? 1 : 0
  name                = "warmpawz-${var.environment}-android-vendor"
  platform            = "GCM"
  platform_credential = var.fcm_server_key

  tags = {
    Name        = "warmpawz-${var.environment}-android-vendor"
    Environment = var.environment
  }
}

# SNS Platform Application for Push Notifications (iOS)
resource "aws_sns_platform_application" "ios_customer" {
  count               = var.enable_ios_push ? 1 : 0
  name                = "warmpawz-${var.environment}-ios-customer"
  platform            = var.environment == "prod" ? "APNS" : "APNS_SANDBOX"
  platform_credential = var.apns_private_key
  platform_principal  = var.apns_certificate

  tags = {
    Name        = "warmpawz-${var.environment}-ios-customer"
    Environment = var.environment
  }
}

resource "aws_sns_platform_application" "ios_vendor" {
  count               = var.enable_ios_push ? 1 : 0
  name                = "warmpawz-${var.environment}-ios-vendor"
  platform            = var.environment == "prod" ? "APNS" : "APNS_SANDBOX"
  platform_credential = var.apns_private_key
  platform_principal  = var.apns_certificate

  tags = {
    Name        = "warmpawz-${var.environment}-ios-vendor"
    Environment = var.environment
  }
}
