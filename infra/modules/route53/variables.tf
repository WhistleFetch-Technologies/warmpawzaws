# Route53 Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Root domain name (e.g., warmpawz.com)"
  type        = string
}

variable "api_subdomain" {
  description = "API subdomain (e.g., api.warmpawz.com or dev.api.warmpawz.com)"
  type        = string
  default     = null
}

variable "regional_certificate_arn" {
  description = "ARN of the regional ACM certificate"
  type        = string
  default     = null
}

variable "api_gateway_id" {
  description = "API Gateway ID"
  type        = string
  default     = null
}

variable "api_gateway_regional_endpoint" {
  description = "API Gateway regional endpoint"
  type        = string
  default     = null
}

variable "api_stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "$default"
}

variable "cloudfront_records" {
  description = "Map of CloudFront distribution records to create"
  type = map(object({
    subdomain                  = string
    cloudfront_domain          = string
    cloudfront_hosted_zone_id  = string
  }))
  default = {}
}

variable "enable_health_checks" {
  description = "Enable Route53 health checks"
  type        = bool
  default     = false
}

