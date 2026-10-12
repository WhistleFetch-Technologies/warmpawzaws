# P3 — Customer plan grid and consultation booking

- **Owner:** Bindu (Abhi reviews)
- **Estimate:** 4 days
- **Depends on:** P0; P2 plans API (stub with fixtures until ready)
- **Gate:** G3
- **Reference:** [mockups/02-customer-home-insurance-tile.jpg](../mockups/02-customer-home-insurance-tile.jpg), [03-insurance-tile-art.jpg](../mockups/03-insurance-tile-art.jpg), [04-customer-plan-grid.jpg](../mockups/04-customer-plan-grid.jpg)

## Goal

Customer finds insurance from home, sees published plans, picks a plan (and vendor per D2), and books a teleconsultation. Booking creates the insurance application and opens chat.

## Tasks

### Backend (4-layer, `backend/lambda/src/endpoints/customer/insurance/`)

- [ ] `GET /customer/insurance/plans` — published plans with ≥1 ready vendor (route → handler → service → repo).
- [ ] `GET /customer/insurance/plans/:id` — plan detail + ready vendors (name, rating, next tele slot).
- [ ] Application creation on tele booking for an insurance vendor (booking hook or explicit `POST /customer/insurance/applications` with `bookingId`, `planId`, `petId`); one open application per pet + plan.
- [ ] Promo engine: exclude insurance consult bookings (or follow D3).
- [ ] Chat window: keep chat open while the application is not terminal (override `chat_available_days_post_appointment` for insurance bookings).
- [ ] `npm run validate:customer-layers`.

### Customer-web

- [ ] Flip coming-soon stubs behind `WARMPAWZ_INSURANCE_ENABLED`: `InsuranceServicesLanding`, `app/insurance/page.tsx`, `CustomerHomeComplete` (~3152), `HelpGridSection` `POLICY_COMING_SOON_SCREENS`, `MoreServicesSection`.
- [ ] `PlanGrid + PlanCard` (company, plan, 3 highlights, "Premium starts at ₹X / unit", "Continue to consultation", disclaimer).
- [ ] `PlanDetail` screen; `ConsultVendorPicker` (if D2 = customer picks); pet selector.
- [ ] Hand off to the existing WAppt tele booking with category `insurance` and the selected vendor.
- [ ] Nav: new `ScreenType`s + `shell-route-policies` + `routeKey` + `CustomerHomeWrapper` branches; no raw `router.push` to cart / checkout / shop / orders / bookings.

## Tests

- Service tests: plan listing filters (unpublished, no ready vendor, inactive company excluded); duplicate application blocked.
- `cd apps/customer-web && npm run test:navigation`.
- Dev smoke: FF-6, FF-7 with UAT OTP.

## Exit (G3)

FF-6 and FF-7 pass on dev; layer validator and nav tests green.
