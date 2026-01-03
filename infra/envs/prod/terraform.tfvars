# Production Environment Variables
aws_region   = "ap-south-1"
alert_emails = ["prod-alerts@warmpawz.com", "sre@warmpawz.com", "cto@warmpawz.com"]

# OpenSearch password - MUST be stored in AWS Secrets Manager
opensearch_master_password = "REPLACE_WITH_SECRET_MANAGER_VALUE"

# Custom domain (optional)
# custom_domain_name = "api.warmpawz.com"
# certificate_arn    = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"
# route53_zone_id    = "Z1234567890ABC"

