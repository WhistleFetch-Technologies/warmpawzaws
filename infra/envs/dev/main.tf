# Development Environment Configuration
# Full deployment with frontend apps, mobile support, and custom domains

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "warmpawz-terraform-state-023394150666"
    key            = "dev/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "warmpawz-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Warmpawz"
      Environment = "dev"
      ManagedBy   = "terraform"
      Repository  = "warmpawzecodev"
    }
  }
}

# Provider for us-east-1 (required for CloudFront ACM certificates)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "Warmpawz"
      Environment = "dev"
      ManagedBy   = "terraform"
      Repository  = "warmpawzecodev"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Route53 Hosted Zone (already exists for warmpawz.com)
data "aws_route53_zone" "main" {
  name         = "warmpawz.com"
  private_zone = false
}

# Local variables
locals {
  environment = "dev"
  domain_name = "warmpawz.com"
  
  # Domain configuration for dev environment
  api_subdomain      = "dev.api.warmpawz.com"
  admin_subdomain    = "dev.admin.warmpawz.com"
  vendor_subdomain   = "dev.vendor.warmpawz.com"
  customer_subdomain = "dev.customer.warmpawz.com"
  
  common_tags = {
    Environment = "dev"
    Project     = "Warmpawz"
  }
  
  # CORS allowed origins including custom domains
  cors_allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://${local.admin_subdomain}",
    "https://${local.vendor_subdomain}",
    "https://${local.customer_subdomain}"
  ]
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  environment              = local.environment
  aws_region               = var.aws_region
  vpc_cidr                 = "10.0.0.0/16"
  public_subnet_cidrs      = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs     = ["10.0.11.0/24", "10.0.12.0/24"]
  database_subnet_cidrs    = ["10.0.21.0/24", "10.0.22.0/24"]
  enable_nat_gateway       = true
  single_nat_gateway       = true
  create_private_endpoints = false
  use_existing_vpc         = false
}

# SNS Module (for alarms and push notifications)
module "sns" {
  source = "../../modules/sns"

  environment  = local.environment
  alert_emails = var.alert_emails
}

# RDS Module
module "rds" {
  source = "../../modules/rds"

  environment             = local.environment
  vpc_id                  = module.vpc.vpc_id
  database_subnet_ids     = module.vpc.database_subnet_ids
  allowed_security_groups = [module.lambda.lambda_security_group_id]
  database_name           = "warmpawz"
  master_username         = "warmpawz_admin"
  min_capacity            = 0.5
  max_capacity            = 1.0
  backup_retention_period = 3
  availability_zones      = slice(module.vpc.availability_zones, 0, 2)
  deletion_protection     = false
  skip_final_snapshot     = true
  instance_count          = 1
  alarm_actions           = [module.sns.system_alerts_topic_arn]
}

# DynamoDB Module
module "dynamodb" {
  source = "../../modules/dynamodb"

  environment   = local.environment
  billing_mode  = "PAY_PER_REQUEST"
  enable_pitr   = false
  alarm_actions = [module.sns.system_alerts_topic_arn]
}

# S3 Module
module "s3" {
  source = "../../modules/s3"

  environment           = local.environment
  account_id            = data.aws_caller_identity.current.account_id
  enable_versioning     = false
  cors_allowed_origins  = local.cors_allowed_origins
  log_retention_days    = 30
  backup_retention_days = 90
  alarm_actions         = [module.sns.system_alerts_topic_arn]
}

# SQS Module
module "sqs" {
  source = "../../modules/sqs"

  environment         = local.environment
  age_alarm_threshold = 600
  alarm_actions       = [module.sns.system_alerts_topic_arn]
}

# Secrets Module (external integrations)
module "secrets" {
  source = "../../modules/secrets"

  environment         = local.environment
  razorpay_key_id     = var.razorpay_key_id
  razorpay_key_secret = var.razorpay_key_secret
  google_maps_api_key = var.google_maps_api_key
  shiprocket_email    = var.shiprocket_email
  shiprocket_password = var.shiprocket_password
}

# Lambda Module
module "lambda" {
  source = "../../modules/lambda"

  environment        = local.environment
  aws_region         = var.aws_region
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  lambda_functions = {
    api-handler = {
      handler     = "index.handler"
      runtime     = "nodejs20.x"
      timeout     = 30
      memory_size = 512
      zip_path    = "${path.module}/../../../backend/lambda/api-handler.zip"
      env_vars    = {}
    }
  }

  common_env_vars = {
    ENVIRONMENT                 = local.environment
    DB_HOST                     = module.rds.cluster_endpoint
    DB_NAME                     = module.rds.database_name
    DB_SECRET_ARN               = module.rds.secret_arn
    DYNAMODB_SESSIONS_TABLE     = module.dynamodb.sessions_table_name
    DYNAMODB_CACHE_TABLE        = module.dynamodb.cache_table_name
    S3_UPLOADS_BUCKET           = module.s3.user_uploads_bucket_name
    SQS_BOOKING_QUEUE_URL       = module.sqs.booking_processing_queue_url
    SQS_PAYMENT_QUEUE_URL       = module.sqs.payment_processing_queue_url
    SNS_NOTIFICATIONS_TOPIC_ARN = module.sns.user_notifications_topic_arn
    SNS_BOOKING_UPDATES_ARN     = module.sns.booking_updates_topic_arn
    SNS_VENDOR_TOPIC_ARN        = module.sns.vendor_notifications_topic_arn
    RAZORPAY_SECRET_ARN         = module.secrets.razorpay_secret_arn
    GOOGLE_MAPS_SECRET_ARN      = module.secrets.google_maps_secret_arn
    SHIPROCKET_SECRET_ARN       = module.secrets.shiprocket_secret_arn
    SNS_ANDROID_CUSTOMER_ARN    = module.secrets.sns_android_customer_arn
    SNS_ANDROID_VENDOR_ARN      = module.secrets.sns_android_vendor_arn
    API_BASE_URL                = "https://${local.api_subdomain}"
    COGNITO_USER_POOL_ID        = module.cognito.user_pool_id
    COGNITO_CLIENT_ID           = module.cognito.customer_web_client_id
  }

  secrets_arns = concat(
    ["${module.rds.secret_arn}"],
    module.secrets.all_secret_arns
  )
  s3_arns       = ["${module.s3.user_uploads_bucket_arn}/*"]
  dynamodb_arns = [module.dynamodb.sessions_table_arn, module.dynamodb.cache_table_arn]
  sns_arns = [
    module.sns.user_notifications_topic_arn,
    module.sns.booking_updates_topic_arn,
    module.sns.vendor_notifications_topic_arn,
    module.secrets.sns_android_customer_arn,
    module.secrets.sns_android_vendor_arn
  ]
  sqs_arns      = [module.sqs.booking_processing_queue_arn, module.sqs.payment_processing_queue_arn]
  dlq_arn       = module.sqs.dlq_arn
  alarm_actions = [module.sns.system_alerts_topic_arn]
}

# Cognito Module
module "cognito" {
  source = "../../modules/cognito"

  environment             = local.environment
  mfa_configuration       = "OFF"
  advanced_security_mode  = "AUDIT"
  customer_callback_urls  = ["http://localhost:3000/callback", "https://${local.customer_subdomain}/callback"]
  customer_logout_urls    = ["http://localhost:3000/logout", "https://${local.customer_subdomain}/logout"]
  vendor_callback_urls    = ["http://localhost:3001/callback", "https://${local.vendor_subdomain}/callback"]
  vendor_logout_urls      = ["http://localhost:3001/logout", "https://${local.vendor_subdomain}/logout"]
  admin_callback_urls     = ["http://localhost:3002/callback", "https://${local.admin_subdomain}/callback"]
  admin_logout_urls       = ["http://localhost:3002/logout", "https://${local.admin_subdomain}/logout"]
  user_uploads_bucket_arn = module.s3.user_uploads_bucket_arn
  api_execution_arn       = module.api_gateway.api_execution_arn
}

# API Gateway Module
module "api_gateway" {
  source = "../../modules/api-gateway"

  environment                 = local.environment
  aws_region                  = var.aws_region
  stage_name                  = "$default"
  auto_deploy                 = true
  cors_allowed_origins        = local.cors_allowed_origins
  throttle_burst_limit        = 100
  throttle_rate_limit         = 50
  cognito_user_pool_arn       = module.cognito.user_pool_arn
  cognito_user_pool_id        = module.cognito.user_pool_id
  cognito_user_pool_client_id = module.cognito.customer_web_client_id

  lambda_integrations = {
    api-handler = {
      invoke_arn    = module.lambda.lambda_function_invoke_arns["api-handler"]
      function_name = module.lambda.lambda_function_names["api-handler"]
      timeout_ms    = 30000
    }
  }

  routes = {
    health = {
      route_key       = "GET /health"
      integration_key = "api-handler"
      require_auth    = false
    }
  }

  alarm_actions = [module.sns.system_alerts_topic_arn]
}

# ACM Certificate Module (for custom domains)
module "acm" {
  source = "../../modules/acm"
  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  environment     = local.environment
  domain_name     = "*.warmpawz.com"
  route53_zone_id = data.aws_route53_zone.main.zone_id
  subject_alternative_names = [
    "warmpawz.com",
    "dev.api.warmpawz.com",
    "dev.admin.warmpawz.com",
    "dev.vendor.warmpawz.com",
    "dev.customer.warmpawz.com"
  ]
  create_regional_cert = true
}

# CloudFront Module (frontend hosting)
module "cloudfront" {
  source = "../../modules/cloudfront"

  environment       = local.environment
  certificate_arn   = module.acm.validated_certificate_arn
  enable_versioning = false
  price_class       = "PriceClass_200"
  alarm_actions     = [module.sns.system_alerts_topic_arn]

  frontend_apps = {
    admin = {
      domain      = local.admin_subdomain
      description = "Admin Dashboard"
    }
    vendor = {
      domain      = local.vendor_subdomain
      description = "Vendor Portal"
    }
    customer = {
      domain      = local.customer_subdomain
      description = "Customer App"
    }
  }
}

# Route53 DNS Records
resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.api_subdomain
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "admin" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.admin_subdomain
  type    = "A"

  alias {
    name                   = module.cloudfront.distributions["admin"].domain_name
    zone_id                = module.cloudfront.distributions["admin"].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "vendor" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.vendor_subdomain
  type    = "A"

  alias {
    name                   = module.cloudfront.distributions["vendor"].domain_name
    zone_id                = module.cloudfront.distributions["vendor"].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "customer" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.customer_subdomain
  type    = "A"

  alias {
    name                   = module.cloudfront.distributions["customer"].domain_name
    zone_id                = module.cloudfront.distributions["customer"].hosted_zone_id
    evaluate_target_health = false
  }
}

# API Gateway Custom Domain
resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = local.api_subdomain

  domain_name_configuration {
    certificate_arn = module.acm.regional_validated_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = {
    Name        = "warmpawz-${local.environment}-api-domain"
    Environment = local.environment
  }
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = module.api_gateway.api_id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = "$default"
}

# OpenSearch Module (Elasticsearch - using AWS OpenSearch which is the managed Elasticsearch service)
module "opensearch" {
  source = "../../modules/opensearch"
  count  = var.enable_opensearch ? 1 : 0

  environment                = local.environment
  vpc_id                     = module.vpc.vpc_id
  vpc_cidr                   = "10.0.0.0/16"
  private_subnet_ids         = module.vpc.private_subnet_ids
  allowed_security_groups    = [module.lambda.lambda_security_group_id]
  instance_type              = "t3.small.search"
  instance_count             = 1
  dedicated_master_enabled   = false
  zone_awareness_enabled     = false
  volume_size                = 10
  master_user_password       = var.opensearch_master_password
  create_service_linked_role = false
  alarm_actions              = [module.sns.system_alerts_topic_arn]
}
