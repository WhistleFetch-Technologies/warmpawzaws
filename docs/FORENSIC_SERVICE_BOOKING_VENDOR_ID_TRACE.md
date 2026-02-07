# Forensic Trace: Service Booking Flow — Vendor ID Usage

**Date:** 2026-02-06  
**Scope:** Validate correct vendor ID parameter through discovery → slots → booking. Ensure canonical `vendors.id` is used for storage and `vendor_identity.id` is available for identity-scoped flows.

---

## 1. ID Semantics

| ID | Source | Use |
|----|--------|-----|
| **vendorId (canonical)** | `vendors.id` | FK in `bookings.vendor_id`, `vendor_services.vendor_id`, collision checks, subscriptions. Must be stored in DB. |
| **vendorIdentityId** | `vendor_identity.id` | Identity-scoped flows (solo provider, at_home). Returned in API so clients have both. |

**Rule:** Client may send either `vendors.id` or `vendor_identity.id` (e.g. from discovery). Backend must resolve to canonical `vendors.id` for all DB writes and return both in responses where needed.

---

## 2. Flow Trace: Vendor ID at Each Step

### 2.1 Discovery (GET /customer/discover-services)

| Location | Code | Vendor ID used |
|----------|------|----------------|
| **Query** | service-discovery.ts | Vendor rows from DB have `vendor.id` = `vendors.id`. |
| **Enrich** | Same file | `vendorId: vendor.id`, `vendorIdentityId: await getVendorIdentityId(vendor.id)`. |
| **Response** | Each vendor in list | `id`, `vendorId` (canonical), `vendorIdentityId` (when present). |

**Validation:** Discovery returns canonical `vendorId` and `vendorIdentityId`. Client can use either for next step; slots and profile accept both.

---

### 2.2 Vendor Profile / Services (GET /customer/vendor/:vendorId, GET /customer/vendor/:vendorId/services)

| Location | Code | Vendor ID used |
|----------|------|----------------|
| **Path param** | `:vendorId` | May be `vendors.id` or `vendor_identity.id`. |
| **Resolution** | `resolveVendorById(vendorId)` | Resolves to vendor row; `vendor.id` = canonical. |
| **Queries** | All use `resolvedVendorId` (vendor.id) | Profile, services, etc. |

**Validation:** Profile and services resolve path param to canonical id; no storage of path param.

---

### 2.3 Available Slots (GET /customer/vendor/:vendorId/available-slots)

| Location | Code | Vendor ID used |
|----------|------|----------------|
| **Path param** | `:vendorId` | May be `vendors.id` or `vendor_identity.id`. |
| **Resolution** | `resolveVendorById(vendorId)` → `resolvedVendorId` | Canonical. |
| **Lookup** | `getVendorIdsForAvailabilityLookup(resolvedVendorId)` | Returns `[vendors.id, ...vendor_identity.id(s)]` for `vendor_id::text = ANY($1::text[])`. |
| **Response IDs** | Derived from same call | `vendorId = availabilityIds[0]` (canonical), `vendorIdentityId = availabilityIds[1] ?? undefined`. |

**Validation:** Slots response always returns canonical `vendorId` and `vendorIdentityId`. No extra DB call; both come from `getVendorIdsForAvailabilityLookup`. Client should use response `vendorId` for booking create when possible.

---

### 2.4 Create Booking (POST /bookings/create — bookings-enhanced)

| Location | Code | Vendor ID used |
|----------|------|----------------|
| **Body** | `vendorId` from request | Client may send `vendors.id` or `vendor_identity.id`. |
| **Resolution** | `resolveVendorById(vendorId)` → `resolvedVendorId` | Done at start of handler. 404 if not found. |
| **Service lookup** | All `vendor_services` / `diagnostic_tests` queries | Use `resolvedVendorId`. |
| **Role / vendor_roles** | `select('vendors', { id: resolvedVendorId })`, `vendor_roles WHERE vendor_id = $1` | Use `resolvedVendorId`. |
| **Lock / collision** | `WHERE vendor_id = $1` | `resolvedVendorId`. |
| **Insert** | `bookings.vendor_id`, `services.vendor_id` (custom service), subscription match | `resolvedVendorId`. |
| **Audit / SNS** | `vendorId: resolvedVendorId` in audit; `booking.vendor_id` in event | Canonical. |

**Validation:** Booking create resolves request `vendorId` once and uses `resolvedVendorId` for all DB reads/writes. `bookings.vendor_id` is always canonical `vendors.id`.

---

## 3. Helper Functions (vendor-profile.ts)

| Function | Returns | Use |
|----------|--------|-----|
| **resolveVendorById(id)** | Vendor row or null | Normalize path/body id to vendor; id may be `vendors.id` or `vendor_identity.id`. |
| **getVendorIdsForAvailabilityLookup(id)** | `[vendors.id, ...vendor_identity.id(s)]` | Slots lookup and response: `ids[0]` = vendorId, `ids[1]` = vendorIdentityId. |
| **getVendorIdentityId(id)** | `vendor_identity.id` or null | Discovery enrich only (slots use lookup array). |

---

## 4. Summary Checklist

- [x] **Discovery:** Returns `vendorId` (canonical) and `vendorIdentityId`.
- [x] **Slots:** Path param resolved; response `vendorId` and `vendorIdentityId` from `getVendorIdsForAvailabilityLookup` (no duplicate call).
- [x] **Booking create:** Resolves body `vendorId` via `resolveVendorById`; all DB operations and `bookings.vendor_id` use `resolvedVendorId`.
- [x] **bookings.vendor_id:** Always stores canonical `vendors.id`.
- [x] **Client:** Can send either id to profile/slots/booking; backend normalizes. Prefer using `vendorId` from slots/discovery response for create.

---

## 5. Files Touched (Validation)

| File | Change |
|------|--------|
| **service-discovery.ts** | Slots: derive `canonicalVendorId` and `vendorIdentityIdFromLookup` from `availabilityIds`; all slots responses use them; discovery enrich adds `vendorIdentityId` via `getVendorIdentityId`. |
| **vendor-profile.ts** | JSDoc for `getVendorIdsForAvailabilityLookup`: order `ids[0]` = vendorId, `ids[1+]` = vendorIdentityId. |
| **bookings-enhanced.ts** | Import `resolveVendorById`; resolve body `vendorId` at start; use `resolvedVendorId` for all create-flow DB operations and storage. |
