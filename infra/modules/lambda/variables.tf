variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Lambda"
  type        = list(string)
}

variable "lambda_functions" {
  description = "Map of Lambda functions to create"
  type = map(object({
    handler             = string
    runtime             = string
    timeout             = number
    memory_size         = number
    zip_path            = string
    env_vars            = map(string)
    reserved_concurrency = optional(number)
    enable_function_url = optional(bool)
  }))
}

variable "common_env_vars" {
  description = "Common environment variables for all Lambda functions"
  type        = map(string)
  default     = {}
}

variable "secrets_arns" {
  description = "ARNs of Secrets Manager secrets Lambda can access"
  type        = list(string)
  default     = ["*"]
}

variable "s3_arns" {
  description = "ARNs of S3 buckets Lambda can access"
  type        = list(string)
  default     = ["*"]
}

variable "dynamodb_arns" {
  description = "ARNs of DynamoDB tables Lambda can access"
  type        = list(string)
  default     = ["*"]
}

variable "sns_arns" {
  description = "ARNs of SNS topics Lambda can publish to"
  type        = list(string)
  default     = ["*"]
}

variable "sqs_arns" {
  description = "ARNs of SQS queues Lambda can access"
  type        = list(string)
  default     = ["*"]
}

variable "cognito_arns" {
  description = "ARNs of Cognito user pools Lambda can access"
  type        = list(string)
  default     = ["*"]
}

variable "opensearch_arns" {
  description = "ARNs of OpenSearch domains Lambda can access"
  type        = list(string)
  default     = ["*"]
}

variable "dlq_arn" {
  description = "ARN of DLQ for failed invocations"
  type        = string
  default     = null
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "enable_xray" {
  description = "Enable X-Ray tracing"
  type        = bool
  default     = true
}

variable "error_alarm_threshold" {
  description = "Error alarm threshold"
  type        = number
  default     = 5
}

variable "alarm_actions" {
  description = "SNS topic ARNs for alarms"
  type        = list(string)
  default     = []
}

variable "create_shared_layer" {
  description = "Create shared Lambda layer"
  type        = bool
  default     = false
}

variable "layer_zip_path" {
  description = "Path to Lambda layer ZIP file"
  type        = string
  default     = null
}

variable "lambda_runtimes" {
  description = "Compatible Lambda runtimes for layer"
  type        = list(string)
  default     = ["nodejs20.x", "nodejs18.x"]
}

variable "cors_allowed_origins" {
  description = "Allowed origins for Lambda Function URLs"
  type        = list(string)
  default     = ["*"]
}

