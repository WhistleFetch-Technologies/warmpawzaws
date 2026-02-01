# Lab Test / Diagnostics Flow – Vet Clinic Discovery & Published-Only Verification

**Date:** 2026-01-31  
**Scope:** Vet clinics with published lab tests must appear in Lab Test / Diagnostics booking flow; only published tests available for booking.

---

## 1. Requirements

| # | Requirement | Implementation |
|---|-------------|-----------------|
| 1 | Vet clinics with lab tests enabled (diagnostics capability) appear in Lab Test discovery | `GET /customer/diagnostics/vendors-with-tests` includes vendors where role is `vet_clinic`/`veterinary_clinic`/`vet` AND role has permission `diagnostics`, `diagnostic_results`, `test_catalog`, or **`diagnostic_lab`** |
| 2 | Only vendors with at least one **published** test (`is_available = true`) appear | Same endpoint: `EXISTS (SELECT 1 FROM diagnostic_tests dt WHERE dt.vendor_id = v.id AND dt.is_available = true)` |
| 3 | Diagnostics labs (diagnostics_center / diagnostic_center) remain visible | Same endpoint: first branch `LOWER(r.name) IN ('diagnostics_center', 'diagnostic_center')` |
| 4 | Only **published** tests are available for booking | `GET /vendor/:vendorId/diagnostics/tests?publishedOnly=true` used by customer booking flow; backend returns only `is_available = true` |

---

## 2. Backend: Role & Capability Matching

**Vet clinic role:** Matched when `roles.name` (case-insensitive) is one of: `vet_clinic`, `veterinary_clinic`, `vet`, or contains both "vet" and "clinic" (e.g. "Veterinary Clinic", "vet clinic"), or when spaces replaced by underscores equals `vet_clinic` / `veterinary_clinic`.

**Diagnostics capability:** Matched when `role_permissions.permission_name` (case-insensitive) is one of: `diagnostics`, `diagnostic_results`, `test_catalog`, `diagnostic_lab`, or when spaces replaced by underscores equals `diagnostic_lab` (e.g. "Diagnostic Lab"). All capability checks (GET/POST/PUT tests, GET bookings) also accept `diagnostic lab` (with space) for admin-stored display names.

- **Discovery:** `vendors-with-tests` – include vendor if role has any of: `diagnostics`, `diagnostic_results`, `test_catalog`, **`diagnostic_lab`**
- **GET tests:** `GET /vendor/:vendorId/diagnostics/tests` – allow if vendor has any of the above
- **POST/PUT tests:** same capability check so vet clinics can create/update tests
- **GET diagnostics/bookings:** same capability check

**File:** `backend/lambda/src/endpoints/specialized-services.ts`

- `vendors-with-tests`: `LOWER(rp.permission_name) IN ('diagnostics', 'diagnostic_results', 'test_catalog', 'diagnostic_lab')`
- GET/POST/PUT diagnostics/tests and GET diagnostics/bookings: `checkVendorCapability(..., 'diagnostic_lab')` added

---

## 3. Backend: Published-Only Tests for Booking

- **Discovery:** Each vendor’s tests returned by `vendors-with-tests` are already filtered with `WHERE is_available = true`.
- **Booking flow:** Customer app calls `GET /vendor/:vendorId/diagnostics/tests?publishedOnly=true`. Backend filters with `is_available = true` so only published tests are returned.

**File (customer):** `apps/customer-web/components/customer/specialized/DiagnosticsBookingFlow.tsx`  
- Calls `/vendor/${vendorId}/diagnostics/tests?publishedOnly=true` and uses `response.tests` as-is (no client-side filter needed).

---

## 4. Forensic Verification Checklist

### 4.1 Database / Role

- [ ] Vet clinic vendor exists in `vendors` with `status` in ('approved','active'), `is_active = true`.
- [ ] Vendor’s `role_id` points to a role where `roles.name` is one of: `vet_clinic`, `veterinary_clinic`, `vet`.
- [ ] That role has at least one of these in `role_permissions.permission_name`: `diagnostics`, `diagnostic_results`, `test_catalog`, **`diagnostic_lab`**.
- [ ] At least one row in `diagnostic_tests` for that vendor with `vendor_id = <vendor_id>` and **`is_available = true`**.

### 4.2 API: Discovery

```bash
# Replace API_BASE with your API Gateway URL (e.g. https://xxx.execute-api.ap-south-1.amazonaws.com)
curl -s "${API_BASE}/customer/diagnostics/vendors-with-tests"
```

- [ ] Response has `success: true` and `vendors` array.
- [ ] `vendors` includes the vet clinic (match by `id` or `businessName`).
- [ ] That vendor’s `tests` array contains only tests you expect (all with `is_available = true` in DB).

### 4.3 API: Tests for Booking (published only)

```bash
# Replace API_BASE and VENDOR_ID (vet clinic vendor UUID)
curl -s "${API_BASE}/vendor/${VENDOR_ID}/diagnostics/tests?publishedOnly=true"
```

- [ ] Response has `success: true` and `tests` array.
- [ ] Every test in `tests` has `is_available === true` (only published tests).

### 4.4 Customer UI

- [ ] Lab Test / Diagnostics landing shows both diagnostics labs and the vet clinic (with at least one published test).
- [ ] Clicking the vet clinic and “Book” opens Diagnostics Booking Flow.
- [ ] Only published tests are listed (no draft/unpublished).
- [ ] Booking steps (select tests, date/time, home/center, payment) complete successfully.

---

## 5. Common Failures

| Symptom | Check |
|--------|--------|
| Vet clinic not in discovery | Role name in `roles.name` (vet_clinic / veterinary_clinic / vet); `role_permissions` has one of diagnostics, diagnostic_results, test_catalog, **diagnostic_lab**; at least one `diagnostic_tests` row with `is_available = true`. |
| 403 on GET tests for vet clinic | Backend must allow `diagnostic_lab` in capability check (implemented). |
| Unpublished tests visible in booking | Customer must call with `?publishedOnly=true`; backend must filter by `is_available = true` (implemented). |
| Diagnostics labs disappeared | Discovery uses OR: (diagnostics_center/diagnostic_center) OR (vet_clinic + capability). Both branches are in the same query. |

---

## 6. Files Touched

| File | Change |
|------|--------|
| `backend/lambda/src/endpoints/specialized-services.ts` | vendors-with-tests: add `diagnostic_lab` to role_permissions IN list. GET tests: add `diagnostic_lab` to capability check; add `publishedOnly=true` filter. POST/PUT tests and GET diagnostics/bookings: add `diagnostic_lab` to capability check. |
| `apps/customer-web/components/customer/specialized/DiagnosticsBookingFlow.tsx` | Call `/vendor/:id/diagnostics/tests?publishedOnly=true`; use `response.tests` directly. |
