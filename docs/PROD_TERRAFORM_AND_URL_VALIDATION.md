# Prod Terraform & URL Propagation Validation

This doc validates (1) Terraform prod configuration and (2) that all endpoints and frontends use the **prod URL from variables / Terraform outputs / CloudFront**.

---

## 1. Terraform validation

### How to validate

- **In CI (recommended):** The prod workflow runs `terraform init -backend-config=backend.hcl` and `terraform plan` in `infra/envs/prod`. A successful plan implies the configuration is valid.
- **Locally:** From repo root:
  ```bash
  cd infra/envs/prod
  terraform init -backend-config=backend.hcl   # requires AWS creds for state
  terraform validate
  ```

### Prod Terraform layout (validated)

| Item | Source | Notes |
|------|--------|--------|
| **API endpoint** | `module.api_gateway.stage_invoke_url` | Prod outputs expose as `api_endpoint`. |
| **CloudFront IDs** | `module.cloudfront.distribution_ids` | Map: admin, vendor, customer. |
| **CloudFront URLs** | `module.cloudfront.distributions` → `https://${v.domain_name}` | Used in CORS and docs. |
| **CORS** | `local.cors_allowed_origins` | `cors_prod_domains` + CloudFront URLs; used by API Gateway and S3 (uploads bucket). |
| **Frontend buckets** | `aws_s3_bucket.prod_frontend` | Names in `prod_frontend_bucket_names` output. |

### Single source of truth for prod API URL

- **Terraform:** `infra/envs/prod/outputs.tf` → `output "api_endpoint"` = `module.api_gateway.stage_invoke_url`.
- **Pipeline:** Exported in the `terraform-apply` job and passed to later jobs as `needs.terraform-apply.outputs.api_endpoint`.

---

## 2. Where prod URL is used (all from variables/CloudFront/Terraform)

### Pipeline (GitHub Actions)

| Step | Variable / source | Purpose |
|------|-------------------|---------|
| Terraform apply | `terraform output -raw api_endpoint` | Exported to job output. |
| Build admin-web | `NEXT_PUBLIC_API_BASE_URL: ${{ needs.terraform-apply.outputs.api_endpoint }}` | Build-time API URL. |
| Build vendor-web | `NEXT_PUBLIC_API_BASE_URL: ${{ needs.terraform-apply.outputs.api_endpoint }}` | Build-time API URL. |
| Build customer-web | `NEXT_PUBLIC_API_BASE_URL: ${{ needs.terraform-apply.outputs.api_endpoint }}` | Build-time API URL. |
| Deploy web | `runtime-config.js` injected with prod API URL (see below) | Runtime API URL for all three apps. |
| CloudFront invalidations | `needs.terraform-apply.outputs.cloudfront_*_id` | Admin, vendor, customer. |
| Readiness summary | `needs.terraform-apply.outputs.api_endpoint` | Display only. |

### Terraform (prod)

| Consumer | Source | Purpose |
|----------|--------|---------|
| API Gateway CORS | `local.cors_allowed_origins` | Prod domains + CloudFront URLs. |
| S3 uploads bucket CORS | `local.cors_allowed_origins` | Same list. |
| Cognito callback/logout URLs | Hardcoded prod domains in `main.tf` | admin/vendor/customer.warmpawz.com. |

### Frontend apps (runtime)

- **Build:** All three apps are built with `NEXT_PUBLIC_API_BASE_URL` set from the Terraform output (see table above).
- **Runtime:** Each app loads `/runtime-config.js`, which is **injected at deploy** with `__API_BASE_URL__` = prod API URL (see workflow step “Inject runtime-config.js (prod API URL)”). So at runtime the API base URL comes from Terraform → pipeline → injected file, not from a hardcoded dev URL.

---

## 3. CloudFront propagation

- **CORS:** API Gateway and S3 use `local.cors_allowed_origins`, which includes the three prod CloudFront URLs from `module.cloudfront.distributions`. No manual CORS update needed after deploy.
- **Custom domains:** If `prod_cloudfront_certificate_arn` is set, CloudFront uses admin/vendor/customer.warmpawz.com; those are already in `cors_prod_domains`.
- **Mark once created:** After first deploy, record the three prod CloudFront URLs from `terraform output cloudfront_urls` (see `docs/PROD_CLOUDFRONT_URLS.md`).

---

## 4. Checklist

- [x] Prod API URL comes from Terraform output only (no hardcoded prod URL in repo).
- [x] All three frontends get prod API URL at build via `NEXT_PUBLIC_API_BASE_URL` from pipeline.
- [x] runtime-config.js is injected at deploy with prod API URL so runtime uses it.
- [x] CORS uses `local.cors_allowed_origins` (prod domains + CloudFront URLs from Terraform).
- [x] CloudFront distribution IDs and bucket names come from Terraform outputs and are used by the deploy job.
