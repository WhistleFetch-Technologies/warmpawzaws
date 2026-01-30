# Next.js Frontend + AWS Serverless Architecture

This doc describes how the **Next.js frontend structure is retained**, built for **performance** (not confusion), and kept **highly compatible** with AWS Serverless: **Cognito**, **Lambda**, **RDS**, **S3**, **CloudFront**, **OpenSearch**, and **AWS Secrets Manager** for Payment, Map, and Logistics APIs.

---

## 1. Next.js Frontend Structure (Retained)

| App | Path | Purpose |
|-----|------|---------|
| Admin Web | `apps/admin-web/` | Admin portal (vendors, analytics, settings) |
| Vendor Web | `apps/vendor-web/` | Vendor dashboard, onboarding, services |
| Customer Web | `apps/customer-web/` | Customer app (booking, shop, profile) |

**Shared:**
- **Build output**: `dist/` (same for all; no confusion with `.next` in deploy).
- **Static export**: `output: 'export'` (admin optional via `NEXT_EXPORT`; vendor/customer always) so assets are **static HTML/JS/CSS** and deploy to **S3 + CloudFront** with no Node server.
- **Runtime config**: API base URL and feature flags come from **`/runtime-config.js`** (injected at deploy), not build-time env, so one build can serve multiple environments.
- **Packages**: `@warmpawz/ui`, `@warmpawz/shared-libs` via `transpilePackages`; resolve from `packages/ui` in webpack.

**No confusion:**
- Single `distDir: 'dist'` per app.
- No mixed SSR + static; frontends are **static export only** for AWS (S3/CloudFront).
- API calls go to **API Gateway → Lambda**; no Next.js API routes in production deploy.

---

## 2. Build for Performance

Each Next.js app uses:

- **`swcMinify: true`** – Fast, small bundles.
- **`compress: true`** – Gzip/Brotli at CDN (CloudFront).
- **`images: { unoptimized: true }`** – Required for static export; image optimization can be done via CloudFront/Lambda@Edge or external service later.
- **`experimental.optimizePackageImports`** – Tree-shake `lucide-react`, `@radix-ui/*`, `framer-motion`, `date-fns` so only used icons/components are bundled.
- **`modularizeImports`** for `lucide-react` – Import per icon, not whole library.
- **`outputFileTracingExcludes: { '*': ['**/*'] }`** – For static export only; avoids tracing noise and manifest issues with `distDir`.
- **Webpack `splitChunks`** – Separate `vendors`, optional `framer-motion` / `radix-ui` chunks for better caching.

Result: smaller client bundles, fewer round-trips, CDN-friendly caching.

---

## 3. AWS Serverless Deployment Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    CloudFront (CDN)                      │
                    │  Admin / Vendor / Customer static sites (HTTPS)          │
                    └───────────────────────────┬─────────────────────────────┘
                                                │
            ┌───────────────────────────────────┼───────────────────────────────────┐
            │                                   │                                   │
            ▼                                   ▼                                   ▼
   ┌─────────────────┐               ┌─────────────────┐               ┌─────────────────┐
   │  S3 Admin Web    │               │  S3 Vendor Web   │               │  S3 Customer Web │
   │  (static export  │               │  (static export  │               │  (static export  │
   │   from dist/)    │               │   from dist/)    │               │   from dist/)    │
   └─────────────────┘               └─────────────────┘               └─────────────────┘

   Frontend: Next.js static export → S3 bucket → CloudFront origin.
   URL rewrite (CloudFront Function): /path → /path.html for Next.js static export.
```

```
   Browser (Cognito JWT) ──► API Gateway ──► Lambda (Hono API)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
              ┌──────────┐     ┌──────────┐     ┌──────────────┐
              │   RDS    │     │    S3    │     │  OpenSearch   │
              │ (Postgres│     │ (uploads,│     │  (search)     │
              │  /Aurora)│     │  assets) │     │              │
              └──────────┘     └──────────┘     └──────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      │
                                      ▼
                            ┌──────────────────┐
                            │ AWS Secrets Mgr   │
                            │ Payment, Map,     │
                            │ Logistics API    │
                            └──────────────────┘
```

- **Cognito**: User pools for Admin, Vendor, Customer. Frontend uses Cognito SDK; JWT sent to API Gateway; Lambda validates via Cognito authorizer or custom JWT check.
- **Lambda**: Single Hono app in `backend/lambda`; bundled and deployed as one or more functions; API Gateway routes (e.g. `ANY /{proxy+}`) forward to Lambda.
- **RDS**: DB credentials from **Secrets Manager** (or RDS-managed secret); Lambda connects from VPC.
- **S3**: Static sites (Next.js `dist/`), uploads bucket; CloudFront OAC for private buckets if needed.
- **CloudFront**: HTTPS, caching, URL rewrite for Next.js static export; optional custom domain per app.
- **OpenSearch**: Search/indexing; Lambda or background jobs write/query; frontend never talks to OpenSearch directly.

---

## 4. AWS Secrets Manager Integration

**Principle:** API keys and credentials are **never** in frontend or in repo. They live in **AWS Secrets Manager**. **Lambda** reads secrets at runtime; frontend only calls backend APIs.

### 4.1 Secret Naming Convention

- **Pattern**: `warmpawz/<environment>/<integration>`  
- **Examples**: `warmpawz/dev/razorpay`, `warmpawz/dev/google-maps`, `warmpawz/dev/shiprocket`.

### 4.2 Payment API (Razorpay)

- **Secret name**: `warmpawz/<env>/razorpay`
- **Content (JSON)**: `{ "key_id": "...", "key_secret": "..." }`
- **Backend**: `backend/lambda/src/utils/razorpay-client.ts` uses `getSecretJson('razorpay')` (with fallback to DB/env).
- **Infra**: `infra/modules/secrets` creates the secret; Lambda gets `RAZORPAY_SECRET_ARN` or IAM permission to read by name.

### 4.3 Map API (Google Maps)

- **Secret name**: `warmpawz/<env>/google-maps` (or `google-maps/api-key` for legacy)
- **Content (JSON)**: `{ "api_key": "..." }`
- **Backend**: `backend/lambda/src/lib/services/gps-tracking-service.ts`, `backend/lambda/src/endpoints/admin-integrations.ts`, `backend/lambda/src/endpoints/tracking.ts` use `getSecret('google-maps/api-key')` or `getSecretJson('google-maps')`.
- **Infra**: `infra/modules/secrets` creates `google_maps` secret; Lambda has access.
- **Frontend**: No key in frontend; map/grid APIs are proxied via Lambda (e.g. geocode, distance) so the key stays server-side.

### 4.4 Logistics API (Shiprocket, Delhivery, Dunzo)

- **Shiprocket**
  - **Secret name**: `warmpawz/<env>/shiprocket`
  - **Content (JSON)**: `{ "email": "...", "password": "..." }`
  - **Backend**: `backend/lambda/src/endpoints/logistics.ts` uses `getSecretJson('shiprocket')`.
  - **Infra**: `infra/modules/secrets` creates the secret.

- **Delhivery**
  - **Secret name**: `warmpawz/<env>/delhivery`
  - **Content (JSON)**: `{ "api_token": "...", "client_name": "..." }`
  - **Backend**: `backend/lambda/src/endpoints/logistics.ts` and `backend/lambda/src/endpoints/logistics-webhooks.ts` use `getSecretJson('delhivery')`.
  - **Infra**: Create this secret manually in Secrets Manager or add to `infra/modules/secrets` with optional variables.

- **Dunzo**
  - **Secret name**: `warmpawz/<env>/dunzo`
  - **Content (JSON)**: `{ "client_id": "...", "client_secret": "...", "webhook_secret": "..." }`
  - **Backend**: `backend/lambda/src/endpoints/logistics.ts` uses `getSecretJson('dunzo')`.
  - **Infra**: Create manually or add to secrets module.

### 4.5 Backend Usage (Lambda)

- **Utility**: `backend/lambda/src/utils/secrets-manager.ts` – `getSecret(secretName)`, `getSecretJson<T>(secretName)`.
- **STAGE**: From `NODE_ENV` or `STAGE` (e.g. `dev`, `prod`); full id is `warmpawz/${STAGE}/${secretName}`.
- **IAM**: Lambda execution role must have `secretsmanager:GetSecretValue` on these secrets (or on `warmpawz/<env>/*`).
- **Infra**: `infra/envs/dev/main.tf` passes `module.secrets.all_secret_arns` into Lambda’s `secrets_arns` so the role can read them.

---

## 5. Deployment Flow (Summary)

1. **Next.js**: `npm run build` in each app → `apps/<app>/dist/` (static export).
2. **Upload**: Sync `dist/` to the app’s S3 bucket (e.g. via CI or `aws s3 sync`).
3. **CloudFront**: Origin = S3; URL rewrite function adds `.html` for Next.js routes; invalidate cache if needed.
4. **Runtime config**: Deploy step writes `runtime-config.js` (e.g. `apiBaseUrl`, `uatMode`) into S3 or injects into `index.html` so the same build works for dev/stage/prod.
5. **Lambda**: Build `backend/lambda` → zip → deploy to Lambda; API Gateway points to Lambda.
6. **Cognito**: Configured in Terraform; frontend uses Cognito Hosted UI or SDK; callback URLs match CloudFront domains.
7. **Secrets**: Stored in Secrets Manager; Lambda reads at runtime (payment, map, logistics). No secrets in frontend or in code.

---

## 6. OpenSearch

- **Infra**: `infra/modules/opensearch` provisions the domain (if used).
- **Backend**: Lambda or dedicated indexer jobs write/query OpenSearch (e.g. search, analytics).
- **Frontend**: No direct OpenSearch access; all search goes through Lambda APIs.

---

## 7. Checklist: Compatibility

- [ ] Next.js apps use **static export** and **`dist/`**; no Node server in production.
- [ ] **Runtime config** used for API base URL; no hardcoded backend URLs in frontend.
- [ ] **Cognito** used for auth; JWT sent to API Gateway; Lambda validates.
- [ ] **Lambda** is single entry for API; RDS, S3, OpenSearch, Secrets Manager used only from Lambda.
- [ ] **Payment (Razorpay), Map (Google Maps), Logistics (Shiprocket, Delhivery, Dunzo)** credentials only in **Secrets Manager**; Lambda uses `getSecret` / `getSecretJson`.
- [ ] **CloudFront** serves static sites; URL rewrite in place for Next.js export.
- [ ] **Terraform**: Cognito, Lambda, RDS, S3, CloudFront, OpenSearch, Secrets modules applied per environment.

This keeps the Next.js frontend structure clear, builds optimized for performance, and aligns with AWS Serverless (Cognito, Lambda, RDS, S3, CloudFront, OpenSearch, Secrets Manager) without confusion.
