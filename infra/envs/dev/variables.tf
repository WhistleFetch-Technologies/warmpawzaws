variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-south-1"
}

variable "alert_emails" {
  description = "Email addresses for alerts"
  type        = list(string)
  default     = []
}

variable "enable_opensearch" {
  description = "Enable OpenSearch/Elasticsearch"
  type        = bool
  default     = true
}

variable "opensearch_master_password" {
  description = "OpenSearch master password"
  type        = string
  sensitive   = true
  default     = ""
}

# External Integration Secrets

variable "razorpay_key_id" {
  description = "Razorpay API Key ID"
  type        = string
  sensitive   = true
}

variable "razorpay_key_secret" {
  description = "Razorpay API Key Secret"
  type        = string
  sensitive   = true
}

variable "razorpay_x_account_number" {
  description = "RazorpayX Current Account number (payout source) for vendor payouts"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_maps_api_key" {
  description = "Google Maps API Key"
  type        = string
  sensitive   = true
}

variable "shiprocket_email" {
  description = "Shiprocket account email"
  type        = string
  sensitive   = true
}

variable "shiprocket_password" {
  description = "Shiprocket account password"
  type        = string
  sensitive   = true
}

variable "skip_cert_validation" {
  description = "Skip certificate validation (certificates will be in PENDING_VALIDATION state)"
  type        = bool
  default     = true
}

variable "uat_jwt_secret" {
  description = "Optional HMAC secret for issuer warmpawz-uat JWTs. Leave empty to use the Lambda code default; if set, must match every environment that signs or verifies those tokens."
  type        = string
  sensitive   = true
  default     = ""
}

variable "uat_jwt_secret_ssm_parameter" {
  description = "When uat_jwt_secret is empty, set UAT_JWT_SECRET from this SSM Parameter (String or SecureString) at apply time—keeps one canonical value in AWS and avoids console/Terraform drift."
  type        = string
  default     = ""
}

variable "enable_delivery_stack" {
  description = "When true and delivery_service_image is set, provisions ECS Fargate + internal ALB for delivery-service and splits API Gateway routes (/delivery, /logistics/pidge/*, /webhooks/pidge, …) to Java via VPC link."
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
  description = "HTTPS Git URL for this monorepo (e.g. https://github.com/org/warmpawzaws.git). When set with delivery stack enabled, provisions CodeBuild to build/push delivery-service and rollout ECS."
  type        = string
  default     = ""
}

variable "delivery_codebuild_branch_ref" {
  description = "Git ref for CodeBuild source_version (examples: refs/heads/main, refs/heads/develop)"
  type        = string
  default     = "refs/heads/main"
}

variable "delivery_codebuild_codestar_connection_arn" {
  description = "Existing CodeConnections (GitHub) ARN. Leave empty to create 'warmpawz-dev-delivery-github'; then complete Pending connection in AWS Console (Developer Tools → Connections)."
  type        = string
  default     = ""
}

variable "delivery_codebuild_use_github_codeconnection" {
  description = "If true, CodeBuild clones via CodeStar connection (typical for private GitHub). If false, no connection (works for public repos; avoids CreateProject OAuth issues with some accounts)."
  type        = bool
  default     = false
}
