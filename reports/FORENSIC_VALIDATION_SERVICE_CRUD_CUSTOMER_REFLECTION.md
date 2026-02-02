# Forensic Validation: Service CRUD → Customer Web Reflection

**Scope:** Next-gen CRUD on service management (vendor dashboard); price edit for all services including catalog; publish/unpublish and price reflecting immediately on customer web. Service discovery using service catalog.

**Date:** 2026-02-02

---

## 1. Model and Imports

### 1.1 Backend – Service discovery endpoint

| File | Import | Purpose |
|------|--------|---------|
| `backend/lambda/src/endpoints/service-discovery.ts` | `select, query, insert` from `../database/rds-connection` | All DB access for discovery and GET /customer/vendor/:vendorId/services |
| `backend/lambda/src/endpoints/service-discovery.ts` | `isValidUUID` from `../types/entities` | UUID validation for vendorId |

- **No separate “model” file** for `vendor_services` or `service_catalog`. Tables are accessed via `rds-connection` (query/select/insert). The **data model** is: `vendor_services` (source of truth for vendor offerings), `services` (legacy base services), `service_catalog` (platform catalog). All are used in SQL only; no ORM model import required.

### 1.2 Handler registration

| File | Registration |
|------|--------------|
| `backend/lambda/src/handler/index.ts` | `import { registerServiceDiscoveryEndpoints } from '../endpoints/service-discovery'` (line 53) |
| `backend/lambda/src/handler/index.ts` | `registerServiceDiscoveryEndpoints(app)` (line 398) – before parameterized `/customer/:customerId` so `/customer/vendor/:vendorId/services` is matched correctly |

---

## 2. Endpoint Flow (Service discovery using service catalog)

### 2.1 GET /customer/vendor/:vendorId/services

**Registered in:** `service-discovery.ts` (inside `registerServiceDiscoveryEndpoints`).

**Flow:**

1. **Params:** `vendorId` (path), `category`, `serviceStyle` (query).
2. **DB:**  
   - `vendor_services vs`  
   - `LEFT JOIN services s ON vs.service_id = s.id` (legacy rows where `service_id` points to `services.id`).  
   - `LEFT JOIN service_catalog sc ON vs.service_id = sc.id` (catalog-origin rows where `service_id` = `service_catalog.id`).
3. **Filters:**  
   - `vs.vendor_id = $1`  
   - `vs.is_enabled = true`  
   - `vs.publish_status = 'published'`  
   - Optional: `category` (on `vs.category`), `serviceStyle` (on `vs.service_style`).
4. **Response fields:**  
   - **Name:** `vs.service_name || s.name || sc.service_name || sc.display_name` (catalog-origin covered by `sc`).  
   - **Description:** `vs.custom_description || s.description || sc.description`.  
   - **Price:** `COALESCE(vs.custom_price, vs.price)` so vendor-set price is used.  
   - **Duration:** `COALESCE(vs.custom_duration, vs.duration_minutes, 30)`.

So: **only published vendor_services** are returned, with **vendor price** and correct **name/description** for both legacy and **service-catalog-origin** rows.

### 2.2 Service catalog → vendor_services

- **Add from catalog:** `POST /vendor/:vendorId/services/add-from-catalog` (vendor-services.ts) inserts into `vendor_services` with:
  - `service_id = service_catalog.id` (UUID),
  - `service_name`, `category`, `sub_category`, `price`, `duration_minutes` from catalog,
  - `publish_status = 'draft'`.
- **Customer GET** above joins `service_catalog` on `vs.service_id = sc.id`, so rows added from catalog get name/description from `service_catalog` when not overridden in `vendor_services`.

### 2.3 Vendor CRUD → same data

- **Update (price/publish/duration):** `PUT /vendor/:vendorId/services/:serviceId` (vendor-services.ts) updates `vendor_services` (price, custom_price, duration_minutes, custom_duration, publish_status, etc.) for both custom and catalog-origin rows (no catalog-only restriction).
- **Customer GET** reads from `vendor_services` with `publish_status = 'published'` and `COALESCE(custom_price, price)`, so:
  - Price/duration changes reflect immediately.
  - Publish/unpublish (draft vs published) reflect immediately (only published returned).

---

## 3. Customer Web Usage

| Component | Endpoint(s) used | Effect |
|-----------|-------------------|--------|
| UniversalServicesByStyle | `/customer/vendor/${vendorId}/services?serviceStyle=...&category=...` | Uses customer endpoint → only published, vendor price. |
| GroomingBookingRouter, TrainingBookingRouter, etc. | `/customer/vendor/${vendorId}/services?category=...` | Same. |
| UniversalBookingRouter, VetBookingRouter | Prefer `/customer/vendor/${vid}/services` then fallbacks | Same; ensures booking flows see only published services and current vendor price. |

---

## 4. Validation Checklist

| Check | Status |
|-------|--------|
| Model/import: service-discovery uses rds-connection (query/select/insert) and types/entities (isValidUUID) | OK |
| No separate vendor_services “model” file; DB layer is rds-connection | OK |
| GET /customer/vendor/:vendorId/services registered in registerServiceDiscoveryEndpoints | OK |
| Endpoint uses vendor_services + LEFT JOIN services + LEFT JOIN service_catalog | OK |
| Only published vendor_services returned (is_enabled = true, publish_status = 'published') | OK |
| Price = COALESCE(custom_price, price) from vendor_services | OK |
| Name/description resolve for catalog-origin rows via service_catalog JOIN | OK |
| Vendor PUT updates vendor_services for any service (catalog or custom) | OK |
| Customer booking flows prefer /customer/vendor/:vendorId/services so CRUD reflects immediately | OK |

---

## 5. Gaps Found and Fixed (Revalidation)

| Gap | Fix |
|-----|-----|
| saveConfiguration only sent updates for services where isEnabled \|\| customPrice \|\| customDuration; disabling a service was never persisted | Removed filter; now send PUT for all services in save list so is_enabled: false is persisted |
| saveConfiguration would call PUT for "catalog not added" services (no vendor_services row) and get 404, failing the whole batch | Filter to only services with a vendor row: services.filter(s => s.isVendorEnabled !== false) before building servicesToSave |
| Customer callers (HomeServiceProviderProfile, ServicePackageSelector, ResortBoardingBookingEnhanced, CafeReservationFlow, EmergencyBookingPage, ClinicProfileView, VetDoctorDetails, search/page) used /vendor/.../services and could see draft services or wrong price | Updated all to prefer /customer/vendor/:vendorId/services (with fallback to vendor endpoint) |

## 6. Param Indices (GET /customer/vendor/:vendorId/services)

- queryParams = [vendorId]; optional push(category) gives $2; optional push(serviceStyle) gives $3. Verified correct.

---

## 7. Summary

- **Model:** “Model” is the DB schema accessed via `rds-connection`; no extra model import is required. `service-discovery` and `vendor-services` both use `query`/`select`/`insert`/`update` from `rds-connection`.
- **Endpoints:** GET /customer/vendor/:vendorId/services is implemented and registered in service-discovery; it uses vendor_services as source of truth, filters by published, and joins service_catalog so **service discovery using the service catalog** (name/description and catalog-origin rows) works correctly.
- **Reflection:** Vendor CRUD (price, duration, publish/unpublish, enable/disable) updates `vendor_services`; the same table and columns are read by GET /customer/vendor/:vendorId/services, so changes reflect immediately on customer web.
- **Customer callers:** All customer-facing flows that load vendor services for booking/profile/search now prefer the customer endpoint so only published services with vendor price are shown.
