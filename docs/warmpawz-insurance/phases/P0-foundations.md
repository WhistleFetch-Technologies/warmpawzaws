# P0 — Foundations and contracts

- **Owner:** Bindu (done 13 Oct 2026)
- **Estimate:** 2 days
- **Depends on:** nothing
- **Gate:** G0

## Goal

Lock decisions and shared contracts so both tracks can build in parallel without rework.

## Tasks

### Decisions (both, day 1)

- [x] Record D1–D8 outcomes in the README decisions table (who decided, date).
- [x] Agree on the vendor nav (Overview, Applications, Chat, Form Library, Availability, Reports) and the admin two-tab layout.

### Shared contracts (Abhi: status + slugs + field types; Bindu: chat cards)

- [x] `packages/shared-types/src/insurance/insurance-status.ts` — statuses, labels, Kanban grouping, transition map ([02 §1](../02-architecture.md#1-status-machine)).
- [x] `packages/shared-types/src/insurance/insurance-slugs.ts` — slug registry ([02 §4](../02-architecture.md#4-shared-contracts-p0--packagesshared-typessrcinsurance)).
- [x] `packages/shared-types/src/insurance/form-field-types.ts` + `form-schema.ts` (zod).
- [x] `packages/shared-types/src/insurance/chat-cards.ts` — card union with `applicationId` + `version`.
- [x] Export from the shared-types index; unit tests for the transition map (no orphan states, every non-terminal state has an exit).
- [x] Move the backend's `domain/application-status.ts` to re-export from shared-types (keep the branch's mapping for old keys until 1127 is rewritten).

### Migrations (Abhi)

- [x] Split `1127_warmpawz_insurance_admin.sql`:
  - `1127_warmpawz_insurance_core.sql` — tables (with the new status list in the CHECK and new application columns: `plan_id`, `pet_id`, `quoted_premium`, `issued_premium`, `payment_link_expires_at`).
  - `1128_warmpawz_insurance_rbac.sql` — permissions using `INSERT … SELECT … WHERE NOT EXISTS` (1093 pattern, no `DO $$`).
- [x] Confirm the next free numbers against `develop` and all open feature branches before committing.
- [x] Applied on dev RDS on 13 Oct 2026 (RDS Data API). Not applied on prod.

### Probes (Bindu, read-only)

- [x] Read the real `chat_messages` CHECK constraint and columns on dev (SELECT on `information_schema` / `pg_constraint`); record which `message_type` values exist in data. Prod was not queried in this pass. Result is in [01 §4.2](../01-flow-and-gap-analysis.md#42-technical).
- [x] Confirm whether tele availability plus role `insurance` returns insurance vendors on dev. One active insurance vendor exists; none have `tele` in `vendor_availability_v2.service_styles`, so discovery does not return a bookable vendor yet.

### Flags (Abhi)

- [x] `WARMPAWZ_INSURANCE_ENABLED`, `WARMPAWZ_INSURANCE_ADMIN_ENABLED` read in backend (same helper as WPay flags) and exposed through runtime config to the three apps; default off.

## Tests

- Shared-types unit tests (transition map, slug registry uniqueness, zod schema round-trip).
- `tsc --noEmit` in backend, admin-web, vendor-web, customer-web with the new exports.

## Exit (G0)

Decisions recorded, contracts merged, migration split reviewed by both, probe result written into [01 §4.2](../01-flow-and-gap-analysis.md#42-technical).
