data "aws_caller_identity" "current" {}

locals {
  name_prefix = "warmpawz-${var.environment}-${var.service_name_slug}"
  terraform_created_connection_arn = length(aws_codestarconnections_connection.github) > 0 ? aws_codestarconnections_connection.github[0].arn : ""
  connection_arn = trimspace(var.codestar_connection_arn) != "" ? var.codestar_connection_arn : (
    var.use_github_codeconnection ? local.terraform_created_connection_arn : ""
  )
}

# Optional: one-time OAuth in AWS Console → Settings → Connections
resource "aws_codestarconnections_connection" "github" {
  count = var.use_github_codeconnection && trimspace(var.codestar_connection_arn) == "" ? 1 : 0
  name          = "${local.name_prefix}-github"
  provider_type = "GitHub"

  tags = {
    Name        = "${local.name_prefix}-codestar-github"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "codebuild" {
  name              = "/aws/codebuild/${local.name_prefix}-cb"
  retention_in_days = 14

  tags = {
    Name        = "${local.name_prefix}-codebuild-logs"
    Environment = var.environment
  }
}

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "codebuild" {
  name_prefix          = "${local.name_prefix}-cb-"
  assume_role_policy   = data.aws_iam_policy_document.codebuild_assume.json
  max_session_duration = 3600

  tags = {
    Environment = var.environment
  }
}

data "aws_iam_policy_document" "codebuild_policy_core" {
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "ECRAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "ECRPushDelivery"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:GetRepositoryPolicy",
    ]
    resources = [
      "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/${var.ecr_repository_name}",
    ]
  }

  statement {
    sid       = "ECSDeploy"
    effect    = "Allow"
    actions   = ["ecs:UpdateService", "ecs:DescribeServices"]
    resources = ["*"]
  }
}

data "aws_iam_policy_document" "codebuild_codestar_clone" {
  count = trimspace(local.connection_arn) != "" ? 1 : 0

  statement {
    sid    = "CodestarConnectionsGitHubClone"
    effect = "Allow"
    actions = [
      "codestar-connections:UseConnection",
    ]
    resources = [local.connection_arn]
  }
}

data "aws_iam_policy_document" "codebuild_policy" {
  source_policy_documents = concat(
    [data.aws_iam_policy_document.codebuild_policy_core.json],
    data.aws_iam_policy_document.codebuild_codestar_clone[*].json,
  )
}

resource "aws_iam_role_policy" "codebuild_inline" {
  name_prefix = "${var.service_name_slug}-policy-"
  role        = aws_iam_role.codebuild.id

  policy = data.aws_iam_policy_document.codebuild_policy.json
}

resource "aws_codebuild_project" "delivery" {
  depends_on = [aws_iam_role_policy.codebuild_inline]

  name          = "${local.name_prefix}-image"
  description   = "Build ${var.ecr_repository_name} Docker image, push to ECR, rollout ECS ${var.ecs_service_name}"
  build_timeout = var.build_timeout_minutes
  service_role  = aws_iam_role.codebuild.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = var.compute_type
    image                       = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "IMAGE_REPO_NAME"
      value = var.ecr_repository_name
    }
    environment_variable {
      name  = "IMAGE_TAG"
      value = var.image_tag_constant
    }
    environment_variable {
      name  = "ECS_CLUSTER"
      value = var.ecs_cluster_name
    }
    environment_variable {
      name  = "ECS_SERVICE"
      value = var.ecs_service_name
    }
  }

  logs_config {
    cloudwatch_logs {
      group_name  = aws_cloudwatch_log_group.codebuild.name
      stream_name = "delivery"
      status      = "ENABLED"
    }
  }

  source {
    type            = "GITHUB"
    location        = var.github_repository_url
    git_clone_depth = 1

    git_submodules_config {
      fetch_submodules = false
    }

    dynamic "auth" {
      for_each = trimspace(local.connection_arn) != "" ? [1] : []
      content {
        type     = "CODECONNECTIONS"
        resource = local.connection_arn
      }
    }

    buildspec = var.buildspec_relative_path
  }

  source_version = var.source_branch != "" ? var.source_branch : null

  tags = {
    Name        = "${local.name_prefix}-codebuild-delivery"
    Environment = var.environment
  }
}
