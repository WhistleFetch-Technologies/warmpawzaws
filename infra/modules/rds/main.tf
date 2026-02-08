# RDS Aurora Serverless v2 Module
# Production-grade PostgreSQL cluster with automated backups

# When subnet group already exists in another VPC, use subnets from that VPC so ModifyDBSubnetGroup succeeds
data "aws_db_subnet_group" "existing" {
  count = var.use_existing_subnet_group_vpc ? 1 : 0

  name = "warmpawz-${var.environment}-db-subnet-group"
}

data "aws_subnets" "in_subnet_group_vpc" {
  count = var.use_existing_subnet_group_vpc ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [data.aws_db_subnet_group.existing[0].vpc_id]
  }
}

locals {
  # When use_existing_subnet_group_vpc: ONLY use subnets from the existing group's VPC (no fallback — fallback caused cross-VPC error)
  db_subnet_ids = var.use_existing_subnet_group_vpc ? data.aws_subnets.in_subnet_group_vpc[0].ids : var.database_subnet_ids
  # RDS SG and cluster must be in the same VPC as the DB subnet group (subnet group is in its own VPC in prod)
  vpc_id_for_rds = var.use_existing_subnet_group_vpc ? data.aws_db_subnet_group.existing[0].vpc_id : var.vpc_id
}

# DB Subnet Group (must span >= 2 AZs for RDS)
resource "aws_db_subnet_group" "main" {
  name       = "warmpawz-${var.environment}-db-subnet-group"
  subnet_ids = local.db_subnet_ids

  tags = {
    Name        = "warmpawz-${var.environment}-db-subnet-group"
    Environment = var.environment
  }

  lifecycle {
    # Never update subnet_ids after create (existing prod group is in another VPC; modifying causes cross-VPC error)
    ignore_changes = [tags, subnet_ids]
  }
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name_prefix = "warmpawz-${var.environment}-rds-"
  description = "Security group for RDS Aurora cluster"
  vpc_id      = local.vpc_id_for_rds

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    description     = "PostgreSQL access from Lambda"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "warmpawz-${var.environment}-rds-sg"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = all  # NUCLEAR OPTION: Never modify after creation
  }
}

# Random password for master user
resource "random_password" "master" {
  length  = 32
  special = true
}

# Store password in Secrets Manager
resource "aws_secretsmanager_secret" "rds_master_password" {
  name_prefix             = "warmpawz-${var.environment}-rds-master-"
  description             = "Master password for RDS Aurora cluster"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Name        = "warmpawz-${var.environment}-rds-master-password"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "rds_master_password" {
  secret_id = aws_secretsmanager_secret.rds_master_password.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    engine   = "postgres"
    host     = aws_rds_cluster.main.endpoint
    port     = 5432
    dbname   = var.database_name
  })
}

# RDS Cluster Parameter Group
resource "aws_rds_cluster_parameter_group" "main" {
  name_prefix = "warmpawz-${var.environment}-aurora-"
  family      = "aurora-postgresql15"
  description = "Cluster parameter group for Aurora PostgreSQL 15"

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements,pgaudit"
    apply_method = "pending-reboot"
  }

  parameter {
    name  = "log_statement"
    value = var.environment == "prod" ? "ddl" : "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = var.environment == "prod" ? "1000" : "500"
  }

  tags = {
    Name        = "warmpawz-${var.environment}-aurora-cluster-params"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# RDS DB Parameter Group (for instances)
resource "aws_db_parameter_group" "main" {
  name_prefix = "warmpawz-${var.environment}-aurora-db-"
  family      = "aurora-postgresql15"
  description = "DB parameter group for Aurora PostgreSQL 15"

  tags = {
    Name        = "warmpawz-${var.environment}-aurora-db-params"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Aurora Serverless v2 Cluster
resource "aws_rds_cluster" "main" {
  cluster_identifier     = "warmpawz-${var.environment}-cluster"
  engine                 = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = "15"
  database_name          = var.database_name
  master_username        = var.master_username
  master_password        = random_password.master.result
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Serverless v2 scaling configuration
  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }

  # Backup configuration
  backup_retention_period      = var.backup_retention_period
  preferred_backup_window      = var.preferred_backup_window
  preferred_maintenance_window = var.preferred_maintenance_window

  # Encryption
  storage_encrypted = true
  kms_key_id        = var.kms_key_id

  # High availability
  availability_zones = var.availability_zones

  # Cluster parameter group
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.main.name

  # Enhanced monitoring
  enabled_cloudwatch_logs_exports = ["postgresql"]

  # Deletion protection - CRITICAL: Prevent accidental deletion
  deletion_protection       = true  # Always on - protect production data
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "warmpawz-${var.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # Apply changes immediately in non-prod
  apply_immediately = var.environment != "prod"

  tags = {
    Name        = "warmpawz-${var.environment}-aurora-cluster"
    Environment = var.environment
  }

  # Lifecycle - NEVER destroy existing cluster
  # CRITICAL: NUCLEAR OPTION - Ignore ALL changes to prevent destruction
  # This means once created, Terraform will NEVER try to modify or replace this cluster
  lifecycle {
    ignore_changes = all  # Ignore ALL attribute changes - NEVER destroy/replace
  }
}

# Aurora Serverless v2 Instance(s)
resource "aws_rds_cluster_instance" "main" {
  count = var.instance_count

  identifier                   = "warmpawz-${var.environment}-instance-${count.index + 1}"
  cluster_identifier           = aws_rds_cluster.main.id
  instance_class               = "db.serverless"
  engine                       = aws_rds_cluster.main.engine
  engine_version               = aws_rds_cluster.main.engine_version
  db_parameter_group_name      = aws_db_parameter_group.main.name
  publicly_accessible          = false
  auto_minor_version_upgrade   = var.auto_minor_version_upgrade
  performance_insights_enabled = var.performance_insights_enabled

  tags = {
    Name        = "warmpawz-${var.environment}-aurora-instance-${count.index + 1}"
    Environment = var.environment
  }

  # CRITICAL: NUCLEAR OPTION - Ignore ALL changes to prevent destruction
  # This means once created, Terraform will NEVER try to modify or replace this instance
  lifecycle {
    ignore_changes = all  # Ignore ALL attribute changes - NEVER destroy/replace
  }
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "warmpawz-${var.environment}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cpu_alarm_threshold
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = var.alarm_actions

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.main.id
  }

  tags = {
    Name        = "warmpawz-${var.environment}-rds-cpu-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "warmpawz-${var.environment}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.connections_alarm_threshold
  alarm_description   = "This metric monitors RDS connection count"
  alarm_actions       = var.alarm_actions

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.main.id
  }

  tags = {
    Name        = "warmpawz-${var.environment}-rds-connections-alarm"
    Environment = var.environment
  }
}

# ============================================================================
# RDS PROXY - For Lambda connection pooling and better connection management
# ============================================================================

# IAM Role for RDS Proxy
resource "aws_iam_role" "rds_proxy" {
  name_prefix = "warmpawz-${var.environment}-rds-proxy-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "warmpawz-${var.environment}-rds-proxy-role"
    Environment = var.environment
  }
}

# IAM Policy for RDS Proxy to access Secrets Manager
resource "aws_iam_role_policy" "rds_proxy_secrets" {
  name_prefix = "warmpawz-${var.environment}-rds-proxy-secrets-"
  role        = aws_iam_role.rds_proxy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.rds_master_password.arn
      }
    ]
  })
}

# Security Group for RDS Proxy
resource "aws_security_group" "rds_proxy" {
  name_prefix = "warmpawz-${var.environment}-rds-proxy-"
  description = "Security group for RDS Proxy"
  vpc_id      = var.vpc_id  # Use the main VPC ID (where Lambda is), not the subnet group VPC

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    description     = "PostgreSQL access from Lambda via Proxy"
  }

  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.rds.id]
    description = "Allow proxy to connect to RDS"
  }

  tags = {
    Name        = "warmpawz-${var.environment}-rds-proxy-sg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# RDS Proxy
resource "aws_db_proxy" "main" {
  name                   = "warmpawz-${var.environment}-proxy"
  engine_family          = "POSTGRESQL"
  
  auth {
    auth_scheme = "SECRETS"
    secret_arn  = aws_secretsmanager_secret.rds_master_password.arn
    iam_auth    = "DISABLED"
  }
  
  role_arn                = aws_iam_role.rds_proxy.arn
  # Use database subnets from the VPC where Lambda is (dev VPC), not the RDS subnet group VPC
  # This ensures proxy is in same VPC as Lambda for connectivity
  vpc_subnet_ids          = var.database_subnet_ids
  vpc_security_group_ids  = [aws_security_group.rds_proxy.id]
  
  require_tls             = true
  idle_client_timeout     = 1800

  tags = {
    Name        = "warmpawz-${var.environment}-rds-proxy"
    Environment = var.environment
  }
}

# RDS Proxy Target Group (for connection settings)
resource "aws_db_proxy_default_target_group" "main" {
  db_proxy_name = aws_db_proxy.main.name

  connection_pool_config {
    max_connections_percent         = 100
    max_idle_connections_percent   = 50
    connection_borrow_timeout       = 120
  }
}

# Register RDS Cluster as Proxy Target
resource "aws_db_proxy_target" "cluster" {
  db_proxy_name          = aws_db_proxy.main.name
  target_group_name      = "default"
  db_cluster_identifier  = aws_rds_cluster.main.id
}

# Allow RDS Proxy to connect to RDS (separate rule to avoid circular dependency)
resource "aws_security_group_rule" "rds_allow_proxy" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds_proxy.id
  security_group_id        = aws_security_group.rds.id
  description              = "PostgreSQL access from RDS Proxy"
}
