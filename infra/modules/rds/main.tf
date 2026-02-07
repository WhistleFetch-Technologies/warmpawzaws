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
  # Use subnets from existing subnet group's VPC when requested (fixes "not in the same Vpc as the existing subnet group")
  db_subnet_ids = var.use_existing_subnet_group_vpc && length(data.aws_subnets.in_subnet_group_vpc[0].ids) > 0 ? data.aws_subnets.in_subnet_group_vpc[0].ids : var.database_subnet_ids
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
    ignore_changes = [tags]
  }
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name_prefix = "warmpawz-${var.environment}-rds-"
  description = "Security group for RDS Aurora cluster"
  vpc_id      = var.vpc_id

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

