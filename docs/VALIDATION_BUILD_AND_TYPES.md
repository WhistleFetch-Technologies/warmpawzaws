# Build & Type Validation Summary

## Validation (re-run)

| App           | `npm run build` | Type check in build | `tsc --noEmit` (if run) |
|---------------|------------------|----------------------|---------------------------|
| **admin-web** | ✅ Pass          | ✅ Yes (types + lint) | N/A (included in build)   |
| **customer-web** | ✅ Pass       | ✅ Yes (types + lint) | N/A (included in build)   |
| **vendor-web**  | ✅ Pass       | ❌ Skipped in config  | Many pre-existing errors  |

## What was fixed

### Admin-web & customer-web (CI-type errors)
- Event handler types: `(e)` → typed as `React.ChangeEvent<HTMLInputElement>`, `HTMLTextAreaElement`, `HTMLSelectElement`, or `React.KeyboardEvent<...>` as appropriate.
- Select/Textarea: all `onChange` handlers use the correct event type for the element (select → `HTMLSelectElement`, textarea → `HTMLTextAreaElement`, input/checkbox → `HTMLInputElement`).

### Vendor-web (no type check in build)
- **next.config.js** has `typescript: { ignoreBuildErrors: true }` and `eslint: { ignoreDuringBuilds: true }`, so the build does not run type-check or lint.
- **Duplicate object keys** (so `tsc` would pass once type-check is enabled):
  - **VendorRoleSelection.tsx**: Removed duplicate keys in `ROLE_ICON_MAP` (`product_seller`, `pet_product`, `sunset` were defined twice).
  - **lib/service-style-labels.ts**: Removed duplicate key `pet_behaviorist` in `ROLE_STYLE_LABELS`.

## Vendor-web: enabling type-check later

Running `npx tsc --noEmit` in `apps/vendor-web` still reports many **pre-existing** errors (not from event handlers), including:

- Test file `__tests__/lib/forensic-api-normalizers.test.ts` missing `@types/jest`.
- **profile/page.tsx**: `VendorProfile` type missing `role`, `roleName`, `roleId`, `vendorType`, `vendor_configuration` (API uses snake_case / different shape).
- **services/page.tsx** and others: `Service` type uses camelCase in code but API/types use snake_case (`service_name`, `service_style`, etc.).
- Various components: property name mismatches (e.g. `grossAmount` vs `gross_amount`), missing optional props, strict union comparisons.

To enable type-check in vendor-web build later:

1. Set `typescript: { ignoreBuildErrors: false }` in `next.config.js`.
2. Add `@types/jest` and/or exclude test files from `tsconfig.json` if needed.
3. Fix API/type alignment (shared types vs backend response shapes) and remaining component type errors.

## Commands to re-validate

```bash
# All three builds
cd apps/admin-web    && npm run build
cd apps/customer-web && npm run build
cd apps/vendor-web   && npm run build

# Vendor-web type-check only (will fail until pre-existing errors are fixed)
cd apps/vendor-web   && npx tsc --noEmit
```

## Lint (admin-web / customer-web)

- `npm run lint` may prompt for ESLint setup if no config exists; the **build** already runs "Linting and checking validity of types" for admin-web and customer-web, so CI type/lint is covered there.
