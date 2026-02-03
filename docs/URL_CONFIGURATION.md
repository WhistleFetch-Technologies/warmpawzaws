# URL Configuration – Single Source of Truth

See also: **Service catalog seeding** – `scripts/seed-service-catalog-comprehensive.js` seeds the full vet catalog. Run: `ENVIRONMENT=dev node scripts/seed-service-catalog-comprehensive.js`.

---

## Rule: No hardcoded API/CloudFront URLs in app or Lambda code

**Always use runtime and environment variables.** Official URLs are in `config/urls.json` for reference only; deploy and CI must set env vars from there.

- **Official CloudFront URLs** (reference only; set via env in tests/deploy):
  - **Admin**: `https://dfof7mguaa0a5.cloudfront.net` → set `ADMIN_URL`
  - **Vendor**: `https://d1s6ykkj381k58.cloudfront.net` → set `VENDOR_URL`
  - **Customer**: `https://d2aoyjj8ine0wk.cloudfront.net` → set `CUSTOMER_URL`

- **API base URL** for frontend apps must come from:
  1. **Deployed**: `runtime-config.js` (injected at deploy; value from env or `config/urls.json` in deploy script)
  2. **Local dev**: `NEXT_PUBLIC_API_BASE_URL` (no hardcoded fallback in app code)
  3. **Backend CORS**: `ALLOWED_ORIGINS` env (comma-separated); if unset, only localhost is allowed

- **CloudFront URLs** are for serving the SPAs and CORS; **not** for use as `apiBaseUrl` (API calls go to API Gateway).

## Single source: `config/urls.json`

| Key | Purpose |
|-----|--------|
| `apiGatewayDefaultUrl` | Default API base when AWS discovery fails in deploy scripts; fallback in app code must match this or come from env. |
| `cloudfront.admin` | Admin app CloudFront (SPA only). |
| `cloudfront.vendor` | Vendor app CloudFront (SPA only). |
| `cloudfront.customer` | Customer app CloudFront (SPA only). |

## Per-app behaviour

| App | API base source | Correct value |
|-----|-----------------|---------------|
| admin-web | Deploy injects API Gateway into `dist/runtime-config.js`; layout fallback | API Gateway URL |
| vendor-web | Deploy injects API Gateway; `lib/api-config.ts` fallback | API Gateway URL |
| customer-web | Deploy injects API Gateway; runtime-config + layout fallback | API Gateway URL |

Deploy scripts resolve API Gateway via:

```bash
aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" --output text
```

If that fails, they use `apiGatewayDefaultUrl` from `config/urls.json`.

## Audit summary (fixes applied)

| App / area | Issue | Fix |
|------------|--------|-----|
| **customer-web** | `apiBaseUrl` was Customer CloudFront → API returned HTML, not JSON | Deploy injects API Gateway; `runtime-config.js`, layout, `api-client.ts`, `useWebSocket.ts`, `photo-upload-enhanced.ts` use API Gateway fallback |
| **admin-web** | Previously fixed | Deploy injects API Gateway; layout and runtime-config fallback = API Gateway |
| **vendor-web** | Already correct | Deploy injects API Gateway; `api-config.ts` and runtime-config fallback = API Gateway |
| **packages/api-config** | Default was `z0b3obweb6` (inconsistent) | Default set to `config/urls.json` value (`rrg9107m3d`) |
| **Deploy scripts** | Fallback URL duplicated in each script | Fallback read from `config/urls.json` when `jq` available |

## Where URLs are allowed (not app API base)

- **Backend Lambda** (`backend/lambda/src/handler/index.ts`): CORS `Access-Control-Allow-Origin` must list the three CloudFront URLs (browser sends `Origin: https://...cloudfront.net`). No change.
- **Deploy scripts**: CloudFront URLs for S3 bucket, distribution ID, and invalidation. No change.
- **Tests / E2E**: Default base URLs for Playwright or curl; prefer env vars (`CUSTOMER_URL`, `API_URL`, etc.). No change.
- **Documentation**: Listing official CloudFront and API Gateway URLs. No change.
