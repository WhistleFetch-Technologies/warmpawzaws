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
  description = "Use existing VPC if found (no new VPC, subnets, or SGs created)"
  type        = bool
  default     = false
}

variable "create_nat_gateway_in_existing_vpc" {
  description = "When use_existing_vpc is true: create one NAT gateway (and EIP) in first public subnet, or use existing_nat_gateway_id if set."
  type        = bool
  default     = false
}

variable "existing_nat_gateway_id" {
  description = "When use_existing_vpc and create_nat_gateway_in_existing_vpc: use this NAT gateway ID instead of creating one (e.g. created via AWS CLI)."
  type        = string
  default     = null
}

variable "existing_vpc_id" {
  description = "When use_existing_vpc: use this VPC ID instead of looking up by tag (ensures same VPC as Lambda/RDS; use if tag lookup returns wrong VPC)."
  type        = string
  default     = null
}

