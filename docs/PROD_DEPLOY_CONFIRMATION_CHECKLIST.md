# Production deploy — confirmation checklist

**Use this to confirm the plan before you run the prod pipeline (Terraform apply, migrations, deploy).**

---

## 1. Cognito

| Item | Plan |
|------|------|
| **Scope** | **Prod-only** user pool and app clients (separate from dev). |
| **Terraform** | `module "cognito"` in `infra/envs/prod/main.tf`: one user pool, clients for admin-web, vendor-web, customer-web, mobile_customer, mobile_vendor. Callbacks/logout use prod domains (admin.warmpawz.com, vendor.warmpawz.com, customer.warmpawz.com, www.warmpawz.com). |
| **Idempotency** | User pool clients have `lifecycle { ignore_changes = [...] }` for OAuth/callback so repeated plans don’t keep changing them. |
| **Admin user** | **Not** created by Terraform or pipeline. One-time: create admin@warmpawz.com in prod Cognito (e.g. via script or AWS console) as part of bootstrap. |

**Confirm:** Prod Cognito is separate from dev; only prod pool/clients are created/updated; admin user is one-time bootstrap.

---

## 2. SNS

| Item | Plan |
|------|------|
| **Scope** | **Prod-only** topics (separate from dev). |
| **Terraform** | `module "sns"` in prod: system-alerts, user-notifications, vendor-notifications, booking-updates, payment-events. Alert emails from `var.alert_emails`. |
| **Lambda** | Prod Lambda gets `SNS_NOTIFICATIONS_TOPIC_ARN`, `SNS_BOOKING_TOPIC_ARN`, `SNS_PAYMENT_TOPIC_ARN`. |

**Confirm:** Prod SNS topics are prod-only; no shared SNS with dev.

---

## 3. S3

| Item | Plan |
|------|------|
| **Scope** | **Prod-only** buckets (separate from dev). |
| **Terraform** | `module "s3"`: user-uploads, backups, logs, static (shared module, env-scoped names). Plus `aws_s3_bucket.prod_frontend["admin"]`, `["vendor"]`, `["customer"]` for CloudFront. |
| **Naming** | e.g. `warmpawz-prod-user-uploads-*`, `warmpawz-prod-admin-frontend-ap-south-1`, etc. |

**Confirm:** All prod S3 buckets are prod-only; no shared buckets with dev.

---

## 4. RDS Cluster

| Item | Plan |
|------|------|
| **Scope** | **Prod-only** Aurora Serverless v2 cluster (separate from dev). |
| **Terraform** | `module "rds"` in prod: one cluster, DB name `warmpawz`, in existing prod VPC/database subnets. Allowed ingress: prod Lambda SG only. Backup 30 days, deletion protection on, 3 instances (HA). |
| **Secrets** | Master password in Secrets Manager (prod secret); Lambda gets `DB_HOST`, `DB_SECRET_ARN`, etc. |

**Confirm:** Prod RDS is prod-only; uses existing VPC/subnets; only prod Lambda can connect.

---

## 5. Lambda

| Item | Plan |
|------|------|
| **Scope** | **Prod-only** functions (separate from dev). |
| **Terraform** | `module "lambda"` in prod: `api-handler` (Node 20, 2048 MB, 30s, reserved concurrency 100). Uses existing VPC/private subnets and prod RDS, DynamoDB, S3, SNS, SQS, OpenSearch, secrets. |
| **Zip** | Pipeline builds backend and uploads `api-handler.zip`; Terraform apply uses that artifact. |

**Confirm:** Prod Lambda is prod-only; one api-handler; uses prod DB/S3/SNS/etc.

---

## 6. CloudFront

| Item | Plan |
|------|------|
| **Scope** | **Prod-only** distributions (separate from dev). |
| **Terraform** | `module "cloudfront"` in prod: three distributions (admin, vendor, customer), each with prod frontend S3 bucket, URL rewrite for static export, optional custom domain (admin/vendor/customer.warmpawz.com) if cert ARN set. |
| **Deploy** | After Terraform apply, pipeline builds admin/vendor/customer web, syncs to prod S3 buckets, invalidates these three CloudFront distributions. |

**Confirm:** Prod CloudFront is three prod-only distributions; dev has its own distributions.

---

## 7. DB migration + admin configuration

| Item | Plan |
|------|------|
| **Schema migrations** | **Pipeline runs every time** (after Terraform apply). Job `database-migrations`: gets prod RDS URL from Terraform outputs → `npm run migrate:up` (all pending migrations in `db/migrations/`) → prod schema brought up to date. |
| **Baseline seed (in pipeline)** | **Pipeline runs every time:** `npm run seed:prod` → runs only `047_seed_roles.sql` and `048_seed_service_catalog.sql` (idempotent). This is **not** full admin config. |
| **Full admin configuration** | **Not in pipeline.** One-time bootstrap: export admin config from **dev** DB (roles, policies, tax, onboarding, platform_settings, etc. per `ADMIN_CONFIG_EXPORT_TABLE_LIST_AND_FINAL_PLAN.md`) → import into **prod** DB. Optional: `scripts/admin-config/check-prod-bootstrap.js` to detect if bootstrap already done. |
| **Admin user (Cognito)** | **Not in pipeline.** One-time: create admin@warmpawz.com in prod Cognito (script or console). |

**Confirm:** Migrations + baseline seed (047/048) run in pipeline; full admin config and admin user are one-time bootstrap only.

---

## 8. Pipeline order (summary)

1. **Confirmation** (manual: type `DEPLOY_TO_PRODUCTION` if workflow_dispatch).
2. **Pre-deployment** (summary).
3. **Build Lambda** → artifact `api-handler.zip`.
4. **Terraform init + plan** (prod state, prod vars, OpenSearch password from secrets).
5. **Final approval** (Environment gate).
6. **Terraform apply** → creates/updates Cognito, SNS, S3, RDS, Lambda, CloudFront, API Gateway, etc. (prod only).
7. **Database migrations** → migrate:up + seed:prod (047/048) against prod RDS.
8. **Build frontends** (admin, vendor, customer) with prod API URL.
9. **Deploy web** → S3 sync + runtime-config.js + CloudFront invalidation.
10. **Warmup Lambdas**, smoke tests, readiness, tag release.

---

## 9. Quick confirm checklist

Before you confirm the run:

- [ ] **Cognito:** Prod-only pool/clients; admin user is one-time bootstrap.
- [ ] **SNS:** Prod-only topics.
- [ ] **S3:** Prod-only buckets (uploads + 3 frontend buckets).
- [ ] **RDS:** Prod-only cluster in existing VPC; migrations + baseline seed in pipeline; full admin config = one-time export/import.
- [ ] **Lambda:** Prod-only api-handler; uses prod DB/S3/SNS/Secrets.
- [ ] **CloudFront:** Prod-only 3 distributions; deploy step syncs S3 and invalidates.
- [ ] **DB migration:** Pipeline runs migrate:up + seed:prod (047/048); full admin config and admin user are **not** in pipeline (one-time bootstrap).

If all checked, you can proceed with the production deployment.
