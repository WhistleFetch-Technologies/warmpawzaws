# Production Environment Configuration
# Same AWS account as dev (057442119249); same pipeline credentials (dev deployment pipeline).
# Prod has its own VPC (10.2.0.0/16) with one NAT gateway for all private traffic.

terraform {
  backend "s3" {
    bucket         = "warmpawz-terraform-state-057442119249"
    key            = "prod/terraform.tfstate"
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
      Environment = "prod"
      ManagedBy   = "terraform"
      Repository  = "warmpawzecodev"
      CostCenter  = "Production"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  environment = "prod"
  common_tags = {
    Environment = "prod"
    Project     = "Warmpawz"
    Critical    = "true"
  }
  # Prod custom domains + CloudFront URLs (CloudFront URLs added after module exists)
  cors_prod_domains = ["https://admin.warmpawz.com", "https://vendor.warmpawz.com", "https://customer.warmpawz.com", "https://www.warmpawz.com"]
  cors_allowed_origins = concat(
    local.cors_prod_domains,
    [for k, v in module.cloudfront.distributions : "https://${v.domain_name}"]
  )

  prod_http_api_invoke_url = "https://mss9sa4y01.execute-api.${var.aws_region}.amazonaws.com"
  delivery_stack_live      = var.enable_delivery_stack && var.delivery_service_image != ""
  delivery_codebuild_live  = local.delivery_stack_live && var.delivery_codebuild_github_url != ""
  # ISSUED *.warmpawz.com (us-east-1) — keep set so Terraform never strips custom-domain TLS on CloudFront
  prod_cloudfront_cert_arn = coalesce(
    var.prod_cloudfront_certificate_arn,
    "arn:aws:acm:us-east-1:057442119249:certificate/02b216e5-4696-409a-b595-a4d0f5b6b04b"
  )
  # Shared dev VPC (vpc-02a4893e5e582c4d8): private subnets are tagged Environment=dev — same as prod Lambda
  prod_private_subnet_ids = length(module.vpc.private_subnet_ids) >= 2 ? module.vpc.private_subnet_ids : [
    "subnet-0fcae82d307f494c5",
    "subnet-0351dcfcb7fddfc5d",
  ]
}

# VPC Module - Use existing VPC, subnets, SGs. Use existing_nat_gateway_id if NAT was created via CLI (see scripts/create-prod-nat-gateway.sh).
# Set existing_vpc_id to the VPC that contains Lambda to fix "different networks" (RDS SG + Lambda SG must be in same VPC).
module "vpc" {
  source = "../../modules/vpc"

  environment                        = local.environment
  aws_region                         = var.aws_region
  vpc_cidr                           = "10.2.0.0/16"
  public_subnet_cidrs                = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
  private_subnet_cidrs               = ["10.2.11.0/24", "10.2.12.0/24", "10.2.13.0/24"]
  database_subnet_cidrs              = ["10.2.21.0/24", "10.2.22.0/24", "10.2.23.0/24"]
  enable_nat_gateway                 = true
  single_nat_gateway                 = true
  create_private_endpoints           = true
  use_existing_vpc                   = true
  create_nat_gateway_in_existing_vpc = true
  existing_vpc_id                    = var.existing_vpc_id
  existing_nat_gateway_id            = var.existing_nat_gateway_id
}

module "sns" {
  source = "../../modules/sns"

  environment  = local.environment
  alert_emails = var.alert_emails
}

# Secrets Module - Same structure as dev; update values in Secrets Manager after deploy
module "secrets" {
  source = "../../modules/secrets"

  environment               = local.environment
  razorpay_key_id           = var.razorpay_key_id
  razorpay_key_secret       = var.razorpay_key_secret
  razorpay_x_account_number = var.razorpay_x_account_number
  google_maps_api_key       = var.google_maps_api_key
  shiprocket_email          = var.shiprocket_email
  shiprocket_password      = var.shiprocket_password
  enable_push_notifications = var.enable_push_notifications
  enable_ios_push           = var.enable_ios_push
  fcm_server_key            = var.fcm_server_key
  apns_certificate          = var.apns_certificate
  apns_private_key          = var.apns_private_key
}

module "rds" {
  source = "../../modules/rds"

  environment                     = local.environment
  vpc_id                          = module.vpc.vpc_id
  database_subnet_ids             = module.vpc.database_subnet_ids
  use_existing_subnet_group_vpc   = false # Use dev VPC subnets for everything (RDS, Proxy, Lambda all in same VPC)
  allowed_security_groups         = [module.lambda.lambda_security_group_id]
  database_name                   = "warmpawz"
  master_username                 = "warmpawz_admin"
  min_capacity                    = 2.0
  max_capacity                    = 16.0
  backup_retention_period         = 30
  availability_zones             = module.vpc.availability_zones
  deletion_protection             = true
  skip_final_snapshot             = false
  instance_count                  = 1 # Single instance for prod
  performance_insights_enabled   = true
  auto_minor_version_upgrade      = false # Manual control in prod
  alarm_actions                   = [module.sns.system_alerts_topic_arn]
}

module "dynamodb" {
  source = "../../modules/dynamodb"

  environment   = local.environment
  billing_mode  = "PAY_PER_REQUEST"
  enable_pitr   = true
  alarm_actions = [module.sns.system_alerts_topic_arn]
}

module "s3" {
  source = "../../modules/s3"

  environment           = local.environment
  account_id            = data.aws_caller_identity.current.account_id
  enable_versioning     = true
  cors_allowed_origins  = local.cors_allowed_origins
  log_retention_days    = 365
  backup_retention_days = 2555 # 7 years for compliance
  alarm_actions         = [module.sns.system_alerts_topic_arn]
}

# ---------------------------------------------------------------------------
# Prod frontend S3 buckets (admin, vendor, customer) - for CloudFront only
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "prod_frontend" {
  for_each = toset(["admin", "vendor", "customer"])
  bucket   = "warmpawz-prod-${each.key}-frontend-${var.aws_region}"

  tags = merge(local.common_tags, {
    Name = "warmpawz-prod-${each.key}-frontend"
    App  = each.key
  })
}

resource "aws_s3_bucket_versioning" "prod_frontend" {
  for_each = aws_s3_bucket.prod_frontend

  bucket = each.value.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "prod_frontend" {
  for_each = aws_s3_bucket.prod_frontend

  bucket = each.value.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront - three prod URLs for admin, vendor, customer (apart from dev)
module "cloudfront" {
  source = "../../modules/cloudfront"

  environment       = local.environment
  aws_region        = var.aws_region
  certificate_arn   = local.prod_cloudfront_cert_arn
  enable_versioning = true
  price_class       = "PriceClass_200"
  alarm_actions     = [module.sns.system_alerts_topic_arn]

  frontend_apps = {
    admin = {
      bucket_name = aws_s3_bucket.prod_frontend["admin"].id
      domain      = "admin.warmpawz.com"
      description = "Admin Dashboard (prod)"
    }
    vendor = {
      bucket_name = aws_s3_bucket.prod_frontend["vendor"].id
      domain      = "vendor.warmpawz.com"
      description = "Vendor Portal (prod)"
    }
    customer = {
      bucket_name = aws_s3_bucket.prod_frontend["customer"].id
      domain      = "customer.warmpawz.com"
      description = "Customer App (prod)"
    }
  }
}

module "sqs" {
  source = "../../modules/sqs"

  environment         = local.environment
  age_alarm_threshold = 180
  alarm_actions       = [module.sns.system_alerts_topic_arn]
}

module "lambda" {
  source = "../../modules/lambda"

  environment        = local.environment
  aws_region         = var.aws_region
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  lambda_functions = {
    api-handler = {
      handler              = "handler.handler"
      runtime              = "nodejs20.x"
      timeout              = 30
      memory_size          = 2048
      zip_path             = "${path.module}/../../../backend/lambda/api-handler.zip"
      env_vars             = {}
      reserved_concurrency = 100 # Prevent runaway costs
    }
  }

  common_env_vars = merge(
    {
      UAT_MODE                            = "false"
      ENVIRONMENT                         = local.environment
      ALLOWED_ORIGINS                     = join(",", local.cors_allowed_origins)
      SETTLEMENT_CALCULATE_CRON_RULE_NAME = "warmpawz-${local.environment}-settlement-calculate-daily"
      DB_HOST                             = module.rds.proxy_endpoint
      DB_READER_HOST                      = module.rds.proxy_endpoint
      DB_NAME                             = module.rds.database_name
      DB_SECRET_ARN                       = module.rds.secret_arn
      DYNAMODB_SESSIONS_TABLE             = module.dynamodb.sessions_table_name
      DYNAMODB_CACHE_TABLE                = module.dynamodb.cache_table_name
      S3_UPLOADS_BUCKET                   = module.s3.user_uploads_bucket_name
      SQS_BOOKING_QUEUE_URL               = module.sqs.booking_processing_queue_url
      SQS_PAYMENT_QUEUE_URL               = module.sqs.payment_processing_queue_url
      SQS_NOTIFICATION_QUEUE_URL          = module.sqs.notification_delivery_queue_url
      SNS_NOTIFICATIONS_TOPIC_ARN         = module.sns.user_notifications_topic_arn
      SNS_BOOKING_TOPIC_ARN               = module.sns.booking_updates_topic_arn
      SNS_PAYMENT_TOPIC_ARN               = module.sns.payment_events_topic_arn
      RAZORPAY_SECRET_ARN                 = module.secrets.razorpay_secret_arn
      GOOGLE_MAPS_SECRET_ARN              = module.secrets.google_maps_secret_arn
      SHIPROCKET_SECRET_ARN               = module.secrets.shiprocket_secret_arn
      AFTERSHIP_SECRET_ARN                = module.secrets.aftership_secret_arn
    },
    local.delivery_stack_live ? {
      DELIVERY_SERVICE_BASE_URL = "http://${module.delivery_service_ecs[0].internal_alb_dns_name}"
    } : {},
    var.meal_delivery_notify_secret != "" ? {
      MEAL_DELIVERY_NOTIFY_SECRET = var.meal_delivery_notify_secret
    } : {},
    # Commercial Engine V2 — prod ON (AUTHORITATIVE). Flip via Terraform; keep Lambda in sync via
    # scripts/apply-prod-discount-engine-env.js after deploys that don't run Terraform apply.
    {
      DISCOUNT_ENGINE_V2_RESOLVER_MODE    = "AUTHORITATIVE"
      DISCOUNT_ENGINE_V2_PRIORITY_MODE    = "AUTHORITATIVE"
      DISCOUNT_ENGINE_V2_STACK_MODE       = "AUTHORITATIVE"
      DISCOUNT_ENGINE_V2_SETTLEMENT_MODE  = "AUTHORITATIVE"
      DISCOUNT_ENGINE_V2_ANALYTICS_MODE   = "AUTHORITATIVE"
      DISCOUNT_ENGINE_V2_CAMPAIGN_MODE    = "AUTHORITATIVE"
      COMMERCIAL_AI_COPILOT_ENABLED       = "false"
    }
  )

  secrets_arns         = concat([module.rds.secret_arn], module.secrets.all_secret_arns)
  s3_arns              = ["${module.s3.user_uploads_bucket_arn}/*"]
  dynamodb_arns        = [module.dynamodb.sessions_table_arn, module.dynamodb.cache_table_arn]
  sns_arns             = [module.sns.user_notifications_topic_arn, module.sns.booking_updates_topic_arn, module.sns.payment_events_topic_arn]
  sqs_arns             = [module.sqs.booking_processing_queue_arn, module.sqs.payment_processing_queue_arn, module.sqs.notification_delivery_queue_arn]
  dlq_arn              = module.sqs.dlq_arn
  rds_proxy_arn        = module.rds.proxy_arn
  rds_proxy_db_username = module.rds.master_username
  enable_rds_proxy      = true  # RDS proxy is always created in prod
  enable_xray          = true
  alarm_actions        = [module.sns.system_alerts_topic_arn]
}

# -----------------------------------------------------------------------------
# Delivery / logistics — Java ECS Fargate + internal ALB (prod)
# -----------------------------------------------------------------------------
resource "aws_security_group" "apigw_delivery_vpc_link" {
  count = local.delivery_stack_live ? 1 : 0

  name_prefix = "warmpawz-prod-apigw-dlv-vplnk-"
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
    Name        = "warmpawz-prod-apigw-delivery-vpc-link"
    Environment = local.environment
  }
}

module "delivery_service_ecs" {
  count  = local.delivery_stack_live ? 1 : 0
  source = "../../modules/delivery-service-ecs"

  environment                       = local.environment
  aws_region                          = var.aws_region
  vpc_id                              = module.vpc.vpc_id
  private_subnet_ids                  = local.prod_private_subnet_ids
  apigw_vpc_link_security_group_ids   = [aws_security_group.apigw_delivery_vpc_link[0].id]

  rds_endpoint          = module.rds.cluster_endpoint
  database_name         = module.rds.database_name
  rds_secret_arn        = module.rds.secret_arn
  rds_security_group_id = module.rds.security_group_id

  container_image           = var.delivery_service_image
  public_api_base_url       = local.prod_http_api_invoke_url
  openapi_public_server_url = local.prod_http_api_invoke_url
  hibernate_ddl_auto        = var.delivery_hibernate_ddl_auto
  meal_delivery_notify_secret = var.meal_delivery_notify_secret
}

module "delivery_codebuild" {
  count = local.delivery_codebuild_live ? 1 : 0

  source      = "../../modules/codebuild-delivery-service"
  environment = local.environment
  aws_region  = var.aws_region

  service_name_slug         = "delivery"
  ecr_repository_name       = module.delivery_service_ecs[0].ecr_repository_name
  ecs_cluster_name          = module.delivery_service_ecs[0].ecs_cluster_name
  ecs_service_name          = module.delivery_service_ecs[0].ecs_service_name
  github_repository_url     = var.delivery_codebuild_github_url
  source_branch             = var.delivery_codebuild_branch_ref
  codestar_connection_arn   = var.delivery_codebuild_codestar_connection_arn
  use_github_codeconnection = var.delivery_codebuild_use_github_codeconnection
}

resource "aws_security_group_rule" "rds_postgres_from_delivery_ecs" {
  count = local.delivery_stack_live ? 1 : 0

  type                     = "ingress"
  security_group_id        = module.rds.security_group_id
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = module.delivery_service_ecs[0].ecs_task_security_group_id
  description              = "delivery-service Fargate to prod Postgres"
}

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

module "cognito" {
  source = "../../modules/cognito"

  environment             = local.environment
  mfa_configuration       = "OPTIONAL"
  advanced_security_mode  = "ENFORCED"
  customer_callback_urls  = ["https://customer.warmpawz.com/callback", "https://www.warmpawz.com/callback"]
  customer_logout_urls    = ["https://customer.warmpawz.com/logout", "https://www.warmpawz.com/logout"]
  vendor_callback_urls    = ["https://vendor.warmpawz.com/callback"]
  vendor_logout_urls      = ["https://vendor.warmpawz.com/logout"]
  admin_callback_urls     = ["https://admin.warmpawz.com/callback"]
  admin_logout_urls       = ["https://admin.warmpawz.com/logout"]
  user_uploads_bucket_arn = module.s3.user_uploads_bucket_arn
  api_execution_arn       = module.api_gateway.api_execution_arn
}

module "api_gateway" {
  source = "../../modules/api-gateway"

  environment                 = local.environment
  aws_region                  = var.aws_region
  stage_name                  = "$default"
  auto_deploy                 = false # Manual deployment in prod
  cors_allowed_origins        = local.cors_allowed_origins
  throttle_burst_limit        = 5000
  throttle_rate_limit         = 10000
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

  # Custom domain (optional)
  custom_domain_name = var.custom_domain_name
  certificate_arn    = var.certificate_arn
  route53_zone_id    = var.route53_zone_id

  alarm_actions = [module.sns.system_alerts_topic_arn]

  delivery_java_integration = local.delivery_stack_live ? {
    vpc_link_subnet_ids         = local.prod_private_subnet_ids
    vpc_link_security_group_ids = [aws_security_group.apigw_delivery_vpc_link[0].id]
    alb_listener_arn            = module.delivery_service_ecs[0].alb_listener_arn
  } : null
}

