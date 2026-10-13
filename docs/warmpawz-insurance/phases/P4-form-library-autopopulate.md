# P4 — Vendor Form Library and slug autopopulate

- **Owner:** Bindu (done 13 Oct 2026)
- **Estimate:** 5 days — renderer + resolver delivered by **day 2** so Bindu can start P5's customer form screen
- **Depends on:** P0 (field types, slugs, schema)
- **Gate:** G4
- **Reference:** [mockups/05-vendor-form-library.jpg](../mockups/05-vendor-form-library.jpg)

## Goal

Vendors build versioned data forms per company / plan, mapping fields to Warmpawz slugs; the customer's form is prefilled from profile and pet data.

## Tasks

### Shared (day 1–2)

- [x] `DynamicFormRenderer` in `packages/ui` — extracted from `DynamicVendorOnboardingForm` `renderField`; props `schema`, `values`, `prefilled`, `readOnly`, `fieldNotes`, `onChange`, `errors`. Supports every type in `form-field-types.ts`.
- [x] Slug resolver (backend, shared util): given `customerId`, `petId`, slug list → values. Reads `customers`, primary `customer_addresses`, `pets` columns first, then `pets.medical_history` JSONB fallback; returns `{ slug, value, source }`; never throws on a missing value.

### Backend (`warmpawz-insurance/vendor/`)

- [x] Migration: `insurance_form_templates`, `insurance_form_template_versions` ([02 §2.2](../02-architecture.md#22-new-tables)).
- [x] `GET/POST/PUT /vendor/insurance/forms`, `POST /forms/:id/publish` (creates an immutable version), `GET /forms/:id/versions`, `GET /vendor/insurance/slugs`.
- [x] Validation: schema passes zod; field keys unique; slug type compatible with field type; vendor must be linked to the company.
- [x] Readiness (P2) switches on the "published form" check.

### Vendor-web

- [x] `InsuranceWorkspace` Form Library tab: `FormList` (status, version, updated), `FormBuilder` (`SectionEditor`, `FieldRow`, `FieldEditor` with label, type, required, helper, min / max, options, `SlugPicker`), draft / publish, `FormPreview` using `DynamicFormRenderer` with sample prefill.
- [x] Base on admin `EnhancedOnboardingFormBuilder.tsx` patterns; vendor-web UI kit (`apps/vendor-web/components/ui`) and design tokens.

## Tests

- Resolver: one test per slug, JSON fallback, missing pet, missing address.
- Template: publish creates version N+1; published versions immutable; draft edits do not change published schema.
- Renderer: each field type renders, validates, shows prefilled marker and field notes.

## Exit (G4)

Tests green; FF-5 vendor part and FF-10 prefill correct in vendor preview on dev.
