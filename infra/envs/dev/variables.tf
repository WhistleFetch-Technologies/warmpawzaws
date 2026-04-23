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
