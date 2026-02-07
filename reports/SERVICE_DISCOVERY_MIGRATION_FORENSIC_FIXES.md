# Forensic Analysis & Fixes: Service Discovery & Appointment Window Post-Migration

**Date**: 2026-01-31  
**Issue**: Vendors lost service discovery in service management; no services appearing; appointment window missing after migration to canonical roles  

---

## Root Causes Identified

### 1. **GetRoleByIdHandler – UUID-only lookup**
- **Problem**: `/config/roles/:roleId` only looked up by `id` (UUID). When frontend passed role name (e.g. `walker`, `vet_clinic`), it returned 404.
- **Impact**: `useRoleConfig` could not load role config when roleId was a name, so service styles and capabilities were wrong or missing.

### 2. **ROLE_SERVICE_STYLES – Missing canonical roles**
- **Problem**: `ROLE_SERVICE_STYLES` in `vendor-services.ts` lacked canonical roles added by migrations 521/522 (e.g. `nutritionist_center`, `adoption_center`, `photographer`, `breeder`, `resort`, `holiday`, `seller`).
- **Impact**: Vendors in these roles saw no or incorrect allowed service styles, so service management showed no services for their style.

### 3. **Vendor schedule – `service_styles` array not used**
- **Problem**: Slots in `vendor_availability_v2` can use `service_styles` (array). The schedule GET only filtered by `service_style` (single).
- **Impact**: Slots that only had `service_styles` (after migration 500) were ignored, so “no appointment window to receive” for some vendors.

### 4. **Local service catalog – Missing canonical role keys**
- **Problem**: `SERVICE_CATALOGS` and `roleVariations` in `service-catalogs.ts` did not include canonical role keys (`vet_solo`, `vet_clinic`, `groomer_solo`, `groomer_center`, `trainer_solo`, `trainer_center`, etc.).
- **Impact**: When catalog used role name for lookup, many migrated roles mapped to an empty catalog.

### 5. **Service catalog role mappings**
- **Problem**: `roleMappings` in `service-catalog.ts` did not cover all canonical roles (e.g. `vet_solo`, `boarding`, `sitter`).
- **Impact**: `/service-catalog/role/:roleId` could fail to match `service_catalog.applicable_roles` for some migrated vendors.

---

## Fixes Applied

### Fix 1: GetRoleByIdHandler – Support role name lookup

**File**: `backend/lambda/src/endpoints/roles.ts`

- Added fallback when UUID lookup fails:
  1. Lookup by `name` (normalized: lowercase, spaces → underscores)
  2. Lookup by case-insensitive `name` via raw SQL
- Use role UUID (`role.id`) for `role_permissions` so FK is always valid.

### Fix 2: ROLE_SERVICE_STYLES – Add canonical roles

**File**: `backend/lambda/src/endpoints/vendor-services.ts`

Added entries for:

- `ambulance`, `photographer`, `sunset`, `breeder`
- `relocation`, `pet_relocation`, `resort`, `holiday`
- `nutritionist_center`, `adoption_center`, `pet_shelter`
- `seller` (with `delivery`, `pickup`)

### Fix 3: Vendor schedule – Support `service_styles` array

**File**: `backend/lambda/src/endpoints/vendor-schedule.ts`

- Extended availability query to:
  - Use `COALESCE(service_style, service_type) = $3`
  - Or `$3 = ANY(COALESCE(service_styles, ARRAY[]::text[]))`
- Use `COALESCE(is_enabled, is_available, true)` so either column is respected.

### Fix 4: Local service catalog – Canonical role keys

**File**: `apps/vendor-web/lib/service-catalogs.ts`

- Added to `SERVICE_CATALOGS`:
  - `vet_solo`, `vet_clinic`, `veterinary_clinic`
  - `groomer_solo`, `groomer_center`
  - `dog_walker`
  - `trainer_solo`, `trainer_center`
  - `nutritionist_solo`, `nutritionist_center`
  - `diagnostics_provider`, `diagnostics_solo`
- Extended `roleVariations` to map canonical names (e.g. `vet_solo`, `vet_clinic`) to the correct catalog.

### Fix 5: Service catalog role mappings

**File**: `backend/lambda/src/endpoints/service-catalog.ts`

- Added role mappings: `vet_solo`, `boarding`, `sitter`.

---

## Verification Steps

1. **Role config**  
   - Call `/config/roles/walker` and `/config/roles/{uuid}`  
   - Both should return role config.

2. **Service management**  
   - Log in as a vendor in a migrated role (e.g. walker, groomer_solo)  
   - Confirm services and allowed styles appear correctly.

3. **Appointment window**  
   - Check a vendor who has `vendor_availability_v2` slots with `service_styles`  
   - Confirm slots show in GET `/vendor/:vendorId/schedule` and availability APIs.

4. **Catalog API**  
   - Call `/service-catalog/role/walker` and `/service-catalog/role/vet_solo`  
   - Confirm services are returned.

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/lambda/src/endpoints/roles.ts` | GetRoleByIdHandler: name/UUID fallback lookup |
| `backend/lambda/src/endpoints/vendor-services.ts` | ROLE_SERVICE_STYLES: added canonical roles |
| `backend/lambda/src/endpoints/vendor-schedule.ts` | Availability query: support `service_styles` array |
| `backend/lambda/src/endpoints/service-catalog.ts` | roleMappings: added vet_solo, boarding, sitter |
| `apps/vendor-web/lib/service-catalogs.ts` | SERVICE_CATALOGS and roleVariations for canonical roles |

---

## Deployment

1. Deploy backend Lambda with these changes.
2. Rebuild and deploy vendor-web (for `service-catalogs.ts`).
3. Re-run migrations 521 and 522 if they have not been applied.
