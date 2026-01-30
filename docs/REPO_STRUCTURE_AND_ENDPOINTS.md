# Repo structure and endpoints (single repo: warmpawzecodev)

Single repo: **warmpawzecodev**. All apps and backend live here. This doc describes canonical structure, where API base URL and endpoints are defined, and how to verify them E2E.

## Canonical structure

```
warmpawzecodev/
├── apps/                          # Canonical app entry points
│   ├── admin-web/                 # Next.js admin (primary admin UI)
│   ├── customer-web/              # Next.js customer
│   ├── vendor-web/                # Next.js vendor
│   ├── WarmpawzVendor/            # React Native vendor
│   └── WarmpawzCustomer/          # React Native customer
├── backend/
│   └── lambda/                     # Hono API (API Gateway) – single backend
├── packages/                       # Shared code (single source)
│   ├── api-config/                 # API base URL + endpoint path constants
│   ├── api-contracts/              # Zod contracts, types
│   ├── shared-types/
│   └── ui/
├── Warmpawz Ecosystem Development/ # Vite app (Customer + Vendor + Admin in one)
├── Admin UI/                       # Alternate admin (Next.js) – align to apps/admin-web
├── docs/
├── tests/                          # E2E, playwright, etc.
└── scripts/
```

- **Backend**: `backend/lambda` – one API. Deployed to API Gateway (e.g. `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`).
- **API config**: `packages/api-config` – base URL and endpoint paths. All apps should use this or match these paths.
- **Apps**: `apps/*` are the main deployable apps. `Warmpawz Ecosystem Development` is a unified dev/demo app and should use the same base URL and paths (via `Warmpawz Ecosystem Development/src/utils/api-config.ts` and optionally `@warmpawz/api-config`).

## API base URL

| App | Source |
|-----|--------|
| apps/admin-web, vendor-web, customer-web | `window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl` or `NEXT_PUBLIC_API_BASE_URL` |
| apps/WarmpawzVendor (RN) | `API_BASE_URL` from `src/config/aws.ts` (env: `AWS_API_GATEWAY_URL`) |
| Warmpawz Ecosystem Development | `getApiBaseUrl()` from `src/utils/api-config.ts` (env: `VITE_API_BASE_URL`) |

Set the same backend in each app (e.g. API Gateway URL) so all hit one backend.

## Endpoint paths (backend/lambda)

Key paths – use with base URL above. Full list lives in `backend/lambda/src/endpoints/*`.

| Path | Method | Purpose |
|------|--------|---------|
| `/config/roles` | GET | List roles (choose your role, vendor onboarding) |
| `/config/roles/:roleId` | GET | Role config by ID |
| `/admin/roles` | GET | Admin role list |
| `/vendor/status/:phone` | GET | Vendor status by phone |
| `/vendor/find-by-phone/:phone` | GET | Vendor by phone |
| `/vendor/application` | * | Vendor application (submit, etc.) |
| `/admin/vendors/active` | GET | Active vendors (admin) |
| `/auth/otp/send` | POST | OTP send |
| `/auth/otp/verify` | POST | OTP verify |
| `/customer/services` | GET | Customer services |
| `/customer/profile/:phone` | GET | Customer profile |
| `/customer/:phone/bookings` | GET | Customer bookings |

Constants: `packages/api-config` exports `ENDPOINTS` (e.g. `ENDPOINTS.CONFIG_ROLES`, `ENDPOINTS.VENDOR_STATUS(phone)`).

## Where endpoints are used

- **Vendor “choose your role”**:  
  - `apps/vendor-web`: `apiClient.get('/config/roles')` (lib/api-client.ts base URL).  
  - `apps/WarmpawzVendor`: `fetch(API_BASE_URL + '/config/roles')` in VendorRoleSelectionScreen.  
  - Warmpawz Ecosystem Development: `configRolesUrl()` from `src/utils/supabase/info.ts` in VendorRoleSelection.tsx.
- **Admin active vendors**:  
  - `apps/admin-web`: apiClient + `/admin/vendors/active`.  
  - Warmpawz Ecosystem Development / Admin UI: use same path with their base URL.

## E2E verification checklist

1. **Single backend**: All apps point to same API base (env / runtime-config / `getApiBaseUrl()`).
2. **No hardcoded API URLs in app code**: Prefer `getApiBaseUrl()` + path or `configRolesUrl()` (Ecosystem). Run `scripts/verify-endpoints-structure.js` to find strays.
3. **Paths match backend**: Paths in `packages/api-config` and in app code match `backend/lambda/src/endpoints/*`.
4. **Vendor onboarding**: Role list loads from `/config/roles`; role selection and onboarding use `/config/roles/:roleId` and vendor application endpoints as in backend.
5. **Tests**: `tests/e2e/*` use `TEST_API_URL` or same base; hit real or stubbed backend with same paths.

## Verification script

Run from repo root:

```bash
node scripts/verify-endpoints-structure.js
```

This reports:

- Files that still use hardcoded API URLs (e.g. legacy `supabase.co` or `make-server-3dd53475`).
- Files that use `/config/roles` or other key paths so you can confirm they use the shared base URL.
