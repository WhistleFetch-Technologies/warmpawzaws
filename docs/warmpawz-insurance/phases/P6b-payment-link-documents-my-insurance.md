# P6b — Payment link, policy documents and My Insurance

- **Owner:** Bindu — done 13 Oct 2026
- **Estimate:** 5 days
- **Depends on:** P5 (cards), P6a (transition service)
- **Gate:** G6 (with P6a)

## Goal

Vendor sends the insurer payment link in chat, uploads policy documents after payment; the customer reviews and confirms, and the policy lives in My Profile → My Insurance.

## Tasks

### Backend

- [ ] `POST /vendor/insurance/applications/:id/payment-link` — URL must be `https` and its host in the company's `payment_link_domains`; expiry (default from `insurance_payment_link_expiry_hours_default`); resend allowed; PaymentLink card.
- [ ] Mark payment reported (vendor; optional customer "I've paid" nudge) → `payment_reported`.
- [ ] Migration: `insurance_policies_issued`.
- [ ] `POST /vendor/insurance/applications/:id/policy` — presigned S3 upload (`storage.ts`), policy number, issued premium, start / end dates; PolicyDocuments card; `policy_uploaded`. Flag quote vs issued premium variance.
- [ ] Customer (4-layer): `POST /customer/insurance/applications/:id/confirm-policy` → `policy_confirmed`; `GET /customer/insurance/policies`, `/policies/:id` (signed document URLs).
- [ ] Free-look cancellation: vendor / admin action → `free_look_cancelled` (clawback handled in P7).

### Vendor-web

- [ ] PaymentLink composer (URL, amount, expiry) in `ContextPanel`.
- [ ] Policy upload form (files, number, premium, dates).
- [ ] Availability tab: `AdvancedScheduleManager` with `allowedServiceStyles={['tele']}`.
- [ ] Overview tab: readiness checklist (from P2), today's consults, counts.

### Customer-web

- [ ] PaymentLink card: opens the insurer site in the system browser (clickable, external; add Capacitor Browser if native requires it), shows expiry.
- [ ] PolicyDocuments card → `PolicyReviewScreen` (documents, policy number, premium, dates; Confirm / Report a problem).
- [ ] `MyInsuranceList + PolicyDetail`; entry in `UserAccountSidebar` / `CustomerProfileView` menu; new `ScreenType` + policy + `routeKey`.

## Tests

- Allowlist: exact host and subdomain rules; non-https rejected; expiry in the past rejected.
- Upload: rejects missing fields, wrong mime, oversize file.
- Confirm: only the application's customer can confirm; idempotent.
- `npm run test:navigation`; `npm run validate:customer-layers`.

## Exit (G6, with P6a)

FF-12 – FF-15 pass on dev.
