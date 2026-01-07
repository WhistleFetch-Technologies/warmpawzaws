variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR for access policy"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for OpenSearch"
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "Security groups allowed to access OpenSearch"
  type        = list(string)
}

variable "engine_version" {
  description = "OpenSearch engine version"
  type        = string
  default     = "OpenSearch_2.11"
}

variable "instance_type" {
  description = "Instance type for data nodes"
  type        = string
  default     = "t3.small.search"
}

variable "instance_count" {
  description = "Number of data nodes"
  type        = number
  default     = 2
}

variable "dedicated_master_enabled" {
  description = "Enable dedicated master nodes"
  type        = bool
  default     = false
}

variable "master_instance_type" {
  description = "Instance type for master nodes"
  type        = string
  default     = "t3.small.search"
}

variable "master_instance_count" {
  description = "Number of master nodes"
  type        = number
  default     = 3
}

variable "zone_awareness_enabled" {
  description = "Enable zone awareness"
  type        = bool
  default     = true
}

variable "availability_zone_count" {
  description = "Number of availability zones"
  type        = number
  default     = 2
}

variable "volume_type" {
  description = "EBS volume type"
  type        = string
  default     = "gp3"
}

variable "volume_size" {
  description = "EBS volume size in GB"
  type        = number
  default     = 20
}

variable "iops" {
  description = "IOPS for gp3 volumes"
  type        = number
  default     = 3000
}

variable "throughput" {
  description = "Throughput for gp3 volumes (MB/s)"
  type        = number
  default     = 125
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
  default     = null
}

variable "advanced_security_enabled" {
  description = "Enable advanced security options"
  type        = bool
  default     = true
}

variable "master_user_name" {
  description = "Master user name"
  type        = string
  default     = "admin"
}

variable "master_user_password" {
  description = "Master user password"
  type        = string
  sensitive   = true
}

variable "snapshot_start_hour" {
  description = "Hour to start automated snapshots (UTC)"
  type        = number
  default     = 3
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "create_service_linked_role" {
  description = "Create service-linked role for OpenSearch"
  type        = bool
  default     = false
}

variable "free_storage_threshold" {
  description = "Free storage alarm threshold (MB)"
  type        = number
  default     = 2000
}

variable "cpu_threshold" {
  description = "CPU utilization alarm threshold (%)"
  type        = number
  default     = 80
}

variable "alarm_actions" {
  description = "SNS topic ARNs for alarms"
  type        = list(string)
  default     = []
}

