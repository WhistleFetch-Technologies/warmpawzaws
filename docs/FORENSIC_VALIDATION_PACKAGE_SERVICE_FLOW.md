# Forensic Validation Report: Package vs Service Flow (Admin → Vendor → Customer)

**Date:** 2026-02-14  
**Scope:** End-to-end flow for “Mark as Package” in admin catalog → vendor sees it → customer sees “Package” label and correct price; UI/API contracts, CRUD, navigation.

---

## 1. Flow Summary

| Step | Actor | Action | Contract / Location |
|------|--------|--------|----------------------|
| 1 | Admin | Mark catalog item as Package | AddServiceModal checkbox → `metadata.isPackage` |
| 2 | Admin | Save (create/update) | POST `/admin/catalog/services` or PUT `/admin/service-catalog/:id` with `metadata` |
| 3 | Backend | Persist | `service_catalog.metadata` (JSONB); admin GET returns full row (incl. metadata) |
| 4 | Vendor | Load catalog by role | GET `/service-catalog/role/:roleId` → returns `isPackage` from `metadata.isPackage` |
| 5 | Vendor | Add service from catalog | POST `/vendor/:vendorId/services/add-from-catalog` → copies catalog `metadata` (isPackage, packageDetails) into `vendor_services.metadata` |
| 6 | Customer | Load vendor services | GET `/customer/vendor/:vendorId/services` → returns `services` (non-package) and `packages` (package), each item has `isPackage` |
| 7 | Customer | See list | Merge `services` + `packages`; show “Package” badge where `isPackage === true`; price from `price`/`custom_price` |

---

## 2. Backend Contracts Verified

### 2.1 Admin service catalog

- **GET /admin/service-catalog**  
  - Query: `SELECT * FROM service_catalog` → rows include `metadata`.  
  - Grouped response pushes full `service` (spread) into `safeService`, so `metadata` is present.  
  - **Contract:** Admin list and ServiceCatalogTab receive `metadata` and derive `isPackage` from `metadata?.isPackage`.

- **POST /admin/catalog/services**  
  - Body: accepts `metadata`; writes to `service_catalog.metadata`.  
  - **Contract:** Create supports “Mark as Package”.

- **PUT /admin/service-catalog/:serviceId**  
  - Body: accepts `metadata`; updates `service_catalog.metadata`.  
  - **Contract:** Update supports “Mark as Package”.

### 2.2 Catalog by role (vendor-facing)

- **GET /service-catalog/role/:roleId**  
  - Returns each service with `metadata` and **`isPackage: !!(service.metadata && (service.metadata as any).isPackage)`**.  
  - **Contract:** Vendor catalog API exposes package flag.

### 2.3 Vendor add-from-catalog

- **POST /vendor/:vendorId/services/add-from-catalog**  
  - Reads `catalogService.metadata`; builds `vendorMetadata` with `isPackage` and `packageDetails`; inserts `vendor_services` with `metadata: vendorMetadata` (or omitted if empty).  
  - **Contract:** Catalog “Mark as Package” is copied to vendor_services so customer-facing APIs see it.

### 2.4 Customer vendor services

- **GET /customer/vendor/:vendorId/services**  
  - Builds `formattedServices` with `isPackage` from `vendor_services.metadata`; returns `services` (non-package) and `packages` (package); each item has `isPackage`, `price`, `custom_price`.  
  - **Contract:** Customer gets both arrays and correct package flag and price.

### 2.5 Service discovery (by-style, etc.)

- **GET /customer/services/by-style** and discovery paths that join `vendor_services` use `metadata?.isPackage` or equivalent when building provider services.  
- **Vendor services list (GET /vendor/:vendorId/services):** Returns `isPackage: s.metadata?.isPackage` for vendor’s own list.  
- **Contract:** Discovery and vendor list align with package flag.

---

## 3. Frontend Contracts Verified

### 3.1 Admin

- **ServiceCatalogTab**  
  - Loads from GET /admin/service-catalog; maps `isPackage: !!(s.metadata?.isPackage ?? s.isPackage)`; filter “Package only” / “Service only”; table and view modal show “Package” vs “Service” badge.  
  - **Status:** Matches backend; CRUD uses AddServiceModal.

- **AddServiceModal**  
  - Form: “Mark as Package” checkbox → `formData.isPackage`; on submit sends `metadata: { ...existing, isPackage: formData.isPackage }` for both create and update.  
  - **Status:** Create/update and navigation (open/close modal) in place.

### 3.2 Vendor

- **VendorServiceCatalogView**  
  - Loads GET /service-catalog/role/:roleId; normalizes `isPackage: svc.isPackage || svc.is_package`.  
  - **Status:** Catalog list and “Add from catalog” use correct flag; add-from-catalog now propagates metadata.

### 3.3 Customer – service lists and badges

- **VetServicesByStyle**  
  - Provider services type includes `isPackage`; fallback mapping sets `isPackage` from API; two places show “Package” badge.  
  - **Status:** Contract and UI in place.

- **UniversalServicesByStyle**  
  - Merges `response.services` and `response.packages`; maps `isPackage` from each item; two places show “Package” badge (profile services list + main sorted list).  
  - **Status:** Contract and UI in place.

- **GroomingServicesByStyle**  
  - Provider services type includes `isPackage`; discover path and fallback path set `isPackage`; two places show “Package” badge.  
  - **Status:** Contract and UI in place.

- **ServicePackageSelector**  
  - Shows “Package” badge when `(service as any).isPackage`.  
  - **Status:** In place.

- **UniversalProviderProfile**  
  - “Selected Services” summary shows “Package” badge when `(service as any).isPackage`.  
  - **Status:** In place.

### 3.4 Navigation and actions

- **Back / navigation**  
  - All above components use `onBack` or `onNavigate` from parents (CustomerHomeWrapper, routers, etc.). No back buttons or navigation were removed.  
  - **Status:** In place.

- **onClick**  
  - Service cards and list rows use existing click handlers (select service, open profile, etc.). Package badge is display-only and does not change behavior.  
  - **Status:** In place.

---

## 4. Gaps Addressed in This Pass

| Gap | Fix |
|-----|-----|
| Customer vendor services API returns `services` and `packages` separately; some UIs only used `services` | UniversalServicesByStyle now merges `services` and `packages` and maps `isPackage` so packages appear in the same list with the badge. |
| Vendor add-from-catalog did not copy catalog metadata | add-from-catalog now copies `metadata` (including `isPackage` and `packageDetails`) from catalog to `vendor_services`. |
| GroomingServicesByStyle did not show Package badge | Added `isPackage` to type and both data paths; added “Package” badge in two places. |
| UniversalServicesByStyle did not show Package badge or use packages array | Merged packages into list; added `isPackage` to map; added “Package” badge in two places. |

---

## 5. End-to-End Trace (Single Path)

1. **Admin** opens Catalog → Service Catalog tab → Edit a service → checks “Mark as Package” → Save.  
   - **API:** PUT /admin/service-catalog/:id with `metadata: { isPackage: true }`.  
   - **DB:** `service_catalog.metadata` updated.

2. **Vendor** opens Service Management → loads catalog (GET /service-catalog/role/:roleId).  
   - **API response:** That service has `isPackage: true`.  
   - Vendor adds it (POST add-from-catalog with catalogServiceId).  
   - **API:** Backend copies catalog metadata into new `vendor_services` row → `vendor_services.metadata.isPackage = true`.

3. **Customer** discovers vendor or opens vendor profile → loads services (GET /customer/vendor/:vendorId/services).  
   - **API response:** Item in `packages` array (or merged list) with `isPackage: true` and vendor price.  
   - **UI:** UniversalServicesByStyle / VetServicesByStyle / GroomingServicesByStyle (or ServicePackageSelector) show “Package” badge and correct price.

**Conclusion:** Flow is wired end-to-end; backend and frontend contracts match; CRUD and navigation are in place.

---

## 6. Optional Follow-Ups

- **Package snapshot / “what’s included”:** Still to implement (see PACKAGE_AND_CHAT_FORENSIC_ANALYSIS.md).  
- **Vendor chat notification on new message:** Unread count is available from GET /chat/vendor/:vendorId/conversations; header badge can be wired to that or to a dedicated notification.  
- **Other customer service lists:** Any new list that displays vendor services should merge `services` + `packages` (if using GET /customer/vendor/:id/services) and show “Package” when `isPackage === true`.

---

## 7. Files Touched (This Validation Pass)

- **Backend:**  
  - `backend/lambda/src/endpoints/vendor-services.ts` (add-from-catalog: copy catalog metadata into vendor_services).
- **Customer web:**  
  - `apps/customer-web/components/customer/shared/UniversalServicesByStyle.tsx` (merge services+packages, isPackage, Package badge x2).  
  - `apps/customer-web/components/customer/grooming/GroomingServicesByStyle.tsx` (isPackage in type and both paths, Package badge x2).

Previously (earlier in conversation):  
- service-catalog.ts (GET by role: return isPackage), service-discovery.ts (isPackage from metadata, not is_custom_service), admin-advanced.ts (metadata in create/update), AddServiceModal (Mark as Package + metadata in submit), VetServicesByStyle (isPackage + badge), UniversalProviderProfile and ServicePackageSelector (Package badge).

---

**Validation result:** Flow is complete; contracts align; CRUD and navigation are in place. Remaining work is optional (package contents snapshot, vendor chat notification badge).
