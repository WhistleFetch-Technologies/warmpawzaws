# Promote Develop → Prod: Final Outline (Single Source of Truth)

This document is the **one place** that describes: what “promote develop → prod” means, what runs today (with validation and gaps), and what the **final** step-by-step plan is after fulfillment. Use it to validate before proceeding.

**Part A / B / C / D / E / F** are **section labels in this document**, not separate pipeline runs. When you trigger "Deploy to Production" once, the workflow runs once; seed:prod (if it runs) runs **once** in that single run.

---

## Part A: What “Promote Develop → Prod” Means

- **Trigger:** Manual only. In GitHub Actions you run the workflow **“Deploy to Production”** and type `DEPLOY_TO_PRODUCTION`. (Pushing or merging to `main` does **not** trigger prod; it triggers **stage**.)
- **Intent:** Take the code from the repo (at the commit you’re deploying), deploy it to **production**: infra (if needed), backend Lambda, DB schema, and **web** frontends. No iOS/Android app build; Capacitor apps are built separately and point at prod web URLs.
- **One-time vs every run:** The **first time** you bring up prod you also run a **one-time bootstrap** (admin config import from dev, seed admin user). On **every later** “promote develop → prod” you do **not** re-run that bootstrap (a marker in the DB is checked and seed/import is skipped).

---

## Part B: Current State – What Actually Runs Today

When you trigger the prod workflow today, the following happens **in order**. (Validation notes and gaps are in Part C.)

### B.1 Trigger and Concurrency

- **Trigger:** `workflow_dispatch` only (manual), with input `confirmation` = `DEPLOY_TO_PRODUCTION`.
- **Concurrency:** `group: prod-deployment`, so only one prod deployment at a time.

### B.2 Job 1: confirmation-check

- Verifies `github.event.inputs.confirmation` === `"DEPLOY_TO_PRODUCTION"`. Otherwise fails.

### B.3 Job 2: pre-deployment-checklist

- Checkout code.
- Placeholder checks (stage deployment, test results, infra diff) – no real logic yet.
- Writes a pre-flight summary to the GitHub step summary.

### B.4 Job 3: infrastructure-diff

- Checkout, AWS creds, Terraform setup.
- Runs `diff -u infra/envs/stage/main.tf infra/envs/prod/main.tf` (informational only).

### B.5 Job 4: build

- Checkout, Node 20, `npm ci --production`.
- **Runs:**
  - `npm run build:backend -- --production`
  - `npm run build:frontend -- --production`
  - `npm run package:lambda`
- **Uploads:** `backend/lambda/dist/*.zip` as artifact `lambda-functions-prod`.

**Gap:** Root `package.json` does **not** define `build:backend`, `build:frontend`, or `package:lambda`. So this job **fails** today unless those scripts are added or the job is changed to use existing scripts (e.g. build Lambda from `backend/lambda` and frontends from `apps/*`).

### B.6 Job 5: terraform-plan

- Checkout, AWS creds, Terraform, download Lambda artifact.
- **Terraform:** `infra/envs/prod`: init with `backend.hcl`, optionally run `cleanup-state.sh`, then `terraform plan -var="opensearch_master_password=${{ secrets.PROD_OPENSEARCH_PASSWORD }}" -out=tfplan`.
- **Variables:** `alert_emails` and others come from `terraform.tfvars` (and defaults). No `-var` for `alert_emails` in the workflow.
- Uploads `tfplan` as artifact.

**Terraform trace (current prod):**

- **Backend:** S3 state `warmpawz-terraform-state-023394150666`, key `prod/terraform.tfstate`, region ap-south-1.
- **Provider:** AWS `ap-south-1`, default tags `Environment = prod`, etc.
- **VPC module:** `use_existing_vpc = false`, `vpc_cidr = "10.2.0.0/16"`, 3 public, 3 private, 3 database subnets, **3 NAT gateways** (`single_nat_gateway = false`). So prod Terraform **creates a new VPC** (10.2.0.0/16), **not** the dev VPC (10.0.0.0/16).
- **SNS, RDS, DynamoDB, S3, SQS, Lambda, Cognito, API Gateway, OpenSearch** modules all use `local.environment = "prod"` and create prod-tagged resources in that **new** VPC.
- **Lambda:** `zip_path = "${path.module}/../../../backend/lambda/api-handler.zip"` – expects the zip at that path (the workflow downloads the artifact to `backend/lambda/dist` but the plan expects `api-handler.zip`; path may need to match what the build job produces).
- **No** `module "secrets"` in prod – no Razorpay/Google Maps/Shiprocket secrets; only RDS secret and wildcard `secret:*` for Lambda.
- **UAT_MODE:** `"false"` in Lambda env (correct for prod).

### B.7 Job 6: final-approval

- Uses GitHub environment `production-approval`. No automated gate; just a checkpoint.

### B.8 Job 7: terraform-apply

- Needs `final-approval`, uses environment `production`.
- Download plan + Lambda artifact, Terraform init, `terraform apply -auto-approve tfplan`.
- Exports `api_endpoint` from Terraform output.

**Result:** If the build job were fixed and the zip path matched, this would create or update **all** prod infra in a **separate** prod VPC (10.2.0.0/16): VPC, 3 NATs, RDS cluster, DynamoDB, S3, SQS, SNS, Lambda, Cognito, API Gateway, OpenSearch. **No** S3/CloudFront for admin/customer/vendor web in this Terraform (prod has no `module "cloudfront"`).

### B.9 Job 8: database-migrations

- Needs `terraform-apply`.
- Gets prod RDS endpoint and secret from Terraform outputs, builds `DATABASE_URL`, runs:
  - `db/npm ci`, `npm run migrate:up` (schema only), `npm run migrate:status`
  - **`npm run seed:prod`** (in `db/`: runs `seed-prod-data.js` → only **047_seed_roles.sql** and **048_seed_service_catalog.sql**)

**What seed:prod (047+048) does each time it runs:** It runs two SQL files: **047** inserts into `roles` (with `ON CONFLICT (name) DO NOTHING`) and **048** inserts into `service_categories` and `service_catalog` (with `ON CONFLICT DO NOTHING`). So it does **not** create duplicate rows—existing rows are skipped. The **same** baseline roles and catalog stay in place; there is no "separate data every time." The reason to avoid running it every deploy is (1) you want prod to get **current** config from dev (export/import), not the fixed 047/048 content, and (2) you want one-time bootstrap plus migrations-only on later deploys.

**Gap:** Seed runs **every** deploy (once per workflow run). There is no “bootstrap already done” check, so the same seed step runs on every deploy (you want it only once). You asked for **no** default 047/048 and for seed to run **only once** (admin config from dev export + admin user).

### B.10 Job 9: warmup-lambdas

- Runs `scripts/warmup-lambdas.sh prod`. Script lists Lambda functions with name containing `warmpawz-prod` and invokes them (AWS_REGION from workflow env = ap-south-1).

### B.11 Job 10: smoke-tests

- Runs `npm run test:smoke:prod` (must exist in root or script).

### B.12 Job 11: payment-validation

- Runs `npm run test:payment:razorpay` and `npm run test:payment:stripe` with ENVIRONMENT=prod.

**Gap:** These npm scripts may not exist in root `package.json`; if missing, job fails.

### B.13 Job 12: final-readiness

- Runs `scripts/readiness-checks.sh prod`.
- Writes readiness summary to step summary.

### B.14 Job 13: tag-release

- Creates git tag `v$(date +%Y.%m.%d).${{ github.run_number }}` and pushes.

### B.15 Job 14: deployment-summary

- Writes deployment summary; optional Slack notify.

---

## Part C: Gaps and Missing Pieces (Current vs Desired)

| # | Gap | Current | Desired |
|---|-----|---------|--------|
| 1 | **Build job** | Uses `build:backend`, `build:frontend`, `package:lambda` – **not in root package.json** | Either add these scripts (building Lambda + web apps and packaging Lambda zip) or change job to use e.g. `backend/lambda` build + `apps/*/npm run build` and pack zip from Lambda output. |
| 2 | **Lambda zip path** | Terraform expects `api-handler.zip` at `infra/envs/prod/../../../backend/lambda/api-handler.zip` | Build job must output the zip at the path Terraform expects (or Terraform `zip_path` must point at artifact path). |
| 3 | **Prod VPC** | Prod Terraform creates **new** VPC 10.2.0.0/16 (separate from dev) | You wanted **same VPC as dev**. So prod Terraform should use `use_existing_vpc = true` and pass dev VPC ID (data source or variable). |
| 4 | **NAT** | Prod Terraform creates **3** NAT gateways (one per AZ) | You wanted **one** NAT gateway for the (shared) VPC, all private routes using it. |
| 5 | **Secrets** | Prod has **no** `module "secrets"`; Lambda only has RDS + wildcard secret:* | Add prod **secrets** module (same structure as dev); Lambda env gets RAZORPAY_SECRET_ARN, GOOGLE_MAPS_SECRET_ARN, etc. You update secret values manually after deploy. |
| 6 | **Seed / bootstrap** | **seed:prod** runs **every** deploy (047 + 048 only) | **One-time** bootstrap: (1) Run **admin config import** from dev export (no 047/048). (2) Seed **admin user** (admin@warmpawz.com / Warmpawz2025). (3) Set **bootstrap marker** in DB. On every **subsequent** deploy: **skip** seed/import if marker is set; only run migrations. |
| 7 | **Admin config** | No export/import of admin config (roles, catalog, policies, GST, refund, categories, specializations, onboarding, platform_settings, etc.) | Node scripts: **export** admin-config tables from dev DB → JSON; **import** into prod DB (once). No vendor/customer data. |
| 8 | **Admin user** | No step creates admin@warmpawz.com | One-time script: create Cognito user in prod pool, add to admin group, set password Warmpawz2025. |
| 9 | **Web frontends** | **No** job builds or deploys admin-web, customer-web, vendor-web to prod S3/CloudFront | Add job(s): build admin-web, customer-web, vendor-web with **prod** API URL; upload to **prod** S3; invalidate **prod** CloudFront. Prod Terraform (or existing manual setup) must define prod S3 buckets and CloudFront for these apps. |
| 10 | **App build** | N/A (no app build in prod today) | Intentionally **excluded**: no iOS/Android/Capacitor build in this pipeline. Capacitor apps are built separately and point at prod web URLs. |
| 11 | **Smoke / payment tests** | Workflow calls `npm run test:smoke:prod`, `test:payment:razorpay`, `test:payment:stripe` | These scripts must exist (or steps made optional/conditional) so the workflow doesn’t fail. |
| 12 | **OpenSearch password** | `terraform.tfvars` has placeholder `opensearch_master_password = "REPLACE_..."`; plan uses secret | Must use a real value from Secrets Manager or GitHub secret (already `secrets.PROD_OPENSEARCH_PASSWORD` in plan). |

---

## Part D: Final Plan – Step-by-Step (After Fulfillment)

When you say “promote develop → prod” and all gaps are addressed, the following is the **exact** sequence.

### One-time only (before or on first prod deploy)

1. **Bootstrap (manual or one-off run):**
   - Run DB migrations on **prod** DB (schema only).
   - Run **check-prod-bootstrap.js**; if already done, stop.
   - Export admin config from **dev** DB (Node script) → JSON.
   - Import admin config into **prod** DB (Node script); set bootstrap marker.
   - Seed **admin user** in prod Cognito (admin@warmpawz.com / Warmpawz2025); update marker.
   - Optionally run SMS config for prod (admin:settings:aws) if not in export.

### Every time you run “Deploy to Production”

1. **Trigger:** Manual, workflow “Deploy to Production”, type `DEPLOY_TO_PRODUCTION`.
2. **Confirmation** – Check input.
3. **Pre-deployment** – Checkout, pre-flight (and optionally real checks).
4. **Infra diff** – Optional diff of stage vs prod Terraform (informational).
5. **Build:**
   - Build **backend** (Lambda): e.g. `backend/lambda` build and produce `api-handler.zip` at the path Terraform expects.
   - Build **web frontends only** (admin-web, customer-web, vendor-web) with **prod** API URL and env; no iOS/Android/Capacitor build.
   - Upload Lambda zip and frontend build outputs as artifacts.
6. **Terraform plan (prod):**
   - Init with `backend.hcl`.
   - Plan with required vars (e.g. `opensearch_master_password` from secret, `alert_emails` from tfvars or var).
   - Prod Terraform uses **existing VPC** (dev VPC), **one** NAT gateway, **secrets** module; creates/updates only prod-tagged resources in ap-south-1.
7. **Approval** – GitHub environment or manual approval.
8. **Terraform apply** – Apply plan; infra and Lambda code (from zip) updated.
9. **Database:**
   - Get prod `DATABASE_URL` from Terraform outputs.
   - Run **check-prod-bootstrap.js** against prod DB:
     - If **bootstrap already done** → **skip** seed and admin config import; only run **migrations** (schema).
     - If **not done** → optionally run one-time bootstrap (or fail and ask to run it manually).
   - Run **migrations** only: `db/npm run migrate:up`, `migrate:status`.
10. **Deploy web frontends:**
    - For each of admin-web, customer-web, vendor-web: take built artifact, inject prod `runtime-config.js` (prod API URL), sync to **prod** S3, invalidate **prod** CloudFront. No app build.
11. **Warmup** – Invoke prod Lambda(s) (e.g. `warmup-lambdas.sh prod`).
12. **Smoke tests** – Run smoke tests against prod API (if scripts exist).
13. **Payment validation** – Optional Razorpay/Stripe checks (if scripts exist).
14. **Readiness** – Run readiness script; write summary.
15. **Tag** – Create and push release tag.
16. **Summary** – Deployment summary and optional Slack.

**What gets built/deployed (final list):**

- **Terraform (create/update only):** Same VPC as dev (reference existing); one NAT; RDS (prod), DynamoDB, S3, SQS, SNS, Lambda, Cognito, API Gateway, OpenSearch, **secrets** (Razorpay, Google Maps, Shiprocket, etc.). All in ap-south-1, tag `Environment = prod`. No second VPC; no CloudFront in Terraform if you keep using existing prod buckets/distributions.
- **Lambda:** One function (e.g. `warmpawz-prod-api-handler`) with code from `api-handler.zip`, env from Terraform (DB, SNS, SQS, S3, DynamoDB, OpenSearch, **secret ARNs**), UAT_MODE=false.
- **DB:** Schema from migrations; **no** re-seed of roles/catalog after first bootstrap; config comes from one-time admin import.
- **Web:** admin-web, customer-web, vendor-web **web** assets only → prod S3/CloudFront (prod URLs for Capacitor to use). **No** iOS/Android app build.

---

## Part E: Validation Summary

### Terraform (prod)

- **State:** `infra/envs/prod/backend.hcl` → S3 bucket, key `prod/terraform.tfstate`, region ap-south-1. Locks: DynamoDB.
- **VPC (current):** New VPC 10.2.0.0/16, 3 NATs. **After change:** Use data source/variable for existing dev VPC; create **one** NAT (or use existing one); no new VPC.
- **Required variables:** `alert_emails`, `opensearch_master_password` (sensitive). Others from tfvars or defaults. Workflow must pass `opensearch_master_password` (already does from secret).
- **Missing in prod today:** `module "secrets"`, `use_existing_vpc`, `single_nat_gateway = true` (or single NAT in shared VPC), S3/CloudFront for web if you want them in Terraform.

### Code trace

- **Build:** Root `package.json` has no `build:backend` / `build:frontend` / `package:lambda` → add or replace with concrete commands (Lambda build + zip; frontend builds from `apps/*`).
- **Seed:** `db/seed-prod-data.js` runs only 047 + 048. To match plan: do **not** call this on every deploy; call it only once or replace with “import from dev export” + “seed admin user” and guard by bootstrap check.
- **Bootstrap check:** Implement `scripts/admin-config/check-prod-bootstrap.js` (read marker from prod DB); call it before any seed/import in the workflow.

### Gaps to close before “promote develop → prod” is correct

1. Add or fix **build** step (Lambda zip + web builds; no app build).
2. Change prod Terraform to **existing VPC**, **one NAT**, add **secrets** module.
3. Implement **admin config export/import** (Node) and **seed admin user** (Node); **bootstrap check** (Node).
4. In workflow: run **check-prod-bootstrap**; if done, **skip** seed/import and run only migrations; **never** run 047/048 on every deploy.
5. Add **deploy web frontends** job (prod S3/CloudFront, prod API URL); ensure prod has buckets/distributions.
6. Ensure **test:smoke:prod**, **test:payment:razorpay**, **test:payment:stripe** exist or are optional.

---

## Part F: Go/No-Go Checklist

Before you run “promote develop → prod” as the final flow:

- [ ] Build job succeeds (Lambda zip + web builds; scripts or workflow steps fixed).
- [ ] Terraform plan/apply uses **existing VPC** and **one NAT** (or single NAT in shared VPC).
- [ ] Prod Terraform has **secrets** module; Lambda env has secret ARNs (values updated manually later).
- [ ] **Bootstrap check** script exists and is run before seed/import.
- [ ] **Admin config export/import** scripts exist; one-time bootstrap documented and run once.
- [ ] **Admin user** seed script exists and is part of one-time bootstrap.
- [ ] **seed:prod** (047/048) is **not** run on every deploy; only migrations run after first bootstrap.
- [ ] **Web deploy** job deploys admin-web, customer-web, vendor-web to **prod** S3/CloudFront with prod API URL.
- [ ] No iOS/Android/Capacitor build in pipeline; Capacitor apps use prod web URLs.
- [ ] Smoke/payment test scripts exist or are optional so workflow doesn’t fail.
- [ ] OpenSearch password and other secrets supplied via secrets/tfvars.

When all items are done, the “promote develop → prod” flow matches this outline and you can proceed.
