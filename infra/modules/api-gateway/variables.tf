variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "$default"
}

variable "auto_deploy" {
  description = "Enable auto-deployment"
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]
}

variable "throttle_burst_limit" {
  description = "API throttle burst limit"
  type        = number
  default     = 5000
}

variable "throttle_rate_limit" {
  description = "API throttle rate limit (requests per second)"
  type        = number
  default     = 10000
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN for authorizer"
  type        = string
  default     = null
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
  default     = null
}

variable "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  type        = string
  default     = null
}

variable "lambda_integrations" {
  description = "Map of Lambda integrations"
  type = map(object({
    invoke_arn    = string
    function_name = string
    timeout_ms    = number
  }))
}

variable "routes" {
  description = "Map of API routes"
  type = map(object({
    route_key       = string
    integration_key = string
    require_auth    = optional(bool)
  }))
}

variable "custom_domain_name" {
  description = "Custom domain name for API"
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

variable "error_5xx_threshold" {
  description = "5XX error alarm threshold"
  type        = number
  default     = 10
}

variable "error_4xx_threshold" {
  description = "4XX error alarm threshold"
  type        = number
  default     = 50
}

variable "latency_threshold" {
  description = "Latency alarm threshold (ms)"
  type        = number
  default     = 5000
}

variable "alarm_actions" {
  description = "SNS topic ARNs for alarms"
  type        = list(string)
  default     = []
}

variable "existing_api_gateway_id" {
  description = "Existing API Gateway ID to reference (instead of creating new). Set this to reuse an existing API Gateway."
  type        = string
  default     = null
}

