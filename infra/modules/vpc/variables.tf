variable "environment" {
  description = "Environment name (dev, stage, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway for all AZs (cost optimization for dev)"
  type        = bool
  default     = false
}

variable "create_private_endpoints" {
  description = "Create VPC endpoints for AWS services"
  type        = bool
  default     = true
}

variable "use_existing_vpc" {
  description = "Use existing VPC if found"
  type        = bool
  default     = false
}

