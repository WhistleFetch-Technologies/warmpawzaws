# Forensic Verification: Solo Trainer/Groomer + Start Travel

**Date:** 2026-01-29  
**Scope:** Implementation verification for (1) solo trainer/groomer custom services and session packages, (2) POST `/tracking/start` 503 fix.

---

## 1. Solo trainer / solo groomer

### 1.1 Backend – packages API

| Check | Status | Detail |
|-------|--------|--------|
| `groomer` in `allowedSoloRoles` | ✅ | `backend/lambda/src/endpoints/packages.ts`: both POST `/vendor/packages` and POST `/vendor/:vendorId/packages` include `groomer` (and `pet_groomer`) so solo groomers can create session packages. |
| Error message mentions groomers | ✅ | 403 message: "Only solo trainers, walkers, sitters, and groomers can create session packages." |

### 1.2 Frontend – role checks

| File | Check | Status |
|------|--------|--------|
| `VendorCustomServiceCreationEnhanced.tsx` | `groomer_solo` in `VENDOR_ROLE_MAPPING`, `roleName.includes('groomer')` for session packages | ✅ |
| `CreatePackageFlow.tsx` | `groomer_solo` in `hasVendorRole` list | ✅ |
| `SoloProviderDashboard.tsx` | `groomer_solo` in `hasVendorRole` list | ✅ |
| `VendorServiceManagementComplete.tsx` | Same role list | ✅ |
| `VendorDashboard.tsx` | Same role list | ✅ |

### 1.3 Behaviour

- **VendorCustomServiceCreationEnhanced:** Uses role **name** (e.g. `trainer_solo`, `groomer_solo`) via `getVendorRoleName(vendorData)` for category and session-package eligibility; solo groomers get session-only packages.
- **VendorApp:** Merges `roleName` / `role_name` from profile into `vendorData`.
- **VendorServiceManagementComplete:** Passes `fetchedRoleName` into custom service modal when opening from service management.

---

## 2. POST /tracking/start (no 503)

### 2.1 Code checks

| Check | Status | Detail |
|-------|--------|--------|
| Safe body parse | ✅ | `gps-tracking.ts`: uses `c.req.text()` then `JSON.parse()`; invalid/empty JSON returns 400 with "Invalid JSON body...". |
| 400 on invalid body | ✅ | Explicit 400 response for parse errors. |
| 503 with JSON for DB/table errors | ✅ | Catches "relation ... does not exist" and connection errors; returns 503 with `{ error, code: 'TRACKING_UNAVAILABLE' }` or `'SERVICE_UNAVAILABLE'`. |
| ETA fetch timeout | ✅ | `gps-tracking-service.ts`: Distance Matrix fetch uses `AbortController` + 6s timeout; Directions (polyline) uses 4s timeout. |
| Timeout cleared in catch/fallback | ✅ | `clearTimeout(timeoutId)` in catch and in fallback path. |

### 2.2 Live API (dev)

| Test | Expected | Result |
|------|----------|--------|
| POST `/tracking/start` empty body | 400 with error message | ✅ 400 `{"error":"bookingId and vendorId are required"}` |
| POST `/tracking/start` invalid JSON | 400 | ✅ 400 |
| POST `/tracking/start` valid body (non-existent booking) | 404 or 400, **not 503** | ✅ 404 (booking not found) |
| GET `/tracking/booking/:bookingId` | 200 with `success`, `tracking` | ✅ 200 `{"success":true,"tracking":null,"message":"No active tracking session for this booking"}` |

---

## 3. How to run forensic verification

**Code + optional live API:**

```bash
# Code checks only
node scripts/forensic-verification-implementation.js

# Code + live API (dev)
API_BASE_URL=https://rrg9107m3d.execute-api.ap-south-1.amazonaws.com node scripts/forensic-verification-implementation.js
```

**TypeScript version (if ts-node/node-fetch available):**

```bash
npx ts-node scripts/forensic-verification-implementation.ts
API_BASE_URL=https://... npx ts-node scripts/forensic-verification-implementation.ts
```

---

## 4. Summary

- **Solo trainer / solo groomer:** Backend allows session packages for groomer roles; frontend uses role name and includes groomer in all session-package eligibility checks; role name is passed from profile and service management.
- **Start Travel 503:** Body is parsed safely (400 on invalid JSON); ETA calls use timeouts and fallback so Lambda responds; DB/table errors return 503 with JSON. Live dev API returns 400/404 for invalid or unknown booking and does **not** return 503 for these cases.
