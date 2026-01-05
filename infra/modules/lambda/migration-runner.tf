# Migration Runner Lambda
# Executes database migrations from within VPC
# Invoked by GitHub Actions CI/CD pipeline
#
# WHY: RDS is in private subnet (publicly_accessible = false)
# GitHub Actions runners cannot reach private IPs
# Lambda runs inside VPC and can access RDS securely
#
# USAGE: Set enable_migration_runner = true to create this resource
# This is OPTIONAL and only needed for production/staging environments
# For dev, use the automated RDS public access approach (scripts/ci-enable-rds-access.sh)

resource "aws_lambda_function" "migration_runner" {
  count = var.enable_migration_runner ? 1 : 0
  
  function_name = "warmpawz-${var.environment}-migration-runner"
  description   = "Runs database migrations from within VPC"
  role          = aws_iam_role.migration_runner[0].arn
  
  # Use Node.js runtime to execute migration scripts
  runtime = "nodejs20.x"
  handler = "index.handler"
  timeout = 300  # 5 minutes for migrations
  
  # Deploy Lambda in VPC to access RDS
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.migration_runner[0].id]
  }
  
  # Environment variables for database connection
  environment {
    variables = merge(
      var.common_env_vars,
      {
        NODE_ENV = var.environment
        # DATABASE_URL will be constructed from Secrets Manager at runtime
        RDS_SECRET_ARN = var.rds_secret_arn != null ? var.rds_secret_arn : ""
      }
    )
  }
  
  # Placeholder code (will be replaced by actual migration runner)
  filename         = "${path.module}/migration-runner-placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/migration-runner-placeholder.zip")
  
  tags = {
    Name        = "warmpawz-${var.environment}-migration-runner"
    Environment = var.environment
    Purpose     = "Database Migrations"
  }
  
  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
      # Allow CI/CD to update Lambda code without Terraform drift
    ]
  }
}

# Security Group for Migration Runner Lambda
resource "aws_security_group" "migration_runner" {
  count = var.enable_migration_runner ? 1 : 0
  
  name_prefix = "warmpawz-${var.environment}-migration-runner-"
  description = "Security group for migration runner Lambda"
  vpc_id      = var.vpc_id
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }
  
  tags = {
    Name        = "warmpawz-${var.environment}-migration-runner-sg"
    Environment = var.environment
  }
}

# IAM Role for Migration Runner Lambda
resource "aws_iam_role" "migration_runner" {
  count = var.enable_migration_runner ? 1 : 0
  
  name_prefix = "warmpawz-${var.environment}-migration-runner-"
  description = "IAM role for migration runner Lambda"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
  
  tags = {
    Name        = "warmpawz-${var.environment}-migration-runner-role"
    Environment = var.environment
  }
}

# IAM Policy for Migration Runner
resource "aws_iam_role_policy" "migration_runner" {
  count = var.enable_migration_runner ? 1 : 0
  
  name_prefix = "warmpawz-${var.environment}-migration-runner-"
  role        = aws_iam_role.migration_runner[0].id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/warmpawz-${var.environment}-migration-runner:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.rds_secret_arn != null ? var.rds_secret_arn : "*"
      }
    ]
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "migration_runner" {
  count = var.enable_migration_runner ? 1 : 0
  
  name              = "/aws/lambda/warmpawz-${var.environment}-migration-runner"
  retention_in_days = var.environment == "prod" ? 30 : 7
  
  tags = {
    Name        = "warmpawz-${var.environment}-migration-runner-logs"
    Environment = var.environment
  }
}

# Output Lambda ARN for CI/CD invocation
output "migration_runner_function_name" {
  description = "Name of migration runner Lambda function"
  value       = var.enable_migration_runner ? aws_lambda_function.migration_runner[0].function_name : null
}

output "migration_runner_function_arn" {
  description = "ARN of migration runner Lambda function"
  value       = var.enable_migration_runner ? aws_lambda_function.migration_runner[0].arn : null
}

