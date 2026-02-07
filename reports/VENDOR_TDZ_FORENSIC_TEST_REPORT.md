# Vendor App Forensic Test Report (TDZ Fix Validation)

**Date:** 2026-02-04  
**Scope:** Live URLs – Admin, Vendor, Customer frontends + API  
**Context:** Post-deployment forensic validation after TDZ fix (“Cannot access 'm' before initialization”) and rebuild/redeploy of vendor-web.

---

## 1. Test URLs

| App      | URL |
|----------|-----|
| Admin    | https://dfof7mguaa0a5.cloudfront.net |
| Vendor   | https://d1s6ykkj381k58.cloudfront.net |
| Customer | https://d2aoyjj8ine0wk.cloudfront.net |
| API      | https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com |

---

## 2. Frontend Application Tests (scripts/test-frontend-apps.sh)

| Area        | Result | Details |
|-------------|--------|---------|
| **Admin UI**   | ✅ 12/12 | /, /vendors, /customers, /services, /bookings, /analytics, /settings, /roles, /capabilities, /policies, /gst-config, /reports – all HTTP 200 |
| **Vendor UI**  | ✅ 9/9  | /, /dashboard, /services, /bookings, /staff, /schedule, /analytics, /profile, /settings – all HTTP 200 |
| **Customer UI**| ✅ 9/9  | /, /services, /search, /bookings, /pets, /profile, /wallet, /shop, /orders – all HTTP 200 |
| **API**        | ⚠ 5/6  | /health, /regions, /roles, /services, /customer/vendors/search – 200; /admin/capabilities – 401 (expected without auth) |

**Summary:** 35 passed, 1 failed. The single “failure” is `/admin/capabilities` returning 401 (auth required), which is expected for unauthenticated requests.

---

## 3. Vendor-Specific Forensic Checks (TDZ Fix)

### 3.1 HTML Delivery

| Resource     | HTTP | Size  | Notes |
|-------------|------|-------|--------|
| GET /        | 200  | 4,667 B | index.html, Next.js shell, correct script/link refs |
| GET /seller  | 200  | 5,380 B | Seller route (VendorDashboard); different chunk set (see below) |

### 3.2 Next.js Chunk References

- **Root (/):** `webpack-99555788de906d2a.js`, `2117-6a4106b1e7f91f41.js`, `app/page-44b2a9fc3d75c35c.js`, `4438-*`, `4714-*`, `main-app-*`, `app/layout-*`, `app/error-*`, `app/not-found-*`, `polyfills-*`.
- **Seller (/seller):** Same base set plus `9530-50f7f87873a29967.js`, `app/seller/page-0a79a0316a95e0ce.js` (seller page chunk).

Chunk hashes differ from pre-fix (e.g. no `3742`, `5362` in these responses), consistent with a new build after static VendorDashboard import and `.then((mod) =>)` changes.

### 3.3 Chunk Availability

| Chunk | HTTP | Notes |
|-------|------|--------|
| webpack-99555788de906d2a.js | 200 | Runtime |
| 2117-6a4106b1e7f91f41.js   | 200 | Shared |
| app/seller/page-0a79a0316a95e0ce.js | 200 | Seller page (VendorDashboard path) |
| 9530-50f7f87873a29967.js  | 200 | Seller route chunk |

All sampled chunks return 200.

### 3.4 Runtime Config

- `GET /runtime-config.js` returns 200.
- Content: `window.__WARMPAWZ_RUNTIME_CONFIG__` with `apiBaseUrl: "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"`, `uatMode: true`. Correct for API Gateway.

### 3.5 TDZ / Error String Check

- Chunks sampled (e.g. 2117, seller page) do not contain the literal string `"Cannot access 'm' before initialization"` in the sampled regions.
- This is a sanity check only; runtime behavior (no 500, no TDZ in console) is the real validation.

---

## 4. Fixes Covered by This Forensic Run

1. **Static import of VendorDashboard** in `VendorLandingPage.tsx` (no lazy load for dashboard chunk).
2. **All `.then((m) =>` → `.then((mod) =>`** in vendor-web: `app/page.tsx`, `app/onboarding/page.tsx`, `VendorCustomServiceCreationEnhanced.tsx`, `VendorAnalytics.tsx`.
3. **VendorDashboard** and **VendorLandingPage** already using `(mod)` in lazy/dynamic imports; no remaining `(m)` in those paths.

---

## 5. Conclusions

| Check | Status |
|-------|--------|
| All three frontends (Admin, Vendor, Customer) serve pages with HTTP 200 | ✅ |
| Vendor / and /seller both 200 with correct HTML and chunk refs | ✅ |
| Key vendor JS chunks (webpack, 2117, seller page, 9530) return 200 | ✅ |
| runtime-config.js present and points to API Gateway | ✅ |
| No TDZ error string found in sampled chunks | ✅ |
| API: public endpoints 200; /admin/capabilities 401 without auth (expected) | ✅ |

**Verdict:** Forensic tests pass. Vendor app is being served correctly after the TDZ fix and redeploy. For full confirmation, perform a manual login on the vendor URL and open the dashboard/seller flow; there should be no 500 and no “Cannot access 'm' before initialization” in the console.

---

## 6. How to Re-run

```bash
# Frontend tests (set URLs first)
export ADMIN_URL="https://dfof7mguaa0a5.cloudfront.net"
export VENDOR_URL="https://d1s6ykkj381k58.cloudfront.net"
export CUSTOMER_URL="https://d2aoyjj8ine0wk.cloudfront.net"
export API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
./scripts/test-frontend-apps.sh
```

Vendor-only checks:

```bash
curl -sI "https://d1s6ykkj381k58.cloudfront.net/"
curl -sI "https://d1s6ykkj381k58.cloudfront.net/seller"
curl -sI "https://d1s6ykkj381k58.cloudfront.net/runtime-config.js"
```
