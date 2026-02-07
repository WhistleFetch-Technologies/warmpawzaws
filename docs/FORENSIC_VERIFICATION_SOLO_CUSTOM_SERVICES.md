# Forensic Verification: Solo Groomer/Vet Custom Services & Lifecycle

**Date:** 2026-01-29  
**Scope:** Custom services for solo groomer/vet, package exclusion, service name uniqueness, update price / unpublish / publish lifecycle.

---

## 1. Custom Services for Solo Groomer and Solo Vet

### Intent
- Solo groomer and solo vet **must** see and use "Custom Services" (create custom services).
- Solo groomer and solo vet **must not** see "Package Management" (no custom packages).

### Implementation Trace

| Location | Logic | Verified |
|----------|--------|----------|
| `VendorServiceManagementComplete.tsx` | `isSoloGroomer = isSoloProvider && hasVendorRole(vendorData, ['pet_groomer','groomer','groomer_solo'])` | ✅ |
| `VendorServiceManagementComplete.tsx` | `isSoloVet = isSoloProvider && hasVendorRole(vendorData, ['veterinarian','vet','vet_solo'])` | ✅ |
| `VendorServiceManagementComplete.tsx` | `canCreateCustomServices = capabilities.custom_services \|\| ... \|\| isSoloGroomer \|\| isSoloVet` | ✅ Solo gets custom services even if role lacks capability |
| `VendorServiceManagementComplete.tsx` | `canCreatePackages = (!isSoloProvider \|\| (isTrainerWalkerSitter && !isSoloGroomer && !isSoloVet))` | ✅ Solo groomer/vet excluded from packages |
| Package section JSX | Renders only when `... && canCreatePackages && !isSoloGroomer && !isSoloVet` | ✅ Double guard so package block never shows for solo groomer/vet |

### Role Matching (Critical)

- **Issue:** Display names like "Groomer (Solo)" or "Veterinarian (Solo)" would not match `groomer_solo` / `vet_solo` with a simple `roleName?.includes(normalizedRole)` (space vs underscore).
- **Fix applied:** `vendor-utils.ts` `hasVendorRole()` now also uses `normalizeRoleName(roleName)` and compares:
  - `vendorRoleNorm === normalizedRole` (e.g. "Groomer (Solo)" → `groomer_solo`)
  - `normalizedRole.includes(vendorRoleNorm)` for partial matches
- **Result:** Solo groomer/vet are correctly identified whether the app stores role as `groomer_solo` or display name "Groomer (Solo)".

### Vital & Effective
- **Vital:** Without this, solo groomer/vet would not see Custom Services when capability is missing or role is stored as display name; they would incorrectly see Package Management.
- **Effective:** Custom Services card is shown; Package Management is hidden for these roles.

---

## 2. Service Name Uniqueness

### Intent
- A vendor cannot create two custom services with the same name (case-insensitive, trim-aware).

### Backend (`vendor-services.ts` POST `/vendor/:vendorId/services/custom`)

| Check | Implementation | Verified |
|-------|----------------|----------|
| Before insert | `SELECT 1 FROM vendor_services WHERE vendor_id = $1 AND is_custom_service = true AND LOWER(TRIM(service_name)) = LOWER($2)` | ✅ |
| Parameters | `[vendorId, nameTrimmed]` (parameterized) | ✅ No SQL injection |
| Response | 400 + message "A service with this name already exists. Please use a different name." | ✅ |
| Table | `vendor_services.service_name`, `is_custom_service` exist (migrations 007, 058) | ✅ |

### Frontend (`VendorCustomServiceCreationEnhanced.tsx`)

| Check | Implementation | Verified |
|-------|----------------|----------|
| In `validateForm()` | `customServices.some(s => nameNorm(s.serviceName \|\| s.name) === nameNorm(serviceName))` | ✅ |
| Normalize | `nameNorm = (s) => (s \|\| '').trim().toLowerCase()` | ✅ Case-insensitive, trim |
| Scope | Only create flow; no edit-name flow in same dialog, so no need to exclude current service by id | ✅ |

### Vital & Effective
- **Vital:** Prevents duplicate names per vendor, which would confuse customers and reporting.
- **Effective:** Backend is authoritative; frontend gives immediate feedback and reduces无效 API calls.

---

## 3. Lifecycle: Update Price, Unpublish, Publish

### Intent
- Vendor can **update price** for a custom service.
- Vendor can **unpublish** (move to draft, hide from customers).
- **Publish** = submit for approval (existing flow).

### Backend PUT `/vendor/:vendorId/services/:serviceId`

| Field | Accepted | Mapped to DB | Verified |
|-------|----------|--------------|----------|
| `price` / `customPrice` | ✅ | `price`, `custom_price` | ✅ |
| `publishStatus` / `publish_status` | ✅ | `publish_status` | ✅ |
| `isEnabled` / `is_enabled` | ✅ | `is_enabled` | ✅ |

- Update uses `vendor_services.id` when `serviceId` is UUID (custom services use UUID).  
- Response: `{ success: true, service, message }`.  
- Frontend uses `data?.success !== false` and then refreshes list; correct.

### Frontend Handlers

| Action | Handler | API | Verified |
|--------|---------|-----|----------|
| Update price | `handleUpdatePrice(service)` | `PUT .../services/${service.id}` with `{ price, customPrice }` | ✅ |
| Unpublish | `handleUnpublish(serviceId)` | `PUT .../services/${serviceId}` with `{ publishStatus: 'draft', isEnabled: false }` | ✅ |
| Publish | `handlePublishService(serviceId)` | Existing `POST .../services/custom/${serviceId}/publish` | ✅ |

### UI Placement

- **Update Price:** Shown for all non-package custom services (same card as other actions).
- **Unpublish:** Shown when `publishStatus === 'published' || publishStatus === 'pending_approval'`.
- **Submit for Approval:** Shown when `publishStatus === 'draft'`.

### Vital & Effective
- **Vital:** Price changes and unpublish are core operations for vendor control and correctness.
- **Effective:** One PUT endpoint handles both; frontend passes correct payload and refreshes list after success.

---

## 4. Edge Cases & Robustness

| Scenario | Handling |
|----------|----------|
| Role from API as UUID | Capabilities loaded by roleId; solo groomer/vet still get custom services via `isSoloGroomer \|\| isSoloVet`. |
| Role as display name "Groomer (Solo)" | `hasVendorRole` now matches via `normalizeRoleName(roleName) === 'groomer_solo'`. |
| API fails (role config) | `FALLBACK_ROLE_STYLES` includes `groomer_solo` and `vet_solo` so allowed styles still correct. |
| Duplicate name on create | Backend rejects; frontend validates before submit. |
| Update price with invalid number | Frontend parses and validates; shows toast on NaN or negative. |
| Unpublish without confirmation | `confirm()` used before unpublish. |

---

## 5. Summary

| Change | Vital | Effective | Note |
|--------|--------|-----------|------|
| Custom services for solo groomer/vet | Yes | Yes | Capability + role-based fallback; role matching hardened. |
| No packages for solo groomer/vet | Yes | Yes | `canCreatePackages` and JSX guard. |
| Service name uniqueness (backend + frontend) | Yes | Yes | Parameterized query; client-side validation. |
| Update price / Unpublish / Publish | Yes | Yes | PUT supports fields; handlers and UI wired. |
| `hasVendorRole` normalization | Yes | Yes | Display names like "Groomer (Solo)" now match. |

**Conclusion:** The implementation is **vital** (correct behavior for solo groomer/vet, no duplicate names, full lifecycle) and **effective** (guards in the right places, backend as source of truth, one hardening fix applied in `hasVendorRole`).
