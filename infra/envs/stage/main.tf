# Stage Environment Configuration
# Production-grade infrastructure (identical to prod)

terraform {
  backend "s3" {
    bucket         = "warmpawz-terraform-state-023394150666"
    key            = "stage/terraform.tfstate"
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
      Environment = "stage"
      ManagedBy   = "terraform"
      Repository  = "warmpawzecodev"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  environment = "stage"
  common_tags = {
    Environment = "stage"
    Project     = "Warmpawz"
  }
}

# VPC Module - Production-grade with HA
module "vpc" {
  source = "../../modules/vpc"

  environment              = local.environment
  aws_region               = var.aws_region
  vpc_cidr                 = "10.1.0.0/16"
  public_subnet_cidrs      = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  private_subnet_cidrs     = ["10.1.11.0/24", "10.1.12.0/24", "10.1.13.0/24"]
  database_subnet_cidrs    = ["10.1.21.0/24", "10.1.22.0/24", "10.1.23.0/24"]
  enable_nat_gateway       = true
  single_nat_gateway       = false # HA: NAT per AZ
  create_private_endpoints = true
  use_existing_vpc         = false
}

module "sns" {
  source = "../../modules/sns"

  environment  = local.environment
  alert_emails = var.alert_emails
}

module "rds" {
  source = "../../modules/rds"

  environment                  = local.environment
  vpc_id                       = module.vpc.vpc_id
  database_subnet_ids          = module.vpc.database_subnet_ids
  allowed_security_groups      = [module.lambda.lambda_security_group_id]
  database_name                = "warmpawz"
  master_username              = "warmpawz_admin"
  min_capacity                 = 1.0
  max_capacity                 = 4.0
  backup_retention_period      = 7
  availability_zones           = module.vpc.availability_zones
  deletion_protection          = true
  skip_final_snapshot          = false
  instance_count               = 2 # HA: Multi-AZ
  performance_insights_enabled = true
  alarm_actions                = [module.sns.system_alerts_topic_arn]
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
  cors_allowed_origins  = ["https://stage.customer.warmpawz.com", "https://stage.vendor.warmpawz.com"]
  log_retention_days    = 90
  backup_retention_days = 180
  alarm_actions         = [module.sns.system_alerts_topic_arn]
}

module "sqs" {
  source = "../../modules/sqs"

  environment         = local.environment
  age_alarm_threshold = 300
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
      handler     = "index.handler"
      runtime     = "nodejs20.x"
      timeout     = 30
      memory_size = 1024
      zip_path    = "${path.module}/../../../backend/lambda/api-handler.zip"
      env_vars    = {}
    }
  }

  common_env_vars = {
    DB_HOST                     = module.rds.cluster_endpoint
    DB_NAME                     = module.rds.database_name
    DB_SECRET_ARN               = module.rds.secret_arn
    DYNAMODB_SESSIONS_TABLE     = module.dynamodb.sessions_table_name
    DYNAMODB_CACHE_TABLE        = module.dynamodb.cache_table_name
    S3_UPLOADS_BUCKET           = module.s3.user_uploads_bucket_name
    SQS_BOOKING_QUEUE_URL       = module.sqs.booking_processing_queue_url
    SQS_PAYMENT_QUEUE_URL       = module.sqs.payment_processing_queue_url
    SNS_NOTIFICATIONS_TOPIC_ARN = module.sns.user_notifications_topic_arn
  }

  secrets_arns  = ["${module.rds.secret_arn}", "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:*"]
  s3_arns       = ["${module.s3.user_uploads_bucket_arn}/*"]
  dynamodb_arns = [module.dynamodb.sessions_table_arn, module.dynamodb.cache_table_arn]
  sns_arns      = [module.sns.user_notifications_topic_arn, module.sns.booking_updates_topic_arn]
  sqs_arns      = [module.sqs.booking_processing_queue_arn, module.sqs.payment_processing_queue_arn]
  dlq_arn       = module.sqs.dlq_arn
  enable_xray   = true
  alarm_actions = [module.sns.system_alerts_topic_arn]
}

module "cognito" {
  source = "../../modules/cognito"

  environment             = local.environment
  mfa_configuration       = "OPTIONAL"
  advanced_security_mode  = "ENFORCED"
  customer_callback_urls  = ["https://stage.customer.warmpawz.com/callback"]
  customer_logout_urls    = ["https://stage.customer.warmpawz.com/logout"]
  vendor_callback_urls    = ["https://stage.vendor.warmpawz.com/callback"]
  vendor_logout_urls      = ["https://stage.vendor.warmpawz.com/logout"]
  admin_callback_urls     = ["https://stage.admin.warmpawz.com/callback"]
  admin_logout_urls       = ["https://stage.admin.warmpawz.com/logout"]
  user_uploads_bucket_arn = module.s3.user_uploads_bucket_arn
  api_execution_arn       = module.api_gateway.api_execution_arn
}

module "api_gateway" {
  source = "../../modules/api-gateway"

  environment                 = local.environment
  aws_region                  = var.aws_region
  stage_name                  = "$default"
  auto_deploy                 = true
  cors_allowed_origins        = ["https://stage.customer.warmpawz.com", "https://stage.vendor.warmpawz.com"]
  throttle_burst_limit        = 2000
  throttle_rate_limit         = 1000
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

module "opensearch" {
  source = "../../modules/opensearch"

  environment                = local.environment
  vpc_id                     = module.vpc.vpc_id
  vpc_cidr                   = "10.1.0.0/16"
  private_subnet_ids         = module.vpc.private_subnet_ids
  allowed_security_groups    = [module.lambda.lambda_security_group_id]
  instance_type              = "t3.medium.search"
  instance_count             = 2
  dedicated_master_enabled   = true
  master_instance_type       = "t3.small.search"
  master_instance_count      = 3
  zone_awareness_enabled     = true
  availability_zone_count    = 2
  volume_size                = 50
  master_user_password       = var.opensearch_master_password
  create_service_linked_role = false
  alarm_actions              = [module.sns.system_alerts_topic_arn]
}

