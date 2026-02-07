# Prod CloudFront URLs (mark once created)

After the first successful **Deploy to Production** run, Terraform creates **three** CloudFront distributions for prod (admin, vendor, customer), in addition to dev URLs.

## Where to find them

- **Terraform outputs** (after `terraform apply`):
  - `cloudfront_distribution_ids`: admin, vendor, customer distribution IDs
  - `cloudfront_urls`: `https://<distribution-domain>` for each app

- **GitHub Actions**: The prod workflow exports these and uses them for S3 deploy and invalidation. No manual step required once the pipeline has run.

## Mark once created

After the first prod deploy:

1. Run `terraform output -json cloudfront_urls` in `infra/envs/prod` (or read from the workflow summary).
2. Record the three prod CloudFront URLs (e.g. `https://dxxxx.cloudfront.net`) for admin, vendor, customer.
3. CORS is already updated in Terraform to include these origins (via `local.cors_allowed_origins`).
4. Optional: Add custom domains (admin.warmpawz.com, etc.) by setting `prod_cloudfront_certificate_arn` in prod tfvars and re-applying.

## Summary

| App     | Prod CloudFront (default) | Custom domain (optional)   |
|---------|---------------------------|----------------------------|
| Admin   | `https://<id>.cloudfront.net` | admin.warmpawz.com   |
| Vendor  | `https://<id>.cloudfront.net` | vendor.warmpawz.com  |
| Customer| `https://<id>.cloudfront.net` | customer.warmpawz.com|

Dev continues to use its own CloudFront URLs (e.g. dev.admin.warmpawz.com, dfof7mguaa0a5.cloudfront.net, etc.).
