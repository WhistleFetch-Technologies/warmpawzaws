# Production Environment Variables
aws_region   = "ap-south-1"
alert_emails = ["prod-alerts@warmpawz.com", "sre@warmpawz.com", "cto@warmpawz.com"]

# OpenSearch password - MUST be stored in AWS Secrets Manager
opensearch_master_password = "REPLACE_WITH_SECRET_MANAGER_VALUE"

# Use existing prod VPC and NAT (created via scripts/create-prod-nat-gateway.sh) — fixes "different networks" and subnet-not-exist
existing_vpc_id         = "vpc-02a4893e5e582c4d8"
existing_nat_gateway_id = "nat-09204ef25ae192146"

# Custom domain (optional)
# custom_domain_name = "api.warmpawz.com"
# certificate_arn    = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"
# route53_zone_id    = "Z1234567890ABC"

