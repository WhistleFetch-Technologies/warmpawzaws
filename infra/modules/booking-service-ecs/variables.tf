variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC for ECS tasks and internal ALB"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR (unused; reserved for future tightening of rules)"
  type        = string
  default     = ""
}

variable "private_subnet_ids" {
  description = "Private subnets for Fargate tasks and internal ALB (>= 2 AZs)"
  type        = list(string)
}

variable "apigw_vpc_link_security_group_ids" {
  description = "Security groups attached to API Gateway VPC link ENIs — allowed HTTP to ALB"
  type        = list(string)
}

variable "rds_endpoint" {
  description = "PostgreSQL host (same as Lambda DB_HOST — cluster endpoint)"
  type        = string
}

variable "database_name" {
  description = "Database name"
  type        = string
}

variable "rds_secret_arn" {
  description = "Secrets Manager ARN for RDS credentials JSON (username, password, …)"
  type        = string
}

variable "rds_security_group_id" {
  description = "RDS cluster security group — ECS egress targets this on 5432"
  type        = string
}

variable "container_image" {
  description = "ECR image URI for booking-service"
  type        = string
}

variable "container_port" {
  description = "Container listen port"
  type        = number
  default     = 8083
}

variable "cpu" {
  type    = number
  default = 1024
}

variable "memory" {
  type    = number
  default = 2048
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "openapi_public_server_url" {
  description = "HTTPS origin for OpenAPI/Swagger UI (e.g. API Gateway invoke URL). Prevents mixed-content http:// Try it out behind internal ALB."
  type        = string
  default     = ""
}

variable "hibernate_ddl_auto" {
  description = "spring.jpa.hibernate.ddl-auto on AWS profile"
  type        = string
  default     = "validate"
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "customer_service_url" {
  description = "Base URL for customer-service (optional; empty disables outbound calls)"
  type        = string
  default     = ""
}

variable "sns_enabled" {
  description = "Enable SNS event publishing from booking-service"
  type        = string
  default     = "false"
}

variable "booking_created_topic_arn" {
  description = "SNS topic ARN for BOOKING_CREATED events"
  type        = string
  default     = ""
}

variable "booking_status_updated_topic_arn" {
  description = "SNS topic ARN for BOOKING_STATUS_UPDATED events"
  type        = string
  default     = ""
}

variable "sns_publish_topic_arns" {
  description = "SNS topic ARNs the ECS task role may publish to (empty disables SNS IAM policy)"
  type        = list(string)
  default     = []
}

variable "app_security_enabled" {
  description = "When \"true\", Spring Security + OAuth2 Resource Server is active and requires a valid Cognito (or UAT) JWT on every booking request. Dev defaults to \"false\" because no Cognito issuer URI / UAT secret is wired here yet, and leaving it on returns body-less 401 for every /bookings/* call. Prod must set this to \"true\" alongside COGNITO_ISSUER_URI + COGNITO_AUDIENCE."
  type        = string
  default     = "false"
}
