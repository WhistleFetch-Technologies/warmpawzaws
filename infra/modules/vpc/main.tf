# VPC Module - Creates isolated network per environment
# Idempotent: Creates only if not exists

data "aws_vpc" "existing" {
  count = var.use_existing_vpc && var.existing_vpc_id == null ? 1 : 0

  filter {
    name   = "tag:Name"
    values = ["warmpawz-${var.environment}-vpc"]
  }

  filter {
    name   = "tag:Environment"
    values = [var.environment]
  }
}

resource "aws_vpc" "main" {
  count = var.use_existing_vpc ? 0 : 1

  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "warmpawz-${var.environment}-vpc"
    Environment = var.environment
  }

  # NUCLEAR OPTION: Never modify or destroy VPC after creation
  lifecycle {
    ignore_changes = all
  }
}

locals {
  # When use_existing_vpc: prefer existing_vpc_id if set (fixes RDS/Lambda "different networks" when tag lookup returns wrong VPC)
  vpc_id = var.use_existing_vpc ? (var.existing_vpc_id != null && var.existing_vpc_id != "" ? var.existing_vpc_id : data.aws_vpc.existing[0].id) : aws_vpc.main[0].id

  # Subnet IDs - use data source if existing VPC, otherwise use created subnets
  # When existing VPC has no database/private-tagged subnets, use any subnets in VPC so RDS gets >= 1 (required by ModifyDBSubnetGroup)
  private_subnet_ids  = var.use_existing_vpc ? data.aws_subnets.existing_private[0].ids : aws_subnet.private[*].id
  public_subnet_ids   = var.use_existing_vpc ? data.aws_subnets.existing_public[0].ids : aws_subnet.public[*].id
  database_subnet_ids = var.use_existing_vpc ? (
    length(data.aws_subnets.existing_database[0].ids) >= 2 ? data.aws_subnets.existing_database[0].ids :
    length(data.aws_subnets.existing_private[0].ids) >= 2 ? data.aws_subnets.existing_private[0].ids :
    data.aws_subnets.existing_any[0].ids
  ) : aws_subnet.database[*].id
}

# Availability Zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Data sources for existing subnets (when use_existing_vpc = true)
# These ensure we can get subnet IDs even if imports fail
data "aws_subnets" "existing_private" {
  count = var.use_existing_vpc ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }

  filter {
    name   = "tag:Type"
    values = ["private"]
  }

  filter {
    name   = "tag:Environment"
    values = [var.environment]
  }
}

data "aws_subnets" "existing_public" {
  count = var.use_existing_vpc ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }

  filter {
    name   = "tag:Type"
    values = ["public"]
  }

  filter {
    name   = "tag:Environment"
    values = [var.environment]
  }
}

data "aws_subnets" "existing_database" {
  count = var.use_existing_vpc ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }

  filter {
    name   = "tag:Type"
    values = ["database"]
  }

  filter {
    name   = "tag:Environment"
    values = [var.environment]
  }
}

# Fallback: any subnets in VPC when no Type=database or Type=private (prod VPC may use different tags)
data "aws_subnets" "existing_any" {
  count = var.use_existing_vpc ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
}

# Public Subnets (for NAT, Load Balancers)
# SKIP when use_existing_vpc = true (subnets already exist in AWS)
resource "aws_subnet" "public" {
  count = var.use_existing_vpc ? 0 : length(var.public_subnet_cidrs)

  vpc_id                  = local.vpc_id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "warmpawz-${var.environment}-public-${count.index + 1}"
    Environment = var.environment
    Type        = "public"
  }

  # NUCLEAR OPTION: Never modify or destroy subnets after creation
  lifecycle {
    ignore_changes = all
  }
}

# Private Subnets (for Lambda, RDS)
# SKIP when use_existing_vpc = true (subnets already exist in AWS)
resource "aws_subnet" "private" {
  count = var.use_existing_vpc ? 0 : length(var.private_subnet_cidrs)

  vpc_id            = local.vpc_id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "warmpawz-${var.environment}-private-${count.index + 1}"
    Environment = var.environment
    Type        = "private"
  }

  # NUCLEAR OPTION: Never modify or destroy subnets after creation
  lifecycle {
    ignore_changes = all
  }
}

# Database Subnets (isolated for RDS)
# SKIP when use_existing_vpc = true (subnets already exist in AWS)
resource "aws_subnet" "database" {
  count = var.use_existing_vpc ? 0 : length(var.database_subnet_cidrs)

  vpc_id            = local.vpc_id
  cidr_block        = var.database_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "warmpawz-${var.environment}-database-${count.index + 1}"
    Environment = var.environment
    Type        = "database"
  }

  # NUCLEAR OPTION: Never modify or destroy subnets after creation
  lifecycle {
    ignore_changes = all
  }
}

# Data source for existing Internet Gateway (when use_existing_vpc = true)
data "aws_internet_gateway" "existing" {
  count = var.use_existing_vpc ? 1 : 0

  filter {
    name   = "attachment.vpc-id"
    values = [local.vpc_id]
  }
}

# Data source for existing NAT Gateway (when use_existing_vpc = true)
data "aws_nat_gateways" "existing" {
  count = var.use_existing_vpc ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

# Get details of first existing NAT Gateway
data "aws_nat_gateway" "existing" {
  count = var.use_existing_vpc && length(data.aws_nat_gateways.existing) > 0 ? 1 : 0

  id = length(data.aws_nat_gateways.existing[0].ids) > 0 ? data.aws_nat_gateways.existing[0].ids[0] : null
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  count = var.use_existing_vpc ? 0 : 1

  vpc_id = local.vpc_id

  tags = {
    Name        = "warmpawz-${var.environment}-igw"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = all
  }
}

# Elastic IP for NAT Gateway
# CRITICAL: Don't create if using existing VPC (resources already exist)
resource "aws_eip" "nat" {
  count = var.use_existing_vpc ? 0 : (var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.public_subnet_cidrs)) : 0)

  domain = "vpc"

  tags = {
    Name        = "warmpawz-${var.environment}-nat-eip-${count.index + 1}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.main]

  lifecycle {
    ignore_changes = all
  }
}

# NAT Gateway (for private subnet internet access)
# CRITICAL: Don't create if using existing VPC (resources already exist)
resource "aws_nat_gateway" "main" {
  count = var.use_existing_vpc ? 0 : (var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.public_subnet_cidrs)) : 0)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name        = "warmpawz-${var.environment}-nat-${count.index + 1}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.main]

  lifecycle {
    ignore_changes = all
  }
}

# Optional: create one NAT gateway when using existing VPC, or use existing_nat_gateway_id (e.g. created via AWS CLI).
resource "aws_eip" "nat_existing_vpc" {
  count = var.use_existing_vpc && var.create_nat_gateway_in_existing_vpc && (var.existing_nat_gateway_id == null || var.existing_nat_gateway_id == "") ? 1 : 0

  domain = "vpc"

  tags = {
    Name        = "warmpawz-${var.environment}-nat-eip"
    Environment = var.environment
  }
}

resource "aws_nat_gateway" "existing_vpc" {
  count = var.use_existing_vpc && var.create_nat_gateway_in_existing_vpc && (var.existing_nat_gateway_id == null || var.existing_nat_gateway_id == "") ? 1 : 0

  allocation_id = aws_eip.nat_existing_vpc[0].id
  subnet_id     = local.public_subnet_ids[0]

  tags = {
    Name        = "warmpawz-${var.environment}-nat"
    Environment = var.environment
  }
}

# Route Table - Public
# SKIP when use_existing_vpc = true (route tables already exist in AWS)
resource "aws_route_table" "public" {
  count = var.use_existing_vpc ? 0 : 1

  vpc_id = local.vpc_id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main[0].id
  }

  tags = {
    Name        = "warmpawz-${var.environment}-public-rt"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = all  # NUCLEAR OPTION: Never modify after import
  }
}

# Route Table - Private
# SKIP when use_existing_vpc = true (route tables already exist in AWS)
resource "aws_route_table" "private" {
  count = var.use_existing_vpc ? 0 : (var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.private_subnet_cidrs)) : 1)

  vpc_id = local.vpc_id

  # Route to NAT Gateway for internet access
  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = var.single_nat_gateway ? aws_nat_gateway.main[0].id : aws_nat_gateway.main[count.index].id
    }
  }

  tags = {
    Name        = "warmpawz-${var.environment}-private-rt-${count.index + 1}"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = all  # NUCLEAR OPTION: Never modify after import
  }
}

# Route Table - Database
# SKIP when use_existing_vpc = true (route tables already exist in AWS)
resource "aws_route_table" "database" {
  count = var.use_existing_vpc ? 0 : 1

  vpc_id = local.vpc_id

  tags = {
    Name        = "warmpawz-${var.environment}-database-rt"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = all  # NUCLEAR OPTION: Never modify after import
  }
}

# Route Table Associations - Public
# SKIP when use_existing_vpc = true (associations already exist in AWS)
resource "aws_route_table_association" "public" {
  count = var.use_existing_vpc ? 0 : length(var.public_subnet_cidrs)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id

  lifecycle {
    ignore_changes = all  # NUCLEAR OPTION: Never modify after import
  }
}

# Route Table Associations - Private
# SKIP when use_existing_vpc = true (associations already exist in AWS)
resource "aws_route_table_association" "private" {
  count = var.use_existing_vpc ? 0 : length(var.private_subnet_cidrs)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = var.single_nat_gateway ? aws_route_table.private[0].id : aws_route_table.private[count.index].id

  lifecycle {
    ignore_changes = all  # NUCLEAR OPTION: Never modify after import
  }
}

# Route Table Associations - Database
# SKIP when use_existing_vpc = true (associations already exist in AWS)
resource "aws_route_table_association" "database" {
  count = var.use_existing_vpc ? 0 : length(var.database_subnet_cidrs)

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database[0].id

  lifecycle {
    ignore_changes = all  # NUCLEAR OPTION: Never modify after import
  }
}

# VPC Endpoints for AWS Services (reduce costs & improve security)
# SKIP when use_existing_vpc = true (endpoints may already exist, route tables aren't managed)
resource "aws_vpc_endpoint" "s3" {
  count = var.use_existing_vpc ? 0 : 1

  vpc_id       = local.vpc_id
  service_name = "com.amazonaws.${var.aws_region}.s3"

  route_table_ids = concat(
    [aws_route_table.public[0].id],
    aws_route_table.private[*].id,
    [aws_route_table.database[0].id]
  )

  tags = {
    Name        = "warmpawz-${var.environment}-s3-endpoint"
    Environment = var.environment
  }
}

resource "aws_vpc_endpoint" "dynamodb" {
  count = var.use_existing_vpc ? 0 : 1

  vpc_id       = local.vpc_id
  service_name = "com.amazonaws.${var.aws_region}.dynamodb"

  route_table_ids = concat(
    [aws_route_table.public[0].id],
    aws_route_table.private[*].id
  )

  tags = {
    Name        = "warmpawz-${var.environment}-dynamodb-endpoint"
    Environment = var.environment
  }
}

# Security Group for VPC Endpoints
# SKIP when use_existing_vpc = true (not managing VPC endpoints)
resource "aws_security_group" "vpc_endpoints" {
  count = var.use_existing_vpc ? 0 : 1

  name_prefix = "warmpawz-${var.environment}-vpc-endpoints-"
  description = "Security group for VPC endpoints"
  vpc_id      = local.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "warmpawz-${var.environment}-vpc-endpoints-sg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# VPC Endpoints for Lambda, Secrets Manager, etc.
# SKIP when use_existing_vpc = true (VPC endpoints may already exist)
resource "aws_vpc_endpoint" "secrets_manager" {
  count = var.use_existing_vpc ? 0 : (var.create_private_endpoints ? 1 : 0)

  vpc_id              = local.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = local.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name        = "warmpawz-${var.environment}-secretsmanager-endpoint"
    Environment = var.environment
  }
}

resource "aws_vpc_endpoint" "sns" {
  count = var.use_existing_vpc ? 0 : (var.create_private_endpoints ? 1 : 0)

  vpc_id              = local.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.sns"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = local.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name        = "warmpawz-${var.environment}-sns-endpoint"
    Environment = var.environment
  }
}

resource "aws_vpc_endpoint" "sqs" {
  count = var.use_existing_vpc ? 0 : (var.create_private_endpoints ? 1 : 0)

  vpc_id              = local.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.sqs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = local.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name        = "warmpawz-${var.environment}-sqs-endpoint"
    Environment = var.environment
  }
}

