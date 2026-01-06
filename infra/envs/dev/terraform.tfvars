# Development Environment Variables
aws_region        = "ap-south-1"
alert_emails      = ["dev-alerts@warmpawz.com"]
enable_opensearch = false

# Certificate validation - set to false to enable custom domains
# When false, Terraform will create validation records and wait for certificate validation
# This is required for CloudFront to accept custom domain requests
skip_cert_validation = false

# OpenSearch password (if enabled)
# opensearch_master_password = "ChangeMeInProduction123!"

