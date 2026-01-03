variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-south-1"
}

variable "alert_emails" {
  description = "Email addresses for alerts"
  type        = list(string)
  default     = []
}

variable "enable_opensearch" {
  description = "Enable OpenSearch/Elasticsearch"
  type        = bool
  default     = true
}

variable "opensearch_master_password" {
  description = "OpenSearch master password"
  type        = string
  sensitive   = true
  default     = ""
}

# External Integration Secrets

variable "razorpay_key_id" {
  description = "Razorpay API Key ID"
  type        = string
  sensitive   = true
}

variable "razorpay_key_secret" {
  description = "Razorpay API Key Secret"
  type        = string
  sensitive   = true
}

variable "google_maps_api_key" {
  description = "Google Maps API Key"
  type        = string
  sensitive   = true
}

variable "shiprocket_email" {
  description = "Shiprocket account email"
  type        = string
  sensitive   = true
}

variable "shiprocket_password" {
  description = "Shiprocket account password"
  type        = string
  sensitive   = true
}
