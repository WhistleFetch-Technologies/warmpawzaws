variable "environment" {
  description = "Environment name"
  type        = string
}

variable "alert_emails" {
  description = "Email addresses for system alerts"
  type        = list(string)
  default     = []
}

