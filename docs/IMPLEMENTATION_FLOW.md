# Implementation Flow: Deployment Architecture, DB Migrations & Deployment Scripts

## 1. Deployment Architecture (AWS Serverless)

The platform runs on **AWS Serverless** with the following components:

| Component | AWS Service | Purpose |
|-----------|-------------|---------|
| **API & business logic** | **Lambda** | Hono API; handles all backend endpoints |
| **Database** | **RDS** (PostgreSQL / Aurora) | Persistent data (vendors, bookings, service_catalog, etc.) |
| **Auth** | **Cognito** | User and vendor authentication (JWT) |
| **Static frontends** | **S3 + CloudFront** | Admin, Vendor, Customer web (Next.js static export) |
| **Storage** | **S3** | Uploads, assets, runtime config |

**Flow:**

- **Frontends** (admin-web, vendor-web, customer-web): built as static export → uploaded to **S3** → served via **CloudFront**.
- **API**: **API Gateway** → **Lambda** (single handler or HTTP API).
- **Lambda** connects to **RDS** (via VPC), **Cognito** (token validation), **S3** (uploads), and **Secrets Manager** (DB credentials).

See also: `docs/NEXTJS_AWS_SERVERLESS_ARCHITECTURE.md`.

---

## 2. DB Migrations: Use Node Scripts in `scripts/`

**Do not** run raw SQL against RDS by hand for schema changes. Use the **Node.js migration scripts** in the **`scripts/`** folder so that:

- RDS connection uses the same pattern (Secrets Manager, SSL, env).
- The same script can be used for dev/staging/prod via `ENVIRONMENT`.

### 2.1 Generic RDS migration runner

**Script:** `scripts/run-migration-rds-node.js`

Runs a single migration file from `db/migrations/` against the RDS cluster for the given environment.

**Usage:**

```bash
# With ENVIRONMENT (uses AWS RDS cluster + Secrets Manager for that env)
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 524_service_catalog_specialization_ids.sql

# Or with staging/prod
ENVIRONMENT=staging node scripts/run-migration-rds-node.js 524_service_catalog_specialization_ids.sql
```

**Requirements:**

- AWS CLI configured; access to RDS cluster `warmpawz-{ENVIRONMENT}-cluster` and Secrets Manager secret for DB credentials.
- Migration file name only (e.g. `524_service_catalog_specialization_ids.sql`) or path under `db/migrations/`.

**What it does:**

- Resolves RDS cluster endpoint and DB name from AWS.
- Fetches DB user/password from Secrets Manager.
- Connects to RDS (SSL), runs the SQL in the migration file, then exits.

### 2.2 Migration-specific apply scripts

Some migrations have a **dedicated apply script** in `scripts/` that wraps the same pattern (e.g. read SQL from `db/migrations/`, connect to RDS, run SQL). Examples:

- `scripts/apply-migration-255-service-catalog-role-assignment.js`
- `scripts/apply-migration-523-orders-meal-plan-delivery.js`

**Usage:** See the comment block at the top of each script (e.g. `node scripts/apply-migration-523-orders-meal-plan-delivery.js`). Typically:

- `ENVIRONMENT=dev` (or `staging` / `prod`) for target env.
- Optional: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SECRET_ARN` or `DB_USER`/`DB_PASSWORD` if not using AWS discovery.

### 2.3 Local / non-RDS (optional)

For **local Postgres** (e.g. `postgresql://warmpawz:warmpawz@localhost:5432/warmpawz`), you can use:

- `db/run-migration.js` with a full path to the migration file, **or**
- Set `DATABASE_URL` and use any script that supports it (if documented in that script).

Production and staging schema changes should go through the **Node scripts in `scripts/`** against RDS.

---

## 3. Deployment: Use Scripts in `scripts/`

**Do not** deploy by hand (e.g. ad‑hoc Lambda uploads or S3 copies). Use the **deployment scripts** in **`scripts/`** so that build, config injection, and uploads are consistent.

### 3.1 Full platform deployment

**Script:** `scripts/deploy-all.sh`

**Usage:**

```bash
./scripts/deploy-all.sh dev        # Deploy everything to dev
./scripts/deploy-all.sh staging    # Deploy to staging
./scripts/deploy-all.sh prod       # Deploy to production
```

**Typical steps (summary):**

- Pre-flight: Node, npm, AWS CLI, credentials.
- Build backend Lambda.
- Deploy infrastructure (e.g. CDK) if applicable.
- Deploy Lambda, API Gateway, frontends (S3 + CloudFront), etc.

### 3.2 App-specific deployment scripts

| Script | Purpose |
|--------|---------|
| `scripts/deploy-admin-web.sh` | Build and deploy admin-web to S3 + CloudFront |
| `scripts/deploy-vendor-web.sh` | Build and deploy vendor-web to S3 + CloudFront |
| `scripts/deploy-customer-web-aws.sh` | Build and deploy customer-web to S3 + CloudFront |
| `scripts/deploy-now.sh` | Quick deploy (see script for scope) |
| `scripts/quick-deploy.sh` | Shortcut deploy (see script for scope) |

**Usage:** See the header comment in each script. Many support `--deploy-only` to skip build and only upload existing `dist/`.

### 3.3 After deployment

- **DB migrations** must be applied **before** or **right after** deploying Lambda that depends on new schema (e.g. new columns/tables).
- Run migrations with the **Node script** for the target environment (see §2).

---

## 4. Summary Checklist

| Task | Where | Command / note |
|------|--------|-----------------|
| Run a DB migration (RDS) | `scripts/` | `ENVIRONMENT=dev node scripts/run-migration-rds-node.js <migration_filename.sql>` |
| Run a specific migration script | `scripts/` | e.g. `node scripts/apply-migration-523-orders-meal-plan-delivery.js` |
| Deploy full platform | `scripts/` | `./scripts/deploy-all.sh dev` |
| Deploy one frontend | `scripts/` | `./scripts/deploy-admin-web.sh`, etc. |
| Architecture reference | `docs/` | NEXTJS_AWS_SERVERLESS_ARCHITECTURE.md, this file |

---

## 5. Example: Service Catalog Specialization IDs (Migration 524)

1. **Apply migration (RDS):**
   ```bash
   ENVIRONMENT=dev node scripts/run-migration-rds-node.js 524_service_catalog_specialization_ids.sql
   ```
2. **Deploy backend** (so Lambda uses new `service_catalog.specialization_ids`):
   ```bash
   ./scripts/deploy-all.sh dev
   # or deploy only Lambda if your pipeline supports it
   ```
3. **Deploy admin-web** if you changed the service catalog UI:
   ```bash
   ./scripts/deploy-admin-web.sh
   ```

Validation script (optional): `node scripts/validate-service-catalog-specializations.js` (see that script for optional `--api-base` and `--auth-header` for API checks).

**Migration 524 (service_catalog.specialization_ids):** Use the **node script** only—do not skip or assume. Run:
```bash
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 524_service_catalog_specialization_ids.sql
```
The script runs the migration and performs **forensic verification** (column + index). After any changes, run forensic validation:
```bash
node scripts/validate-service-catalog-specializations.js
# With API: node scripts/validate-service-catalog-specializations.js --api-base=<URL> --auth-header="Bearer <token>"
```

**Authenticated API validation (Stage 3):** Admin endpoints (e.g. `POST/PUT/DELETE /admin/service-catalog`) require a Cognito JWT. To run full API wire tests:
1. Sign in as an admin user (e.g. via admin-web or Cognito User Pools).
2. Obtain the IdToken (JWT) from the session or from the sign-in response.
3. Run: `node scripts/validate-service-catalog-specializations.js --api-base=https://<your-api-url> --auth-header="Bearer <IdToken>"`.
This verifies create/read/update of `specialization_ids` over the live API.

---

## 6. Gaps Fixed & Assumptions Avoided (Service Catalog Specializations)

The following were verified and fixed so nothing was skipped or assumed:

| Gap | Fix |
|-----|-----|
| **GET /service-catalog/role/:roleId** did not return `specialization_ids` / `specializationIds` | Response mapping now includes both for each service in the list. |
| **GET /service-catalog/:serviceId** (single service) did not return `specialization_ids` in the nested `service` object | Nested `service` object now includes `specializationIds` and `specialization_ids`. |
| **GET /vendor/:vendorId/service-catalog/complete** `availableServices` did not include specializations | Each item in `availableServices` now includes `specializationIds` and `specialization_ids`. |
| **PUT /admin/service-catalog/:serviceId** accepted only snake_case body fields | Update handler now accepts both snake_case and camelCase (e.g. `serviceName`, `categoryId`, `applicableRoles`, `specializationIds`, `displayOrder`, `duration`, etc.) for consistency with POST and frontend clients. |
| **POST /admin/service-catalog** | Already accepted camelCase; no change. |
| **GET /services/:serviceId** (customer-facing) | Already returned specialization_ids; no change. |
| **GET /admin/service-catalog** | Already returned specialization_ids in list/grouped; no change. |

**Assumptions avoided:**

- No response shape was assumed: all service-catalog GET endpoints that return service objects were checked and updated to include `specialization_ids` / `specializationIds` where they were missing.
- PUT was aligned with POST: same dual-case (snake_case + camelCase) handling for create and update.

**Next steps (no assumptions):**

1. ~~Run migration 524 against RDS~~ (see §5) — **Done** (node script + verification).
2. ~~Deploy backend (Lambda)~~ — **Done** (`./scripts/deploy-all.sh dev`).
3. ~~Deploy admin-web~~ — **Done** (`./scripts/deploy-admin-web.sh`).
4. Optionally run the validation script with `--api-base` and `--auth-header` for end-to-end API checks (admin endpoints require Cognito JWT).
5. **Catalog seeding (India metro + specializations):** Run `ENVIRONMENT=dev node scripts/seed-service-catalog-india-metro.js`. This enhances (does not remove) existing services: vet services from migration 048 with `specialization_ids` and India metro pricing; walker, trainer, behaviorist, groomer with allowed service styles, roles, packages, and India metro prices. Prerequisites: migration 524 applied; `specialization_master` seeded (`node scripts/seed-specialization-master.js`).

---

**Last updated:** 2026-02-02
