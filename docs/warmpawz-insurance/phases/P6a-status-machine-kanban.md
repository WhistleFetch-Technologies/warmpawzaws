# P6a — Status machine, Kanban and commission snapshot

- **Owner:** Bindu — done 13 Oct 2026
- **Estimate:** 4 days
- **Depends on:** P0 (status contract), P5 card endpoints (can overlap)
- **Gate:** G6 (with P6b)
- **Reference:** [mockups/07-vendor-kanban.jpg](../mockups/07-vendor-kanban.jpg)

## Goal

One server-enforced status machine drives the vendor Kanban, the customer timeline and the admin Dashboard; completion freezes the commission.

## Tasks

### Backend

- [ ] Transition service: single entry point used by every card endpoint and `POST /vendor/insurance/applications/:id/transition`; enforces the transition map + guards ([02 §1](../02-architecture.md#1-status-machine)); writes `insurance_application_events`.
- [ ] `GET /vendor/insurance/applications` (filters: status column, plan, company, date; counts per column) and `GET /applications/:id` (detail + timeline + latest cards).
- [ ] Migration: `insurance_commission_snapshots`.
- [ ] Snapshot on `policy_confirmed`: terms in force on the confirmation date (IST) for the link → basis, rate, base (issued premium), commission, GST, total. GST missing → transition fails (fail closed).
- [ ] Auto-confirm job: `policy_uploaded` older than `insurance_auto_confirm_days` → `policy_confirmed` with `confirmed_by='auto'` (scheduled Lambda / existing cron runner).
- [ ] Payment link expiry job: `payment_link_sent` past `payment_link_expires_at` → `payment_link_expired`.
- [ ] Admin Dashboard reads the same statuses (replace branch outreach status mapping).

### Vendor-web

- [ ] `KanbanBoard` (columns: New, In progress, Awaiting payment, Policy issued, Closed) — desktop columns, mobile status filter + list.
- [ ] `ApplicationCard` (customer, pet, plan, status, age, next action).
- [ ] `ApplicationDrawer` (timeline, cards, guarded "Move to" actions with the reason a move is blocked).
- [ ] Metric tiles (open, awaiting payment, issued this window, conversion).

### Customer-web

- [ ] Application status strip on the chat and in My Insurance (labels from shared status file).

## Tests

- Every allowed edge succeeds; every disallowed edge returns 422 with a reason.
- Guards: no `payment_link_sent` without allowlisted URL; no `policy_uploaded` without number / premium / dates / document.
- Snapshot uses terms in force on the IST confirmation date; later term edits do not change it.
- Auto-confirm and expiry jobs are idempotent.

## Exit (G6, with P6b)

FF-12 – FF-15 pass on dev.
