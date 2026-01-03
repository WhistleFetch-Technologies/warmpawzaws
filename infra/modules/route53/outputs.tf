# Route53 Module Outputs

output "zone_id" {
  description = "Route53 hosted zone ID"
  value       = data.aws_route53_zone.main.zone_id
}

output "zone_name" {
  description = "Route53 hosted zone name"
  value       = data.aws_route53_zone.main.name
}

output "api_domain_name" {
  description = "Custom domain name for API Gateway"
  value       = var.api_gateway_regional_endpoint != null ? aws_apigatewayv2_domain_name.api[0].domain_name : null
}

output "api_target_domain_name" {
  description = "Target domain name for API Gateway custom domain"
  value       = var.api_gateway_regional_endpoint != null ? aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name : null
}

output "cloudfront_records" {
  description = "Map of created CloudFront DNS records"
  value = {
    for k, v in aws_route53_record.cloudfront : k => {
      fqdn    = v.fqdn
      name    = v.name
      type    = v.type
    }
  }
}

