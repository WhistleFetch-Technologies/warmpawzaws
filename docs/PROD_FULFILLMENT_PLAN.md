# Production Fulfillment Plan – Six Gaps & One-Time Prod Setup

This document is the **plan** to fulfill all six gaps and your requirements: same VPC as dev, one NAT gateway, admin config export/import (no vendor data), one-time admin seed, secrets from Secrets Manager, no re-seed after first success, and promote develop → prod for code-only deploys with UAT in dev and real SMS in prod.

---

## 1. Summary of Requirements (Your Ask)

| # | Requirement | Fulfillment approach |
|---|-------------|----------------------|
| 1 | **SMS in prod** | Include `platform_settings` (admin:settings:aws) in admin config export; prod DB gets SMS/SNS config. You update secret values manually with prod APIs after deploy. |
| 2 | **DB export/import for admin config only** | Node script: export from dev DB a defined list of “admin config” tables (no vendors, customers, bookings). Second script: import into prod DB. Run once. |
| 3 | **Seed admin account** | One-time: create Cognito user `admin@warmpawz.com` with password `Warmpawz2025` in prod pool, add to admin group. Node script. |
| 4 | **Prod Terraform only create if not exist** | Terraform is declarative (create/update to match state). Prod Terraform will use **existing VPC** (same as dev) and create only prod-tagged resources (RDS, Lambda, etc.) so no duplicate VPC. |
| 5 | **Single VPC, one NAT gateway** | Prod lives in **same VPC as dev**. One NAT gateway in that VPC; all private (and if desired database) route tables point 0.0.0.0/0 to that NAT. All prod resources tagged `Environment = prod`, ap-south-1. |
| 6 | **Same secrets structure as dev; update manually later** | Prod Terraform uses a **secrets module** (same structure as dev: Razorpay, Google Maps, Shiprocket, etc.) so Lambda reads all config from Secrets Manager. Values are placeholders; you update secret values manually with prod APIs after deploy. |
| 7 | **Do not use default 047/048 seed** | Prod seed is **not** 047/048. It is: (a) run migrations (schema only), (b) run **admin config import** from dev export (current roles, service catalog, policies, etc.), (c) one-time admin user seed. Export script reads **current** dev data (all manual changes included). |
| 8 | **Seed only once** | A **bootstrap marker** (e.g. `platform_settings` key `prod_bootstrap_completed` or table `prod_seed_status`) is set after first successful seed. Prod pipeline checks it; if set, skip all seed/import steps. |
| 9 | **All config: GST, refund, categories, specializations, onboarding, Dashboard UI** | Export list includes every admin-config table (see table list below). Import restores them so prod has same config as dev (no vendor data). |
| 10 | **Promote develop → prod** | Trigger prod deploy when you promote (e.g. merge to `main` or manual workflow). Deploy = Terraform apply (if needed) + Lambda + **web frontends only** (admin-web, customer-web, vendor-web → S3/CloudFront). **No** iOS/Android app builds in prod pipeline; Capacitor apps are built separately and point to prod web URLs. **No** seed/import if already run once. UAT in dev, real SMS in prod (UAT_MODE false in prod). |
| 11 | **One NAT, all IPs associated** | Single NAT gateway in the shared VPC; one EIP; all private (and optionally database) route tables in that VPC use this NAT for 0.0.0.0/0. |

---

## 2. Architecture: Same VPC, Prod Tagged, One NAT

- **VPC:** Use the **existing dev VPC** (no second VPC). Prod Terraform uses `use_existing_vpc = true` and passes the existing VPC ID (from data source or variable).
- **NAT:** One NAT gateway in that VPC, one EIP. All private subnets’ (and if desired database subnets’) default route 0.0.0.0/0 → this NAT. Implementation options:
  - **Option A:** In **dev** Terraform (or a shared “base” env): ensure single NAT and all private/database route tables point to it; prod Terraform does not create NAT.
  - **Option B:** Prod Terraform creates **one** NAT in the existing VPC and updates only route tables that should use it (needs clear ownership so dev and prod don’t fight).
- **Resources:** All prod resources (Lambda, RDS, SNS, SQS, etc.) are created in **ap-south-1**, in that **same VPC**, with tag **`Environment = prod`**.
- **RDS:** Prod has its **own** RDS instance (or cluster) in that VPC so prod DB is isolated (admin config only, zero vendors after import).

---

## 3. Admin Configuration Tables (Export from Dev → Import to Prod)

Only these tables (and only their rows) are exported/imported so **no vendor/customer transactional data** is copied. Vendor admin in prod will see **zero vendors** until they onboard in prod.

**Core roles & catalog**

- `roles`
- `role_permissions`
- `service_catalog`
- `service_categories`
- `specialization_master`
- `specialization_symptoms` (if used for admin config)

**Policies & tax**

- `cancellation_policies`
- `rbac_policies`
- `tax_categories`
- `gst_configs`
- `hsn_codes`
- `gst_rules` (if exists)
- `refund_rules` / `booking_cancellation_rules` / refund-tier tables (admin-managed)
- `booking_rules`
- `payout_rules`

**Platform & admin settings**

- `platform_settings` (includes `admin:settings:aws` for SMS/SNS; other platform keys as needed)
- `admin_settings`
- `payment_gateway_settings` (structure only; secrets come from Secrets Manager, so can exclude secret values or use placeholders)

**Onboarding & discovery**

- `onboarding_forms`
- `problem_grid_mappings`
- `discovery_rules` (if exists)
- `scheduling_policies` (if exists)

**Dashboard / content (if admin-managed)**

- `admin_settings` (dashboard UI keys if stored there)
- `spotlight_offers`, `content_pages`, `notification_templates` (if considered admin config)

**Explicitly excluded (no vendor/customer data)**

- `vendors`, `vendor_*`, `customers`, `bookings`, `orders`, `payments`, `pets`, etc.

---

## 4. Node Scripts to Implement

All automation in **Node** (no bash for data logic).

### 4.1 `scripts/admin-config/export-admin-config.js`

- **Input:** `SOURCE_DATABASE_URL` (dev DB).
- **Output:** One directory (e.g. `scripts/admin-config/exports/`) with:
  - One JSON file per table (e.g. `roles.json`, `service_catalog.json`, `platform_settings.json`), or one combined `admin-config-YYYYMMDD.json`.
- **Logic:** Connect to dev, run `SELECT * FROM <table>` for each admin-config table in order (respect FK order if needed: e.g. roles → role_permissions, service_categories → service_catalog). Write JSON. No vendor/customer tables.

### 4.2 `scripts/admin-config/import-admin-config.js`

- **Input:** `TARGET_DATABASE_URL` (prod DB), path to export directory or combined JSON.
- **Logic:**
  - Option A: Truncate (or delete) only the admin-config tables in prod, then insert from export (with ID mapping if we want to preserve UUIDs, or let prod generate new UUIDs and only preserve business keys like `name`, `setting_key`, etc.).
  - Option B: Upsert by business key (e.g. `roles.name`, `platform_settings.setting_key`) so re-run is idempotent.
- **Order:** Insert in FK-safe order (e.g. roles before role_permissions, service_categories before service_catalog).
- **Bootstrap marker:** After successful import, set `platform_settings` row `setting_key = 'prod_bootstrap_completed'`, `setting_value = { "configImportDone": true, "at": "<ISO timestamp>" }` (or use a small `prod_seed_status` table).

### 4.3 `scripts/admin-config/seed-prod-admin-user.js`

- **Input:** `COGNITO_USER_POOL_ID` (prod), `COGNITO_CLIENT_ID` (optional), admin email `admin@warmpawz.com`, password `Warmpawz2025`.
- **Logic:** Use AWS SDK (Cognito): create user if not exists, set permanent password, add to admin group (or assign admin role). Idempotent (if user exists, skip or update password).
- **Bootstrap marker:** After success, set a flag (e.g. in `platform_settings`: `prod_admin_user_seeded = true`) so we don’t re-run.

### 4.4 `scripts/admin-config/check-prod-bootstrap.js`

- **Input:** `TARGET_DATABASE_URL` (prod).
- **Output:** Exit 0 if bootstrap already completed (config import + admin user done), else exit 1.
- **Use:** In prod CI/CD, run this first; if exit 0, skip export/import and admin seed.

### 4.5 One-time “full prod bootstrap” runner (optional)

- **Script:** e.g. `scripts/admin-config/bootstrap-prod-once.js`.
- **Steps in order:**
  1. Run DB migrations on prod (schema only).
  2. Run `check-prod-bootstrap.js`; if already done, exit 0.
  3. Run `export-admin-config.js` from dev.
  4. Run `import-admin-config.js` to prod.
  5. Run `seed-prod-admin-user.js`.
  6. Set bootstrap completed in `platform_settings` (or `prod_seed_status`).

After that, **no seeds on every deploy**; only code deploy (Lambda, web frontends). **No native app builds** in this pipeline.

---

## 5. Terraform Changes (Prod in Same VPC, One NAT, Secrets)

### 5.1 Prod Terraform: use existing VPC

- In `infra/envs/prod/main.tf`:
  - **VPC:** Use `data "aws_vpc" "existing"` (filter by tag, e.g. `Environment = dev` or `Name = warmpawz-dev-vpc`) or pass `vpc_id` via variable.
  - **Subnets:** Use data sources for existing subnets in that VPC (or pass subnet IDs).
  - **NAT:** Do **not** create a new NAT in prod if we manage NAT in dev/shared. If prod is to own the “single NAT” in the shared VPC, add one `aws_nat_gateway` and one `aws_eip`, and update the **existing** private (and optionally database) route tables to point 0.0.0.0/0 to this NAT (ensure no conflict with dev Terraform).

### 5.2 One NAT gateway for the VPC

- **Option A (recommended):** In **dev** (or shared) Terraform:
  - Create **one** NAT gateway and one EIP.
  - Set **all** private (and database) route tables in that VPC to use this NAT for 0.0.0.0/0.
  - Remove or avoid creating extra NATs (you already removed 4; if a NAT instance is still there, you can keep it or replace with this single NAT).
- **Option B:** Prod Terraform creates the single NAT in the existing VPC and updates route tables (need to import or reference existing route tables).

### 5.3 Prod secrets (same structure as dev)

- In `infra/envs/prod/main.tf` add a **secrets** module (same as dev): create secrets for Razorpay, Google Maps, Shiprocket (and any other integration). Use **variables** (e.g. from tfvars or env) so values can be placeholders; you’ll update secret values in Secrets Manager manually after deploy.
- Lambda `common_env_vars`: pass **secret ARNs** (e.g. `RAZORPAY_SECRET_ARN`, `GOOGLE_MAPS_SECRET_ARN`, `SHIPROCKET_SECRET_ARN`, `DB_SECRET_ARN`) so all config is “variable taking input from Secrets Manager”. No hardcoded keys.

### 5.4 Prod Terraform only creates/updates resources

- Terraform already behaves as “create if not exist, update if exist”. No change needed beyond using existing VPC/subnets so prod doesn’t create a second VPC.

---

## 6. Prod CI/CD: Seed Only Once

- **When:** You run the **one-time bootstrap** (export from dev → import to prod + seed admin user) **manually** or from a one-off job (not on every deploy).
- **On every prod deploy (e.g. on promote develop → prod):**
  1. Run `check-prod-bootstrap.js` against prod DB.
  2. If bootstrap already completed → **skip** import and admin seed; only run **migrations** (schema only, idempotent).
  3. Deploy code: Terraform apply (if needed), Lambda, **web frontends only** (admin-web, customer-web, vendor-web to prod S3/CloudFront). **No** iOS/Android app build or Capacitor build in this pipeline.
- So: **first time** = migrations + import + admin seed; **every other time** = migrations (if any) + code deploy (Lambda + web), no re-seed, no app build.

---

## 7. SMS in Prod

- **Config:** `platform_settings` row `setting_key = 'admin:settings:aws'` holds SNS/SMS config (and optional credentials). This is part of the **admin config export** so prod gets it from dev export (or you can run `seed-sms-aws-settings.js` for prod once with prod credentials).
- **Secrets:** Actual AWS credentials for SNS can live in Secrets Manager; Lambda already reads `admin:settings:aws` from DB and can be extended to pull credentials from Secrets Manager if you prefer. You update secret values manually with prod APIs.
- **UAT_MODE:** Prod Lambda has `UAT_MODE = "false"` so real SMS is sent in prod; dev keeps `UAT_MODE = "true"` for UAT.

---

## 8. Promote Develop → Prod (Code-Only After First Bootstrap)

- **Trigger:** Push to `main` or manual “Deploy to Production” workflow.
- **Steps:**
  1. Checkout code (from `main` or tag).
  2. Run `check-prod-bootstrap.js`; if not done, fail or run one-time bootstrap (your choice).
  3. Run DB migrations (schema only) against prod DB.
  4. Terraform plan/apply (prod) – only creates/updates resources in same VPC, prod-tagged.
  5. Build and deploy Lambda (prod).
  6. Build and deploy **web frontends only** to prod S3/CloudFront with prod API URL:
     - **admin-web** → prod admin URL (e.g. https://admin.warmpawz.com or prod CloudFront).
     - **customer-web** → prod customer web URL (used as the **production web URL for Capacitor** customer app).
     - **vendor-web** → prod vendor web URL (used as the **production web URL for Capacitor** vendor app).
- **Excluded from prod pipeline:** No build or deploy of **iOS/Android app binaries** (no Capacitor build step). Customer and vendor **native apps** are built separately (e.g. via Capacitor locally or in a separate workflow) and are configured to load the **production web URLs** above. So: prod deploy provides the web URLs; you point the newly built production Capacitor apps (iOS/Android) at those URLs.
- **No** export/import or admin user seed on every run; **only once** via bootstrap.

---

## 8b. No App Build in Prod – Capacitor Uses Prod Web URLs

- **Prod pipeline does NOT:** Build or deploy iOS/Android app binaries (no Xcode/Android build, no Capacitor build step in prod CI/CD).
- **Prod pipeline DOES:** Deploy **web** only – admin-web, customer-web, vendor-web – to prod S3/CloudFront. Those become the **production web URLs**.
- **Capacitor:** Customer and vendor **native apps** (iOS/Android) are built with **Capacitor** from the same customer-web and vendor-web codebases, but the **build** of the .ipa/.apk (or app bundles) is done **outside** this prod pipeline (e.g. locally, or in a separate mobile-build workflow). Those Capacitor apps are configured to use the **newly built production web** – i.e. the prod customer-web and vendor-web URLs deployed above. So you deploy the web to prod; then you build Capacitor apps (when needed) and point them at the production web URL. No app build steps in the promote-develop-to-prod flow.

---

## 9. Implementation Order (Suggested)

1. **Define export/import table list** (finalize from section 3) and add any missing tables (e.g. refund tiers, scheduling_policies).
2. **Implement `export-admin-config.js`** (dev DB → JSON files).
3. **Implement `import-admin-config.js`** (JSON → prod DB, with bootstrap marker).
4. **Implement `seed-prod-admin-user.js`** (Cognito admin@warmpawz.com / Warmpawz2025).
5. **Implement `check-prod-bootstrap.js`** (read marker from prod DB).
6. **Prod Terraform:** Switch to existing VPC, add secrets module, ensure one NAT for VPC (in dev or prod Terraform).
7. **Prod workflow:** Add bootstrap check; if not done, run bootstrap once; on every deploy run migrations + code deploy only.
8. **Document:** How to run bootstrap once (env vars, order of scripts), and how to update prod secrets manually after deploy.

---

## 10. Can This Be Done? Is It Possible?

**Yes.** All of the above is possible:

- **Same VPC, one NAT:** Use existing VPC in prod Terraform; manage a single NAT (in dev or prod) and point all private/database routes to it.
- **Admin config only, no vendor data:** Export/import only the listed tables; prod DB has zero vendors until they onboard in prod.
- **One-time seed, then code-only deploys:** Bootstrap marker + `check-prod-bootstrap.js` ensures seed runs once; subsequent deploys only run migrations and deploy code.
- **Secrets from Secrets Manager:** Prod secrets module + Lambda env vars; you update secret values manually with prod APIs.
- **Admin login:** Cognito user admin@warmpawz.com / Warmpawz2025 created once.
- **Real SMS in prod, UAT in dev:** UAT_MODE false in prod; admin:settings:aws in prod from import or one-time SMS script.
- **Promote develop → prod:** Workflow runs migrations + Terraform + Lambda + frontends; no re-seed if bootstrap already done.

If you want to proceed, the next step is implementing the Node scripts (export, import, seed admin, check bootstrap) and then adjusting prod Terraform (existing VPC, one NAT, secrets module) and the prod pipeline.
