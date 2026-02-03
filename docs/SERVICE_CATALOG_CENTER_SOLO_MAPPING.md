# Service Catalog: Center vs Solo by service_style

**Date:** 2026-02-03

## Summary

Services in `service_catalog` are mapped by **service_style** so that:

- **at_center** services → only **business/center** roles can discover them (`vet_clinic`, `groomer_center`, `trainer_center`, `behaviorist_center`).
- **at_home** / **tele** services → only **solo** roles can discover them (`vet_solo`, `groomer_solo`, `trainer_solo`, `behaviorist_solo`).
- **service_style = 'all'** or NULL → both solo and center roles for that domain (backward compatible).

Discovery is **dynamic from service_catalog only**: backend filters by `applicable_roles && vendor_role_aliases` and `service_style`; no hardcoded frontend lists.

## Domains and roles

| Domain      | Center (business)   | Solo                 | Same specializations |
|------------|----------------------|----------------------|-----------------------|
| Vet        | vet_clinic           | vet_solo             | Yes                   |
| Groomer    | groomer_center       | groomer_solo         | Yes                   |
| Trainer    | trainer_center       | trainer_solo         | Yes                   |
| Behaviorist| behaviorist_center   | behaviorist_solo     | Yes                   |

## Migration

- **533_service_catalog_center_solo_by_style.sql**
  - Updates `service_catalog.applicable_roles` by domain and `service_style`.
  - Sets `behaviorist_solo` role config so allowed service styles are at_home + tele only (no at_center).

**Run:**  
`ENVIRONMENT=dev node scripts/run-migration-rds-node.js 533_service_catalog_center_solo_by_style.sql`

(Or run the SQL file against RDS with your migration runner.)

## Backend alignment

- **service-catalog.ts** and **vendor-services.ts**: `roleMappings` include `behaviorist_solo`, `behaviorist_center` (and existing vet/groomer/trainer solo/center).
- **vendor-services.ts**: `ROLE_SERVICE_STYLES` has `behaviorist_solo` = at_home + tele, `behaviorist_center` = at_home + at_center + tele.
- **specialization-master.ts**: Display names and role mappings include behaviorist_solo/center so specializations by role work.

## Verification

After migration:

1. **Vet:** at_center rows have `applicable_roles` containing `vet_clinic` (not vet_solo); at_home/tele have `vet_solo` (not vet_clinic).
2. **Groomer / Trainer / Behaviorist:** Same pattern (center vs solo by service_style).
3. Vendor dashboard “available to add” list: only services whose `applicable_roles` overlap the vendor’s role **and** whose `service_style` matches the requested tab (at_center / at_home / tele).
