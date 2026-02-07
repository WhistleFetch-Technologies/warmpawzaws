# Cognito Module - User authentication and authorization

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "warmpawz-${var.environment}-users"

  # Username configuration
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # User attributes
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "phone_number"
    attribute_data_type = "String"
    required            = false
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # Custom attributes for user type
  schema {
    name                = "user_type"
    attribute_data_type = "String"
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # MFA configuration
  mfa_configuration = var.mfa_configuration

  dynamic "software_token_mfa_configuration" {
    for_each = var.mfa_configuration != "OFF" ? [1] : []
    content {
      enabled = true
    }
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration
  email_configuration {
    email_sending_account = var.ses_email_identity != null ? "DEVELOPER" : "COGNITO_DEFAULT"
    source_arn            = var.ses_email_identity
    from_email_address    = var.from_email_address
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = var.advanced_security_mode
  }

  # Lambda triggers
  dynamic "lambda_config" {
    for_each = var.lambda_triggers != null ? [var.lambda_triggers] : []
    content {
      pre_sign_up          = lookup(lambda_config.value, "pre_sign_up", null)
      post_confirmation    = lookup(lambda_config.value, "post_confirmation", null)
      pre_authentication   = lookup(lambda_config.value, "pre_authentication", null)
      post_authentication  = lookup(lambda_config.value, "post_authentication", null)
      custom_message       = lookup(lambda_config.value, "custom_message", null)
      pre_token_generation = lookup(lambda_config.value, "pre_token_generation", null)
      user_migration       = lookup(lambda_config.value, "user_migration", null)
    }
  }

  # Device tracking
  device_configuration {
    challenge_required_on_new_device      = true
    device_only_remembered_on_user_prompt = true
  }

  tags = {
    Name        = "warmpawz-${var.environment}-user-pool"
    Environment = var.environment
  }

  lifecycle {
    prevent_destroy = false # Set to true after first deployment in prod
  }
}

# Cognito User Pool Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "warmpawz-${var.environment}-${random_string.domain_suffix.result}"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "random_string" "domain_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Cognito User Pool Clients
resource "aws_cognito_user_pool_client" "customer_web" {
  name         = "customer-web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret        = false
  refresh_token_validity = 30
  access_token_validity  = 60
  id_token_validity      = 60
  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = var.customer_callback_urls
  logout_urls                          = var.customer_logout_urls
  supported_identity_providers         = ["COGNITO"]

  read_attributes = [
    "email",
    "email_verified",
    "name",
    "phone_number",
    "custom:user_type"
  ]

  write_attributes = [
    "email",
    "name",
    "phone_number"
  ]

  prevent_user_existence_errors = "ENABLED"

  lifecycle {
    ignore_changes = [
      allowed_oauth_flows_user_pool_client,
      allowed_oauth_flows,
      allowed_oauth_scopes,
      enable_token_revocation
    ]
  }
}

resource "aws_cognito_user_pool_client" "vendor_web" {
  name         = "vendor-web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret        = false
  refresh_token_validity = 30
  access_token_validity  = 60
  id_token_validity      = 60
  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = var.vendor_callback_urls
  logout_urls                          = var.vendor_logout_urls
  supported_identity_providers         = ["COGNITO"]

  read_attributes = [
    "email",
    "email_verified",
    "name",
    "phone_number",
    "custom:user_type"
  ]

  write_attributes = [
    "email",
    "name",
    "phone_number"
  ]

  prevent_user_existence_errors = "ENABLED"

  lifecycle {
    ignore_changes = [
      allowed_oauth_flows_user_pool_client,
      allowed_oauth_flows,
      allowed_oauth_scopes,
      enable_token_revocation
    ]
  }
}

resource "aws_cognito_user_pool_client" "admin_web" {
  name         = "admin-web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret        = false
  refresh_token_validity = 7
  access_token_validity  = 60
  id_token_validity      = 60
  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = var.admin_callback_urls
  logout_urls                          = var.admin_logout_urls
  supported_identity_providers         = ["COGNITO"]

  read_attributes = [
    "email",
    "email_verified",
    "name",
    "phone_number",
    "custom:user_type"
  ]

  write_attributes = [
    "email",
    "name",
    "phone_number"
  ]

  prevent_user_existence_errors = "ENABLED"

  lifecycle {
    ignore_changes = [
      allowed_oauth_flows_user_pool_client,
      allowed_oauth_flows,
      allowed_oauth_scopes,
      enable_token_revocation
    ]
  }
}

resource "aws_cognito_user_pool_client" "mobile_customer" {
  name         = "mobile-customer"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret        = false
  refresh_token_validity = 30
  access_token_validity  = 60
  id_token_validity      = 60
  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  read_attributes = [
    "email",
    "email_verified",
    "name",
    "phone_number",
    "custom:user_type"
  ]

  write_attributes = [
    "email",
    "name",
    "phone_number"
  ]

  prevent_user_existence_errors = "ENABLED"

  lifecycle {
    ignore_changes = [
      callback_urls,
      logout_urls,
      allowed_oauth_flows_user_pool_client,
      allowed_oauth_flows,
      allowed_oauth_scopes,
      enable_token_revocation
    ]
  }
}

resource "aws_cognito_user_pool_client" "mobile_vendor" {
  name         = "mobile-vendor"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret        = false
  refresh_token_validity = 30
  access_token_validity  = 60
  id_token_validity      = 60
  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  read_attributes = [
    "email",
    "email_verified",
    "name",
    "phone_number",
    "custom:user_type"
  ]

  write_attributes = [
    "email",
    "name",
    "phone_number"
  ]

  prevent_user_existence_errors = "ENABLED"

  lifecycle {
    ignore_changes = [
      callback_urls,
      logout_urls,
      allowed_oauth_flows_user_pool_client,
      allowed_oauth_flows,
      allowed_oauth_scopes,
      enable_token_revocation
    ]
  }
}

# Cognito Identity Pool (for AWS credentials)
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "warmpawz_${var.environment}_identity_pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.customer_web.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.vendor_web.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.mobile_customer.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.mobile_vendor.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  tags = {
    Name        = "warmpawz-${var.environment}-identity-pool"
    Environment = var.environment
  }
}

# IAM Role for authenticated users
resource "aws_iam_role" "authenticated" {
  name_prefix = "warmpawz-${var.environment}-cognito-auth-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "warmpawz-${var.environment}-cognito-auth-role"
    Environment = var.environment
  }
}

# IAM Policy for authenticated users
resource "aws_iam_role_policy" "authenticated" {
  name_prefix = "warmpawz-${var.environment}-cognito-auth-policy-"
  role        = aws_iam_role.authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${var.user_uploads_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = "${var.api_execution_arn}/*"
      }
    ]
  })
}

# Attach role to identity pool
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    authenticated = aws_iam_role.authenticated.arn
  }
}

