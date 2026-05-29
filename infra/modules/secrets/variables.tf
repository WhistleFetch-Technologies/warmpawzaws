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

# RazorpayX Current Account (payout source). Optional; can also be set in secret JSON via Console/CLI.
variable "razorpay_x_account_number" {
  description = "RazorpayX Current Account number (Customer Identifier) for Payouts API - source account for vendor payouts"
  type        = string
  default     = ""
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

# AfterShip (vendor-managed shipping tracking)
variable "aftership_api_key" {
  description = "AfterShip API key (optional; secret can be set via AWS CLI/Console instead)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "aftership_api_secret" {
  description = "AfterShip API secret for webhook verification"
  type        = string
  default     = ""
  sensitive   = true
}

# Push Notifications Configuration
variable "enable_push_notifications" {
  description = "Enable Android push notifications (requires FCM server key)"
  type        = bool
  default     = false
}

variable "enable_ios_push" {
  description = "Enable iOS push notifications (requires APNS certificate)"
  type        = bool
  default     = false
}

variable "fcm_server_key" {
  description = "Firebase Cloud Messaging server key (required if enable_push_notifications is true)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "firebase_service_account_json" {
  description = "Firebase Admin SDK service account JSON for FCM HTTP v1 API (project_id, private_key, client_email). Stored in Secrets Manager as warmpawz/{env}/firebase."
  type        = string
  default     = ""
  sensitive   = true
}

variable "apns_certificate" {
  description = "Apple Push Notification Service certificate (required if enable_ios_push is true)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "apns_private_key" {
  description = "Apple Push Notification Service private key (required if enable_ios_push is true)"
  type        = string
  default     = ""
  sensitive   = true
}
