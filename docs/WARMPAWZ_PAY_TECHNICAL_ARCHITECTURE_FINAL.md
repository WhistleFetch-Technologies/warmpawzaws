# Warmpawz Pay — Technical Architecture & Design Document (Final)

**Document version:** Final (approved)  
**Supersedes:** V1 (`WARMPAWZ_PAY_TECHNICAL_ARCHITECTURE.md`), V2 (`WARMPAWZ_PAY_TECHNICAL_ARCHITECTURE_V2.md`)  
**Branch reference:** `develop`  
**Status:** **Approved for implementation** — engineering design review complete  
**Audience:** Engineering, QA, DevOps, Product  
**Last updated:** July 22, 2026

---

## Design Review Verdict

**Approved** with refinements incorporated in this document:

1. `payment_source` has **no DEFAULT** — every bounded context must set it explicitly on insert.
2. Documented **migration path** from signed quote tokens → persistent quote entities.
3. **Effects lifecycle** owned by each subsystem’s own tables — not `payments.metadata`.
4. Added **Dependency Rules** section (enforced in code review / lint).
5. Added **Testing Strategy** section.

---

## Revision Summary (V2 → Final)

| Topic | V2 | Final |
|-------|-----|-------|
| `payment_source` | `NOT NULL DEFAULT 'warmpawz_pay'` for new rows | **`NOT NULL` with no DEFAULT** — explicit on every insert |
| Effects tracking | `payments.metadata.effects` | **Removed** — derive from `settlements`, `promotion_usages`, `transactions`, notification logs |
| Quote evolution | Signed token only | **+ documented path** to persistent `warmpawz_pay_quotes` table |
| Dependency Rules | Implicit | **Explicit §23** |
| Testing | Scattered in sprints | **Dedicated §24** |

---

# 1. Executive Summary

## What Warmpawz Pay Is

Warmpawz Pay is a **standalone walk-in payment product**: customer opens a vendor profile, enters a bill amount, applies a promotion, pays via Razorpay, and both parties see the transaction. Vendor settlement uses the platform's generic `settlements` / `payouts` rail.

## Why It Exists

Existing Razorpay flows are bound to booking, shop, pharmacy, and meal domains. Warmpawz Pay is the first **isolated bounded context** writing to the shared `payments` hub with an explicit `payment_source`.

## Scope (MVP)

| In scope | Out of scope |
|----------|--------------|
| Pay Bill from vendor profile | Booking / ecommerce / pharmacy / meal logic |
| Signed quote token → initiate → Razorpay → verify | Wallet, QR, cashback, membership, loyalty |
| Customer & vendor transaction history | Platform-wide legacy `payment_source` backfill |
| Async post-commit effects + reconciliation jobs | Shared `PaymentGatewayService` extraction |
| Admin refund | Event bus / SQS |

## MVP Goals

1. Ship Pay Bill end-to-end with **zero coupling** to legacy payment monolith handlers.
2. **Never block payment completion** on non-financial side effects.
3. Extend `payments` minimally: `payment_source` (required, no default), `original_amount`, `metadata` (context only).
4. Each subsystem **owns its own lifecycle state** in its own tables.
5. Establish dependency rules and test strategy before Sprint 1 merge.

## Future Vision

Multiple bounded contexts write to `payments` with explicit `payment_source`. Optional `source_entity_id` added later when parent aggregates exist (QR session, membership). Nullable legacy FKs deprecated gradually.

---

# 2. Functional Requirements

## Customer (C-01 – C-08)

Discover vendor → Pay Bill CTA → enter amount → apply promo → Razorpay pay → confirmation → transaction history/detail.

**Eligibility:** `vendor.pay_bill_enabled AND vendor.bank_verified AND vendor.status = active`.

## Vendor (V-01 – V-04)

Notifications, transaction history/detail with commission and settlement status (read from `settlements`, not payment metadata).

## Admin (A-01 – A-05)

Filter `payment_source = 'warmpawz_pay'`, detail view, manual refund, finance reporting via `transactions`.

## Promotion Flow

Quote (signed token) → initiate re-validates token → verify completes payment → **async** promo usage in `promotion_usages` / `coupon_usages`.

## Settlement Flow

Verify completes payment → **async** `settlements` row (`order_type = 'warmpawz_pay'`) → daily batch → `payouts` → RazorpayX.

## Refunds

Admin-initiated via generic Razorpay refund + Warmpawz Pay refund orchestrator. Preconditions: `payment_status = completed`.

## Notifications

Async post-commit via notification service. Delivery tracked in platform notification logs — not on `payments`.

---

# 3. Non-Functional Requirements

| NFR | Target |
|-----|--------|
| Verify API p95 | < 200 ms |
| Quote API p95 | < 300 ms |
| Payment `completed` | Strongly consistent |
| Settlement / promo / ledger | Eventually consistent ≤ 5 min (reconciliation SLA) |
| Idempotency | Initiate key, verify status guard, unique settlement per payment |
| Operability | Dashboards for reconciliation gaps |

---

# 4. High Level Architecture

## Pattern: Sync capture + async effects + subsystem-owned state

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────────────┐
│ Verify TX   │────►│ PostPaymentProcessor │────►│ Reconciliation jobs     │
│ payment     │     │ (async, idempotent)  │     │ (close gaps)            │
│ completed   │     └──────────────────────┘     └─────────────────────────┘
└─────────────┘              │
                             ├──► settlements (owns accrual status)
                             ├──► promotion_usages (owns promo commit)
                             ├──► transactions (owns admin ledger)
                             └──► notification service (owns delivery log)
```

## ASCII diagram

```
Customer / Vendor / Admin Apps
            │
            ▼
     API Gateway + Auth + Rate Limit
            │
            ▼
┌───────────────────────────────────────────────────────────┐
│ WARMPAWZ PAY BOUNDED CONTEXT                               │
│  QuoteService → PaymentOrchestrator → PostPaymentProcessor │
│  HistoryService │ RazorpayAdapter (local) │ ReconcileJobs  │
└───────────────────────────┬───────────────────────────────┘
                            │
     razorpay-client │ discount-engine │ finance/commission
     notifications   │ createPayout()
                            ▼
              PostgreSQL + Razorpay API
```

---

# 5. Domain Model

## Aggregates

**PaymentIntent** (root) = `payments` row where `payment_source = 'warmpawz_pay'` (set explicitly at insert).

**SettlementAccrual** (root) = `settlements` row where `order_type = 'warmpawz_pay'`.

**PromotionUsage** (entity) = rows in `promotion_usages` / `coupon_usages` keyed by `payment_id`.

## Value objects

`Money`, `QuoteToken` (signed), `CommissionSnapshot`, `RazorpayCheckoutRef`, `BillAmount`.

## Invariants

- `payment_source` must be `'warmpawz_pay'` on every Warmpawz Pay insert — **never rely on DB default**.
- `booking_id`, `order_id`, `pharmacy_order_id` must be NULL.
- At most one `completed` payment per `(customer_id, idempotency_key)` for Warmpawz Pay.

## Entity ownership

| Table | Owner | Warmpawz Pay access |
|-------|-------|---------------------|
| `payments` | Shared hub | Write own rows only |
| `settlements` | Platform Finance | Insert accrual |
| `promotion_usages` | Discount usage | Insert via processor |
| `transactions` | Admin Finance | Insert via processor |
| `vendor_earnings` | Booking | **No access** |

---

# 6. Backend Module Structure

```
backend/lambda/src/endpoints/warmpawz-pay/
├── domain/
├── application/
│   ├── payment-orchestrator.service.ts
│   ├── post-payment-processor.service.ts
│   ├── quote.service.ts
│   ├── history.service.ts
│   └── refund.service.ts
├── infrastructure/
│   ├── razorpay.adapter.ts
│   └── quote-token.signer.ts
├── repositories/
├── handlers/
├── routes/
├── dto/
├── constants/
└── jobs/
    ├── reconcile-pending-payments.job.ts
    ├── reconcile-missing-settlements.job.ts
    └── reconcile-missing-promo-usage.job.ts
```

Register via `registerWarmpawzPayRoutes(app)` in `handler/index.ts`.

---

# 7. Database Design

## 7.1 `payments` — extensions

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| **`payment_source`** | `TEXT` | **`NOT NULL` — no DEFAULT** | Every bounded context sets explicitly at insert. Warmpawz Pay: `'warmpawz_pay'`. |
| **`original_amount`** | `NUMERIC(12,2)` | NULL allowed | Pre-discount bill amount |
| **`metadata`** | `JSONB` | `NOT NULL DEFAULT '{}'` | Promo snapshot, quote ref, client context — **not** effect status |

### Why no DEFAULT on `payment_source`

| With DEFAULT | Without DEFAULT (Final) |
|--------------|-------------------------|
| Silent NULL-equivalent behavior if ORM omits column | Insert fails fast if omitted — forces intentional domain tagging |
| Legacy code may accidentally get wrong source | Each bounded context documents its value in repository layer |
| Hides migration debt | Makes incomplete migrations visible immediately |

**Legacy rows:** Pre-migration `payments` rows may have NULL `payment_source` until a separate platform backfill migration runs. **All new inserts** from any bounded context must set `payment_source` once the column exists — no exceptions.

**Warmpawz Pay repository rule:**

```text
INSERT must include payment_source = 'warmpawz_pay' in every code path.
Repository layer rejects inserts without explicit payment_source.
```

### Columns explicitly NULL for Warmpawz Pay

`booking_id`, `order_id`, `pharmacy_order_id`, `subscription_id`.

### Deferred

- `source_entity_id` — add when QR session or membership aggregate exists.

### Indexes (partial, Warmpawz Pay only)

```text
idx_payments_wpay_customer_date   (customer_id, created_at DESC) WHERE payment_source = 'warmpawz_pay'
idx_payments_wpay_vendor_date     (vendor_id, created_at DESC)     WHERE payment_source = 'warmpawz_pay'
idx_payments_wpay_pending         (created_at)                    WHERE payment_source = 'warmpawz_pay' AND payment_status = 'pending'
UNIQUE idx_payments_wpay_idempotency (customer_id, idempotency_key) WHERE payment_source = 'warmpawz_pay' AND idempotency_key IS NOT NULL
```

## 7.2 Subsystem-owned effect state (Final — replaces metadata.effects)

| Concern | Source of truth | How to determine status |
|---------|-----------------|-------------------------|
| **Payment captured** | `payments.payment_status` | `completed` = paid |
| **Settlement accrued** | `settlements` | Row exists for `payment_id` + `order_type = 'warmpawz_pay'`; status via `settlement_status` |
| **Promo committed** | `promotion_usages` / `coupon_usages` | Row exists with `payment_id`; if no promo applied, N/A (skipped) |
| **Admin ledger** | `transactions` | Row with `payment_id` + `transaction_category = 'warmpawz_pay'` |
| **Notification sent** | Platform notification delivery log / `payment_transaction_log` | Event type `notification_sent` for `payment_id` |

**API composite status** (computed at read time in HistoryService):

```text
paymentStatus     ← payments.payment_status
settlementStatus  ← settlements.settlement_status | 'not_created' | 'not_applicable'
promotionStatus   ← 'committed' | 'pending' | 'not_applicable' (derived from usage tables + reconciliation queue)
```

**Do not store** duplicated effect flags on `payments.metadata`.

## 7.3 `settlements`

- Insert async post-verify.
- **Unique partial index:** `UNIQUE (payment_id) WHERE order_type = 'warmpawz_pay' AND payment_id IS NOT NULL`

## 7.4 `promotion_usages` / `coupon_usages`

- Add nullable `payment_id UUID REFERENCES payments(id)`.
- **Unique partial index (if promo applied):** one usage row per `payment_id` per promotion type.

## 7.5 `transactions`

- Extend `transaction_category` CHECK with `'warmpawz_pay'`.
- Write async; existence = ledger effect complete.

## 7.6 No new MVP tables

Confirmed. Persistent quote table deferred (see §8).

---

# 8. Quote Architecture & Evolution

## 8.1 MVP: Signed quote tokens (stateless)

**Flow:**

1. `POST /v1/warmpawz-pay/quote` → Discount Engine → build payload → **HMAC-sign** → return `quoteToken`.
2. `POST /v1/warmpawz-pay/initiate` → verify signature + expiry → create `payments` row.

**Token payload:**

```json
{
  "vendorId": "uuid",
  "customerId": "uuid",
  "originalAmount": 1500.00,
  "payableAmount": 1350.00,
  "discountAmount": 150.00,
  "promoSnapshot": { },
  "issuedAt": "ISO8601",
  "expiresAt": "ISO8601"
}
```

**Stored on payment at initiate:** `metadata.quote_token_hash` (SHA-256 of token) for audit — not the full token.

**Why stateless for MVP:** No Redis/DB quote store; minimal infra; sufficient for single-step Pay Bill.

## 8.2 When to migrate to persistent quote entities

Migrate when **any** of these requirements appear:

| Trigger | Why tokens fail |
|---------|-----------------|
| **Mutable quotes** (admin changes promo mid-checkout) | Signed token is immutable |
| **Multi-step checkout** (QR open session, partial payments) | Need long-lived quote ID |
| **Quote analytics / abandonment funnel** | Need queryable quote records |
| **Wallet split preview** (pay ₹500 wallet + ₹1000 Razorpay) | Need updatable quote state |

## 8.3 Migration path: tokens → persistent quotes

### Phase A (MVP — current)

- Stateless signed `quoteToken`.
- Initiate accepts token only.

### Phase B (dual mode)

- Introduce table `warmpawz_pay_quotes` (future — not MVP):

```text
warmpawz_pay_quotes
  id UUID PK
  customer_id, vendor_id
  original_amount, payable_amount, promo_snapshot JSONB
  status: draft | consumed | expired
  payment_id NULL  -- set on initiate
  expires_at, created_at
```

- Quote API returns **both** `quoteToken` (short TTL) and optional `quoteId` (long TTL).
- Initiate accepts **either** valid token **or** `quoteId` (server loads row, checks status = draft).
- Warmpawz Pay repository dual-read for one release.

### Phase C (deprecate tokens)

- Quote API returns `quoteId` only; server-side session for mobile/web.
- Remove token signer after all clients migrated.
- `metadata.quote_token_hash` → `metadata.quote_id`.

**Compatibility rule:** Payment row always stores reference to quote (`quote_token_hash` or `quote_id`) for audit trail.

---

# 9. API Design

Base: `/v1/warmpawz-pay`

| Method | Path | Auth |
|--------|------|------|
| POST | `/v1/warmpawz-pay/quote` | Customer |
| POST | `/v1/warmpawz-pay/initiate` | Customer |
| POST | `/v1/warmpawz-pay/verify` | Customer |
| GET | `/v1/warmpawz-pay/transactions` | Customer |
| GET | `/v1/warmpawz-pay/transactions/:paymentId` | Customer |
| GET | `/v1/vendor/:vendorId/warmpawz-pay/transactions` | Vendor |
| GET | `/v1/vendor/:vendorId/warmpawz-pay/transactions/:paymentId` | Vendor |
| POST | `/v1/admin/warmpawz-pay/refunds` | Admin |

**Envelope:** `{ success, data }` / `{ success: false, error: { code, message } }`

**Verify response (Final):**

```json
{
  "success": true,
  "data": {
    "paymentId": "uuid",
    "status": "completed",
    "payableAmount": 1350.00,
    "vendorName": "Happy Paws Clinic",
    "completedAt": "2026-07-22T08:32:00Z",
    "downstream": {
      "settlement": "pending",
      "promotion": "pending"
    }
  }
}
```

`downstream` values computed from subsystem tables at read time (may show `pending` seconds after verify — expected).

---

# 10. Payment Lifecycle

## Sync TX (verify)

```
BEGIN
  SELECT payments FOR UPDATE
  IF completed → return idempotent
  VERIFY Razorpay HMAC
  UPDATE payments SET payment_status='completed', razorpay_*, commission snapshot
  INSERT payment_status_history
COMMIT
→ PostPaymentProcessor(paymentId)  // outside TX
```

## Async processor (idempotent per subsystem)

```
1. settlements:     INSERT ... ON CONFLICT (payment_id) DO NOTHING
2. promotion_usages: INSERT IF promo applicable AND NOT EXISTS
3. transactions:    INSERT IF NOT EXISTS for payment_id
4. notifications:   fire via notification service
```

## Reconciliation jobs

| Job | Heals |
|-----|-------|
| `reconcile-pending-payments` | Stale pending → Razorpay poll → complete/fail |
| `reconcile-missing-settlements` | completed payment, no settlement row |
| `reconcile-missing-promo-usage` | completed payment with promo snapshot, no usage row |

---

# 11. Promotion Architecture

- Domain: `WARMPAWZ_PAY` in Discount Engine.
- Quote-time calculation; snapshot on payment at initiate.
- Usage **async** — payment never fails if usage insert fails.
- Status: query `promotion_usages` / `coupon_usages` by `payment_id`.

---

# 12. Settlement Architecture

- Commission snapshot on payment row at verify (sync).
- Settlement row insert **async** — reads snapshot from payment, does not recompute.
- Payout: daily batch on `settlements WHERE order_type = 'warmpawz_pay' AND settlement_status = 'pending'`.
- Status: query `settlements` by `payment_id`.

---

# 13. Database Transactions & Idempotency

| Operation | Idempotency key |
|-----------|-----------------|
| Initiate | `(customer_id, idempotency_key)` unique partial index |
| Verify | `payment_id` + status guard |
| Webhook | `razorpay_payment_id` |
| Settlement insert | `UNIQUE(settlements.payment_id) WHERE order_type=warmpawz_pay` |
| Promo usage | `UNIQUE(promotion_usages.payment_id)` where applicable |

---

# 14. Error Handling & Security

- Payment verify fails only on HMAC invalid, amount mismatch, or DB error on payment row itself.
- Promo/settlement/ledger failures → reconciliation retry — never roll back payment.
- Quote token HMAC prevents amount tampering.
- Rate limits: quote 30/min, initiate 10/min, verify 10/min per customer.
- Webhook: signature validated before dispatcher delegates to Warmpawz Pay.

---

# 15. Logging & Monitoring

**Metrics:**

- `warmpawz_pay.verify.success|failure`
- `warmpawz_pay.settlement.missing` (reconciliation fixed count)
- `warmpawz_pay.promo_usage.missing`
- `warmpawz_pay.downstream.lag_seconds` (completed → settlement row exists)

**Alerts:**

- Completed payment without settlement row > 10 min
- Promo usage missing > 30 min for payments with `discount_amount > 0`

---

# 16. Event-Driven Roadmap

| MVP (in-process async) | Post-MVP (SQS/EventBridge) |
|------------------------|----------------------------|
| Settlement insert | `PaymentCompleted` → settlement consumer |
| Promo usage | `PaymentCompleted` → promo consumer |
| Notifications | `PaymentCompleted` → notification consumer |
| Admin ledger | `PaymentCompleted` → ledger consumer |

---

# 17. Sprint Breakdown

| Sprint | Focus |
|--------|-------|
| 1 | Schema (`payment_source` no default), domain module, quote token, Discount Engine domain |
| 2 | Initiate + verify + PostPaymentProcessor + Pay Bill UI |
| 3 | History APIs + reconciliation jobs + vendor UI |
| 4 | Admin refund, notifications, security, load test |
| 5 | Prod rollout, dashboards, runbooks, feature flag |

---

# 18. Architectural Decision Log

| ADR | Decision |
|-----|----------|
| ADR-001 | `payment_source NOT NULL` **without DEFAULT** — explicit per bounded context |
| ADR-002 | Defer `source_entity_id` until parent aggregate exists |
| ADR-003 | Module-local `RazorpayAdapter`; defer platform `PaymentGatewayService` |
| ADR-004 | Async settlement accrual with reconciliation |
| ADR-005 | Async promo usage; payment never fails on promo |
| ADR-006 | **Subsystem-owned effect state** — not `payments.metadata.effects` |
| ADR-007 | MVP quotes = signed tokens; persistent quotes when mutable/multi-step needed |

---

# 19. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Missing `payment_source` on insert | NOT NULL no DEFAULT + repository guard + unit test |
| Completed payment, no settlement | Reconciliation job + alert |
| verify/webhook race | `FOR UPDATE` on payment |
| Duplicate settlement/promo rows | Unique partial indexes |
| Token secret compromise | Key rotation with dual-key verify window |

---

# 20. Final Diagrams

## Component diagram

```
Warmpawz Pay BC
├── QuoteService ──────────► Discount Engine
├── PaymentOrchestrator ───► RazorpayAdapter ──► razorpay-client
│         │ sync verify
│         └──► PostPaymentProcessor
│                    ├──► settlements (status owner)
│                    ├──► promotion_usages (status owner)
│                    ├──► transactions (status owner)
│                    └──► NotificationService (delivery log owner)
├── HistoryService ────────► composes read model from subsystem tables
└── ReconciliationJobs
```

## Database relationships

```
payments (payment_source='warmpawz_pay', set explicitly)
   ├── payment_status_history
   ├── settlements (payment_id)     ← settlement status lives here
   ├── promotion_usages (payment_id) ← promo status lives here
   └── transactions (payment_id)    ← ledger status lives here

bookings ──X──  vendor_earnings ──X──
```

---

# 21. Approved Recommendations Summary

## Keep

- Independent bounded context
- Extend `payments` hub; no MVP transaction table
- `payment_source` discriminator (**explicit, no default**)
- Async post-commit effects + reconciliation
- Signed quote tokens for MVP
- Reuse `settlements` / `payouts` / `refunds`
- Never use booking monolith payment handlers or `vendor_earnings`

## Modify (from V2 → Final)

- Remove DEFAULT from `payment_source`
- Remove `metadata.effects` — subsystem tables own state
- Add quote evolution path documentation
- Add Dependency Rules + Testing Strategy sections

## Remove

- `source_entity_id` at MVP
- Platform PaymentGatewayService extraction from Sprint 1
- Sync settlement/promo in verify TX
- Fail-verify on promo errors

## Add

- Repository enforcement of explicit `payment_source`
- `reconcile-missing-promo-usage` job
- Composite `downstream` status in verify/history API (read from subsystem tables)
- Dependency lint / CODEOWNERS
- Full testing strategy (§24)

---

# 22. Dependency Rules

## 22.1 Purpose

Prevent bounded context erosion. Warmpawz Pay must not become coupled to booking, ecommerce, or the Razorpay monolith. Enforced via code review, optional ESLint `import/no-restricted-paths`, and CI grep checks.

## 22.2 Allowed dependencies (Warmpawz Pay may import)

| Layer | Allowed paths |
|-------|---------------|
| **Payment infra** | `utils/payments/razorpay-client.ts` |
| **Finance** | `finance/commission/*`, `finance/settlement/compute-funding-aware-settlement.ts` |
| **Discount** | `discount-engine/*` (resolver, enums — not booking adapters) |
| **Platform** | `middleware/*`, `database/rds-connection`, `utils/error-tracking` |
| **Notifications** | `endpoints/notification/*` (send only — not CRM logic) |
| **Shared types** | `packages/shared-types`, `packages/api-contracts` |
| **Constants** | `endpoints/constants` (PaymentTransactionStatus enum) |

## 22.3 Forbidden dependencies (Warmpawz Pay must NOT import)

| Path | Reason |
|------|--------|
| `endpoints/payments-enhanced.ts` | Booking-only create |
| `endpoints/razorpay/endpoints/razorpay.razorpay.ts` | Monolith handlers |
| `endpoints/booking/**` | Booking domain |
| `endpoints/ecommerce/**` | Ecommerce domain |
| `endpoints/pharmacy-orders.ts` | Pharmacy domain |
| `endpoints/meal-plans.ts` | Meal domain |
| `utils/vendor-earnings-on-completion.ts` | Booking accrual |
| `utils/payment-reconciliation.ts` (booking) | Booking-specific reconcile |
| `utils/booking-payment-sources.ts` | Booking display |

## 22.4 Inbound dependencies (others → Warmpawz Pay)

| Caller | Allowed | Pattern |
|--------|---------|---------|
| `handler/index.ts` | Yes | `registerWarmpawzPayRoutes(app)` only |
| Shared webhook router | Yes | Calls `WarmpawzPayWebhookHandler.handle(event)` — **one function export** |
| Booking / ecommerce / admin | **No** | Must not import Warmpawz Pay services |

## 22.5 Database access rules

| Rule | Detail |
|------|--------|
| Writes to `payments` | Only via `PaymentIntentRepository`; always `payment_source = 'warmpawz_pay'` |
| Reads from `payments` | Filter `WHERE payment_source = 'warmpawz_pay'` in every query |
| Writes to `settlements` | Only `order_type = 'warmpawz_pay'` |
| No writes | `bookings`, `orders`, `vendor_earnings`, `ecommerce_order_settlements` |

## 22.6 Layer direction (within module)

```
routes → handlers → application services → domain
                              ↓
                    repositories → RDS
                              ↓
                    infrastructure adapters → external APIs
```

- Domain layer imports nothing from handlers, routes, or repositories.
- Repositories do not import application services.
- Handlers do not import repositories directly (go through services).

## 22.7 CI enforcement (recommended)

```bash
# Example: fail if warmpawz-pay imports forbidden paths
rg "from '.*bookings-enhanced|razorpay\.razorpay|payments-enhanced" \
   backend/lambda/src/endpoints/warmpawz-pay/ && exit 1 || true
```

Add to `package.json` script: `validate:warmpawz-pay-deps`.

---

# 23. Testing Strategy

## 23.1 Test pyramid

```
                    ┌─────────────┐
                    │  E2E (few)  │  Playwright Pay Bill flow
                   ┌┴─────────────┴┐
                   │ Integration    │  Repos + RDS test schema
                  ┌┴───────────────┴┐
                  │ Unit (many)     │  Domain, token signer, adapters
                  └─────────────────┘
```

## 23.2 Unit tests

| Target | Cases |
|--------|-------|
| `QuoteTokenSigner` | Valid sign/verify, expired token, tampered payload, wrong secret |
| `BillAmount` validator | Min/max bounds, decimal precision |
| `CommissionSnapshot` / settlement calc | Funding-aware splits with mocked tier rates |
| `PaymentVerificationDomainService` | HMAC valid/invalid (mock adapter) |
| `PaymentIntentRepository` (mocked DB) | Insert always includes `payment_source = 'warmpawz_pay'` |
| `HistoryService.computeDownstreamStatus` | Derives settlement/promo status from subsystem row presence |

**Location:** `backend/lambda/src/endpoints/warmpawz-pay/**/__tests__/`

## 23.3 Integration tests

| Target | Setup |
|--------|-------|
| PaymentIntentRepository | Dev/test RDS or transactional test container |
| SettlementAccrualRepository | Verify unique constraint on `payment_id` |
| PostPaymentProcessor | Seed completed payment → run processor → assert rows in `settlements`, `promotion_usages` |
| Idempotent processor retry | Run processor twice → single settlement row |

**Script:** `backend/lambda/scripts/warmpawz-pay-integration-smoke.js` (new — follow customer smoke pattern).

## 23.4 API / contract tests

| Target | Tool |
|--------|------|
| Zod DTO round-trip | Jest + sample payloads |
| OpenAPI parity (optional) | Generated from Zod |
| Error envelope shape | Every error code returns `{ success: false, error: { code, message } }` |

## 23.5 End-to-end tests

| Flow | Tool | Environment |
|------|------|-------------|
| Pay Bill happy path | Playwright (`tests/playwright/`) | Dev API + UAT Razorpay |
| Quote → initiate → verify | Playwright | Dev |
| Vendor history shows payment | Playwright | Dev |
| Invalid coupon at quote | Playwright | Dev |

**UAT OTP / Razorpay test mode** per `deployment.mdc` dev environment.

## 23.6 Concurrency & idempotency tests

| Scenario | Expected |
|----------|----------|
| Duplicate `POST /verify` with same payload | Single completed payment; single settlement row |
| Concurrent verify + webhook | One completed; one settlement (FOR UPDATE) |
| Duplicate initiate with same idempotency key | Same `paymentId` returned |
| Initiate with different key, same quote token consumed | Second rejected or new payment per policy |

## 23.7 Reconciliation tests

| Job | Test |
|-----|------|
| `reconcile-missing-settlements` | Seed completed payment without settlement → job creates row |
| `reconcile-missing-promo-usage` | Seed payment with discount, no usage → job creates usage |
| `reconcile-pending-payments` | Seed pending + mock Razorpay paid → job completes payment |

## 23.8 Regression guards

| Guard | Purpose |
|-------|---------|
| `validate:warmpawz-pay-deps` | Forbidden imports |
| Repository insert test | `payment_source` always explicit |
| Booking smoke suite unchanged | No monolith regression |
| `npm run validate:customer-layers` | If touching shared handler registration |

## 23.9 Performance tests (Sprint 5)

| Target | Threshold |
|--------|-----------|
| Quote p95 | < 300 ms @ 50 RPS |
| Verify p95 | < 200 ms @ 30 RPS |
| PostPaymentProcessor lag p95 | < 5 s (in-process async) |

Tool: k6 script in `tests/load-testing/warmpawz-pay-load.js` (optional).

## 23.10 Test data fixtures

```json
{
  "vendor": { "id": "...", "pay_bill_enabled": true, "bank_verified": true },
  "customer": { "id": "...", "jwt": "..." },
  "promo": { "couponCode": "WARM10", "vendorId": "..." },
  "amounts": { "original": 1500, "payable": 1350 }
}
```

Store in `backend/lambda/scripts/_warmpawz-pay-smoke-fixtures.json` (gitignored secrets; committed structure only).

## 23.11 Definition of Done (testing)

- [ ] Unit tests for token signer, amount validation, downstream status computation
- [ ] Integration smoke passes on dev RDS
- [ ] Playwright Pay Bill E2E green
- [ ] Idempotency scenarios covered
- [ ] Reconciliation jobs tested with injected gaps
- [ ] No forbidden dependency imports
- [ ] Manual UAT checklist signed on dev CloudFront customer app

---

# 24. Engineering Sign-Off Checklist

Before Sprint 1 PR merge:

- [ ] Schema migration reviewed: `payment_source NOT NULL` without DEFAULT
- [ ] `PaymentIntentRepository` rejects inserts without explicit `payment_source`
- [ ] Dependency rules documented and CI check added
- [ ] PostPaymentProcessor idempotency verified by integration test
- [ ] Reconciliation jobs scheduled in dev
- [ ] Feature flag `WARMPAWZ_PAY_ENABLED` defined
- [ ] Runbook draft for ops (payout failure, missing settlement)

---

**Document end.**

**Authoritative blueprint:** This file (`WARMPAWZ_PAY_TECHNICAL_ARCHITECTURE_FINAL.md`) is the single source of truth for Warmpawz Pay implementation. V1 and V2 are historical reference only.
