# ACM Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name for the certificate"
  type        = string
}

variable "subject_alternative_names" {
  description = "List of subject alternative names"
  type        = list(string)
  default     = []
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for DNS validation"
  type        = string
}

variable "create_regional_cert" {
  description = "Whether to create a regional certificate (for API Gateway)"
  type        = bool
  default     = true
}

variable "skip_validation" {
  description = "Skip certificate validation (use when certificate already exists and is validated)"
  type        = bool
  default     = false
}

