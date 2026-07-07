# Development Environment Configuration
# Full deployment with frontend apps, mobile support, and custom domains

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }

  backend "s3" {
    bucket         = "warmpawz-terraform-state-057442119249"
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
  # Must match existing HTTP API (see module.api_gateway existing_api_gateway_id) — used for Swagger/OpenAPI Try it out (HTTPS).
  dev_http_api_invoke_url = "https://z0b3obweb6.execute-api.${var.aws_region}.amazonaws.com"
  admin_subdomain    = "dev.admin.warmpawz.com"
  vendor_subdomain   = "dev.vendor.warmpawz.com"
  customer_subdomain = "dev.customer.warmpawz.com"
  
  common_tags = {
    Environment = "dev"
    Project     = "Warmpawz"
  }
  
  # CORS allowed origins including custom domains and CloudFront distributions
  # OFFICIAL CloudFront distributions only (as per infrastructure)
  # Admin: E1WPXL8WBOWOE8 → dfof7mguaa0a5.cloudfront.net
  # Customer: E2RDORGXSWJJ87 → d2aoyjj8ine0wk.cloudfront.net
  # Vendor: E95171GX1I6HN → d1s6ykkj381k58.cloudfront.net
  cors_allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:3003",
    "http://127.0.0.1:5173",
    "https://${local.admin_subdomain}",
    "https://${local.vendor_subdomain}",
    "https://${local.customer_subdomain}",
    # Admin CloudFront (OFFICIAL - E1WPXL8WBOWOE8)
    "https://dfof7mguaa0a5.cloudfront.net",
    # Customer CloudFront (OFFICIAL - E2RDORGXSWJJ87)
    "https://d2aoyjj8ine0wk.cloudfront.net",
    # Vendor CloudFront (OFFICIAL - E95171GX1I6HN)
    "https://d1s6ykkj381k58.cloudfront.net",
  ]

  # Java delivery/logistics ECS + API Gateway split (VPC link → internal ALB)
  delivery_stack_live       = var.enable_delivery_stack && var.delivery_service_image != ""
  delivery_codebuild_live   = local.delivery_stack_live && var.delivery_codebuild_github_url != ""
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
  use_existing_vpc         = true  # CRITICAL: Use existing VPC (VPC limit reached)
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
  min_capacity            = 2.0  # Increased from 1.0 to 2.0 ACU to prevent database pausing and handle more connections
  max_capacity            = 4.0  # Increased from 1.0 to 4.0 ACU to handle traffic bursts
  backup_retention_period = 1  # Free tier allows max 1 day
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

  environment                = local.environment
  razorpay_key_id            = var.razorpay_key_id
  razorpay_key_secret        = var.razorpay_key_secret
  razorpay_x_account_number  = var.razorpay_x_account_number
  google_maps_api_key        = var.google_maps_api_key
  shiprocket_email    = var.shiprocket_email
  shiprocket_password = var.shiprocket_password
}

# Optional: load UAT JWT HMAC from SSM when var.uat_jwt_secret is not in tfvars (no runtime SSM read on Lambda).
data "aws_ssm_parameter" "uat_jwt_secret" {
  count = var.uat_jwt_secret == "" && var.uat_jwt_secret_ssm_parameter != "" ? 1 : 0
  name  = var.uat_jwt_secret_ssm_parameter
}

# Lambda Module
module "lambda" {
  source = "../../modules/lambda"

  environment        = local.environment
  aws_region         = var.aws_region
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  # Enable VPC-based migration runner (Lambda with RDS access)
  enable_migration_runner = true
  rds_secret_arn          = module.rds.secret_arn

  lambda_functions = {
    api-handler = {
      handler                 = "handler.handler"
      runtime                 = "nodejs20.x"
      timeout                 = 60  # Increased from 30s to 60s to handle VPC cold starts and RDS scaling delays
      memory_size             = 1024  # Increased from 512 to reduce cold start time
      provisioned_concurrency = 5    # Increased from 2 to 5 to handle burst traffic and eliminate cold starts
      zip_path                = "${path.module}/../../../backend/lambda/api-handler.zip"
      env_vars                = {
        DB_POOL_MAX = "10"  # Increase connection pool size
      }
    }
  }

  # UAT_MODE=true enables verifyCognitoToken to accept issuer warmpawz-uat (see backend/lambda/src/utils/jwt-verification.ts).
  # Optional UAT_JWT_SECRET when var.uat_jwt_secret is non-empty — must match verify-OTP signing on this same Lambda.
  common_env_vars = merge(
    {
    ENVIRONMENT                 = local.environment
    SETTLEMENT_CALCULATE_CRON_RULE_NAME = "warmpawz-${local.environment}-settlement-calculate-daily"
    ALLOWED_ORIGINS             = join(",", local.cors_allowed_origins)
    # AWS_REGION is reserved by Lambda runtime, cannot be set
    # Lambda functions automatically have AWS_REGION available
    UAT_MODE                    = "true"
    # Skip meal_orders lead_time_hours validation on POST /meal/orders/create (dev testing only; ignored when ENVIRONMENT/STAGE is prod).
    BYPASS_24H_MEAL_VALIDATION  = "true"
    NODE_ENV                    = "development"
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
    AFTERSHIP_SECRET_ARN        = module.secrets.aftership_secret_arn
    API_BASE_URL                = "https://${local.api_subdomain}"
    COGNITO_USER_POOL_ID        = module.cognito.user_pool_id
    COGNITO_CLIENT_ID           = module.cognito.customer_web_client_id
    },
    var.uat_jwt_secret != "" ? { UAT_JWT_SECRET = var.uat_jwt_secret } : (
      length(data.aws_ssm_parameter.uat_jwt_secret) > 0 ? { UAT_JWT_SECRET = data.aws_ssm_parameter.uat_jwt_secret[0].value } : {}
    ),
    # Meal dispatch (Lambda) -> Java delivery-service internal ALB HTTP :80 (see meal-dispatch.ts)
    local.delivery_stack_live ? {
      DELIVERY_SERVICE_BASE_URL = "http://${module.delivery_service_ecs[0].internal_alb_dns_name}"
    } : {},
    { MEAL_DELIVERY_NOTIFY_SECRET = "warmpawz-dev-meal-delivery-notify-2026" },
    {
      DISCOUNT_ENGINE_V2_RESOLVER_MODE    = "AUTHORITATIVE"
      DISCOUNT_ENGINE_V2_PRIORITY_MODE    = "AUTHORITATIVE"
      DISCOUNT_ENGINE_V2_STACK_MODE       = "AUTHORITATIVE"
      DISCOUNT_ENGINE_V2_SETTLEMENT_MODE  = "AUTHORITATIVE"
      DISCOUNT_ENGINE_V2_ANALYTICS_MODE   = "AUTHORITATIVE"
      DISCOUNT_ENGINE_V2_CAMPAIGN_MODE    = "AUTHORITATIVE"
    }
  )

  secrets_arns = concat(
    ["${module.rds.secret_arn}"],
    module.secrets.all_secret_arns
  )
  s3_arns       = ["${module.s3.user_uploads_bucket_arn}/*"]
  dynamodb_arns = [module.dynamodb.sessions_table_arn, module.dynamodb.cache_table_arn]
  sns_arns = [
    module.sns.user_notifications_topic_arn,
    module.sns.booking_updates_topic_arn,
    module.sns.vendor_notifications_topic_arn
  ]
  sqs_arns      = [module.sqs.booking_processing_queue_arn, module.sqs.payment_processing_queue_arn]
  dlq_arn       = module.sqs.dlq_arn
  alarm_actions = [module.sns.system_alerts_topic_arn]
}

# -----------------------------------------------------------------------------
# Delivery / logistics — Java ECS Fargate + internal ALB
# Toggle: enable_delivery_stack + delivery_service_image in tfvars; then terraform apply + scripts/deploy-delivery-service.sh for image updates.
# -----------------------------------------------------------------------------
resource "aws_security_group" "apigw_delivery_vpc_link" {
  count = local.delivery_stack_live ? 1 : 0

  name_prefix = "warmpawz-dev-apigw-dlv-vplnk-"
  description = "API Gateway VPC link ENIs to internal delivery ALB (HTTP)"
  vpc_id      = module.vpc.vpc_id

  egress {
    description = "HTTP to internal ALB in VPC"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr]
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "warmpawz-dev-apigw-delivery-vpc-link"
    Environment = local.environment
  }
}

module "delivery_service_ecs" {
  count  = local.delivery_stack_live ? 1 : 0
  source = "../../modules/delivery-service-ecs"

  environment        = local.environment
  aws_region         = var.aws_region
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  apigw_vpc_link_security_group_ids = [aws_security_group.apigw_delivery_vpc_link[0].id]

  rds_endpoint          = module.rds.cluster_endpoint
  database_name         = module.rds.database_name
  rds_secret_arn        = module.rds.secret_arn
  rds_security_group_id = module.rds.security_group_id

  container_image    = var.delivery_service_image
  public_api_base_url = "https://${local.api_subdomain}"
  openapi_public_server_url = local.dev_http_api_invoke_url
  hibernate_ddl_auto  = var.delivery_hibernate_ddl_auto
  meal_delivery_notify_secret = "warmpawz-dev-meal-delivery-notify-2026"
  cpu                 = 512
  memory              = 1024
}

module "delivery_codebuild" {
  count = local.delivery_codebuild_live ? 1 : 0

  source        = "../../modules/codebuild-delivery-service"
  environment   = local.environment
  aws_region    = var.aws_region

  service_name_slug       = "delivery"
  ecr_repository_name     = module.delivery_service_ecs[0].ecr_repository_name
  ecs_cluster_name        = module.delivery_service_ecs[0].ecs_cluster_name
  ecs_service_name        = module.delivery_service_ecs[0].ecs_service_name
  github_repository_url    = var.delivery_codebuild_github_url
  source_branch           = var.delivery_codebuild_branch_ref
  codestar_connection_arn   = var.delivery_codebuild_codestar_connection_arn
  use_github_codeconnection = var.delivery_codebuild_use_github_codeconnection
}

resource "aws_security_group_rule" "rds_postgres_from_delivery_ecs" {
  count = local.delivery_stack_live ? 1 : 0

  type              = "ingress"
  security_group_id = module.rds.security_group_id
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  source_security_group_id = module.delivery_service_ecs[0].ecs_task_security_group_id
  description              = "delivery-service Fargate to shared dev Postgres (Terraform rule)"
}

# api-handler (VPC Lambda) POSTs meal dispatch to the internal ALB. The ALB SG otherwise only allows
# API Gateway VPC link ENIs — without this rule, Node fetch fails with a generic "fetch failed".
resource "aws_security_group_rule" "delivery_internal_alb_ingress_from_lambda" {
  count = local.delivery_stack_live ? 1 : 0

  type                     = "ingress"
  security_group_id        = module.delivery_service_ecs[0].alb_security_group_id
  from_port                = 80
  to_port                  = 80
  protocol                 = "tcp"
  source_security_group_id = module.lambda.lambda_security_group_id
  description              = "HTTP from API Lambda to internal delivery ALB (meal-dispatch)"
}

# Interface VPC endpoint for Secrets Manager uses a tight SG; Fargate task ENIs must be allowed (private DNS -> VPCE).
data "aws_vpc_endpoint" "secretsmanager" {
  vpc_id       = module.vpc.vpc_id
  service_name = "com.amazonaws.${var.aws_region}.secretsmanager"
}

resource "aws_vpc_security_group_ingress_rule" "secretsmanager_vpce_from_delivery_ecs" {
  for_each = local.delivery_stack_live ? toset(data.aws_vpc_endpoint.secretsmanager.security_group_ids) : toset([])

  security_group_id            = each.value
  referenced_security_group_id = module.delivery_service_ecs[0].ecs_task_security_group_id
  description                  = "delivery-service ECS tasks read RDS secret via Secrets Manager VPCE"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
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
  throttle_burst_limit        = 5000   # Increased to prevent OPTIONS preflight rate limiting
  throttle_rate_limit         = 10000   # Increased to prevent OPTIONS preflight rate limiting
  cognito_user_pool_arn       = module.cognito.user_pool_arn
  cognito_user_pool_id        = module.cognito.user_pool_id
  cognito_user_pool_client_id = module.cognito.customer_web_client_id
  
  # CRITICAL: Reference existing API Gateway (IMMUTABLE - do not create or modify)
  # This API Gateway is LIVE and IN USE - z0b3obweb6
  existing_api_gateway_id     = "z0b3obweb6"

  lambda_integrations = {
    api-handler = {
      invoke_arn    = module.lambda.lambda_function_invoke_arns["api-handler"]
      function_name = module.lambda.lambda_function_names["api-handler"]
      timeout_ms    = 60000  # Increased to match Lambda timeout (60s)
    }
  }

  routes = {
    health = {
      route_key       = "GET /health"
      integration_key = "api-handler"
      require_auth    = false
    }
    # Catch-all route to forward ALL requests to Lambda (Hono handles internal routing)
    proxy = {
      route_key       = "ANY /{proxy+}"
      integration_key = "api-handler"
      require_auth    = false
    }
    # Root path handler
    root = {
      route_key       = "ANY /"
      integration_key = "api-handler"
      require_auth    = false
    }
  }

  # Custom domain configuration
  custom_domain_name = local.api_subdomain
  certificate_arn    = module.acm.regional_validated_certificate_arn
  route53_zone_id    = data.aws_route53_zone.main.zone_id

  alarm_actions = [module.sns.system_alerts_topic_arn]

  delivery_java_integration = local.delivery_stack_live ? {
    vpc_link_subnet_ids         = module.vpc.private_subnet_ids
    vpc_link_security_group_ids = [aws_security_group.apigw_delivery_vpc_link[0].id]
    alb_listener_arn            = module.delivery_service_ecs[0].alb_listener_arn
  } : null
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
  skip_validation      = true  # Certificate already exists and is validated in us-east-1
}

# CloudFront Module (frontend hosting)
module "cloudfront" {
  source = "../../modules/cloudfront"

  environment       = local.environment
  aws_region        = var.aws_region
  # IMPORTANT: Only use certificate if validated (ISSUED state)
  # CloudFront rejects PENDING_VALIDATION certificates
  certificate_arn   = var.skip_cert_validation ? null : module.acm.validated_certificate_arn
  enable_versioning = false
  price_class       = "PriceClass_200"
  alarm_actions     = [module.sns.system_alerts_topic_arn]

  # IMPORTANT: Only set domain if certificate is validated
  # CloudFront requires ISSUED certificate, not PENDING_VALIDATION
  #
  # BROWNFIELD: bucket_name references EXISTING S3 buckets
  # These buckets must be created manually or via deployment scripts BEFORE running Terraform
  # Terraform will NOT create these buckets - it only manages CloudFront and policies
  frontend_apps = {
    admin = {
      bucket_name = "warmpawz-${local.environment}-admin-frontend-${var.aws_region}"
      domain      = var.skip_cert_validation ? null : local.admin_subdomain
      description = "Admin Dashboard"
    }
    vendor = {
      bucket_name = "warmpawz-${local.environment}-vendor-frontend-${var.aws_region}"
      domain      = var.skip_cert_validation ? null : local.vendor_subdomain
      description = "Vendor Portal"
    }
    customer = {
      bucket_name = "warmpawz-${local.environment}-customer-frontend-${var.aws_region}"
      domain      = var.skip_cert_validation ? null : local.customer_subdomain
      description = "Customer App"
    }
  }
}

# Route53 DNS Records
resource "aws_route53_record" "api" {
  count    = var.skip_cert_validation ? 0 : 1
  zone_id  = data.aws_route53_zone.main.zone_id
  name     = local.api_subdomain
  type     = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# Route53 records for CloudFront custom domains
# Only create when certificate is validated (not skipped)
resource "aws_route53_record" "admin" {
  count   = var.skip_cert_validation ? 0 : 1
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
  count   = var.skip_cert_validation ? 0 : 1
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
  count   = var.skip_cert_validation ? 0 : 1
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
# API Gateway Domain Name
# Only create if regional certificate is validated (not skipped)
# If validation is skipped, certificate will be in PENDING_VALIDATION state
# and cannot be used for API Gateway
resource "aws_apigatewayv2_domain_name" "api" {
  count       = var.skip_cert_validation ? 0 : 1
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
  count       = var.skip_cert_validation ? 0 : 1
  api_id      = module.api_gateway.api_id
  domain_name = aws_apigatewayv2_domain_name.api[0].id
  stage       = "$default"
}
