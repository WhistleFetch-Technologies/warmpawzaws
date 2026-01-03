# Development Environment Configuration
# Minimal resources, no HA, single NAT gateway

terraform {
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

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local variables
locals {
  environment = "dev"
  common_tags = {
    Environment = "dev"
    Project     = "Warmpawz"
  }
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
  single_nat_gateway       = true  # Cost optimization for dev
  create_private_endpoints = false # Cost optimization for dev
  use_existing_vpc         = false
}

# SNS Module (for alarms)
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
  enable_pitr   = false # Cost optimization for dev
  alarm_actions = [module.sns.system_alerts_topic_arn]
}

# S3 Module
module "s3" {
  source = "../../modules/s3"

  environment           = local.environment
  account_id            = data.aws_caller_identity.current.account_id
  enable_versioning     = false # Cost optimization for dev
  cors_allowed_origins  = ["http://localhost:3000", "http://localhost:5173"]
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

# Lambda Module
module "lambda" {
  source = "../../modules/lambda"

  environment        = local.environment
  aws_region         = var.aws_region
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  lambda_functions = {
    # Placeholder - will be populated with actual functions
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
  alarm_actions = [module.sns.system_alerts_topic_arn]
}

# Cognito Module
module "cognito" {
  source = "../../modules/cognito"

  environment             = local.environment
  mfa_configuration       = "OFF" # Simplified for dev
  advanced_security_mode  = "AUDIT"
  customer_callback_urls  = ["http://localhost:3000/callback"]
  customer_logout_urls    = ["http://localhost:3000/logout"]
  vendor_callback_urls    = ["http://localhost:3001/callback"]
  vendor_logout_urls      = ["http://localhost:3001/logout"]
  admin_callback_urls     = ["http://localhost:3002/callback"]
  admin_logout_urls       = ["http://localhost:3002/logout"]
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
  cors_allowed_origins        = ["http://localhost:3000", "http://localhost:5173"]
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

# OpenSearch Module (optional for dev - can be disabled)
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

