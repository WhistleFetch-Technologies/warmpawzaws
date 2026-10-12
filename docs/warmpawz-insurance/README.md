# Warmpawz Insurance — plan of record

Owners: **Abhi** and **Bindu**. Branch: `feature/abhi-insurance-admin` (based on `feature/abhi-promo-ranges` at `8f2e4e717`).

This folder is the working plan for the Warmpawz Insurance feature: admin catalogue and dashboard, insurance vendor onboarding, customer plan discovery, teleconsultation, chat-based quoting and data forms, payment link tracking, policy documents, My Insurance, and window-based payout reconciliation.

## Read in this order

| File | What it covers |
|---|---|
| [01-flow-and-gap-analysis.md](01-flow-and-gap-analysis.md) | Target flow, step-by-step map against today's code, WPay / WAppt control parity, business / technical / UI / configurability gaps |
| [02-architecture.md](02-architecture.md) | Status machine, data model, API surface, shared contracts, component tree per app |
| [03-test-gates-and-full-flow.md](03-test-gates-and-full-flow.md) | Gates G0–G8 and the 18-step full-flow script |
| [phases/](phases/) | One file per phase: scope, owner, tasks, files, tests, exit gate |
| [mockups/](mockups/) | Reference screens supplied by product (content reference only; layout follows our current theme) |

## Target flow (as specified)

1. Insurance vendor onboards through the dynamic onboarding form for the `insurance` role; admin approves.
2. Admin, under the **Warmpawz Insurance** sidebar item, uses two tabs:
   - **Catalogue** — create insurance companies (and their plans), assign active insurance vendors, set payout frequency and commission per vendor–company link.
   - **Dashboard** — progress of every application, payout windows, vendor completion reports, reconciliation, reminders, receipts.
3. Customer: policy grid → book consultation → teleconsultation → chat opens.
4. Vendor builds data forms in his Form Library ahead of time; in chat he uses the Quick Builder to show premiums and coverages.
5. Once the customer agrees, the vendor sends the data form in chat. The customer opens it; fields mapped to slugs autopopulate from the customer and pet profile.
6. Customer submits; vendor can request corrections; customer edits and resubmits.
7. Vendor confirms and sends the insurer payment link in chat, then tracks the case on his Kanban board. Customer and admin see the same progress.
8. After payment, the vendor uploads the policy documents. The customer reviews and confirms; the policy lives under **My Profile → My Insurance**.
9. The vendor generates the payout report for each frequency window from completed policies; it appears on the admin Dashboard for reconciliation.

## Current state (12 Oct 2026)

Already on this branch (uncommitted work committed with this plan):

- Migration `db/migrations/1127_warmpawz_insurance_admin.sql` — **not run on any environment**. To be split and revised in P0 (see [phases/P0-foundations.md](phases/P0-foundations.md)).
- Backend admin module `backend/lambda/src/endpoints/warmpawz-insurance/admin/` (companies, vendor links, commission terms, payout schedules, outreach, payout ledger, reminders, receipts) with 25 unit tests.
- Admin-web pages under `apps/admin-web/app/warmpawz-insurance/` and components under `apps/admin-web/components/admin/warmpawz-insurance/`, sidebar entry, permissions.

Nothing is deployed. Phase P2 reshapes the admin UI from three tabs to the two specified tabs.

## Decisions to confirm before P1

| # | Decision | Recommendation |
|---|---|---|
| D1 | Commercial wording: share of the intermediary's commission vs referral / platform fee (IRDAI) | Confirm with compliance; data model is the same either way |
| D2 | Vendor routing for a plan with several vendors | Customer picks from ready vendors; auto-assign later |
| D3 | Consultation fee | Free at launch, excluded from promo engine |
| D4 | Who defines plans and cover options | Admin defines; vendor uses them in the Quick Builder |
| D5 | Completion trigger | Customer confirms documents; auto-confirm after 7 days |
| D6 | Payment link domains | Admin-managed allowlist per company |
| D7 | Payout source of truth | System-computed expected amount is authoritative; vendor report attests and flags variance |
| D8 | Kanban interaction in v1 | Guarded "Move to" actions; drag-and-drop later |

## Phase summary

| Phase | Owner | Est. | Gate |
|---|---|---|---|
| [P0 Foundations and contracts](phases/P0-foundations.md) | Both | 2d | G0 |
| [P1 Role and onboarding](phases/P1-role-onboarding.md) | Abhi | 3d | G1 |
| [P2 Admin Catalogue and Dashboard](phases/P2-admin-catalogue-dashboard.md) | Abhi | 4d | G2 |
| [P3 Customer plan grid and consultation booking](phases/P3-customer-discovery-booking.md) | Bindu | 4d | G3 |
| [P4 Form Library and autopopulate](phases/P4-form-library-autopopulate.md) | Abhi | 5d | G4 |
| [P5 Chat cards and data-form loop](phases/P5-chat-cards-form-loop.md) | Bindu | 6d | G5 |
| [P6a Status machine and Kanban](phases/P6a-status-machine-kanban.md) | Abhi | 4d | G6 |
| [P6b Payment link, documents, My Insurance](phases/P6b-payment-link-documents-my-insurance.md) | Bindu | 5d | G6 |
| [P7 Payout windows and reconciliation](phases/P7-payout-windows-reconciliation.md) | Abhi (Bindu reviews) | 4d | G7 |
| [P8 Full flow and release readiness](phases/P8-full-flow-release.md) | Both | 3d | G8 |

Roughly 25 days for Abhi and 22 for Bindu; 6–7 calendar weeks with overlap.

| Week | Abhi | Bindu | Hand-off |
|---|---|---|---|
| 1 | P0, P1 | P0, P3 start | Contracts merged (G0) |
| 2 | P2 | P3 | Published plans API for the customer grid |
| 3 | P4 | P5 start (cards, Quick Builder) | Form renderer + slug resolver by day 2 of P4 |
| 4 | P6a | P5 (form loop) | Status machine API for chat cards |
| 5 | P7 | P6b | Confirmed policies feed payout reports |
| 6–7 | P8 | P8 | Full-flow sign-off (G8) |

## Working rules for this feature

- Customer HTTP routes follow the 4-layer split (`.cursor/rules/endpoint-4-layer-parity.mdc`); run `npm run validate:customer-layers`.
- Customer navigation uses the nav stack (`.cursor/rules/customer-navigation.mdc`); run `npm run test:navigation` after nav changes.
- Migrations: next free number (1128+), additive, idempotent, Data API safe (no `DO $$` blocks for RBAC — use the `INSERT … SELECT … WHERE NOT EXISTS` pattern from 1093).
- Do not extend the legacy `insurance.ts` monolith or the dev-only `insurance_plans` / `insurance_policies` tables.
- Commission GST follows the GST guard invariants (`docs/GST_FINANCIAL_LINEAGE_GUARD.md`): fail closed, no silent 18%, snapshot at completion, never recompute history.
- Feature flags `WARMPAWZ_INSURANCE_ENABLED` and `WARMPAWZ_INSURANCE_ADMIN_ENABLED` stay off on prod until G8.
