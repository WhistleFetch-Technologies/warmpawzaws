variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "alert_emails" {
  description = "Email addresses for alerts"
  type        = list(string)
  default     = []
}

variable "enable_opensearch" {
  description = "Enable OpenSearch (optional for dev)"
  type        = bool
  default     = false
}

variable "opensearch_master_password" {
  description = "OpenSearch master password"
  type        = string
  sensitive   = true
  default     = ""
}

