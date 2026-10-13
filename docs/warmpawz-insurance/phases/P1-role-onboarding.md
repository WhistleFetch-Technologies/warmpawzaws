# P1 — Insurance role and dynamic onboarding

- **Owner:** Bindu (done 13 Oct 2026)
- **Estimate:** 3 days
- **Depends on:** P0 (field types)
- **Gate:** G1

## Goal

An insurance vendor signs up through the same dynamic onboarding flow as every other role, with insurance-specific fields, and lands in the Insurance Workspace after approval.

## Current state

- Role `insurance` is canonical and active; `pet_insurance` is merged and inactive.
- `onboarding_forms` holds one row per role (`fields`, `sections`, `version`) — there is **no `insurance` row**.
- Migration 050 put the `pet_insurance` schema into `roles.config.onboardingFields`, which nothing reads.
- No `insurance` entry in `ROLE_KYC_CONFIGS` (`backend/lambda/src/lib/kyc-form-fields.ts`); no `pet_insurance → insurance` alias in `ROLE_NAME_ALIASES`.
- Vendor-web `role-config.ts` / `role-labels.ts` keyed only on `pet_insurance`.
- Admin designer (`OnboardingDesigner.tsx`, catalog page "onboarding" tab) lacks date / number / multiselect; the renderer drops dropdown / radio to text.

## Tasks

- [x] Migration (next free number): insert the `insurance` row into `onboarding_forms` with `INSERT … SELECT … WHERE NOT EXISTS`. Fields:
  - Business: legal name, trade name, entity type, PAN, GST (optional), address.
  - Licence: IRDAI licence / registration number, licence type (POSP / corporate agent / broker / web aggregator), licence expiry (date), authorised insurers (multiselect), licence document (file).
  - Team: principal officer name, phone, email; number of advisors (number).
  - Bank: account holder, account number, IFSC, cancelled cheque (file).
- [x] Add `insurance` to `ROLE_KYC_CONFIGS`; add `pet_insurance → insurance` to `ROLE_NAME_ALIASES`.
- [x] Admin designer: support `number`, `date`, `multiselect` (and `radio`, `select` options) using `form-field-types.ts`.
- [x] Vendor renderer: render every type in `form-field-types.ts` (dropdown / radio fixed).
- [x] Vendor-web `role-config.ts` / `role-labels.ts`: add `insurance` (keep `pet_insurance` as alias).
- [x] `VendorLandingPage.tsx` (~1515–1607): route `insurance` to the workspace container (stub `InsuranceWorkspace` with the agreed tabs; content arrives in later phases).
- [x] Fix `POST /admin/forms` nonexistent-column write if it is on the insurance path; otherwise log as follow-up.

## Files (expected)

- `db/migrations/11xx_insurance_onboarding_form.sql`
- `backend/lambda/src/lib/kyc-form-fields.ts`, role alias source
- `apps/admin-web/components/admin/onboarding/OnboardingDesigner.tsx` (or its field-type list)
- `apps/vendor-web/components/vendor/orders/DynamicVendorOnboardingForm.tsx`
- `apps/vendor-web/lib/role-config.ts`, `role-labels.ts`
- `apps/vendor-web/components/vendor/landingPage/VendorLandingPage.tsx`

## Tests

- Unit: alias resolution (`pet_insurance` and `insurance` resolve to the same form); KYC config merge for `insurance`.
- Unit: renderer renders each field type and validates required / min / max.
- Dev E2E: FF-1, FF-2.

## Exit (G1)

FF-1 and FF-2 pass on dev; migration applied on dev only after the PR is approved.
