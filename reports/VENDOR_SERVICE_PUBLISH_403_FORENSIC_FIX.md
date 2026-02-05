# Vendor Service Publish 403 – Forensic Analysis & Fix

**Date:** 2026-02-04  
**Issue:** PUT `/vendor/:vendorId/services/:serviceId` returns 404/403 when publishing or updating a service: *"Service not found for this vendor or you do not have permission to update it"* with `actualVendorId` ≠ `requestedVendorId`.

---

## 1. Observed Behaviour

- **Request:** `PUT https://.../vendor/e23c969e-.../services/f07e55a8-...` (or with `requestedVendorId: 0c0df45b-...`).
- **Response:** 404/403 with body:
  - `"error": "Service not found or you do not have permission to update it"`
  - `"actualVendorId": "476d61ee-aa26-4415-a1b2-e41f71bc7f29"` (owner of the service in DB)
  - `"requestedVendorId": "0c0df45b-6d33-406f-a38c-8d5fe279c4f5"` (vendorId from request path)
- **User impact:** Publish/update fails even though the service was just created or listed for that vendor.

---

## 2. Root Cause

**Inconsistent use of “request vendorId” vs “resolved vendor id” across endpoints.**

1. **POST `/vendor/:vendorId/services/add-from-catalog`** (and add-from-catalog flow):
   - Takes `vendorId` from the path.
   - If that id is **not** in the `vendors` table, it:
     - Looks up `vendor_identity` by that id.
     - If approved/activated, looks up **existing vendor by phone**.
     - Uses that vendor’s id as **`actualVendorId`** and creates the `vendor_services` row with **`vendor_id = actualVendorId`**.
   - So the service can be created under a **different** vendor id (e.g. `476d61ee`) than the one in the URL (e.g. `0c0df45b` – e.g. vendor_identity id).

2. **PUT `/vendor/:vendorId/services/:serviceId`** and **GET `/vendor/:vendorId/services/:serviceStyle`**:
   - Used **only** the path `vendorId` (no resolution).
   - Permission and ownership checks used `service.vendor_id !== vendorId`.
   - So when the frontend sent the same id as in the URL (e.g. `0c0df45b`) but the row had `vendor_id = 476d61ee`, the backend correctly rejected with “service belongs to 476d61ee, not 0c0df45b”.

3. **Frontend**:
   - Uses a single `vendorId` (e.g. from session/context) for both:
     - Listing services (GET)
     - Updating/publishing (PUT)
   - So it kept sending the “request” id (e.g. vendor_identity id) while the service was stored under the “resolved” vendor id.

**Conclusion:** The backend resolved vendor only in add-from-catalog and wrote `vendor_services.vendor_id = actualVendorId`, but GET and PUT did not resolve `vendorId`, so they compared and filtered by the wrong id and returned 403/404.

---

## 3. DB / Endpoint Behaviour (Verified)

- **`vendor_services`:** `id` (PK), `vendor_id`, `service_id`, etc. Service ownership is by `vendor_id`.
- **GET** `/vendor/:vendorId/services/:serviceStyle`:  
  `SELECT ... FROM vendor_services vs WHERE vs.vendor_id = $1 ...`  
  So it only returns rows for the given `vendorId`; no resolution was applied.
- **PUT** looks up the service by `vendor_services.id` (or catalog resolution), then enforces `service.vendor_id === vendorId`. Again, no resolution.

So once a service was created under `actualVendorId` (e.g. 476d61ee) via add-from-catalog, GET with `vendorId = 0c0df45b` would not return it (different vendor_id), but the UI could still have that service in state (e.g. from an optimistic update or a previous load with a different context). When the user then tried to publish/update, PUT with `vendorId = 0c0df45b` would see `vendor_id = 476d61ee` and return 403. Alternatively, if GET was ever called with the resolved id and the UI showed the service, but the app then sent the unresolved id in PUT, the same 403 would occur. In both cases the fix is to make GET and PUT use the **same** resolved vendor id as add-from-catalog.

---

## 4. Fix Applied

### 4.1 Backend – `vendor-services.ts`

- **`resolveVendorId(paramVendorId: string): Promise<string>`**
  - If `paramVendorId` exists in `vendors` → return it.
  - Else look up `vendor_identity` by `paramVendorId`; if approved/activated, look up `vendors` by `identity.phone`; if found, return that vendor’s id.
  - Otherwise return `paramVendorId` (no creation of vendors in this helper).

- **Use resolved id everywhere that currently uses path `vendorId`:**
  - **GET** `/vendor/:vendorId/services`  
    Resolve at start; use resolved `vendorId` for all queries and response.
  - **GET** `/vendor/:vendorId/services/:serviceStyle`  
    Resolve at start; use resolved `vendorId` for vendor lookup and `vendor_services` query.
  - **PUT** `/vendor/:vendorId/services/:serviceId`  
    Resolve at start; use resolved `vendorId` for capability check, service lookup, and `service.vendor_id === vendorId` check (and for the update).
  - **DELETE** `/vendor/:vendorId/services/:serviceId`  
    Resolve at start; use resolved `vendorId` for capability and `DELETE ... WHERE vendor_id = $2`.
  - **POST** `/vendor/:vendorId/services/custom/:serviceId/publish`  
    Resolve at start; use resolved `vendorId` for capability and for selecting/updating `vendor_services`.

So list, update, delete, and custom publish all see the same “actual” vendor as add-from-catalog when the path carries a vendor_identity id that maps to an existing vendor by phone.

### 4.2 Frontend – `VendorServiceConfigurationScreen.tsx`

- **Publish flow:** Use a single, explicit “vendor service id” (vendor_services.id) for PUT:
  - Added `vendorServiceId` on merged service objects (from catalog and custom).
  - Publish uses `service.vendorServiceId ?? service.id` in the PUT URL so we always target the correct `vendor_services` row.
- **Save flow:** Already used `service.vendorServiceId`; no change needed except that backend resolution now makes the same `vendorId` valid for those requests.

---

## 5. How to Verify

1. **Scenario A – Vendor identity id in path**
   - Use a vendor id that is in `vendor_identity` but not in `vendors`, with an existing vendor row with the same phone.
   - Add a service via add-from-catalog (so it’s created under the existing vendor).
   - Call GET `/vendor/<identity-id>/services/<style>` → should return that service (resolved id used).
   - Call PUT `/vendor/<identity-id>/services/<vendor_services.id>` with e.g. `publish_status: 'published'` → should return 200, no 403.

2. **Scenario B – Normal vendor id**
   - Use a vendor id that exists in `vendors`. List services, add from catalog, update/publish → behaviour unchanged; resolution returns the same id.

3. **Frontend**
   - Publish from the configuration screen after adding catalog or custom services → no 403; services show as published when list is refreshed.

---

## 6. Files Touched

| File | Change |
|------|--------|
| `backend/lambda/src/endpoints/vendor-services.ts` | Added `resolveVendorId`; used in GET (two routes), PUT, DELETE, POST custom publish. |
| `apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx` | Set `vendorServiceId` on merged services; publish uses `vendorServiceId ?? id` for PUT. |

---

## 7. Summary

- **Cause:** add-from-catalog wrote `vendor_services.vendor_id = actualVendorId` (resolved from vendor_identity/phone), while GET and PUT used the path `vendorId` without resolution, so ownership checks failed (403/404).
- **Fix:** Resolve path `vendorId` to the same logical vendor in GET (both routes), PUT, DELETE, and POST custom publish; frontend uses explicit `vendorServiceId` for publish PUT. No DB schema change; behaviour aligned with existing add-from-catalog resolution.
