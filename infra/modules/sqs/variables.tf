variable "environment" {
  description = "Environment name"
  type        = string
}

variable "age_alarm_threshold" {
  description = "Age of oldest message alarm threshold (seconds)"
  type        = number
  default     = 600 # 10 minutes
}

variable "alarm_actions" {
  description = "SNS topic ARNs for alarms"
  type        = list(string)
  default     = []
}

