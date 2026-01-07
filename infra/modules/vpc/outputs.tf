output "vpc_id" {
  description = "VPC ID"
  value       = local.vpc_id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = var.vpc_cidr
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  # Uses locals which handle existing VPC vs new VPC automatically
  value = local.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs (for Lambda routing)"
  # CRITICAL: Lambda requires at least 2 subnets in different AZs for high availability
  # Uses locals which handle existing VPC vs new VPC automatically
  # Falls back to data source if imports fail, ensuring Lambda always has subnet IDs
  value = local.private_subnet_ids
}

output "database_subnet_ids" {
  description = "Database subnet IDs"
  # Uses locals which handle existing VPC vs new VPC automatically
  value = local.database_subnet_ids
}

output "nat_gateway_ids" {
  description = "NAT Gateway IDs"
  value       = aws_nat_gateway.main[*].id
}

output "vpc_endpoints_security_group_id" {
  description = "Security group ID for VPC endpoints"
  # When use_existing_vpc = true, this security group doesn't exist
  value       = var.use_existing_vpc ? null : aws_security_group.vpc_endpoints[0].id
}

output "availability_zones" {
  description = "Availability zones used"
  value       = data.aws_availability_zones.available.names
}

