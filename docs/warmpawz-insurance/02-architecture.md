# 02 — Architecture

Proposed target design. Names marked *(branch)* already exist on `feature/abhi-insurance-admin`; everything else is to be built in the phase noted.

## 1. Status machine

Single source: `packages/shared-types/src/insurance/insurance-status.ts` (P0). Backend validates every transition; UIs only render allowed actions.

| Status | Customer label | Kanban column | Entered by | Allowed next |
|---|---|---|---|---|
| `consultation_booked` | Consultation booked | New | system (booking) | `consulted`, `cancelled` |
| `consulted` | Consultation done | New | system (booking completed) / vendor | `quote_shared`, `dropped` |
| `quote_shared` | Plan shared | In progress | vendor (PlanQuote card) | `quote_shared`, `form_sent`, `dropped` |
| `form_sent` | Information needed | In progress | vendor (FormRequest card) | `form_submitted`, `dropped` |
| `form_submitted` | Information submitted | In progress | customer | `changes_requested`, `form_confirmed` |
| `changes_requested` | Corrections needed | In progress | vendor (ChangeRequest card) | `form_submitted`, `dropped` |
| `form_confirmed` | Details confirmed | In progress | vendor | `payment_link_sent` |
| `payment_link_sent` | Payment required | Awaiting payment | vendor (PaymentLink card) | `payment_reported`, `payment_link_expired`, `payment_link_sent` (resend) |
| `payment_link_expired` | Payment link expired | Awaiting payment | system job | `payment_link_sent`, `dropped` |
| `payment_reported` | Payment received | Awaiting payment | vendor (customer may also report) | `policy_uploaded` |
| `policy_uploaded` | Review your policy | Policy issued | vendor (PolicyDocuments card) | `policy_confirmed`, `policy_uploaded` (re-upload) |
| `policy_confirmed` | Policy active | Policy issued | customer or auto-confirm job | `free_look_cancelled` |
| `free_look_cancelled` | Policy cancelled | Closed | vendor / admin | — |
| `dropped` | Closed | Closed | vendor / customer | — |
| `cancelled` | Cancelled | Closed | customer / admin (consult cancelled) | — |

Rules:

- Guards (server): `form_sent` needs a published template version; `payment_link_sent` needs an allowlisted URL + expiry; `policy_uploaded` needs policy number, issued premium, start / end dates and ≥1 document; `policy_confirmed` freezes the commission snapshot.
- Every transition writes `insurance_application_events` *(branch)* with actor type, actor id, from / to status, payload.
- `policy_confirmed` is the completion event for payouts (replaces the branch's `policy_issued` + evidence rule).
- Branch statuses map: `form_required → form_sent`, `vendor_processing / vendor_review → form_confirmed`, `payment_link_shared → payment_link_sent`, `awaiting_payment → payment_link_sent`, `documents_uploaded → policy_uploaded`, `policy_issued → policy_confirmed`.

## 2. Data model

### 2.1 Tables already in migration 1127 *(branch, not run)*

| Table | Purpose | Change planned |
|---|---|---|
| `insurance_companies` | Insurer master | Add `payment_link_domains TEXT[]`, `logo_url` (P2) |
| `insurance_vendor_companies` | Vendor ↔ company link, status, dates | Inline edit in UI (P2) |
| `insurance_commission_terms` | Effective-dated basis / rate / GST | GST required, no default (P2) |
| `insurance_payout_schedules` | Default + per-link frequency, due, grace, reminder days | — |
| `insurance_applications` | One case per customer + pet + plan | New status list, plan / vendor / booking / snapshot columns (P0 split) |
| `insurance_application_events` | Timeline | — |
| `insurance_payout_periods` | Persisted window state (reminded / received) | Link to completion report (P7) |
| `insurance_payout_reminders` | Reminder log | — |

### 2.2 New tables

| Table | Key columns | Phase |
|---|---|---|
| `insurance_plans` *(name clashes with dev-only legacy table — use `insurance_company_plans`)* | `id`, `company_id`, `name`, `product_type`, `highlights JSONB` (≤3), `premium_from NUMERIC`, `premium_unit` (`month`/`year`), `cover_options JSONB` (`[{key,label,description}]`), `sum_insured_options JSONB`, `copay_options JSONB`, `status` (`draft`/`published`/`archived`), `sort_order`, timestamps | P2 |
| `insurance_form_templates` | `id`, `vendor_id`, `company_id`, `plan_id NULL`, `name`, `status` (`draft`/`published`/`archived`), `current_version_id` | P4 |
| `insurance_form_template_versions` | `id`, `template_id`, `version INT`, `schema JSONB` (sections + fields), `published_at`, `published_by`; immutable once published | P4 |
| `insurance_form_submissions` | `id`, `application_id`, `template_version_id`, `revision INT`, `answers JSONB`, `prefilled_slugs TEXT[]`, `consent_at`, `submitted_at`, `status` (`submitted`/`changes_requested`/`confirmed`/`superseded`), `change_notes JSONB` (field key → note) | P5 |
| `insurance_policies_issued` | `id`, `application_id UNIQUE`, `policy_number`, `issued_premium`, `start_date`, `end_date`, `documents JSONB` (`[{s3Key,name,mime,size}]`), `uploaded_at`, `confirmed_at`, `confirmed_by` (`customer`/`auto`), `cancelled_at`, `cancel_reason` | P6b |
| `insurance_commission_snapshots` | `application_id UNIQUE`, `link_id`, `terms_id`, `basis`, `rate`, `vendor_commission_rate`, `base_amount`, `commission_amount`, `gst_rate`, `gst_amount`, `total_amount`, `snapshot_at`; clawback rows reference the original | P6a |
| `insurance_completion_reports` | `id`, `link_id`, `period_start`, `period_end`, `status` (`draft`/`submitted`/`accepted`/`disputed`), `reported_policy_count`, `reported_amount`, `expected_amount` (system at submit), `variance`, `lines JSONB` (application ids + amounts), `submitted_at`, `reviewed_by`, `review_note` | P7 |
| `insurance_payout_receipts` | Split from periods if partial payments needed: `period_id`, `amount`, `tds_amount`, `utr`, `received_on`, `recorded_by` | P7 |

### 2.3 Changes to shared tables

| Table | Change | Phase |
|---|---|---|
| `chat_messages` | `ADD COLUMN IF NOT EXISTS metadata JSONB`; widen `message_type` CHECK to include `card` (after probing dev + prod constraint) | P0 probe, P5 migration |
| `onboarding_forms` | Insert `insurance` row (fields + sections) via `INSERT … WHERE NOT EXISTS` | P1 |
| `admin_settings` | Category `insurance`: `insurance_auto_confirm_days`, `insurance_chat_open_while_active`, `insurance_payment_link_expiry_hours_default` | P2 |
| `rbac_permissions` | `admin.warmpawz_insurance*` via 1093 pattern | P0 |

## 3. API surface

### 3.1 Admin — `/admin/warmpawz-insurance` *(branch, extended)*

| Method + path | Purpose | Phase |
|---|---|---|
| `GET /dashboard`, `GET /outreach`, `GET /applications/:id/events` | Dashboard tiles, application list, timeline | branch |
| `GET/POST/PUT /companies` | Companies | branch |
| `GET/POST/PUT /companies/:id/plans` | Plans | P2 |
| `POST /plans/:id/publish`, `/unpublish` | Plan publish with readiness check | P2 |
| `GET /vendor-candidates`, `GET/POST/PUT /vendor-links`, `GET/POST /vendor-links/:id/terms`, `PUT /vendor-links/:id/payout-schedule` | Vendor assignment, commission, frequency | branch |
| `GET /readiness` | Per plan / vendor readiness blockers | P2 |
| `GET/PUT /payout-schedule` | Platform default schedule | branch |
| `GET /payouts`, `POST /payouts/remind`, `POST /payouts/receipt` | Windows, reminders, receipts | branch (rework P7) |
| `GET /completion-reports`, `POST /completion-reports/:id/accept`, `/dispute` | Reconciliation | P7 |
| `GET /export/applications`, `/export/payouts` | xlsx export | P7 |

### 3.2 Vendor — `/vendor/insurance` (new module `backend/lambda/src/endpoints/warmpawz-insurance/vendor/`)

| Method + path | Purpose | Phase |
|---|---|---|
| `GET /workspace` | Links, plans, readiness, counts | P2 |
| `GET/POST/PUT /forms`, `POST /forms/:id/publish`, `GET /forms/:id/versions` | Form Library | P4 |
| `GET /slugs` | Slug registry for the picker | P4 |
| `GET /applications`, `GET /applications/:id` | Kanban + drawer | P6a |
| `POST /applications/:id/transition` | Guarded status change (`{to, payload}`) | P6a |
| `POST /applications/:id/quote` | PlanQuote card + `quote_shared` | P5 |
| `POST /applications/:id/form-request` | FormRequest card + `form_sent` | P5 |
| `POST /applications/:id/change-request` | ChangeRequest card + `changes_requested` | P5 |
| `POST /applications/:id/payment-link` | PaymentLink card + `payment_link_sent` | P6b |
| `POST /applications/:id/policy` | Upload policy (presigned S3) + `policy_uploaded` | P6b |
| `GET /payout-windows`, `POST /payout-windows/report` | Generate / submit completion report | P7 |

### 3.3 Customer — `endpoints/customer/insurance/` (4-layer)

| Method + path | Purpose | Phase |
|---|---|---|
| `GET /customer/insurance/plans` | Published plans with ≥1 ready vendor | P3 |
| `GET /customer/insurance/plans/:id` | Plan detail + ready vendors | P3 |
| `POST /customer/insurance/applications` | Create application when the consult is booked (or from booking hook) | P3 |
| `GET /customer/insurance/applications/:id/form` | Template version + prefilled answers (slug resolver) | P5 |
| `POST /customer/insurance/applications/:id/form` | Submit / resubmit with consent | P5 |
| `POST /customer/insurance/applications/:id/confirm-policy` | Confirm documents → `policy_confirmed` | P6b |
| `GET /customer/insurance/policies`, `/policies/:id` | My Insurance | P6b |

## 4. Shared contracts (P0) — `packages/shared-types/src/insurance/`

| File | Contents |
|---|---|
| `insurance-status.ts` | Status list, labels, Kanban grouping, transition map |
| `insurance-slugs.ts` | `{ slug, label, group: 'customer'|'address'|'pet', source: { table, column, jsonPath? }, type }` — e.g. `customer.full_name`, `customer.phone`, `customer.email`, `customer.date_of_birth`, `address.line1`, `address.city`, `address.pincode`, `pet.name`, `pet.species`, `pet.breed`, `pet.gender`, `pet.date_of_birth`, `pet.age`, `pet.weight_kg`, `pet.microchip_id`, `pet.is_spayed_neutered`, `pet.color` |
| `form-field-types.ts` | `text`, `textarea`, `number`, `date`, `email`, `phone`, `select`, `multiselect`, `radio`, `checkbox`, `file`, `section_note` + per-type validation (`min`, `max`, `pattern`, `options`) |
| `form-schema.ts` | `FormSchema = { sections: [{ key, title, fields: [{ key, label, type, required, helperText, options, min, max, slug? }] }] }` (zod) |
| `chat-cards.ts` | Discriminated union on `metadata.card`: `plan_quote`, `form_request`, `form_submission`, `change_request`, `payment_link`, `policy_documents`, `status_update` — each with `applicationId` and a version number |

## 5. Component tree

### Shared

- `DynamicFormRenderer` (`packages/ui`) — extracted from `DynamicVendorOnboardingForm` `renderField`; props `schema`, `values`, `prefilled`, `readOnly`, `fieldNotes`, `onChange`. Used by onboarding, vendor preview, customer fill.
- `KanbanBoard` — columns + cards + "Move to" menu; drag via `@dnd-kit` later.

### Admin (`apps/admin-web/components/admin/warmpawz-insurance/`)

- `shared/WarmpawzInsuranceShell` *(branch; reduce to two tabs)*
- Catalogue: `CompanyCatalogue → CompanyCard` (expandable) `→ PlanList + PlanDialog`, `AssignedVendorsTable → VendorConfigRow` (inline frequency, commission type, value, GST), `AssignVendorDialog` *(branch VendorLinkDialog)*, `ReadinessBadge`
- Dashboard: `MetricTiles`, `ApplicationsTable + ApplicationTimeline` *(branch outreach)*, `PayoutWindowsTable` *(branch)*, `CompletionReportDetail`, `RecordReceiptDialog` *(branch; add TDS)*

### Vendor (`apps/vendor-web/components/vendor/insurance/`)

- `InsuranceWorkspace` replaces `InsuranceVendorContainer` (routing in `apps/vendor-web/components/vendor/landingPage/VendorLandingPage.tsx` ~1515–1607). Tabs: Overview, Applications, Chat, Form Library, Availability, Reports.
- Applications: `KanbanBoard`, `ApplicationCard`, `ApplicationDrawer` (timeline + guarded actions), `CompletionReportBar`
- Chat: `ConversationList` (from `VendorChatConversationsModal`), `ChatThread` (extracted from `VendorChatModal`), `ChatCardRegistry`, `QuickPlanBuilder`, `ContextPanel` (drawer on mobile)
- Form Library: `FormList`, `FormBuilder` (`SectionEditor`, `FieldRow`, `FieldEditor`, `SlugPicker`) based on `EnhancedOnboardingFormBuilder`, `FormPreview` = `DynamicFormRenderer`
- Availability: `AdvancedScheduleManager allowedServiceStyles={['tele']}`
- Reports: CSV export pattern from `EarningsAnalytics`

### Customer (`apps/customer-web`)

- `PlanGrid + PlanCard`, `PlanDetail`, `ConsultVendorPicker` (D2), existing WAppt tele booking
- Chat cards via the same registry (customer variants)
- `InsuranceFormScreen` (renderer + prefill + consent + `registerLeaveGuard`)
- `PolicyReviewScreen`
- `MyInsuranceList + PolicyDetail` from the profile menu (`UserAccountSidebar`)
- Every new screen: `ScreenType` + `shell-route-policies` + `routeKey` + `CustomerHomeWrapper` branch
