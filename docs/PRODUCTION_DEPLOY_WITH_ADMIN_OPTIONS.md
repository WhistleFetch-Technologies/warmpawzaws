# Production Deploy with Admin – CI/CD and Configuration Preservation

This doc summarizes the CI/CD pipeline, where admin configuration lives, and **options to deploy production with admin** while preserving policies, roles, service catalog, categories, and CRUD state.

---

## 1. CI/CD pipeline overview

| Workflow | Trigger | What it deploys | Frontend (admin/vendor/customer) |
|----------|---------|------------------|-----------------------------------|
| **Dev** (`.github/workflows/dev.yml`) | Push to `develop` | Lambda (code), admin-web, vendor-web, customer-web → S3 + CloudFront (dev) | ✅ Yes – all three apps to dev buckets |
| **Stage** (`.github/workflows/stage.yml`) | **Push to `main`** (or manual) | Terraform (stage), Lambda, migrations, etc. | Stage env |
| **Prod** (`.github/workflows/prod.yml`) | **Manual only:** Actions → "Deploy to Production" → type `DEPLOY_TO_PRODUCTION` | Terraform (prod infra + Lambda), DB migrations, `npm run seed:prod`, warmup, smoke tests | ❌ **No** – no admin/vendor/customer deploy in prod workflow |

**Important:** Promoting code to production (e.g. merging `develop` → `main`) does **not** trigger the prod workflow. Only **stage** runs on push to `main`. Prod runs only when someone manually triggers "Deploy to Production" in GitHub Actions.

**Important:** The **prod workflow does not build or upload admin-web** (or vendor-web, customer-web). It only runs Terraform, migrations, seed:prod, and tests. Prod Terraform (`infra/envs/prod/main.tf`) also **does not** create S3/CloudFront for frontends (unlike dev, which has a `cloudfront` module for admin, vendor, customer).

---

## 1b. "Promote to production from dev" – does prod CI/CD run? Is data preserved?

| Question | Answer |
|----------|--------|
| **If code is promoted to production from dev (e.g. merge develop → main), does prod CI/CD trigger?** | **No.** Prod workflow is **manual only** (`workflow_dispatch`). Pushing or merging to `main` triggers **stage** (`.github/workflows/stage.yml`), not prod. To deploy to prod you must go to **Actions → "Deploy to Production" → Run workflow** and type `DEPLOY_TO_PRODUCTION`. |
| **When prod workflow runs, does it deploy to a separate prod environment?** | **Yes.** It uses `infra/envs/prod` and Terraform state key `prod/terraform.tfstate`. So prod has its own VPC, RDS, Lambda, API Gateway, etc. – completely separate from dev. |
| **Is admin configuration (data) preserved when prod deploys?** | **Yes.** Migrations run against **prod RDS** (from Terraform outputs). They only add/change schema and run idempotent inserts. `seed:prod` only runs 047 (roles) and 048 (service catalog) with conflict handling. There is no step that truncates or replaces `roles`, `service_catalog`, `cancellation_policies`, `rbac_policies`, etc. So existing prod DB data – all admin configuration and CRUD – is preserved. |

---

## 2. Where admin configuration lives (and how it’s preserved)

All of the following are stored in the **database (RDS)**, not in repo or deploy artifacts:

| Configuration | Table(s) | Preserved when… |
|---------------|----------|------------------|
| Roles | `roles`, `role_permissions` | Migrations/seed use `ON CONFLICT DO NOTHING` or equivalent; re-run does not overwrite. |
| Service catalog | `service_catalog`, `service_categories` | Same; seed:prod runs 048_seed_service_catalog.sql (idempotent). |
| Categories | `service_categories`, catalog category fields | Same. |
| Policies (cancellation, tax, RBAC, etc.) | `cancellation_policies`, `tax_categories`, `rbac_policies`, `gst_configs`, `hsn_codes` | Not touched by seed:prod; only by migrations that add schema or insert missing rows. |
| Admin CRUD state | All of the above + `admin_settings`, etc. | Any change you make in Admin UI is written to **that environment’s RDS**. Deploying new **code** (Lambda, admin-web) does not wipe DB. |

So:

- **Dev** has its own RDS; admin CRUD in dev stays in dev DB.
- **Prod** has its own RDS; admin CRUD in prod stays in prod DB.
- Deploying **application code** (Lambda, admin-web) to prod does **not** erase or reset configuration; it only changes the app/API that reads/writes the **existing** prod DB.

**seed:prod** (used in prod workflow) only runs:

- `db/migrations/047_seed_roles.sql` – roles (insert with conflict handling).
- `db/migrations/048_seed_service_catalog.sql` – service categories + service catalog (idempotent).

It does **not** overwrite or delete existing rows in other config tables (policies, tax, HSN, etc.). So **policies, roles, service catalog, categories, and CRUD state in prod are preserved** across prod deploys as long as you don’t run something that explicitly truncates or replaces those tables.

---

## 3. How to deploy production with admin – options

### Option A: Use the existing prod workflow (no admin UI deploy today)

- **What it does:** Terraform apply (prod infra + Lambda), DB migrations, seed:prod, warmup, smoke tests.
- **What it does not do:** Build or upload admin-web (or any frontend) to prod.
- **Result:** Backend and infra are prod-ready; **admin (and vendor/customer) apps are not updated in prod** by this pipeline. You would need to add a step (or separate process) to deploy admin to prod (see B and C).

### Option B: Add “deploy admin (and frontends)” to the prod workflow

1. **Ensure prod has frontend hosting:** Prod Terraform currently has **no** S3 buckets or CloudFront for admin/vendor/customer. You must either:
   - Add a CloudFront + S3 (or equivalent) module for prod in `infra/envs/prod/main.tf` (similar to dev), and apply it, **or**
   - Create prod S3 buckets and CloudFront distributions manually and record their names/IDs.
2. **Add a job in `.github/workflows/prod.yml`** that:
   - Builds admin-web (and optionally vendor-web, customer-web) with **prod** API URL and env (e.g. `NEXT_PUBLIC_API_BASE_URL` = prod API Gateway).
   - Uploads build output to the **prod** S3 bucket(s).
   - Invalidates the **prod** CloudFront distribution(s).
3. **Secrets:** Use prod API URL (and any prod-only secrets) in that job (e.g. from GitHub secrets or Terraform outputs).

**Configuration:** Unchanged. Admin in prod keeps using **prod RDS**; all existing policies, roles, catalog, categories, and CRUD state remain.

### Option C: Deploy admin to prod via scripts (manual or separate workflow)

The repo’s **deploy scripts are dev-only** today (see `.cursor/rules/deployment.mdc`):

- `./scripts/deploy-admin-web.sh` → uses `warmpawz-dev-admin-frontend-ap-south-1`, dev API URL, dev CloudFront ID.

To deploy **admin to production** with the same pattern:

1. **Create prod frontend resources** (if not already): prod S3 bucket(s) and CloudFront for admin (and optionally vendor/customer), e.g. by adding a prod CloudFront module in Terraform or creating them manually.
2. **Add a prod-aware deploy script** (e.g. `deploy-admin-web-prod.sh` or `deploy-admin-web.sh` with `--env prod`) that:
   - Uses **prod** S3 bucket name and CloudFront distribution ID.
   - Uses **prod** API Gateway URL for `runtime-config.js` (or equivalent).
   - Builds admin-web with prod env and runs `aws s3 sync` + CloudFront invalidation to prod.
3. Run that script **manually** or from a separate “Deploy prod frontend” workflow (triggered manually or by tag).

**Configuration:** Again, prod DB is untouched by code deploy; all config (policies, roles, catalog, categories, CRUD) in prod is preserved.

### Option D: Copy configuration from dev to prod (same state as dev)

If you want **prod’s** config (roles, catalog, policies, categories, etc.) to **match dev** (e.g. after you’ve done a lot of CRUD in admin in dev):

- **Option D1 – Export/import:** Export config tables from **dev RDS** (e.g. `roles`, `role_permissions`, `service_catalog`, `service_categories`, `cancellation_policies`, `rbac_policies`, `tax_categories`, `hsn_codes`, `admin_settings`) and import into **prod RDS** (scripts or pg_dump/restore for those tables). This overwrites prod config with dev’s.
- **Option D2 – Seed only:** Rely only on migrations + seed:prod in prod. Prod will get the **baseline** from 047 + 048 (roles + service catalog); any **extra** CRUD you did in admin in dev will **not** be in prod unless you replicate it (manually, or via D1).

So: **to preserve “all configuration and CRUD applied in admin” in prod**, you either (1) do that CRUD in prod’s admin and keep using prod DB only (Options B/C), or (2) copy that state from dev to prod (Option D1).

---

## 4. Summary table

| Goal | Approach |
|------|----------|
| Deploy **backend** to prod | Use existing prod workflow (Terraform + Lambda + migrations + seed:prod). |
| Deploy **admin app** to prod | Add prod frontend deploy to prod workflow (Option B) or use a prod deploy script (Option C); ensure prod S3/CloudFront exist first. |
| **Preserve** policies, roles, catalog, categories, CRUD in prod | They live in prod RDS; code deploys do not wipe them. seed:prod is idempotent and only seeds roles + catalog. |
| **Reuse** exact dev config in prod | Export config tables from dev RDS and import into prod RDS (Option D1). |

---

## 5. Production: Secrets, config migration, Terraform, admin seed, UAT, SMS/SNS

| Question | Answer |
|----------|--------|
| **Separate Secrets Manager for production?** | **No.** Dev has `module "secrets"` (Razorpay, Google Maps, Shiprocket) and passes those ARNs to Lambda. **Prod does not** use that module. Prod Lambda only gets `DB_SECRET_ARN` (from RDS) and a wildcard `arn:aws:secretsmanager:...:secret:*`. So prod has no Terraform-created integration secrets; you must create prod secrets manually (or add a prod `module "secrets"` and variables) and ensure Lambda can read them. |
| **Script to migrate current configuration to prod?** | **No.** There is no script that migrates admin configuration (policies, roles, catalog, categories, etc.) from dev to prod. `db/seed-prod-data.js` only runs 047 (roles) and 048 (service catalog). To copy dev config to prod you need a custom export/import (e.g. pg_dump of config tables or a one-off script). |
| **Does prod Terraform only create resources if not exists?** | **Yes, in effect.** Terraform is declarative: it creates resources that don’t exist and updates existing ones to match the code. It does not duplicate resources; it brings the live state in line with `infra/envs/prod/main.tf`. So prod deploy “builds” (creates or updates) cloud resources so that they exist and match the definition. |
| **Does prod deploy seed an admin account?** | **No.** `seed:prod` runs only 047 (roles) and 048 (service catalog). It does **not** create a Cognito admin user or a DB admin user. You must create the first admin user in prod manually (e.g. via Cognito + admin group or your admin bootstrap process). |
| **Is prod switched off from UAT mode?** | **Yes.** In `infra/envs/prod/main.tf`, Lambda `common_env_vars` has `UAT_MODE = "false"`. Dev has `UAT_MODE = "true"`. So prod runs in production mode (e.g. real OTP/SMS when SMS is configured). |
| **Is prod configured for SMS using SNS flow?** | **Partially.** **SNS infrastructure:** Prod has `module "sns"` and passes SNS topic ARNs to Lambda (notifications, booking, payment). **SMS application config:** The backend sends SMS via SNS when `admin:settings:aws` is present in `platform_settings` (with credentials and `sns.enabled`). That is seeded by `scripts/seed-sms-aws-settings.js`, which is **not** run in the prod CI/CD workflow. So for production SMS you must run that script (or equivalent) against **prod** DB with **prod** AWS credentials (and set `ENVIRONMENT=prod` / prod RDS cluster name in the script if needed). |

---

## 6. Scripts and references

- **Deploy scripts (dev):** `./scripts/deploy-lambda-direct.sh`, `./scripts/deploy-admin-web.sh`, `./scripts/deploy-vendor-web.sh`, `./scripts/deploy-customer-web.sh` (see `.cursor/rules/deployment.mdc`). All currently target **dev** only.
- **Prod workflow:** `.github/workflows/prod.yml` – confirmation, Terraform plan/apply, DB migrations, seed:prod, warmup, smoke tests. No frontend deploy.
- **Prod Terraform:** `infra/envs/prod/main.tf` – no CloudFront/S3 for admin/vendor/customer; add them if you want Terraform-managed prod frontends.
- **Seed prod:** `db/seed-prod-data.js` runs `047_seed_roles.sql` and `048_seed_service_catalog.sql` only; idempotent, preserves existing data in other tables.
