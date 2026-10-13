# P2 — Admin Catalogue and Dashboard

- **Owner:** Bindu (done 13 Oct 2026)
- **Estimate:** 4 days
- **Depends on:** P0
- **Gate:** G2
- **Reference:** [mockups/01-admin-catalogue.jpg](../mockups/01-admin-catalogue.jpg)

## Goal

Reshape the branch's admin module into the two specified tabs, add plans per company, inline vendor configuration, readiness and publish.

## Tasks

### Backend (`backend/lambda/src/endpoints/warmpawz-insurance/admin/`)

- [x] Migration: `insurance_company_plans` ([02 §2.2](../02-architecture.md#22-new-tables)); `insurance_companies.payment_link_domains TEXT[]`, `logo_url`; `admin_settings` category `insurance` defaults.
- [x] Plans repo / service / handlers / routes: `GET/POST/PUT /companies/:id/plans`, `POST /plans/:id/publish|unpublish`.
- [x] Readiness service (pattern: `merchant-readiness.service.ts`): plan publishable when company active and ≥1 ready vendor. Vendor ready = onboarding approved + vendor active + link active + tele availability exists + published form template for the company (form check enabled after P4; behind a flag until then).
- [x] Commission terms: GST rate required (no default); reject missing GST (fail closed).
- [x] Audit: write `entity_audit_log` for company, plan, link, terms, schedule changes.
- [x] Respect `WARMPAWZ_INSURANCE_ADMIN_ENABLED`.
- [x] Vendor workspace endpoint `GET /vendor/insurance/workspace` (links, plans, readiness) for P3 / P4.

### Admin-web (`apps/admin-web/components/admin/warmpawz-insurance/`)

- [x] `WarmpawzInsuranceShell`: two tabs — **Catalogue**, **Dashboard**. Redirect old `/warmpawz-insurance/companies` and `/premium-payout` routes to the new tabs.
- [x] Catalogue: `CompanyCatalogue → CompanyCard` (expandable), `PlanList + PlanDialog`, `AssignedVendorsTable → VendorConfigRow` (inline frequency, commission type, value, GST; save per row), `AssignVendorDialog` (reuse branch `VendorLinkDialog`), `ReadinessBadge`, "View history" for terms.
- [x] Dashboard: move branch outreach table + metric tiles + payout windows here (payout rework in P7).
- [x] Remove the 18% GST pre-fill in `insurance-forms.tsx`.
- [x] Keep current theme (accent `#FF8C42`, lucide icons, existing table and card styles).

### Consult fee (only if D3 = paid)

- [x] Not applicable. D3 is free at launch, so the paid consult-fee work is not part of P2.

## Tests

- Keep the 25 existing unit tests green.
- New: plan validation (≤3 highlights, premium ≥ 0, unit enum), readiness rules, GST-required, publish blocked reasons.
- Permission matrix: view-only admin cannot write companies / plans / links / payouts.
- `apps/admin-web` build; sidebar nav test.

## Exit (G2)

FF-3, FF-4 and the admin part of FF-5 pass on dev.
