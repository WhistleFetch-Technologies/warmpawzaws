# ACM Module Outputs

output "certificate_arn" {
  description = "ARN of the ACM certificate (us-east-1 for CloudFront)"
  value       = aws_acm_certificate.main.arn
}

output "certificate_domain_name" {
  description = "Domain name of the certificate"
  value       = aws_acm_certificate.main.domain_name
}

output "certificate_status" {
  description = "Status of the certificate"
  value       = aws_acm_certificate.main.status
}

output "validated_certificate_arn" {
  description = "ARN of the validated certificate"
  value       = aws_acm_certificate_validation.main.certificate_arn
}

output "regional_certificate_arn" {
  description = "ARN of the regional certificate (for API Gateway)"
  value       = var.create_regional_cert ? aws_acm_certificate.regional[0].arn : null
}

output "regional_validated_certificate_arn" {
  description = "ARN of the validated regional certificate"
  value       = var.create_regional_cert ? aws_acm_certificate_validation.regional[0].certificate_arn : null
}

