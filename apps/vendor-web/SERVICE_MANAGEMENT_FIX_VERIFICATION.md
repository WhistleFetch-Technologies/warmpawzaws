# Service Management CRUD Fix – Verification

## Summary of changes

1. **`app/services/manage/page.tsx`** (solo provider service manage)
   - Fetch vendor services first; derive `roleId` from `enabledRes?.role?.id` (no `'veterinarian'` fallback).
   - Fetch catalog only when `roleId` is set; if missing, show only vendor’s added services.
   - Use `serviceId` (catalog id) for matching; vendor’s added services listed first, then catalog not-yet-added.

2. **`components/vendor/VendorServiceConfigurationScreen.tsx`**
   - `roleId` from props/vendorData/roleConfig only; never default to `'veterinarian'`.
   - Fetch catalog only when `roleId` is truthy; otherwise show only vendor’s added services.
   - List order: vendor’s added services → custom vendor services → catalog not yet added.

3. **`components/vendor/VendorServiceManagementComplete.tsx`**
   - Pass `roleId={fetchedRoleId}` into `VendorServiceConfigurationScreen`.

## Verification performed

| Check | Result |
|-------|--------|
| **Build** | `npm run build` in `apps/vendor-web` – **PASS** (exit 0) |
| **Linter** | No errors in changed files (ReadLints) |
| **Hardcoded `veterinarian`** | Removed; grep shows no fallback to `'veterinarian'` in manage page or config screen |
| **API usage** | Manage page: `GET /vendor/:vendorId/services` first, then `GET /service-catalog/role/:roleId` only when `roleId` is set |
| **Merge order** | Vendor’s added services first in both manage page and config screen |

## Manual test steps

1. **Solo provider (e.g. grooming)**
   - Log in as a non-vet vendor (grooming/boarding/etc.).
   - Go to **Services → Manage** (`/services/manage`).
   - Confirm the list shows **that vendor’s added services first**, then catalog for **their role** (not vet).
   - Add a service from the catalog, save; confirm it appears in the list and stays after refresh.

2. **Service configuration (by style)**
   - Go to **Services** and open a style tab (e.g. At Home or Tele).
   - Confirm the list shows **vendor’s added services first**, then “available to add” from the **correct role** catalog.
   - For a grooming vendor, do not see veterinarian-only catalog items dominating the list.

3. **Publishing**
   - Enable one or more services and publish.
   - Confirm only **added** services appear as options for publishing and that published services match the vendor’s role.

## Contract tests

Backend contract tests for `GET /vendor/:vendorId/services` are in:

- `tests/playwright/specs/contract-tests/schema-validation.spec.ts` (Vendor Services API Contracts)

Run with backend and Playwright configured:

```bash
cd tests/playwright && npx playwright test schema-validation.spec.ts -g "vendor.*services"
```
