# CloudFront Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region where resources are created"
  type        = string
}

variable "frontend_apps" {
  description = <<-EOT
    Map of frontend applications to deploy.
    
    IMPORTANT: bucket_name must reference an EXISTING S3 bucket.
    Terraform will NOT create the bucket - it must already exist.
    
    This prevents "BucketAlreadyOwnedByYou" errors and makes deployments idempotent.
  EOT
  type = map(object({
    bucket_name = string  # REQUIRED: Name of existing S3 bucket
    domain      = string  # Optional custom domain (null for CloudFront default)
    description = string  # Human-readable description
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

