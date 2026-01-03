# OpenSearch Module - Search and analytics engine

# Security Group for OpenSearch
resource "aws_security_group" "opensearch" {
  name_prefix = "warmpawz-${var.environment}-opensearch-"
  description = "Security group for OpenSearch domain"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    description     = "HTTPS access from Lambda"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "warmpawz-${var.environment}-opensearch-sg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# IAM Service-Linked Role for OpenSearch (if not exists)
resource "aws_iam_service_linked_role" "opensearch" {
  count            = var.create_service_linked_role ? 1 : 0
  aws_service_name = "es.amazonaws.com"
  description      = "Service-linked role for OpenSearch"
}

# OpenSearch Domain
resource "aws_opensearch_domain" "main" {
  domain_name    = "warmpawz-${var.environment}"
  engine_version = var.engine_version

  cluster_config {
    instance_type            = var.instance_type
    instance_count           = var.instance_count
    dedicated_master_enabled = var.dedicated_master_enabled
    dedicated_master_type    = var.dedicated_master_enabled ? var.master_instance_type : null
    dedicated_master_count   = var.dedicated_master_enabled ? var.master_instance_count : null
    zone_awareness_enabled   = var.zone_awareness_enabled

    dynamic "zone_awareness_config" {
      for_each = var.zone_awareness_enabled ? [1] : []
      content {
        availability_zone_count = var.availability_zone_count
      }
    }
  }

  # VPC Configuration
  vpc_options {
    subnet_ids         = var.zone_awareness_enabled ? var.private_subnet_ids : [var.private_subnet_ids[0]]
    security_group_ids = [aws_security_group.opensearch.id]
  }

  # EBS Configuration
  ebs_options {
    ebs_enabled = true
    volume_type = var.volume_type
    volume_size = var.volume_size
    iops        = var.volume_type == "gp3" ? var.iops : null
    throughput  = var.volume_type == "gp3" ? var.throughput : null
  }

  # Encryption
  encrypt_at_rest {
    enabled    = true
    kms_key_id = var.kms_key_id
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  # Advanced Security Options
  advanced_security_options {
    enabled                        = var.advanced_security_enabled
    internal_user_database_enabled = true
    master_user_options {
      master_user_name     = var.master_user_name
      master_user_password = var.master_user_password
    }
  }

  # Advanced Options
  advanced_options = {
    "rest.action.multi.allow_explicit_index" = "true"
    "override_main_response_version"         = "false"
  }

  # CloudWatch Logs
  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.opensearch_application.arn
    log_type                 = "ES_APPLICATION_LOGS"
  }

  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.opensearch_index.arn
    log_type                 = "INDEX_SLOW_LOGS"
  }

  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.opensearch_search.arn
    log_type                 = "SEARCH_SLOW_LOGS"
  }

  # Snapshot configuration
  snapshot_options {
    automated_snapshot_start_hour = var.snapshot_start_hour
  }

  tags = {
    Name        = "warmpawz-${var.environment}-opensearch"
    Environment = var.environment
  }

  depends_on = [aws_iam_service_linked_role.opensearch]
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "opensearch_application" {
  name              = "/aws/opensearch/${var.environment}/application"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "warmpawz-${var.environment}-opensearch-application-logs"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "opensearch_index" {
  name              = "/aws/opensearch/${var.environment}/index"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "warmpawz-${var.environment}-opensearch-index-logs"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "opensearch_search" {
  name              = "/aws/opensearch/${var.environment}/search"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "warmpawz-${var.environment}-opensearch-search-logs"
    Environment = var.environment
  }
}

# CloudWatch Log Resource Policy
resource "aws_cloudwatch_log_resource_policy" "opensearch" {
  policy_name = "warmpawz-${var.environment}-opensearch-logs"

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "es.amazonaws.com"
        }
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.opensearch_application.arn}:*",
          "${aws_cloudwatch_log_group.opensearch_index.arn}:*",
          "${aws_cloudwatch_log_group.opensearch_search.arn}:*"
        ]
      }
    ]
  })
}

# OpenSearch Access Policy
resource "aws_opensearch_domain_policy" "main" {
  domain_name = aws_opensearch_domain.main.domain_name

  access_policies = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action   = "es:*"
        Resource = "${aws_opensearch_domain.main.arn}/*"
        Condition = {
          IpAddress = {
            "aws:SourceIp" = var.vpc_cidr
          }
        }
      }
    ]
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "opensearch_cluster_status_red" {
  alarm_name          = "warmpawz-${var.environment}-opensearch-cluster-red"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "ClusterStatus.red"
  namespace           = "AWS/ES"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "1"
  alarm_description   = "OpenSearch cluster status is red"
  alarm_actions       = var.alarm_actions

  dimensions = {
    DomainName = aws_opensearch_domain.main.domain_name
    ClientId   = data.aws_caller_identity.current.account_id
  }

  tags = {
    Name        = "warmpawz-${var.environment}-opensearch-cluster-red"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "opensearch_free_storage" {
  alarm_name          = "warmpawz-${var.environment}-opensearch-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/ES"
  period              = "300"
  statistic           = "Minimum"
  threshold           = var.free_storage_threshold
  alarm_description   = "OpenSearch free storage is low"
  alarm_actions       = var.alarm_actions

  dimensions = {
    DomainName = aws_opensearch_domain.main.domain_name
    ClientId   = data.aws_caller_identity.current.account_id
  }

  tags = {
    Name        = "warmpawz-${var.environment}-opensearch-low-storage"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "opensearch_cpu" {
  alarm_name          = "warmpawz-${var.environment}-opensearch-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ES"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cpu_threshold
  alarm_description   = "OpenSearch CPU utilization is high"
  alarm_actions       = var.alarm_actions

  dimensions = {
    DomainName = aws_opensearch_domain.main.domain_name
    ClientId   = data.aws_caller_identity.current.account_id
  }

  tags = {
    Name        = "warmpawz-${var.environment}-opensearch-high-cpu"
    Environment = var.environment
  }
}

data "aws_caller_identity" "current" {}

