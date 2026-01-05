# CloudFront Module Outputs

output "distributions" {
  description = "Map of CloudFront distribution details"
  value = {
    for k, v in aws_cloudfront_distribution.frontend : k => {
      id                 = v.id
      arn                = v.arn
      domain_name        = v.domain_name
      hosted_zone_id     = v.hosted_zone_id
      status             = v.status
      aliases            = v.aliases
    }
  }
}

output "s3_buckets" {
  description = "Map of S3 bucket details for frontend apps (existing buckets referenced by Terraform)"
  value = {
    for k, v in data.aws_s3_bucket.frontend : k => {
      id          = v.id
      arn         = v.arn
      bucket      = v.bucket
      domain_name = v.bucket_regional_domain_name
    }
  }
}

output "distribution_ids" {
  description = "Map of CloudFront distribution IDs"
  value = {
    for k, v in aws_cloudfront_distribution.frontend : k => v.id
  }
}

output "bucket_names" {
  description = "Map of S3 bucket names (existing buckets, not created by Terraform)"
  value = {
    for k, v in data.aws_s3_bucket.frontend : k => v.bucket
  }
}

