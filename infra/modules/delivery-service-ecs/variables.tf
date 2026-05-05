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
  description = "ECR image URI for delivery-service"
  type        = string
}

variable "container_port" {
  description = "Container listen port"
  type        = number
  default     = 8082
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

variable "public_api_base_url" {
  description = "PUBLIC_API_BASE_URL / pidge.public-api-base-url (API Gateway HTTPS URL)"
  type        = string
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
