# 01 — Flow map and gap analysis

Sources: code on `main` / `feature/abhi-insurance-admin` as of 12 Oct 2026, the seven mockups in [mockups/](mockups/), and the product flow description in the [README](README.md).

## 1. Flow mapped to today's code

Legend: **Extend** = a working base exists; **New** = nothing usable exists.

| # | Step | Exists today | Needed | Owner | State |
|---|---|---|---|---|---|
| 1 | Vendor onboards with the insurance dynamic form; admin approves | Role `insurance` is canonical and active (`customer_service='insurance'`); `pet_insurance` merged and inactive. Vendor renderer `components/vendor/orders/DynamicVendorOnboardingForm.tsx`; submissions in `vendor_onboarding_applications`; admin approve / reject | `onboarding_forms` row for `insurance`; `ROLE_KYC_CONFIGS` entry; `pet_insurance → insurance` alias; designer types date / number / multiselect; vendor-web `role-config.ts` / `role-labels.ts` keyed on `insurance` | Abhi | Extend |
| 2 | Admin creates company + plans, assigns vendors, sets frequency and commission, publishes | Branch: companies, vendor links, effective-dated commission terms, payout schedules, RBAC | Plans per company; 2-tab Catalogue / Dashboard; inline vendor-row edit; readiness; publish; flags; audit | Abhi | Extend |
| 3 | Customer sees the policy grid | Home tile via service-launch config (`insurance`); coming-soon stubs in `InsuranceServicesLanding`, `app/insurance/page.tsx`, `CustomerHomeComplete` (~3152), `HelpGridSection` `POLICY_COMING_SOON_SCREENS`, `MoreServicesSection` | Plan grid from published plans; remove stubs behind flag | Bindu | Extend |
| 4 | Customer books a consultation | WAppt tele discovery knows category `insurance`; slots endpoints; AWS Chime | Vendor routing (D2); create application at booking; consult fee (D3) | Bindu | Extend |
| 5 | Teleconsultation | Chime video; instant tele queue (SSE) | Category wiring only | Bindu | Extend |
| 6 | Chat opens | `activateTeleChatOnBookingCreated`; 3 s polling; window closes 7 days after completion | Keep chat open while the application is open; customer push on vendor message (today SMS only) | Bindu | Extend |
| 7 | Vendor builds forms in his Form Library | Orphaned admin `EnhancedOnboardingFormBuilder.tsx` is the best base | Template + version tables; slug picker; draft / publish; vendor-web Form Library | Abhi | New |
| 8 | Quick Builder in chat: premiums, coverages | Prescription card precedent (JSON in message text) | `metadata` JSONB on `chat_messages`; PlanQuote card; options from plan config | Bindu | New |
| 9 | Vendor sends the data form in chat | — | FormRequest card pinned to a template version | Bindu | New |
| 10 | Customer opens the form; profile + pet data autopopulate | `customers`, `customer_addresses`, `pets` columns; some pet data only in `pets.medical_history` JSONB | Shared renderer; slug resolver (column first, JSON fallback); consent | Abhi + Bindu | New |
| 11 | Vendor requests changes; customer edits | — | Submission versions; ChangeRequest card with field-level notes | Bindu | New |
| 12 | Payment link in chat; vendor tracks on Kanban; customer + admin see progress | No payment-link card, no Kanban, no drag-drop library | PaymentLink card (allowlist, expiry); status machine; Kanban; shared timeline | Bindu (card) / Abhi (Kanban) | New |
| 13 | Vendor uploads policy docs; customer reviews and confirms; My Insurance | S3 presign (`storage.ts`); chat file upload; no My Insurance screen (`InsuranceProvider.tsx` unreachable) | PolicyDocuments card; confirm step; auto-confirm (D5); My Insurance list + detail | Bindu | New |
| 14 | Vendor generates window payout report; admin Dashboard | Branch: live payout ledger, reminders, receipts | Vendor completion report per window; expected vs reported; commission snapshot; UTR + TDS | Abhi | Extend |

### Status vocabulary implied by the flow

One list shared by admin, vendor and customer (see [02-architecture.md](02-architecture.md#1-status-machine)):

`consultation_booked → consulted → quote_shared → form_sent → form_submitted ⇄ changes_requested → form_confirmed → payment_link_sent → payment_reported → policy_uploaded → policy_confirmed`

Side exits: `dropped`, `cancelled`, `payment_link_expired`, `free_look_cancelled`. Kanban columns are groupings of these, not separate states.

## 2. WPay / WAppt control parity

| Control | WPay / WAppt today | Insurance equivalent | State |
|---|---|---|---|
| Commission per vendor | WPay `vendor_tiers.commission_rate` via `warmpawz_pay_merchant_pricing.tier_id` | Per vendor × company link: % of premium, % of vendor commission, or fixed ₹; effective-dated, append-only (`insurance_commission_terms`) | Built (branch) |
| Payout cadence | Marketplace cron T+N (`platform_settings` `admin:finance:settlement-schedule`); WPay settles per payment; no frequency concept | Per link: weekly / fortnightly / twice-monthly / monthly / every two months, due days, grace, reminder days; platform default (`insurance_payout_schedules`) | Built (branch) |
| GST % on our revenue | `admin_settings` `wpay_platform_fee_gst_rate` 18 (exclusive); `wpay_platform_gst_rate` 18 (inclusive); `WPAY_CONVENIENCE_DEFAULTS` falls back to 18 | GST % on commission per link, exclusive. Must fail closed — the branch UI pre-fills 18, remove that | Change |
| Platform / convenience fee | `wpay_platform_fee` + mode; convenience retired | Consult fee only (premium is paid off-platform). Reuse WAppt per-vendor `appointment_fee` with tele | Decision D3 |
| GST on consult fee | WAppt fee GST hard-coded 0 | Same as WAppt unless finance says otherwise | Decision D3 |
| Promo engine / benefit cap | Tele is promo-eligible in WAppt | Exclude insurance consults (or allow deliberately) | Gap |
| Publish / unpublish | Per-vendor publish, bulk | Company active → plan published → link active; customer sees a plan only if ≥1 ready vendor | Partial |
| Readiness | `merchant-readiness.service.ts` blockers + warnings | Vendor ready = approved + active + link active + tele availability + published form for the plan | Gap (reuse pattern) |
| Cancellation / refund tiers | `vendor_refund_tiers` with `commerce_mode='warmpawz_appointments'`, platform / category scope | Reuse with category `insurance` for consult fee | Reuse |
| Settlement snapshot | `settlements.settlement_breakup` JSONB frozen at payment | Freeze basis, rate, base amount, GST, commission on the application at `policy_confirmed` | Gap |
| Mark settled | WPay bulk mark settled, no reference | Receipt per window: amount, UTR, date, partial, TDS deducted | Built; add TDS |
| Export | WPay xlsx (5,000-row cap) | Payout window + applications export | Gap |
| Feature flags | `WARMPAWZ_PAY_ENABLED` / `WARMPAWZ_PAY_ADMIN_ENABLED` + runtime config | `WARMPAWZ_INSURANCE_ENABLED` / `WARMPAWZ_INSURANCE_ADMIN_ENABLED` | Gap |
| RBAC | Migrations 1084 / 1086 / 1090 / 1093 / 1116 | `admin.warmpawz_insurance` (+ `.view`, `.companies.write`, `.payouts.write`) | Built; convert DO block (1093 pattern) |
| Audit | `entity_audit_log` on catalogue / pricing | Companies, plans, links, terms, schedules, receipts, status overrides | Gap |
| Category mapping | `roles.customer_service` | `insurance` already mapped | Exists |

## 3. Built on the branch vs final requirement

| Area | On the branch | Change for the final requirement |
|---|---|---|
| Sidebar + tabs | Warmpawz Insurance item; tabs Dashboard / Companies & vendors / Premium payout | Two tabs: **Catalogue** (companies, plans, vendors, commission, frequency) and **Dashboard** (progress, payout windows, reconciliation) |
| Companies | CRUD, products as a text list, buying flow, status | Expandable company cards (mockup 01); plans as real rows: name, product type, 3 highlights, premium-from + unit, cover options, sum-insured and co-pay options |
| Vendor assignment | Link dialog + Manage dialog (details / commission / schedule tabs) | Inline row edit in the assigned-vendors table (frequency, commission type, value, GST); history behind a link |
| Applications | Read-only table + timeline; 11 statuses | Status machine (section 1); vendor and customer write APIs with server-side guards |
| Payouts | Ledger computed live from issued policies; manual reminders; receipts | Vendor generates + submits a completion report per window; admin reconciles against system expected; snapshot instead of live pricing |
| Data | Migration 1127 (8 tables), not run | Add plans, form templates / versions / submissions, chat metadata, completion reports; split 1127 before first run |
| Tests | 25 unit tests (periods, commission, ledger, permissions) | Keep; extend for status guards, snapshots, reports, clawback |

Keep: commission terms, schedules, ledger maths, RBAC, API shape. Reshape: tabs, catalogue UI, payout source of truth. Add: plans, vendor and customer write paths.

## 4. Gaps

### 4.1 Business logic

| Gap | Why it matters / proposal | Severity |
|---|---|---|
| Regulatory model | Sharing an intermediary's insurance commission with an unlicensed platform may be restricted by IRDAI. Confirm whether we bill a referral / platform fee before "commission" reaches contracts and UI (D1) | High |
| Proof of sale | Premium is paid off-platform and vendor-reported. Require policy number + document + customer confirmation; compare vendor report to confirmed policies; optional insurer statement upload | High |
| Vendor routing | Several vendors per company — customer picks or auto-assign (D2) | High |
| Consult fee | Free or paid; if paid it rides WAppt tele (fee = platform revenue, GST 0) and the promo engine applies unless excluded (D3) | High |
| Commission frozen at completion | Branch prices live from terms; editing terms mid-window rewrites history. Snapshot onto the application at `policy_confirmed` | High |
| Completion never happens | Customer may never confirm; auto-confirm after N days (D5) | Medium |
| Free-look cancellation | Policy cancelled within the free-look window → negative line in the next window | Medium |
| Quote vs issued premium | Flag variance between quoted and issued premium | Medium |
| Form version snapshot | Submission stores template version + labels; template edits never change submitted data | Medium |
| Consent (DPDP) | Prefilling profile and pet data into a vendor form needs an explicit consent tick + audit | Medium |
| Chat window | Chat closes 7 days after the consult (`chat_available_days_post_appointment`); keep open while the application is open | Medium |
| Duplicates | One open application per pet per plan | Medium |
| Payment link safety | Per-company domain allowlist, expiry, resend; premium never collected inside Warmpawz | Medium |
| Vendor suspended mid-case | Reassign or close; link end date blocks new cases only | Medium |
| Payout disputes + TDS | Disputed state when report ≠ expected; TDS deducted on receipts | Medium |
| Renewals, claims | Store policy start / end now; renewal commission and claims later | Low |

### 4.2 Technical

| Area | Finding |
|---|---|
| `chat_messages` | No `metadata` JSONB; CHECK allows text / image / file / location while code inserts prescription / video / system. Probe the real constraint on dev and prod (read-only) before adding card types |
| Customer push | Vendor chat message → SMS only; no customer push |
| Onboarding | No `insurance` row in `onboarding_forms`; migration 050 fields sit in `roles.config.onboardingFields` (unread); no `ROLE_KYC_CONFIGS` entry; no alias in `ROLE_NAME_ALIASES`; vendor-web role config keyed only on `pet_insurance` |
| Field types | Admin designer lacks date / number / multiselect; renderer drops dropdown / radio to text |
| Broken admin form routes | `POST /admin/forms` writes a nonexistent column; claims status route missing |
| Pet data split | Some pet fields only in `pets.medical_history` JSONB → resolver reads the column first, JSON second |
| Legacy insurance code | `insurance.ts` monolith + `insurance_plans` / `insurance_policies` exist on dev, not prod. Do not extend |
| Migration 1127 | RBAC uses a `DO $$` block; Data API path prefers `INSERT … SELECT` (1093 pattern). Split before first run |
| 4-layer rule | New customer insurance endpoints under `endpoints/customer/` in route → handler → service → repo |
| Payment links | No Razorpay payment links; chat URLs not clickable; Capacitor Browser not installed |

### 4.3 UI (mockups vs our app)

| Gap | Proposal |
|---|---|
| Vendor nav differs across mockups | One nav: Overview, Applications, Chat, Form Library, Availability, Reports |
| Admin tabs | Mockup shows Catalogue / Dashboard / Reconciliation; spec is two tabs → reconciliation lives in Dashboard |
| Premium unit | Grid shows ₹/month, quote shows ₹/year → unit configured per plan, shown consistently |
| Desktop 3-pane vs mobile-first vendor-web | `VendorRouteShell` is a 430 px column; context panel becomes a drawer; Kanban becomes a status filter + list on mobile, columns on desktop (`columnClassName` override) |
| Drag-and-drop Kanban | No dnd library; moves have prerequisites. Guarded "Move to" first (D8) |
| Visual clutter | Keep current theme: `#FF8C42` accent, lucide icons, existing cards and tables; drop gradients and illustrations except the home tile art |

### 4.4 What must be configurable, and by whom

| Setting | Owner | Effect |
|---|---|---|
| Plans + cover options | Admin | Customer grid and Quick Builder checkboxes (no hard-coded covers) |
| Sum insured / co-pay options | Admin, per plan | Quick Builder dropdowns |
| Form templates | Vendor, per company + plan | Sections, types, required, helper, min / max, options, slug, versioned publish |
| Slug registry | Platform (code) | Single place to add a mappable field |
| Commission, GST, frequency, due / grace / reminder days | Admin, per link | Built |
| Payment link allowlist + expiry | Admin, per company | Validated server-side |
| Auto-confirm days, chat-open rule | Admin setting | Platform-wide |
| Consult fee | Vendor (WAppt fee) or admin | Depends on D3 |
