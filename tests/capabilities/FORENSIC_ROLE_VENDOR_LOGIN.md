# Forensic: Role Permissions vs Vendor Login Capabilities

## Contract

1. **Single source of truth:** Admin "roles in Catalog & Service" config is stored in `role_permissions` (per `roles.id`).  
   - `GET /config/roles` and `GET /config/roles/:id` return these capabilities.

2. **Vendor at login:**  
   - `GET /vendor/:vendorId/profile` and `GET /vendor/dashboard/:vendorId` return capabilities = **role_permissions for that vendor’s role_id**, with two-stage filtering:
     - **Stage 1 (solo/business):** Uses the **vendor’s** `vendor_type` (from `vendors.vendor_type` or onboarding). Solo removes e.g. staff_management; solo can add `platform_catalog_services`, `professional_profile`.
     - **Stage 2 (service styles):** Uses role’s `config.serviceStyles.selected` and `config.capabilityRules.serviceStyleDependencies` to include only capabilities for selected styles.

3. **Invariant:** Every capability a vendor sees is either in their role’s `role_permissions` or is one of the allowed solo additions. No extra capabilities from any other source.

## Code Paths

| What | Where |
|------|--------|
| Admin saves role capabilities | `PUT /config/roles` → `roles.ts` UpdateRoleHandler → `role_permissions` |
| Admin reads role capabilities | `GET /config/roles`, `GET /config/roles/:id` → `roles.ts` → `role_permissions` |
| Vendor profile capabilities | `vendor-profile.ts` → `role_permissions` by `vendor.role_id` → `getEffectiveCapabilities(vendor.vendor_type, ...)` |
| Vendor dashboard capabilities | `vendor-dashboard.ts` → same as profile |
| Vendor’s type for filtering | `vendor.vendor_type` (from `vendors` table; set at onboarding/approval and when auto-creating vendor record) |

## Running the Forensic Test

```bash
# Roles-only (no auth): checks GET /config/roles vs GET /config/roles/:id consistency
API_BASE_URL=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com npx ts-node tests/capabilities/forensic-role-permissions-vendor-login.test.ts

# With vendor checks: ensure each vendor’s profile/dashboard capabilities ⊆ role permissions (+ solo additions)
API_BASE_URL=... TEST_VENDOR_IDS=uuid1,uuid2 AUTH_HEADER="Bearer <jwt>" npx ts-node tests/capabilities/forensic-role-permissions-vendor-login.test.ts
```

## Changes Made for Alignment

- **Vendor profile & dashboard:** Use `vendor.vendor_type` (from DB) for capability filtering instead of only `role.config.vendorConfiguration`, so the vendor’s actual onboarding choice (solo/business) drives the filter.
- **Auto-created vendor records:** When creating a `vendors` row from identity (profile/settings flow), set `vendor_type` from `identity.vendor_type` or application payload so capability filtering has the correct type.
- **Forensic test:** Ensures role list and role-by-id capabilities match, and (when TEST_VENDOR_IDS set) that profile/dashboard capabilities are subset of role permissions plus allowed solo additions.
