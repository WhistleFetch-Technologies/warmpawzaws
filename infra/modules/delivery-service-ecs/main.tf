
locals {

  name_prefix = "warmpawz-${var.environment}-delivery"

  jdbc_url = "jdbc:postgresql://${var.rds_endpoint}:5432/${var.database_name}?sslmode=require"
}

# ---------------------------------------------------------------------------
# ECR
# ---------------------------------------------------------------------------
resource "aws_ecr_repository" "delivery_service" {
  name                 = "${local.name_prefix}-svc"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${local.name_prefix}-ecr"
    Environment = var.environment
  }
}

# ---------------------------------------------------------------------------
# CloudWatch logs
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${local.name_prefix}-logs"
    Environment = var.environment
  }
}

# ---------------------------------------------------------------------------
# Security groups
# ---------------------------------------------------------------------------
resource "aws_security_group" "alb_internal" {
  name_prefix = "${local.name_prefix}-alb-"
  description = "Internal ALB for delivery-service (API Gateway VPC link)"
  vpc_id      = var.vpc_id

  egress {
    description     = "To ECS tasks"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  tags = {
    Name        = "${local.name_prefix}-alb-sg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "alb_ingress_from_apigw_vpc_link" {
  count = length(var.apigw_vpc_link_security_group_ids)

  type                     = "ingress"
  security_group_id        = aws_security_group.alb_internal.id
  from_port                = 80
  to_port                  = 80
  protocol                 = "tcp"
  source_security_group_id = var.apigw_vpc_link_security_group_ids[count.index]
  description              = "HTTP from API Gateway VPC link"
}

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${local.name_prefix}-tasks-"
  description = "Fargate tasks - delivery-service"
  vpc_id      = var.vpc_id

  egress {
    description = "HTTPS for AWS APIs / image layers"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description     = "PostgreSQL to RDS cluster"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.rds_security_group_id]
  }

  tags = {
    Name        = "${local.name_prefix}-tasks-sg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "ecs_tasks_ingress_from_alb" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ecs_tasks.id
  from_port                = var.container_port
  to_port                  = var.container_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb_internal.id
  description              = "App port from internal ALB"
}

# ---------------------------------------------------------------------------
# ALB (internal)
# ---------------------------------------------------------------------------
resource "aws_lb" "internal" {
  # Name max 32 chars
  name               = substr("${local.name_prefix}-i", 0, 32)
  load_balancer_type = "application"
  internal           = true
  security_groups    = [aws_security_group.alb_internal.id]
  subnets            = var.private_subnet_ids

  tags = {
    Name        = "${local.name_prefix}-alb"
    Environment = var.environment
  }
}

resource "aws_lb_target_group" "delivery" {
  name_prefix = "wmdl-"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/actuator/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name        = "${local.name_prefix}-tg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.internal.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.delivery.arn
  }

  tags = {
    Name        = "${local.name_prefix}-listener"
    Environment = var.environment
  }
}

# ---------------------------------------------------------------------------
# IAM — task execution + task role
# ---------------------------------------------------------------------------
resource "aws_iam_role" "ecs_execution" {
  name_prefix = "${local.name_prefix}-exec-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name_prefix = "rds-secret-"
  role        = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [var.rds_secret_arn]
      }
    ]
  })
}

resource "aws_iam_role" "ecs_task" {
  name_prefix = "${local.name_prefix}-task-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

# ---------------------------------------------------------------------------
# ECS cluster + service
# ---------------------------------------------------------------------------
resource "aws_ecs_cluster" "delivery" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_ecs_task_definition" "delivery" {
  family                   = "${local.name_prefix}-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "delivery-service"
      image     = var.container_image
      essential = true
      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]
      environment = concat(
        [
          { name = "SPRING_PROFILES_ACTIVE", value = "aws" },
          { name = "SPRING_DATASOURCE_URL", value = local.jdbc_url },
          { name = "PUBLIC_API_BASE_URL", value = var.public_api_base_url },
          { name = "SPRING_JPA_HIBERNATE_DDL_AUTO", value = var.hibernate_ddl_auto }
        ],
        var.openapi_public_server_url != "" ? [{ name = "OPENAPI_PUBLIC_SERVER_URL", value = var.openapi_public_server_url }] : []
      )
      secrets = [
        {
          name      = "SPRING_DATASOURCE_USERNAME"
          valueFrom = "${var.rds_secret_arn}:username::"
        },
        {
          name      = "SPRING_DATASOURCE_PASSWORD"
          valueFrom = "${var.rds_secret_arn}:password::"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Environment = var.environment
  }
}

resource "aws_ecs_service" "delivery" {
  name            = "${local.name_prefix}-svc"
  cluster         = aws_ecs_cluster.delivery.id
  task_definition = aws_ecs_task_definition.delivery.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.delivery.arn
    container_name   = "delivery-service"
    container_port   = var.container_port
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  depends_on = [aws_lb_listener.http]

  tags = {
    Environment = var.environment
  }
}
