# P2 — Admin Catalogue and Dashboard

- **Owner:** Abhi (Bindu reviews)
- **Estimate:** 4 days
- **Depends on:** P0
- **Gate:** G2
- **Reference:** [mockups/01-admin-catalogue.jpg](../mockups/01-admin-catalogue.jpg)

## Goal

Reshape the branch's admin module into the two specified tabs, add plans per company, inline vendor configuration, readiness and publish.

## Tasks

### Backend (`backend/lambda/src/endpoints/warmpawz-insurance/admin/`)

- [ ] Migration: `insurance_company_plans` ([02 §2.2](../02-architecture.md#22-new-tables)); `insurance_companies.payment_link_domains TEXT[]`, `logo_url`; `admin_settings` category `insurance` defaults.
- [ ] Plans repo / service / handlers / routes: `GET/POST/PUT /companies/:id/plans`, `POST /plans/:id/publish|unpublish`.
- [ ] Readiness service (pattern: `merchant-readiness.service.ts`): plan publishable when company active and ≥1 ready vendor. Vendor ready = onboarding approved + vendor active + link active + tele availability exists + published form template for the company (form check enabled after P4; behind a flag until then).
- [ ] Commission terms: GST rate required (no default); reject missing GST (fail closed).
- [ ] Audit: write `entity_audit_log` for company, plan, link, terms, schedule changes.
- [ ] Respect `WARMPAWZ_INSURANCE_ADMIN_ENABLED`.
- [ ] Vendor workspace endpoint `GET /vendor/insurance/workspace` (links, plans, readiness) for P3 / P4.

### Admin-web (`apps/admin-web/components/admin/warmpawz-insurance/`)

- [ ] `WarmpawzInsuranceShell`: two tabs — **Catalogue**, **Dashboard**. Redirect old `/warmpawz-insurance/companies` and `/premium-payout` routes to the new tabs.
- [ ] Catalogue: `CompanyCatalogue → CompanyCard` (expandable), `PlanList + PlanDialog`, `AssignedVendorsTable → VendorConfigRow` (inline frequency, commission type, value, GST; save per row), `AssignVendorDialog` (reuse branch `VendorLinkDialog`), `ReadinessBadge`, "View history" for terms.
- [ ] Dashboard: move branch outreach table + metric tiles + payout windows here (payout rework in P7).
- [ ] Remove the 18% GST pre-fill in `insurance-forms.tsx`.
- [ ] Keep current theme (accent `#FF8C42`, lucide icons, existing table and card styles).

### Consult fee (only if D3 = paid)

- [ ] Use WAppt per-vendor `appointment_fee` for tele; add `vendor_refund_tiers` rows for category `insurance`; exclude from promo engine.

## Tests

- Keep the 25 existing unit tests green.
- New: plan validation (≤3 highlights, premium ≥ 0, unit enum), readiness rules, GST-required, publish blocked reasons.
- Permission matrix: view-only admin cannot write companies / plans / links / payouts.
- `apps/admin-web` build; sidebar nav test.

## Exit (G2)

FF-3, FF-4 and the admin part of FF-5 pass on dev.
