# CloudFront Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "frontend_apps" {
  description = "Map of frontend applications to deploy"
  type = map(object({
    domain      = string
    description = string
  }))
  default = {}
}

variable "certificate_arn" {
  description = "ACM certificate ARN for custom domains"
  type        = string
  default     = null
}

variable "enable_versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = false
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_200" # Use Asia, Europe, and North America
}

variable "alarm_actions" {
  description = "List of ARNs for alarm actions"
  type        = list(string)
  default     = []
}

