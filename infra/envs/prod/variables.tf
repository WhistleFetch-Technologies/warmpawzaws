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

# ============================================
# External Integration Variables
# ============================================

variable "razorpay_key_id" {
  description = "Razorpay API Key ID (use rzp_live_... for production)"
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
  description = "Google Maps API key"
  type        = string
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
