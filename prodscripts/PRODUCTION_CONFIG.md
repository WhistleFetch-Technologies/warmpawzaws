# Production Environment Configuration

This document contains all production environment details retrieved from AWS CLI on 2026-02-09.

## S3 Buckets

| Application | Bucket Name |
|------------|-------------|
| Admin | `warmpawz-prod-admin-frontend-ap-south-1` |
| Vendor | `warmpawz-prod-vendor-frontend-ap-south-1` |
| Customer | `warmpawz-prod-customer-frontend-ap-south-1` |

## CloudFront Distributions

| Application | Distribution ID | CloudFront URL |
|------------|----------------|----------------|
| Admin | `E2NHO6UUI5UIHW` | `https://dbr09zyoq9akb.cloudfront.net` |
| Vendor | `E3JDHOY1XIFOWE` | `https://d1y5ywletev82x.cloudfront.net` |
| Customer | `E2F29N49KVOOBP` | `https://dg69gqp2frh39.cloudfront.net` |

## API Gateway

| Environment | API Name | Endpoint |
|------------|----------|----------|
| Production | `warmpawz-prod-api` | `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com` |
| API ID | `mss9sa4y01` | |

## AWS Region

- **Region**: `ap-south-1` (Asia Pacific - Mumbai)

## Terraform Outputs

These values can also be retrieved from Terraform:

```bash
cd infra/envs/prod
terraform output -json prod_frontend_bucket_names
terraform output -json cloudfront_distribution_ids
terraform output -json cloudfront_urls
terraform output -raw api_endpoint
```

### Expected Terraform Outputs:

**S3 Buckets:**
```json
{
  "admin": "warmpawz-prod-admin-frontend-ap-south-1",
  "customer": "warmpawz-prod-customer-frontend-ap-south-1",
  "vendor": "warmpawz-prod-vendor-frontend-ap-south-1"
}
```

**CloudFront Distribution IDs:**
```json
{
  "admin": "E2NHO6UUI5UIHW",
  "customer": "E2F29N49KVOOBP",
  "vendor": "E3JDHOY1XIFOWE"
}
```

**CloudFront URLs:**
```json
{
  "admin": "https://dbr09zyoq9akb.cloudfront.net",
  "customer": "https://dg69gqp2frh39.cloudfront.net",
  "vendor": "https://d1y5ywletev82x.cloudfront.net"
}
```

**API Endpoint:**
```
https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/
```

## Verification Commands

### Verify S3 Buckets
```bash
aws s3 ls | grep "warmpawz-prod.*frontend"
```

### Verify CloudFront Distributions
```bash
aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[0].DomainName | contains(@, 'warmpawz-prod')].{Id:Id,DomainName:DomainName,Status:Status}" --output table
```

### Verify API Gateway
```bash
aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-prod-api'].{Name:Name,ApiEndpoint:ApiEndpoint}" --output table
```

## Notes

- All CloudFront distributions are in "Deployed" status
- All S3 buckets are in `ap-south-1` region
- API Gateway endpoint does not have a trailing slash in production scripts
- These values are hardcoded in the production deployment scripts for reliability
