variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "database_subnet_ids" {
  description = "Database subnet IDs (used when subnet group is created fresh)"
  type        = list(string)
}

variable "use_existing_subnet_group_vpc" {
  description = "When true, look up existing DB subnet group by name and use subnets from its VPC (fixes 'not in the same Vpc as the existing subnet group')"
  type        = bool
  default     = false
}

variable "allowed_security_groups" {
  description = "Security groups allowed to access RDS"
  type        = list(string)
}

variable "database_name" {
  description = "Initial database name"
  type        = string
  default     = "warmpawz"
}

variable "master_username" {
  description = "Master username for RDS"
  type        = string
  default     = "warmpawz_admin"
}

variable "min_capacity" {
  description = "Minimum ACU capacity"
  type        = number
  default     = 0.5
}

variable "max_capacity" {
  description = "Maximum ACU capacity"
  type        = number
  default     = 1.0
}

variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "preferred_backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "preferred_maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "kms_key_id" {
  description = "KMS key ID for encryption (optional)"
  type        = string
  default     = null
}

variable "availability_zones" {
  description = "Availability zones for the cluster"
  type        = list(string)
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot on deletion"
  type        = bool
  default     = false
}

variable "instance_count" {
  description = "Number of Aurora instances"
  type        = number
  default     = 1
}

variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "cpu_alarm_threshold" {
  description = "CPU utilization alarm threshold (%)"
  type        = number
  default     = 80
}

variable "connections_alarm_threshold" {
  description = "Database connections alarm threshold"
  type        = number
  default     = 100
}

variable "alarm_actions" {
  description = "SNS topic ARNs for alarms"
  type        = list(string)
  default     = []
}

