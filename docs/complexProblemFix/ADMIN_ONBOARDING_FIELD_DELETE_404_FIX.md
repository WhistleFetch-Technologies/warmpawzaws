# Admin Onboarding Field Delete 404 – End-to-End Fix

**Date:** 2026-02  
**Environments:** Dev (UAT) and Production. Lambda and frontend changes apply to both; no vendor fetch logic was modified.

---

## 1. Problem description

- **Where:** Admin Web → Catalog & Services → Onboarding. User selects a role (e.g. Vet Clinic), then deletes a field (e.g. `stateCouncilDoc`).
- **Observed:** Request `DELETE /admin/onboarding-fields/vet_clinic/stateCouncilDoc` returns **404**. UI shows: *"Failed to delete field: Endpoint not found: /admin/onboarding-fields/vet_clinic/stateCouncilDoc. Please check if the API route is configured."*
- **Root causes (either or both):**
  1. **API Gateway:** DELETE method not configured for the resource (e.g. only GET/POST/PUT), so the request never reaches Lambda or Gateway returns 404.
  2. **Backend:** Role lookup for `vet_clinic` fails (e.g. DB has `veterinarian` or `veterinary_clinic`), so Lambda returns 404 "Role not found" or "Field not found".

**Requirement:** Fix must work in both UAT and Production without changing vendor fetch behavior. Lambda logic must be identical in both environments.

---

## 2. Schema changes

**None.** The fix uses existing tables and columns:

- **`onboarding_forms`**
  - `role_id` (VARCHAR) – already used.
  - `fields` (JSONB) – already used.
  - `deleted_kyc_field_ids` (JSONB) – already added in a prior change; used to hide KYC-only fields “deleted” in the UI. No new migration.

No new tables, no new columns, no data migration.

---

## 3. Lambda updates (backend)

**File:** `backend/lambda/src/endpoints/onboarding-form-management.ts`

### 3.1 Shared delete logic

- **Added:** Async helper `removeOnboardingField(roleId: string, fieldId: string)` inside `registerOnboardingFormManagementEndpoints`.
- **Behavior:**
  - Resolves role via existing `getRoleByName(roleId)` (see 3.2).
  - Ensures `onboarding_forms.deleted_kyc_field_ids` column exists (ALTER TABLE IF NOT EXISTS).
  - Loads `onboarding_forms` row for `actualRoleName` and parses `fields` and `deleted_kyc_field_ids`.
  - If `fieldId` exists in `fields`: removes it, reorders `displayOrder`, updates `onboarding_forms`, increments form version, returns `{ success: true, message: 'Field deleted successfully' }`.
  - If `fieldId` is not in DB: checks if it is a KYC-only field via `getKYCFieldsForRole(actualRoleName, ...)`. If yes, appends `fieldId` to `deleted_kyc_field_ids`, updates or inserts row, increments version, returns success. If not a KYC field, returns `{ error: 'Field not found', status: 404 }`.
  - If role not found: returns `{ error: 'Role not found', status: 404 }`.
- **Return type:** `Promise<{ success: true; message: string } | { error: string; status: 404 | 500 }>`.

### 3.2 Role resolution (getRoleByName) – vet_clinic hardening

- **Location:** Same file, function `getRoleByName(roleId)`.
- **Added:** After existing alias and partial-match logic, a dedicated branch when `roleId` is `vet_clinic` or `veterinary_clinic`:
  - Tries variants: `veterinary_clinic`, `veterinarian`, `vet clinic`, `vet_clinic` (with and without space in name).
  - Uses query: `(LOWER(name) = LOWER($1) OR LOWER(REPLACE(name, ' ', '_')) = LOWER($2)) AND is_active = true`.
- **Purpose:** Ensures role is found even when DB has different naming (e.g. space vs underscore, or only `veterinarian`).

### 3.3 DELETE handler (unchanged contract, uses shared logic)

- **Route:** `DELETE /admin/onboarding-fields/:roleId/:fieldId`
- **Change:** Handler now calls `removeOnboardingField(roleId, fieldId)` and maps result to HTTP response:
  - `{ success, message }` → 200 JSON.
  - `{ error, status: 404 }` → 404 JSON.
  - Thrown errors → 500 JSON with error message.

### 3.4 New POST fallback (for when DELETE is not available)

- **Route:** `POST /admin/onboarding-fields/:roleId/remove-field`
- **Body (JSON):** `{ "fieldId": "<string>" }` (or `field_id`).
- **Behavior:** Reads `roleId` from path, `fieldId` from body; validates `fieldId` present; calls `removeOnboardingField(roleId, fieldId)`; returns same response shape as DELETE (200 success, 400 if `fieldId` missing, 404/500 on errors).
- **Purpose:** Works when API Gateway does not expose DELETE for this resource (e.g. production). Same Lambda logic for UAT and Prod.

**Vendor fetch:** Not touched. No changes in vendor discovery, availability, or UAT-vs-Prod vendor fetch paths.

---

## 4. Backend code changes (summary)

| File | Change |
|------|--------|
| `backend/lambda/src/endpoints/onboarding-form-management.ts` | Added `removeOnboardingField`; hardened `getRoleByName` for `vet_clinic`/`veterinary_clinic`; DELETE handler delegates to `removeOnboardingField`; added POST `/admin/onboarding-fields/:roleId/remove-field`. |

No other backend files modified. No env-specific branching; one code path for both environments.

---

## 5. Frontend changes

**File:** `apps/admin-web/components/admin/onboarding/OnboardingDesigner.tsx`

**Function:** `deleteField(sectionId: string, fieldId: string)`

- **Before:** Single call `apiClient.delete(\`/admin/onboarding-fields/${selectedRole}/${fieldId}\`)`. On any error, showed generic failure message.
- **After:**
  1. Call `apiClient.delete(\`/admin/onboarding-fields/${selectedRole}/${fieldId}\`)`.
  2. On failure: if the error indicates 404 or "Endpoint not found" (e.g. `response.status === 404` or `message.includes('404')` or `message.includes('Endpoint not found')`), retry with `apiClient.post(\`/admin/onboarding-fields/${selectedRole}/remove-field\`, { fieldId })`.
  3. If either request returns `response.success`, reload form via `loadFormForRole(selectedRole)`.
  4. Otherwise show failure message.

**Purpose:** Delete works whether the API exposes DELETE or only POST remove-field (e.g. Prod with no DELETE on that resource).

No changes to vendor fetch, API base URL selection, or UAT vs Prod frontend branching.

---

## 6. Implementation flow and final solution

### 6.1 Request flow (delete field)

1. User: Admin → Catalog & Services → Onboarding → select role (e.g. Vet Clinic) → delete a field (e.g. State Council Doc).
2. Frontend: Calls DELETE `/admin/onboarding-fields/vet_clinic/stateCouncilDoc`.
3. If DELETE returns 404 or "Endpoint not found": Frontend calls POST `/admin/onboarding-fields/vet_clinic/remove-field` with body `{ "fieldId": "stateCouncilDoc" }`.
4. Lambda (DELETE or POST):
   - Resolves role: `getRoleByName("vet_clinic")` → uses aliases and vet-clinic variants → gets `actualRoleName` (e.g. `veterinarian` or `veterinary_clinic`).
   - Runs `removeOnboardingField("vet_clinic", "stateCouncilDoc")`: ensures `deleted_kyc_field_ids` column; loads form; if field in DB, remove from `fields` and save; else if KYC field, append to `deleted_kyc_field_ids` and save; else 404.
5. Response 200 with `{ success: true, message: 'Field deleted successfully' }` → frontend reloads form.

### 6.2 Environments

- **UAT/Dev:** Same Lambda code; same frontend. If DELETE is configured, it is used; otherwise POST remove-field is used on 404.
- **Production:** Same Lambda code; same frontend. If DELETE is not configured on API Gateway, POST remove-field is used after first request returns 404.
- **Vendor fetch:** Unchanged in both environments.

### 6.3 Deployment checklist

- Deploy **Lambda** (same artifact) to both Dev and Prod so that:
  - `DELETE /admin/onboarding-fields/:roleId/:fieldId` and  
  - `POST /admin/onboarding-fields/:roleId/remove-field`  
  are available.
- Deploy **Admin Web** to both Dev and Prod so that the delete flow uses DELETE with POST fallback on 404.
- Optional: In API Gateway (Prod), add DELETE method for `/admin/onboarding-fields/{proxy+}` (or equivalent) so DELETE works without fallback. If not added, the POST fallback ensures the feature still works.

### 6.4 Verification

- **Dev/UAT:** In Admin → Catalog → Onboarding, select e.g. Vet Clinic, delete a KYC field (e.g. State Council Doc). Should succeed (via DELETE or POST fallback).
- **Prod:** Same steps; should succeed. If DELETE is 404, second request (POST remove-field) should succeed and form should reload.

---

## 7. References (for agents)

- Role resolution and aliases: `backend/lambda/src/endpoints/onboarding-form-management.ts` (`getRoleByName`, `ROLE_NAME_ALIASES`).
- KYC fields and role config: `backend/lambda/src/lib/kyc-form-fields.ts` (`getKYCFieldsForRole`, `ROLE_KYC_CONFIGS`, `HEALTHCARE_VET_FIELDS`).
- Admin onboarding UI: `apps/admin-web/components/admin/onboarding/OnboardingDesigner.tsx` (`deleteField`, `loadFormForRole`).
- No vendor fetch code was modified; do not change vendor fetch behavior when maintaining or extending this fix.
