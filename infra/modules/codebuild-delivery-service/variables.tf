variable "environment" {
  type        = string
  description = "Deployment stage (dev, prod, …)"
}

variable "aws_region" {
  type = string
}

variable "service_name_slug" {
  type        = string
  description = "Short slug for naming (e.g. delivery)"
}

variable "ecr_repository_name" {
  type = string
}

variable "ecs_cluster_name" {
  type = string
}

variable "ecs_service_name" {
  type = string
}

variable "github_repository_url" {
  type        = string
  description = "HTTPS clone URL, e.g. https://github.com/org/warmpawzaws.git"
}

variable "source_branch" {
  type        = string
  default     = "refs/heads/main"
  description = "Examples: refs/heads/main, refs/heads/develop"
}

variable "buildspec_relative_path" {
  type        = string
  default     = "services/delivery-service/buildspec.yml"
}

variable "codestar_connection_arn" {
  type        = string
  default     = ""
  description = "Existing CodeConnections ARN. If empty and use_github_codeconnection is true, Terraform creates a connection (finish GitHub handshake in Console)."
}

variable "use_github_codeconnection" {
  type        = bool
  default     = false
  description = "If true, attach CodeStar/CodeConnections auth to the GitHub source (needed for many private repos). If false, clone without connection (works for public GitHub repos)."
}

variable "compute_type" {
  type        = string
  default     = "BUILD_GENERAL1_LARGE"
  description = "Java/Docker builds: LARGE or above recommended"
}

variable "build_timeout_minutes" {
  type    = number
  default = 60
}

variable "image_tag_constant" {
  type        = string
  default     = "latest"
  description = "Image tag aligned with ECS task definition image"
}
