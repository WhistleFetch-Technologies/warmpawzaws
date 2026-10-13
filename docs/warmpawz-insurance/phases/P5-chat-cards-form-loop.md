# P5 — Chat cards, Quick Builder and the data-form loop

- **Owner:** Bindu (done 13 Oct 2026)
- **Estimate:** 6 days
- **Depends on:** P0 (chat-card contract, chat probe), P3 (application exists), P4 renderer + resolver (day 2 of P4)
- **Gate:** G5
- **Reference:** [mockups/06-vendor-chat-quick-builder.jpg](../mockups/06-vendor-chat-quick-builder.jpg)

## Goal

Inside the booking chat, the vendor shares a plan quote, sends the data form, and runs a correction loop with the customer, all as structured cards.

## Tasks

### Backend

- [x] Migration: `chat_messages.metadata JSONB`; widen the `message_type` CHECK to include `card` (exact form per P0 probe); `insurance_form_submissions`.
- [x] Card insert helper: validates `metadata` against `chat-cards.ts`, writes the chat message and the application event in one transaction.
- [x] Vendor: `POST /vendor/insurance/applications/:id/quote` (`quote_shared`), `/form-request` (`form_sent`, pins template version), `/change-request` (`changes_requested`, field notes), `/transition` to `form_confirmed`.
- [x] Customer (4-layer): `GET /customer/insurance/applications/:id/form` (version schema + resolver prefill + latest answers / notes), `POST …/form` (consent required; new revision; `form_submitted`).
- [x] Customer push on vendor chat message (today SMS only) — reuse the existing push service.

### Vendor-web

- [x] Extract `ChatThread` from `VendorChatModal`; `ConversationList` from `VendorChatConversationsModal`; Chat tab in `InsuranceWorkspace`.
- [x] `ChatCardRegistry` rendering each card type.
- [x] `QuickPlanBuilder` — insurer, plan, cover type, sum insured, co-pay, optional covers, indicative premium; options from the plan config (no hard-coded covers).
- [x] `ContextPanel` (plan summary + select form + send form); drawer on mobile.
- [x] Submission review: field-level "request change" notes; confirm.

### Customer-web

- [x] Card registry (customer variants) in the existing chat UI.
- [x] `InsuranceFormScreen`: `DynamicFormRenderer` with prefilled values marked, consent checkbox, field notes on resubmission, `registerLeaveGuard` for unsaved changes; new `ScreenType` + policy + `routeKey`.

## Tests

- Card payload validation (rejects unknown card, wrong application, missing fields).
- Submission revisions: resubmit creates revision N+1, older revisions `superseded`, template version pinned.
- Transitions only via allowed edges.
- `npm run test:navigation`; `npm run validate:customer-layers`.

## Exit (G5)

FF-8 – FF-11 pass on dev on web and one mobile build.
