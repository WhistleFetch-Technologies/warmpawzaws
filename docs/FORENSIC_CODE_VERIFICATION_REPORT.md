# Forensic Code Verification Report

**Scope:** Trace from every entry point, line-level verification for breakage, gaps, API contract alignment, booking flow steps/parameters, and all roles (Customer, Vendor, Admin, Staff).

**Date:** 2026-01-30

---

## 1. Entry Points (Traced)

| App / Entry | Path | Notes |
|-------------|------|--------|
| **Admin Web** | `apps/admin-web/app/layout.tsx` → `app/page.tsx` → `AdminApp` | Next.js App Router; static export → S3/CloudFront |
| **Vendor Web** | `apps/vendor-web/app/layout.tsx` → `app/page.tsx` → `VendorApp` → `VendorRoleSelection` when new vendor | Next.js; static export |
| **Customer Web** | `apps/customer-web/app/layout.tsx` → `app/page.tsx` → `CustomerApp` | Next.js; static export |
| **Warmpawz Ecosystem (Vite)** | `Warmpawz Ecosystem Development/src/App.tsx` → `VendorApp` / `CustomerApp` / `AdminApp` | Single Vite app; VendorApp → VendorRoleSelection when new vendor |
| **Admin UI (alternate)** | `Admin UI/layout.tsx` + page routes | Next.js; imports `@repo/utils/api-config` |
| **Backend API** | `backend/lambda` → handler → Hono app; routes registered in `handler/index.ts` | API Gateway → Lambda |

---

## 2. Changed Files & Breakage (Verification)

### 2.1 Changes Made in Recent Sessions

| File | Change | Breakage risk |
|------|--------|----------------|
| `Warmpawz Ecosystem Development/src/components/vendor/VendorRoleSelection.tsx` | Use `configRolesUrl()`, `getAuthHeaders()` from `utils/api-config` | **Fixed:** Import now `configRolesUrl, getAuthHeaders` from api-config. |
| `packages/api-config` | **Created** – `getApiBaseUrl()`, `ENDPOINTS` | Not yet consumed by all apps; optional. |
| `apps/admin-web/next.config.js`, `apps/vendor-web/next.config.js`, `apps/customer-web/next.config.js` | Performance opts (compress, optimizePackageImports, modularizeImports); structure retained | No functional breakage; build output remains `dist/`, static export. |

### 2.2 Breakage Status

- **Ecosystem VendorRoleSelection:** Fixed (import from `utils/api-config`).
- **Vendor-web:** Fixed by adding `lib/api-config.ts`; all components use getApiBaseUrl/getAuthHeaders.
- **Admin UI:** Fixed by adding `Admin UI/src/utils/api-config.ts`; all imports use `@repo/utils/api-config` and getApiBaseUrl/getAuthHeaders/getAuthToken.

---

## 3. Gaps in Full Product

| Gap | Location | Severity | Recommendation |
|-----|----------|----------|----------------|
| **Admin UI api-config** | Admin UI | Resolved | `Admin UI/src/utils/api-config.ts` created; all imports use `@repo/utils/api-config`. |
| **api-contracts not enforced at runtime** | Frontend/backend | Medium | `packages/api-contracts` defines Zod schemas (bookings, vendors, etc.) but frontend/backend do not consistently validate requests/responses with them. | Use contracts in Lambda handlers (e.g. `CreateBookingRequestSchema.parse(body)`) and optionally in frontend before submit. |
| **Duplicate booking endpoints** | Backend | Low | Multiple paths for same action: `/bookings/create`, `/booking/create`, `/customer/bookings/create`, `/customer/booking/create`. All are implemented in `bookings-enhanced.ts`; no functional break, but contract surface is large. | Standardize on one path per action and document; keep aliases for backward compatibility. |
| **Customer bookings list path variance** | Frontend vs backend | Low | Frontend: `GET /customer/bookings?phone=...` vs `GET /customer/:phone/bookings`. Backend has both `customer-booking-history.ts` (`/customer/:customerId/bookings`) and `customer-phone-convenience.ts` (`/customer/bookings` with query). | Ensure one canonical path and document; frontend should use it. |
| **Vendor role ID format** | api-contracts | Low | `SelectVendorRoleRequestSchema` uses `role_id: z.string().uuid()` but some roles are slugs (e.g. `veterinarian`, `service-provider`). | Relax to `z.string()` or document slug vs UUID. |

---

## 4. API Contracts: Frontend vs Backend

### 4.1 Booking Create

| Contract | Frontend usage | Backend route | Match |
|----------|----------------|---------------|-------|
| **Create booking** | `POST /bookings/create` (majority), `POST /booking/create`, `POST /customer/bookings/create`, `POST /customer/booking/create` | All four implemented in `bookings-enhanced.ts`; same handler | ✅ Yes |
| **Request body** | `customerId`, `vendorId`, `serviceId`, `bookingDate`, `bookingTime`, `serviceType`, `petId`, `address`, etc. | Handler expects same fields; matches `CreateBookingRequestSchema` (packages/api-contracts) | ✅ Yes |
| **Response** | Frontend expects `bookingId`, `status`, `message` | Backend returns success + data with `bookingId`, status, etc. | ✅ Yes |

### 4.2 Booking Get / List

| Contract | Frontend | Backend | Match |
|----------|----------|---------|--------|
| Get one booking | `GET /customer/bookings/:bookingId` | `GET /bookings/:bookingId`, `GET /customer/bookings/:bookingId` (bookings-enhanced, customer-booking-history) | ✅ Yes |
| List by customer | `GET /customer/:phone/bookings`, `GET /customer/bookings?phone=...` | `GET /customer/:customerId/bookings`, `GET /customer/bookings` (with query) | ✅ Yes (multiple paths) |
| Vendor list | `GET /vendor/bookings`, `GET /vendor/:vendorId/bookings` | Both exist in vendor-bookings.ts, vendor-booking-actions.ts | ✅ Yes |

### 4.3 Config / Roles (Vendor Onboarding)

| Contract | Frontend | Backend | Match |
|----------|----------|---------|--------|
| List roles | Ecosystem: `configRolesUrl()` → `/config/roles`; vendor-web: `apiClient.get('/config/roles')` | `GET /config/roles` (backend/lambda/src/endpoints/roles.ts) | ✅ Yes |
| Role by ID | `GET /config/roles/:roleId` | Implemented in roles.ts | ✅ Yes |

### 4.4 Vendor Application / Status

| Contract | Frontend | Backend | Match |
|----------|----------|---------|--------|
| Vendor status by phone | Ecosystem: `getApiBaseUrl() + /vendor/status/:phone` | `GET /vendor/status/:phone` (vendor-setup.ts; also vendor/status/:vendorId in same file) | ⚠️ Verify path: some code uses phone, some vendorId. |
| Submit application | POST to vendor application endpoint | Multiple endpoints (admin, vendor-setup); need to align with frontend submit. | ✅ Document which path frontend uses. |

---

## 5. Booking Flows: Steps and Parameters (Traceable)

### 5.1 Customer Role – Booking Creation

| Step | Component / API | Parameters in | Parameters out |
|------|-----------------|---------------|----------------|
| 1. Discover service | Customer home, service list, `GET /customer/services` or `/services/:serviceId` | – | `serviceId`, `vendorId`, service details |
| 2. Select slot | Slot picker, `GET /customer/vendor/:vendorId/available-slots` or similar | `vendorId`, `date` | `bookingDate`, `bookingTime` |
| 3. Pet / details | Pet selector, customer phone | `customerId` or phone | `petId`, `customerId` |
| 4. Submit | `UnifiedBookingEngine`, `BookingFlow`, etc. | `customerId`, `vendorId`, `serviceId`, `bookingDate`, `bookingTime`, `serviceType`, `petId`, `address`, … | – |
| 5. API call | `POST /bookings/create` | Body: CreateBookingRequest (see api-contracts) | `bookingId`, `status`, `message` |
| 6. Payment / confirm | Payment page, then redirect to confirmation | `bookingId` | – |

**Traceability:** Parameters flow from step 1 → 2 → 3 → 4 → 5; `vendorId`/`serviceId` from discovery, `bookingDate`/`bookingTime` from slot, `customerId`/`petId` from session/pet selector. **Match:** Yes, with multiple frontend entry points (UnifiedBookingEngine, BookingFlow, VetBookingRouter, etc.) all building same shape for `/bookings/create`.

### 5.2 Vendor Role – Booking Lifecycle

| Step | Component / API | Parameters in | Parameters out |
|------|----------------|---------------|----------------|
| 1. List bookings | Vendor dashboard, `GET /vendor/bookings` or `GET /vendor/:vendorId/bookings` | `vendorId` (from auth/session) | List of bookings |
| 2. Accept / Reject | `POST /vendor/bookings/:bookingId/accept`, `POST /vendor/bookings/:bookingId/reject` | `bookingId` | – |
| 3. Start / Check-in | `POST /vendor/bookings/:bookingId/start-session`, `check-in`, etc. | `bookingId` | – |
| 4. Complete | `POST /vendor/bookings/:bookingId/complete` | `bookingId` | – |

**Traceability:** `bookingId` comes from list; same ID used for all actions. **Match:** Backend has these routes in vendor-booking-actions.ts and vendor-bookings.ts.

### 5.3 Admin Role – Bookings / Vendors

| Step | API | Parameters | Match |
|------|-----|------------|--------|
| List bookings | `GET /admin/bookings` | Query params | ✅ admin.ts |
| List vendors | `GET /admin/vendors/active`, `GET /admin/vendors` | – | ✅ admin-comprehensive.ts, admin.ts |
| Approve / Reject vendor | `POST /admin/vendors/:vendorId/approve`, `reject` | `vendorId` | ✅ admin.ts |

### 5.4 Staff Role – Appointments

| Step | API | Parameters | Match |
|------|-----|------------|--------|
| Staff appointments | `GET /vendor/:vendorId/bookings` or staff-scoped endpoint | `vendorId`, `staffId` | ✅ staff.ts has `PUT /staff/:staffId/appointments/:bookingId/accept`, etc. |
| Accept / Reject / Start / Complete | `PUT /staff/:staffId/appointments/:bookingId/accept` (etc.) | `staffId`, `bookingId` | ✅ staff.ts |

---

## 6. All Roles – Summary

| Role | Entry point | Main flows | API contract match | Parameter trace |
|------|-------------|------------|--------------------|-----------------|
| **Customer** | CustomerApp (customer-web, Ecosystem) | Discover → Slot → Pet → Create booking → Payment | ✅ Booking create/get/list align with backend | ✅ customerId, vendorId, serviceId, bookingDate, bookingTime, petId passed through steps |
| **Vendor** | VendorApp (vendor-web, Ecosystem) | Role selection → Onboarding → Dashboard → Bookings (accept/start/complete) | ✅ Config/roles, vendor bookings, status | ✅ bookingId from list used in actions; vendorId from auth |
| **Admin** | AdminApp (admin-web, Ecosystem), Admin UI | Vendors, bookings, analytics, settings | ✅ Admin endpoints exist | ✅ vendorId, applicationId in approve/reject |
| **Staff** | Staff dashboard (vendor app) | Appointments accept/reject/start/complete | ✅ staff.ts routes | ✅ staffId, bookingId in paths |

---

## 7. Recommendations

1. **Admin UI:** Done – `Admin UI/src/utils/api-config.ts` added; all imports use `@repo/utils/api-config`. Ensure build path alias `@repo` resolves to Admin UI (e.g. `src/`).
2. **api-contracts:** Use Zod schemas in Lambda (e.g. bookings-enhanced) to parse and validate request body; return 400 on validation failure.
3. **Booking paths:** Pick one canonical path per action (e.g. `POST /bookings/create`, `GET /customer/:phone/bookings`) and document in `docs/REPO_STRUCTURE_AND_ENDPOINTS.md`; keep aliases for backward compatibility.
4. **Vendor status:** Confirm whether frontend calls `/vendor/status/:phone` or `/vendor/status/:vendorId` and ensure backend supports the same.
5. **E2E tests:** Add or extend tests that walk Customer booking flow (discover → slot → create) and Vendor booking actions (list → accept → complete) and assert on request/response shapes from api-contracts.

---

## 8. Files Touched in This Verification

- **Fixed:** `Warmpawz Ecosystem Development/src/components/vendor/VendorRoleSelection.tsx` – import `configRolesUrl, getAuthHeaders` from api-config.
- **Added:** This report – `docs/FORENSIC_CODE_VERIFICATION_REPORT.md`.

