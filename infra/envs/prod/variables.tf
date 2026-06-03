variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-south-1"
}

variable "alert_emails" {
  description = "Email addresses for alerts"
  type        = list(string)
}

variable "opensearch_master_password" {
  description = "OpenSearch master password"
  type        = string
  sensitive   = true
}

variable "custom_domain_name" {
  description = "Custom domain name for API Gateway"
  type        = string
  default     = null
}

variable "certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
  default     = null
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
  default     = null
}

# Optional: ACM cert in us-east-1 for prod CloudFront custom domains (admin/vendor/customer.warmpawz.com)
variable "prod_cloudfront_certificate_arn" {
  description = "ACM certificate ARN (us-east-1) for CloudFront custom domains"
  type        = string
  default     = null
}

# Secrets (placeholders; update values in Secrets Manager after deploy)
variable "razorpay_key_id" {
  description = "Razorpay API Key ID"
  type        = string
  default     = ""
  sensitive   = true
}
variable "razorpay_key_secret" {
  description = "Razorpay API Key Secret"
  type        = string
  default     = ""
  sensitive   = true
}
variable "razorpay_x_account_number" {
  description = "RazorpayX account number"
  type        = string
  default     = ""
  sensitive   = true
}
variable "google_maps_api_key" {
  description = "Google Maps API Key"
  type        = string
  default     = ""
  sensitive   = true
}
variable "shiprocket_email" {
  description = "Shiprocket account email"
  type        = string
  default     = ""
  sensitive   = true
}
variable "shiprocket_password" {
  description = "Shiprocket account password"
  type        = string
  default     = ""
  sensitive   = true
}
variable "meal_delivery_notify_secret" {
  description = "HMAC-style shared secret for Java delivery-service → Lambda POST /internal/meal-delivery/notify"
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_push_notifications" {
  description = "Enable Android push (FCM)"
  type        = bool
  default     = false
}
variable "enable_ios_push" {
  description = "Enable iOS push (APNS)"
  type        = bool
  default     = false
}
variable "fcm_server_key" {
  description = "FCM server key"
  type        = string
  default     = ""
  sensitive   = true
}
variable "apns_certificate" {
  description = "APNS certificate"
  type        = string
  default     = ""
  sensitive   = true
}
variable "apns_private_key" {
  description = "APNS private key"
  type        = string
  default     = ""
  sensitive   = true
}

# Optional: use when prod VPC/subnets were created outside Terraform or to fix "different networks" (RDS/Lambda must be in same VPC)
variable "existing_vpc_id" {
  description = "Prod VPC ID to use (must be the VPC that contains Lambda). Set to avoid tag lookup returning wrong VPC."
  type        = string
  default     = null
}

# Optional: use when NAT gateway was created via AWS CLI (e.g. scripts/create-prod-nat-gateway.sh). Terraform will not create NAT.
variable "existing_nat_gateway_id" {
  description = "Existing NAT gateway ID (e.g. nat-xxxx). When set, Terraform does not create NAT in existing VPC."
  type        = string
  default     = null
}

variable "enable_delivery_stack" {
  description = "When true and delivery_service_image is set, provisions ECS Fargate + internal ALB for delivery-service and splits API Gateway routes (/logistics/pidge/*, /webhooks/pidge, …) to Java via VPC link."
  type        = bool
  default     = false
}

variable "delivery_service_image" {
  description = "Full ECR URI for delivery-service (push from scripts/deploy-delivery-service.sh). Ignored unless enable_delivery_stack is true."
  type        = string
  default     = ""
}

variable "delivery_hibernate_ddl_auto" {
  description = "spring.jpa.hibernate.ddl-auto for ECS tasks (validate recommended on shared RDS)"
  type        = string
  default     = "validate"
}

variable "delivery_codebuild_github_url" {
  description = "HTTPS Git URL for monorepo. When set with delivery stack enabled, provisions CodeBuild to build/push delivery-service."
  type        = string
  default     = ""
}

variable "delivery_codebuild_branch_ref" {
  description = "Git ref for CodeBuild source_version (e.g. refs/heads/main)"
  type        = string
  default     = "refs/heads/main"
}

variable "delivery_codebuild_codestar_connection_arn" {
  description = "Existing CodeConnections (GitHub) ARN for private repos"
  type        = string
  default     = ""
}

variable "delivery_codebuild_use_github_codeconnection" {
  description = "If true, CodeBuild clones via CodeStar connection"
  type        = bool
  default     = false
}

