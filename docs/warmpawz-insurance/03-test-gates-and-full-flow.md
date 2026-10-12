# 03 — Test gates and full-flow script

A phase is done only when its gate passes on **dev**. Gates are cumulative: G6 assumes G0–G5 still pass.

## Gates

| Gate | Phase | Pass criteria | Signed off by |
|---|---|---|---|
| G0 | P0 | D1–D8 recorded in the README; shared contracts merged and compiling in admin-web, vendor-web, customer-web and backend; migration split reviewed; `chat_messages` constraint probe result recorded | Abhi + Bindu |
| G1 | P1 | FF-1, FF-2 pass; alias and schema unit tests green | Bindu reviews |
| G2 | P2 | FF-3, FF-4, admin part of FF-5 pass; existing 25 + new API and permission tests green; `apps/admin-web` build passes | Bindu reviews |
| G3 | P3 | FF-6, FF-7 pass; `npm run test:navigation` and `npm run validate:customer-layers` green | Abhi reviews |
| G4 | P4 | Template publish + version tests and resolver tests green; FF-5 vendor part; FF-10 prefill correct in vendor preview | Bindu reviews |
| G5 | P5 | FF-8 – FF-11 pass on web and one mobile build | Abhi reviews |
| G6 | P6a + P6b | FF-12 – FF-15 pass; transition guard tests green | Both |
| G7 | P7 | FF-16, FF-17 pass; ledger, report-lock, variance and clawback tests green | Bindu reviews |
| G8 | P8 | FF-1 – FF-18 end to end, twice (2 vendors × 2 companies × weekly + monthly windows); GST guard CI green and untouched; prod checklist signed | Both + product |

## Full-flow script (dev, UAT OTP `123456`)

Fixtures: two insurance vendors (V1, V2), two companies (C1, C2) each with one published plan, one customer with one dog and one cat, complete profile (name, phone, email, DOB, address) and pets with breed, DOB, weight, microchip.

| # | Step | Actor | Expected | Phase |
|---|---|---|---|---|
| FF-1 | New vendor signs up, picks Pet Insurance Provider, fills the insurance onboarding form | Vendor | Licence number, licence type, authorised insurers (multiselect), licence expiry (date), documents render and save | P1 |
| FF-2 | Admin reviews and approves | Admin | Vendor lands in the Insurance Workspace on next login | P1 |
| FF-3 | Admin creates C1 and plan "Plan A" (highlights, premium-from, unit, cover options, sum-insured and co-pay options) | Admin | Plan saved as draft; not visible to customers | P2 |
| FF-4 | Admin assigns V1 to C1: weekly, 25% of premium, GST explicitly entered; publishes Plan A | Admin | Publish blocked with a readiness reason until V1 is ready | P2 |
| FF-5 | V1 sets tele availability and publishes a form for Plan A | Vendor | Readiness turns green in Catalogue; publish succeeds | P2 / P4 |
| FF-6 | Customer opens "Find best insurance" | Customer | Only published plans with a ready vendor; premium unit consistent | P3 |
| FF-7 | Customer books a consultation for Plan A with V1 | Customer | Booking + application `consultation_booked`; row on admin Dashboard and V1 Kanban "New" | P3 |
| FF-8 | Consult happens; chat opens | Both | Chat open beyond 7 days while the application is open; customer gets a push on vendor message | P3 / P5 |
| FF-9 | V1 sends a Quick Builder quote | Vendor | PlanQuote card on both sides; options come from plan config; status `quote_shared` | P5 |
| FF-10 | V1 sends the data form; customer opens it | Both | Name, phone, email, address, pet name, breed, DOB, weight, microchip prefilled; consent required before submit | P4 / P5 |
| FF-11 | Customer submits; V1 requests a correction on one field; customer edits and resubmits | Both | Revision 1 kept, revision 2 stored; field note shown; Kanban "In progress" | P5 |
| FF-12 | V1 confirms the form and sends the payment link | Vendor | Allowlisted link accepted, others rejected; expiry shown on the card; status `payment_link_sent` | P6b |
| FF-13 | Customer pays on the insurer site; V1 marks payment reported | Vendor | Customer timeline and admin Dashboard update | P6a / P6b |
| FF-14 | V1 uploads the policy PDF with policy number, premium, dates | Vendor | Blocked without number, premium, dates or document; status `policy_uploaded` | P6b |
| FF-15 | Customer reviews and confirms | Customer | Policy in My Insurance with document; commission snapshot stored; status `policy_confirmed` | P6a / P6b |
| FF-16 | Window closes; V1 generates and submits the completion report | Vendor | Report lists the policy with commission + GST; locked after submit | P7 |
| FF-17 | Admin reconciles, sends a reminder, records a receipt with UTR and TDS | Admin | Variance 0; window Paid | P7 |
| FF-18 | Negative paths: consult cancelled (refund tier), V1 suspended mid-case, free-look clawback, auto-confirm after N days, expired payment link, duplicate application for the same pet + plan | All | Each rule applied as configured; clawback appears as a negative line in the next window | P2 – P7 |

## Regression checks run at every gate

- `cd backend/lambda && npx jest src/endpoints/warmpawz-insurance`
- `cd backend/lambda && npm run validate:customer-layers`
- `cd backend/lambda && npm run build:bundle`
- `cd apps/admin-web && npm run build`
- `cd apps/vendor-web && npm run build` (from P2)
- `cd apps/customer-web && npm run test:navigation && npm run build` (from P3)
- WPay and WAppt smoke on dev unaffected (one Pay Bill payment, one tele booking)
