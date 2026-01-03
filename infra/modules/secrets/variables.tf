# Secrets Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

# Razorpay
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

# Google Maps
variable "google_maps_api_key" {
  description = "Google Maps API Key"
  type        = string
  sensitive   = true
}

# Shiprocket
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

# Push Notifications (optional - use SNS instead of Firebase)
variable "fcm_server_key" {
  description = "Firebase Cloud Messaging server key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "apns_certificate" {
  description = "Apple Push Notification Service certificate (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "apns_private_key" {
  description = "Apple Push Notification Service private key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

