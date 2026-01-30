# Service Catalog Discovery – Forensic Review

**Date:** 2026-01-28  
**Scope:** End-to-end verification of service catalog discovery by role on vendor dashboard (enable/publish, listing correctness).

---

## 1. Code Path: DB → API → Vendor UI

### 1.1 Data model

- **`service_catalog`** (DB): `applicable_roles TEXT[]` – list of role names (e.g. `vet_solo`, `vet_clinic`, `groomer_center`) that can see the service.
- **Migration 255** backfills `applicable_roles` from category/service name and adds multiple roles per type (e.g. vet services get `veterinarian`, `vet_clinic`, `vet_solo`).

### 1.2 Backend: service catalog by role

- **`GET /service-catalog/role/:roleId`** (`backend/lambda/src/endpoints/service-catalog.ts`):
  - Resolves `roleId` (UUID or name) via `roles` table.
  - Builds **acceptableRoles** from `role.name`, `role.id`, `role.display_name`, and **roleMappings[role.name]** (and normalized name fallback).
  - Query: `service_catalog` WHERE `status = 'active'` AND `publish_status = 'published'` AND **`applicable_roles && $1::text[]`** (overlap).
  - Solo: excludes `at_center`; supports **comma-separated `serviceStyle`** (e.g. `at_home,tele`) via `service_style = ANY($n::text[])`.

### 1.3 Backend: vendor services

- **`GET /vendor/:vendorId/services`** (`backend/lambda/src/endpoints/vendor-services.ts`):
  - Returns **role** `{ id, name, display_name, config }` from vendor’s `role_id`.
  - Optional catalog for a given style uses the same **roleMappings** and **acceptableRoles** to query `service_catalog` for that role.

### 1.4 Vendor UI: Service Management entry

- **VendorDashboard** / **SoloProviderDashboard** / **VendorLandingPage**:
  - “Service Management” shown when: `hasCatalog || hasBooking || hasCapability(capabilities, 'services') || hasVendorRole(vendorData, ['pharmacy', 'pet_pharmacy', 'pet_cafe', ...])`.
- **Manage page** (`apps/vendor-web/app/services/manage/page.tsx`):
  - Calls **`GET /vendor/:vendorId/services?isSoloProvider=true`** first → gets **role.id**.
  - Then **`GET /service-catalog/role/${roleId}?serviceStyle=at_home,tele`** (solo: at_home + tele).
  - Merges: **vendor’s added services first**, then **catalog services not yet added** (dedup by catalog id).

### 1.5 Enable / Publish flow

- **Enable:** Toggle on manage page → PATCH/POST vendor service (enable flag).
- **Publish:** Publish action → backend updates `publish_status` to `published`.
- Listing shows only **vendor’s added services** (with enable/publish state) plus **catalog items not yet added**; catalog is **filtered by vendor’s role** on the backend.

---

## 2. Bug fixed during review

- **Comma-separated `serviceStyle`:** Manage page sends `serviceStyle=at_home,tele`. Backend previously used `service_style = $2` with the literal `"at_home,tele"`, so **no rows matched**. Fixed in **service-catalog.ts** by splitting on comma and using `service_style = ANY($n::text[])` for multiple styles.

---

## 3. Verification

- **Script:** `scripts/verify-service-catalog-discovery-e2e.js`
- **Checks:** Health; catalog by role (vet_solo, vet_clinic, groomer_center, groomer_solo, trainer_center, trainer_solo, walker, pharmacy) with `serviceStyle=at_home`; catalog for `vet_solo` with `serviceStyle=at_home,tele`; GET vendor services structure.
- **Run:** `API_ENDPOINT=<base> node scripts/verify-service-catalog-discovery-e2e.js`

---

## 4. Role assignment correctness

- Catalog is filtered by **applicable_roles && acceptableRoles** (backend).
- **acceptableRoles** = role.name + roleMappings[role.name] + normalized name (e.g. vet_solo → vet, veterinarian, vet_clinic, vet_solo, solo_vet).
- So: **only services whose `applicable_roles` overlap the vendor’s role (and mappings) are returned**; enable/publish applies only to those services and vendor’s own added list.

---

## 5. Deploy

- **Backend:** Deploy Lambda (e.g. `./scripts/deploy-lambda-direct.sh`) so the comma-separated `serviceStyle` fix and role logic are live.
- **Vendor-web:** No change required for discovery; optional deploy for other fixes.
