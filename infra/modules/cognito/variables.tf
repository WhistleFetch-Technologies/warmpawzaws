variable "environment" {
  description = "Environment name"
  type        = string
}

variable "mfa_configuration" {
  description = "MFA configuration (OFF, OPTIONAL, ON)"
  type        = string
  default     = "OPTIONAL"
}

variable "advanced_security_mode" {
  description = "Advanced security mode (OFF, AUDIT, ENFORCED)"
  type        = string
  default     = "AUDIT"
}

variable "ses_email_identity" {
  description = "SES email identity ARN for sending emails"
  type        = string
  default     = null
}

variable "from_email_address" {
  description = "From email address"
  type        = string
  default     = null
}

variable "lambda_triggers" {
  description = "Lambda triggers for Cognito"
  type        = map(string)
  default     = null
}

variable "customer_callback_urls" {
  description = "Callback URLs for customer app"
  type        = list(string)
}

variable "customer_logout_urls" {
  description = "Logout URLs for customer app"
  type        = list(string)
}

variable "vendor_callback_urls" {
  description = "Callback URLs for vendor app"
  type        = list(string)
}

variable "vendor_logout_urls" {
  description = "Logout URLs for vendor app"
  type        = list(string)
}

variable "admin_callback_urls" {
  description = "Callback URLs for admin app"
  type        = list(string)
}

variable "admin_logout_urls" {
  description = "Logout URLs for admin app"
  type        = list(string)
}

variable "user_uploads_bucket_arn" {
  description = "ARN of S3 bucket for user uploads"
  type        = string
}

variable "api_execution_arn" {
  description = "API Gateway execution ARN"
  type        = string
}

