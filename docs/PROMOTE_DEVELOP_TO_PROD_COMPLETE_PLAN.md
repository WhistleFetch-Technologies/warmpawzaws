# Promote Develop to Production — Complete Step-by-Step Plan

This is the **full** plan for the dev→prod pipeline: every step, **gap-fixing** (from recent conversation), **one-time bootstrap**, code trace, Terraform trace, first-time vs repeat behaviour, and approval (repo-owner only).

**Related docs:** `PROMOTE_DEVELOP_TO_PROD_FINAL_OUTLINE.md` (gaps list), `PROD_FULFILLMENT_PLAN.md` (bootstrap scripts), `ADMIN_CONFIG_EXPORT_TABLE_LIST_AND_FINAL_PLAN.md` (export table list), `PROD_CLOUDFRONT_URLS.md`, `PROD_TERRAFORM_AND_URL_VALIDATION.md`.

---

## 0. Gaps that were required and how they were fixed

From the final outline (Part C), these gaps were identified and addressed as follows.

| # | Gap | Required fix | Status / implementation |
|---|-----|--------------|-------------------------|
| 1 | **Build job** | Root `package.json` must provide Lambda + web build and Lambda zip. | **Fixed.** Root `package.json`: `build:backend`, `package:lambda`; workflow has `build-lambda` (Lambda only) and `build-frontends` (admin, vendor, customer with prod API URL). No `build:frontend` monolith; each app built in `build-frontends` job. |
| 2 | **Lambda zip path** | Terraform expects `backend/lambda/api-handler.zip`; CI must place zip there. | **Fixed.** Build job uploads artifact from `backend/lambda/api-handler.zip`; `terraform-plan` and `terraform-apply` download artifact to `backend/lambda` so the file is in place for Terraform. |
| 3 | **Prod VPC** | Originally “same VPC as dev”; dev/prod can be different accounts. | **Done.** Prod keeps its own VPC (10.2.0.0/16) in prod account; no shared VPC across accounts. |
| 4 | **NAT** | One NAT gateway for all private traffic. | **Fixed.** `infra/envs/prod/main.tf`: `single_nat_gateway = true` in `module "vpc"`. |
| 5 | **Secrets** | Prod Lambda must get Razorpay, Google Maps, Shiprocket from Secrets Manager. | **Fixed.** `infra/envs/prod/main.tf`: `module "secrets"` added; Lambda `common_env_vars` includes `RAZORPAY_SECRET_ARN`, `GOOGLE_MAPS_SECRET_ARN`, `SHIPROCKET_SECRET_ARN`; `secrets_arns` uses `module.secrets.all_secret_arns`. |
| 6 | **Seed / bootstrap** | One-time admin config import + admin user; then only migrations on later deploys. | **Partially.** Pipeline runs `seed:prod` (047/048) every time (idempotent). One-time bootstrap (export from dev → import to prod + admin user) is **manual** or one-off; `scripts/admin-config/check-prod-bootstrap.js` exists to detect if bootstrap already done. Optional: add workflow step to run check and skip seed when bootstrap done. |
| 7 | **Admin config** | Export/import roles, catalog, policies, GST, onboarding, platform_settings, etc. (no vendor data). | **Planned.** Table list and order in `ADMIN_CONFIG_EXPORT_TABLE_LIST_AND_FINAL_PLAN.md`. Scripts to implement: `export-admin-config.js`, `import-admin-config.js` (see `PROD_FULFILLMENT_PLAN.md` §4). |
| 8 | **Admin user** | One-time: admin@warmpawz.com / Warmpawz2025 in prod Cognito. | **Planned.** Script `seed-prod-admin-user.js` (see `PROD_FULFILLMENT_PLAN.md` §4.3); run once as part of one-time bootstrap. |
| 9 | **Web frontends** | Build and deploy admin-web, customer-web, vendor-web to prod S3/CloudFront. | **Fixed.** `build-frontends` job builds all three with `NEXT_PUBLIC_API_BASE_URL` from Terraform; `deploy-web` injects `runtime-config.js` with prod API URL, syncs to prod S3, invalidates prod CloudFront. Terraform: prod S3 buckets + `module "cloudfront"` (three distributions). |
| 10 | **App build** | No iOS/Android in pipeline. | **Confirmed.** No Capacitor/iOS/Android build; apps built separately and point at prod web URLs. |
| 11 | **Smoke / payment tests** | Must not fail pipeline if scripts missing. | **Fixed.** `smoke-tests` job has `continue-on-error: true`; payment validation job removed from workflow so pipeline does not depend on it. |
| 12 | **OpenSearch password** | Real value for prod plan. | **Fixed.** Workflow passes `secrets.PROD_OPENSEARCH_PASSWORD` into `terraform plan`. |
| — | **Stage** | Stage removed from “promote develop → prod” path. | **Fixed.** Stage workflow no longer runs on push to `main`; only `workflow_dispatch`. Prod is the deploy path. |
| — | **CORS** | API and S3 must allow prod CloudFront and prod domains. | **Fixed.** `infra/envs/prod/main.tf`: `local.cors_allowed_origins` = prod domains + CloudFront URLs from `module.cloudfront.distributions`; used by API Gateway and S3 module. |
| — | **Prod API URL in apps** | All frontends must use prod API URL from Terraform, not hardcoded. | **Fixed.** Build with `NEXT_PUBLIC_API_BASE_URL` from Terraform output; deploy step injects `runtime-config.js` with same URL. |

---

## 1. Trigger and approval (who can run / bypass)

### 1.1 How the pipeline is triggered

| Trigger | When | How |
|--------|------|-----|
| **Manual (primary)** | Every time you want to promote develop to prod | Actions → “Deploy to Production” → Run workflow → choose branch (e.g. `develop` or `prod`) → enter `DEPLOY_TO_PRODUCTION` → Run. |
| **Push to `prod` (optional)** | When you merge `develop` into `prod` and push | Push to branch `prod` runs the same workflow; no input required; **approval is enforced by GitHub Environment** (see below). |

**Code:** `.github/workflows/prod.yml`  
- `on.workflow_dispatch` with `inputs.confirmation` (required string).  
- Optional: `on.push.branches: [prod]` — if present, push to `prod` also triggers the run.

### 1.2 Approval process (only repo owner can bypass)

- **Gate 1 — Confirmation (manual runs only):** You must type `DEPLOY_TO_PRODUCTION` in the workflow input. Code: `prod.yml` job `confirmation-check`, step “Verify confirmation” (compares `github.event.inputs.confirmation` to `DEPLOY_TO_PRODUCTION`).  
- **Gate 2 — Environment “production-approval”:** Job `final-approval` uses `environment: production-approval`. The run **waits** until the environment is approved.  
- **Gate 3 — Environment “production”:** Job `terraform-apply` uses `environment: production`. Apply to prod infra only runs after this environment is approved.

**Restrict approval to repo owner:**

1. Repo → **Settings** → **Environments** → create or edit **production-approval** and **production**.  
2. Under **Protection rules**:  
   - Enable **Required reviewers**.  
   - Add **only the repo owner(s)** (or a dedicated “Production approvers” team that contains only owners).  
3. Optionally enable **Wait timer** (e.g. 5 minutes) so no one can “bypass” by clicking too quickly.  
4. **Result:** Only repo owners (or the chosen reviewers) can approve; no one else can bypass.  

**Code:** `.github/workflows/prod.yml`  
- `final-approval` job: `environment: name: production-approval`.  
- `terraform-apply` job: `environment: production`.

---

## 2. Concurrency and branch used

- **Concurrency:** `group: prod-deployment`, `cancel-in-progress: false` — only one prod deployment at a time; a new run does not cancel the previous one.  
- **Code used:** The commit that triggered the run (on `workflow_dispatch` you choose the ref; on `push` it’s the push commit). So “promote develop to prod” = run the workflow from the branch/commit you want in prod (usually `develop` or `prod` after merge).

---

## 3. Step-by-step with code tracing (every run)

### Step 1 — Confirmation check

| What | Detail |
|------|--------|
| Job | `confirmation-check` |
| Runner | `ubuntu-latest` |
| Code | `.github/workflows/prod.yml` (confirmation-check job) |
| Logic | If `workflow_dispatch`: fail unless `github.event.inputs.confirmation == "DEPLOY_TO_PRODUCTION"`. If `push`: can be configured to always pass (approval is environment). |
| Output | Job succeeds → next job runs. |

---

### Step 2 — Pre-deployment

| What | Detail |
|------|--------|
| Job | `pre-deployment` |
| Needs | `confirmation-check` |
| Code | `prod.yml` → pre-deployment job |
| Logic | Checkout repo; write to GitHub Step Summary: branch/ref and commit SHA. **No** stage deployment check and **no** infrastructure-diff with stage (stage removed from pipeline). |
| Trace | `actions/checkout@v4` (ref = trigger ref). |

---

### Step 3 — Build Lambda

| What | Detail |
|------|--------|
| Job | `build-lambda` |
| Needs | `pre-deployment` |
| Code | `prod.yml` → build-lambda job |
| Scripts | Root `package.json`: `build:backend` → `cd backend/lambda && npm ci && npm run build`. `package:lambda` → `cd backend/lambda && npm run package`. |
| Trace | `backend/lambda/package.json`: `build` runs esbuild; `package` runs `cd dist && zip -r ../api-handler.zip .`. |
| Output | Artifact `lambda-prod`: `backend/lambda/api-handler.zip` (uploaded). |
| First vs repeat | Same every time: build from current code and overwrite zip. |

---

### Step 4 — Terraform plan

| What | Detail |
|------|--------|
| Job | `terraform-plan` |
| Needs | `build-lambda` |
| Code | `prod.yml` → terraform-plan job |
| AWS | Uses `secrets.AWS_ACCESS_KEY_ID`, `secrets.AWS_SECRET_ACCESS_KEY`, `env.AWS_REGION` (ap-south-1). |
| Terraform | `infra/envs/prod/`: `terraform init -backend-config=backend.hcl`, then `terraform plan -var="opensearch_master_password=${{ secrets.PROD_OPENSEARCH_PASSWORD }}" -out=tfplan`. |
| Backend | `backend.hcl`: bucket `warmpawz-terraform-state-023394150666`, key `prod/terraform.tfstate`, region ap-south-1, DynamoDB locks. |
| Lambda zip | Download artifact `lambda-prod` into `backend/lambda` so `api-handler.zip` is in place for Terraform’s `zip_path`. |
| Output | Artifact `tfplan-prod`: `infra/envs/prod/tfplan`. |

**Terraform config trace (prod):**

- **State:** `infra/envs/prod/main.tf` (terraform backend block) + `infra/envs/prod/backend.hcl`.  
- **VPC:** `module "vpc"` → `infra/modules/vpc` — one NAT (`single_nat_gateway = true`), CIDR 10.2.0.0/16.  
- **Secrets:** `module "secrets"` (Razorpay, Google Maps, Shiprocket); Lambda env gets secret ARNs.  
- **SNS, RDS, DynamoDB, S3, prod frontend S3 buckets, CloudFront (3), SQS, Lambda, Cognito, API Gateway, OpenSearch:** All in `infra/envs/prod/main.tf`; modules under `infra/modules/*`.  
- **CORS:** `local.cors_allowed_origins` = prod domains + CloudFront URLs; used by API Gateway and S3.  
- **Variables:** `infra/envs/prod/variables.tf`; values from `terraform.tfvars` and workflow (e.g. `opensearch_master_password` from `secrets.PROD_OPENSEARCH_PASSWORD`).  

---

### Step 5 — Final approval (wait for reviewer)

| What | Detail |
|------|--------|
| Job | `final-approval` |
| Needs | `terraform-plan` |
| Code | `prod.yml` → final-approval job |
| Environment | `production-approval` — run **waits** until an allowed reviewer (e.g. repo owner) approves. |
| Bypass | Only by approving the environment (restrict reviewers to repo owner in Settings → Environments). |

---

### Step 6 — Terraform apply

| What | Detail |
|------|--------|
| Job | `terraform-apply` |
| Needs | `final-approval` |
| Environment | `production` — second gate; only allowed reviewers can approve. |
| Code | `prod.yml` → terraform-apply job |
| Logic | Download `tfplan-prod` and `lambda-prod`; init prod Terraform; `terraform apply -auto-approve tfplan`. Then export outputs: `api_endpoint`, `cloudfront_*_id`, `bucket_*`. |
| Outputs | Job outputs: `api_endpoint`, `cloudfront_admin_id`, `cloudfront_vendor_id`, `cloudfront_customer_id`, `bucket_admin`, `bucket_vendor`, `bucket_customer`. |

**Terraform apply trace:**

- Reads state from S3; applies plan (create/update resources only).  
- **First time:** Creates VPC, NAT, RDS, DynamoDB, S3 (uploads + prod frontend buckets), CloudFront (3 distributions), SQS, SNS, Lambda, Cognito, API Gateway, OpenSearch, secrets.  
- **Repeat:** Updates only what changed (e.g. Lambda code, config drift); no duplicate VPC/CloudFront if already present.  

---

### Step 7 — Database migrations

| What | Detail |
|------|--------|
| Job | `database-migrations` |
| Needs | `terraform-apply` |
| Code | `prod.yml` → database-migrations job |
| DB URL | From Terraform outputs: `rds_endpoint`, `rds_secret_arn`, etc.; Secrets Manager for password; build `DATABASE_URL`. |
| Scripts | `db/package.json`: `migrate:up` → `node run-migration-all.js`; `seed:prod` → `node seed-prod-data.js`. |
| Trace | `db/run-migration-all.js` runs pending migrations; `db/seed-prod-data.js` runs `047_seed_roles.sql`, `048_seed_service_catalog.sql` (idempotent). **Optional:** Run `check-prod-bootstrap.js` before seed; if bootstrap done, skip seed (full config comes from one-time import). |
| First vs repeat | **First time:** Migrations create schema; seed adds baseline roles/catalog. For full admin config (policies, onboarding, marketing), run one-time bootstrap (§4). **Repeat:** Migrations run any new pending files; seed is idempotent (ON CONFLICT DO NOTHING). |

---

### Step 8 — Build frontends

| What | Detail |
|------|--------|
| Job | `build-frontends` |
| Needs | `terraform-apply`, `database-migrations` |
| Code | `prod.yml` → build-frontends job |
| Env | `NEXT_PUBLIC_API_BASE_URL: ${{ needs.terraform-apply.outputs.api_endpoint }}` for all three apps. |
| Trace | `apps/admin-web`, `apps/vendor-web`, `apps/customer-web`: `npm ci && npm run build` (Next.js static export → `dist/`). |
| Output | Artifact `frontends-prod`: `apps/admin-web/dist`, `apps/vendor-web/dist`, `apps/customer-web/dist`. |

---

### Step 9 — Deploy web (S3 + CloudFront)

| What | Detail |
|------|--------|
| Job | `deploy-web` |
| Needs | `terraform-apply`, `build-frontends` |
| Code | `prod.yml` → deploy-web job |
| Inject | Writes `runtime-config.js` with prod API URL into each app’s `dist` (from `needs.terraform-apply.outputs.api_endpoint`). |
| Sync | `aws s3 sync apps/admin-web/dist s3://<bucket_admin> --delete` (same for vendor, customer). Bucket names from Terraform output `prod_frontend_bucket_names`. |
| Invalidate | `aws cloudfront create-invalidation --distribution-id <id> --paths "/*"` for admin, vendor, customer (IDs from Terraform). |

---

### Step 10 — Warmup, smoke, readiness, tag

| Step | Job | Code / trace |
|------|-----|--------------|
| Warmup | `warmup-lambdas` | `scripts/warmup-lambdas.sh prod` — invokes prod Lambdas. |
| Smoke | `smoke-tests` | `npm run test:smoke:prod` (continue-on-error). |
| Readiness | `final-readiness` | `scripts/readiness-checks.sh prod`; writes API endpoint to summary. |
| Tag | `tag-release` | Creates tag `v<date>.<run_number>`, pushes to origin (requires `contents: write`). |

---

## 4. One-time bootstrap (before or on first prod deploy)

Run these steps **once** (manually or via a one-off script). The pipeline does **not** run export/import or admin user creation; it only runs migrations and idempotent seed:prod (047/048). To get full admin config (policies, onboarding, marketing, etc.) and the admin login in prod, do the following.

| Step | Action | Code / script | Notes |
|------|--------|----------------|-------|
| 1 | Run DB migrations on **prod** | `db/npm run migrate:up` with prod `DATABASE_URL` | Schema only; can be done by pipeline on first run or before. |
| 2 | Check if bootstrap already done | `node scripts/admin-config/check-prod-bootstrap.js` with prod `DATABASE_URL` | Exits 0 if `platform_settings.prod_bootstrap_completed` exists; else exit 1. If done, stop. |
| 3 | Export admin config from **dev** | `export-admin-config.js` (to implement) with dev `SOURCE_DATABASE_URL` | Output: JSON files under e.g. `scripts/admin-config/exports/`. Table list and FK order: `ADMIN_CONFIG_EXPORT_TABLE_LIST_AND_FINAL_PLAN.md` §1–3. No vendor/customer data. |
| 4 | Import admin config into **prod** | `import-admin-config.js` (to implement) with prod `TARGET_DATABASE_URL` and export path | Insert in FK-safe order; then set bootstrap marker (e.g. `platform_settings.prod_bootstrap_completed`). |
| 5 | Seed admin user in prod Cognito | `seed-prod-admin-user.js` (to implement) | Create `admin@warmpawz.com` with password `Warmpawz2025`; add to admin group. Idempotent. Update bootstrap marker. |
| 6 | SMS config (optional) | Include `admin:settings:aws` in export, or run `seed-sms-aws-settings.js` once for prod | So prod has SNS/SMS config; update secret values in Secrets Manager with prod APIs. |

**References:** `PROD_FULFILLMENT_PLAN.md` §4 (script contracts), `ADMIN_CONFIG_EXPORT_TABLE_LIST_AND_FINAL_PLAN.md` (full table list: policies, onboarding forms, marketing/promotions, etc.).

---

## 5. First time vs repeat (summary)

| Aspect | First time | Repeat (same pipeline, same steps) |
|--------|------------|-------------------------------------|
| Trigger | Manual (or push to `prod`) | Same. |
| Approval | Required (production-approval + production) | Required every time. |
| Terraform | Creates all prod resources (VPC, one NAT, RDS, DynamoDB, S3, CloudFront x3, SQS, SNS, Lambda, Cognito, API Gateway, OpenSearch, secrets). | Updates only changed resources; state already exists. |
| DB | Migrations create schema; pipeline runs `seed:prod` (047/048, idempotent). For **full** config, run one-time bootstrap (export/import + admin user) separately. | New migrations applied if any; seed:prod runs again (idempotent). Optional: add step to run `check-prod-bootstrap.js` and skip seed when bootstrap done. |
| Frontends | Built with prod API URL from Terraform; deployed to S3; runtime-config.js injected; CloudFront invalidated. | Same; new build and deploy. |
| One-time bootstrap | Run §4 steps once (migrations, export from dev, import to prod, admin user, SMS if needed). Pipeline does **not** run export/import or admin user. | Not re-run; bootstrap marker prevents duplicate work if you add check to pipeline. |
| Stage | Not used; prod is the deploy path. | Same. |

---

## 6. Terraform scripts checklist (prod)

| File | Purpose |
|------|--------|
| `infra/envs/prod/main.tf` | VPC (single NAT), SNS, secrets, RDS, DynamoDB, S3, prod frontend S3 buckets, CloudFront, SQS, Lambda, Cognito, API Gateway, OpenSearch; locals for CORS. |
| `infra/envs/prod/variables.tf` | aws_region, alert_emails, opensearch_master_password, prod_cloudfront_certificate_arn, secrets (defaults). |
| `infra/envs/prod/outputs.tf` | api_endpoint, rds_*, cloudfront_distribution_ids, cloudfront_urls, prod_frontend_bucket_names, etc. |
| `infra/envs/prod/backend.hcl` | S3 backend bucket, key, region, DynamoDB table. |
| `infra/envs/prod/terraform.tfvars` | alert_emails, opensearch_master_password (or use env/CLI). |
| `infra/modules/vpc` | One NAT when `single_nat_gateway = true`. |
| `infra/modules/cloudfront` | Three distributions (admin, vendor, customer); references existing S3 buckets. |

Plan reads: `infra/envs/prod/main.tf` and all referenced modules. Apply uses the plan produced in the `terraform-plan` job.

---

## 7. Quick reference: pipeline flow

```
Trigger (manual or push to prod)
  → confirmation-check (input or pass)
  → pre-deployment
  → build-lambda → artifact lambda-prod
  → terraform-plan → artifact tfplan-prod
  → final-approval (environment: production-approval — wait for repo owner / reviewer)
  → terraform-apply (environment: production — wait for approval)
  → database-migrations (migrate + seed:prod)
  → build-frontends (NEXT_PUBLIC_API_BASE_URL from Terraform)
  → deploy-web (inject runtime-config, S3 sync, CloudFront invalidation)
  → warmup-lambdas → smoke-tests (optional) → final-readiness → tag-release
```

---

## 8. Restricting approval to repo owner only

1. **Settings** → **Environments** → **production-approval** and **production**.  
2. **Required reviewers:** Add only the repo owner (or a team that contains only owners).  
3. Do **not** add “bypass” for any other role; only these reviewers can approve.  
4. Optionally set **Wait timer** (e.g. 5 min) so approvals are deliberate.  

Result: Every run (whether triggered manually or by push to `prod`) must pass environment approval, and only the configured reviewers (e.g. repo owner) can approve — no one else can bypass.

---

## 9. Go/No-Go checklist (from recent conversation)

Before running “Deploy to Production”:

- [ ] Build job succeeds (Lambda zip at `backend/lambda/api-handler.zip`; frontends build with prod API URL).
- [ ] Terraform plan/apply uses **one NAT** (`single_nat_gateway = true`) and **secrets** module; Lambda has secret ARNs; `UAT_MODE=false` in prod.
- [ ] **Bootstrap check** script exists: `scripts/admin-config/check-prod-bootstrap.js`; optionally run in pipeline to skip seed when bootstrap done.
- [ ] **One-time bootstrap** (if not yet done): export admin config from dev, import to prod, seed admin user; table list in `ADMIN_CONFIG_EXPORT_TABLE_LIST_AND_FINAL_PLAN.md`.
- [ ] **seed:prod** (047/048) runs in pipeline (idempotent); full config comes from one-time import when you run it.
- [ ] **Deploy web** job deploys admin-web, customer-web, vendor-web to prod S3/CloudFront; injects `runtime-config.js` with prod API URL.
- [ ] No iOS/Android build in pipeline; Capacitor apps use prod web URLs.
- [ ] Smoke tests optional (`continue-on-error: true`); OpenSearch password from `secrets.PROD_OPENSEARCH_PASSWORD`.
- [ ] Environments **production-approval** and **production** have Required reviewers = repo owner only.

---

## 10. Code trace (file:line reference)

| Step | Workflow (prod.yml) | Other code |
|------|---------------------|------------|
| Trigger | `on.workflow_dispatch` (L4–10), `on.push.branches: [prod]` (L11–15) | — |
| Confirmation | `confirmation-check` job, run step (L27–38) | — |
| Pre-deploy | `pre-deployment` job (L40–48) | — |
| Build Lambda | `build-lambda` job (L50–66); `npm run build:backend`, `npm run package:lambda` | Root `package.json` scripts (build:backend, package:lambda); `backend/lambda/package.json` (build, package) |
| Terraform plan | `terraform-plan` job (L68–98); init with `backend.hcl`, plan with `opensearch_master_password` | `infra/envs/prod/main.tf`, `backend.hcl`, `variables.tf`, `terraform.tfvars` |
| Final approval | `final-approval` job (L100–108); `environment: production-approval` | GitHub Settings → Environments |
| Terraform apply | `terraform-apply` job (L110–162); apply tfplan; export outputs (L148–161) | `infra/envs/prod/outputs.tf` (api_endpoint, cloudfront_*, prod_frontend_bucket_names) |
| DB migrations | `database-migrations` job (L164–218); get DB URL from Terraform (L181–195); migrate (L196–206); seed (L209–216) | `db/package.json` (migrate:up, seed:prod); `db/run-migration-all.js`, `db/seed-prod-data.js` |
| Build frontends | `build-frontends` job (L220–254); `NEXT_PUBLIC_API_BASE_URL` from terraform-apply outputs | `apps/admin-web`, `apps/vendor-web`, `apps/customer-web` (Next.js build → dist) |
| Deploy web | `deploy-web` job (L256–297); inject runtime-config (L268–276); S3 sync (L277–286); CloudFront invalidation (L287–296) | — |
| Warmup / smoke / readiness / tag | `warmup-lambdas` (L299–311), `smoke-tests` (L313–321), `final-readiness` (L323–336), `tag-release` (L338–351) | `scripts/warmup-lambdas.sh`, `scripts/readiness-checks.sh` |
