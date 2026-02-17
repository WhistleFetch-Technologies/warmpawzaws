# Razorpay & Vendor Payout Management – Comparison Analysis

Analysis of vendor payout management and Razorpay integration across customer web, admin, and backend, compared to Razorpay’s recommended model (single account, test vs live keys, marketplace/Route).

---

## 1. How Razorpay Is Intended to Work (Reference)

- **Single Razorpay account**: One dashboard; **Test Mode** and **Live Mode** toggle.
- **Two key pairs**: Test Key ID/Secret (test mode), Live Key ID/Secret (live mode).
- **App responsibility**: Use test keys in dev/staging and live keys in production. Do not mix.
- **Secrets**: Keep `RAZORPAY_KEY_ID_TEST`, `RAZORPAY_KEY_SECRET_TEST`, `RAZORPAY_KEY_ID_LIVE`, `RAZORPAY_KEY_SECRET_LIVE` (or equivalent) and choose by environment.
- **Webhooks**: Separate webhook URLs and **webhook secrets** for test and live.
- **Marketplace/Route**: Same principle – test keys ⇒ test Route/linked accounts; live keys ⇒ live. Do not reuse entity IDs (orders, payments, account_id, fund_account_id) across test and live.

---

## 2. What We Implemented – Credentials & Environment

### 2.1 AWS Secrets Manager (Verified via CLI)

| Secret name              | Purpose        | Contents (structure) |
|--------------------------|----------------|----------------------|
| `warmpawz/dev/razorpay`  | Dev Lambda     | `keyId` / `key_id`, `keySecret` / `key_secret`, `webhookSecret`, `razorpayXAccountNumber` / `xAccountNumber`. Dev uses **test** keys (`rzp_test_...`). |
| `warmpawz/prod/razorpay` | Prod Lambda    | Same JSON shape. Should hold **live** keys (`rzp_live_...`) and live webhook secret. |

- **Separate secrets per environment** ⇒ effectively “separate keys (test/live) in secrets” ✅  
- **Environment chooses key pair**: Lambda env `ENVIRONMENT` (or `STAGE` / `NODE_ENV`) drives which secret is read: `warmpawz/${STAGE}/razorpay` in `secrets-manager.ts`. Prod Lambda has `ENVIRONMENT=prod` → prod secret; dev → dev secret. ✅  

**Gap / risk**: There is no code-level check that dev uses `rzp_test_*` and prod uses `rzp_live_*`. If someone puts live keys in the dev secret, the app would use them. Recommendation: document and/or add a startup or config check (e.g. in dev, assert keyId starts with `rzp_test_`).

### 2.2 Where Credentials Are Loaded

| Component | Source of credentials | Notes |
|-----------|------------------------|--------|
| **razorpay-client.ts** (create-order, verify-payment, refund, Route transfer, bank validation) | 1) Secrets Manager `warmpawz/${STAGE}/razorpay`<br>2) DB `platform_integrations` (razorpay)<br>3) Env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Single `getRazorpayConfig()`; returns `keyId`, `keySecret`, `webhookSecret`, `razorpayXAccountNumber`. ✅ |
| **razorpay-settlements.ts** (linked accounts, Route) | **Only** `process.env.RAZORPAY_KEY_ID` and `process.env.RAZORPAY_KEY_SECRET` | ❌ **Gap**: Does not use Secrets Manager. If Lambda has no Razorpay keys in env (only in secret), linked-account and Route flows in this file will fail (empty auth). |
| **payments-enhanced.ts** (webhook) | **Only** `process.env.RAZORPAY_WEBHOOK_SECRET` | ❌ **Gap**: Webhook secret is not taken from the Razorpay secret JSON. If webhook secret is only in Secrets Manager and not set in Lambda env, webhook verification will fail. |
| **admin-advanced.ts** (payout processing) | **Only** `process.env.RAZORPAY_X_ACCOUNT_NUMBER` | ⚠️ **Inconsistency**: Razorpay client and bank validation use `razorpayXAccountNumber` from secret (or env). Payout flow here only checks env. If X account is only in secret, admin “Process payout” will fail with “not configured”. |

### 2.3 Webhook Secret

- **Razorpay**: Separate webhook endpoints and secrets for test vs live. ✅ We have two secrets (dev/prod), so each can store its own `webhookSecret`.
- **Code**: `payments-enhanced.ts` and `payments.ts` use only `RAZORPAY_WEBHOOK_SECRET` from env. So:
  - Either webhook secret is set in Lambda env for both dev and prod, or
  - Code should be updated to use webhook secret from the same source as keys (e.g. from `getRazorpayConfig().webhookSecret` when available).

### 2.4 RazorpayX Payout Source Account

- **Intended**: One source account (e.g. RazorpayX Current Account) for payouts; configured per environment.
- **Implementation**: 
  - Stored in secret as `razorpayXAccountNumber` / `xAccountNumber` and used by razorpay-client (e.g. bank validation, getRazorpayXAccountNumber).
  - Also read from `RAZORPAY_X_ACCOUNT_NUMBER` in admin payout and in settlements. So we have two sources; if only one is set, some flows work and others don’t. Recommendation: unify on one source (e.g. secret) and have all payout/X-account logic use `getRazorpayConfig()` / `getRazorpayClient().getRazorpayXAccountNumber()`.

---

## 3. Customer Web – Razorpay Usage

- **Flow**: Backend `POST /razorpay/create-order` returns `orderId`, `amount`, `currency`, **`keyId`**. Frontend loads Razorpay checkout script and opens with this `key` (keyId). After payment, frontend calls `POST /razorpay/verify-payment` with `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.
- **Key source**: Backend returns `keyId` from `getRazorpayConfig()` (i.e. from secret for the current env). So **customer web uses the key from the API it talks to** (dev API ⇒ test key, prod API ⇒ live key). ✅  
- **Fallbacks**: Some components use `orderRes.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY` (e.g. UniversalPaymentPage, BookingFlow, EnhancedPaymentPage, PaymentPage, MealOrderCheckout, DiagnosticsBookingFlow, PetResortBookingFlow, PetCafeBookingFlow). A few use only `process.env.NEXT_PUBLIC_RAZORPAY_KEY` (CheckoutView, PharmacyOrderFlow, pharmacy/PharmacyOrderFlow).  
  **Risk**: If `NEXT_PUBLIC_RAZORPAY_KEY` is set to the wrong mode (e.g. live key in dev build) or is the only key used in a flow, test/live can be mixed. **Recommendation**: Prefer `keyId` from create-order everywhere; use `NEXT_PUBLIC_RAZORPAY_KEY` only as fallback for legacy, and ensure dev and prod builds use the correct env (test vs live) for that fallback.

---

## 4. Admin – Payment Gateway, Tiers, Payouts, Refunds

### 4.1 Payment settings (Razorpay in admin)

- **Admin UI**: Finance & Logistics → Payment Settings (or Settings tab). Loads/saves Razorpay via `/admin/payments/gateway-config` (GET/PUT). Data is stored in `payment_gateway_settings` (e.g. `gateway_name = 'razorpay'`, config in JSON).
- **Backend**: `getRazorpayConfig()` prefers Secrets Manager, then DB, then env. So admin-edited DB config is a fallback when secret is not used. ✅  
- **Important**: In production, credentials should live in Secrets Manager (or env), not only in DB, so that dev and prod stay clearly separated (dev secret = test keys, prod secret = live keys).

### 4.2 Tiers (Finance & Logistics → Tiers)

- **Purpose**: Vendor subscription tiers define **commission rate** and **payout period** (and pricing/features).
- **Storage**: `vendor_tiers` (e.g. `tier_name`, `tier_level`, `commission_rate`, `payout_period_days`, etc.). Admin configures tiers in **Tier Management** (Finance & Logistics).
- **Usage**:
  - **Commission**: `getVendorTierCommission(vendorId)` in `razorpay.ts` (and used by vendor-booking-actions) reads from `vendor_tier_subscriptions` → `vendor_tiers`, else `vendors.tier` → `vendor_tiers`, else default tier. Returns `commission_rate` (percentage). ✅  
  - **Create order (Route split)**: When creating a Razorpay order, if vendor has `razorpay_account_id` and `bank_verified`, backend computes `vendorShare = amount - (amount * tierCommission / 100)` and adds `transfers: [{ account: vendor.razorpay_account_id, amount: vendorShare, ... }]`. So **split is driven by tier commission**. ✅  
  - **Settlement**: Same tier-based commission is used when creating settlement records and when initiating Route transfer (in razorpay.ts marketplace settlement handler). ✅  
- **Conclusion**: Tiers correctly define the split; commission and payout period are used end-to-end.

### 4.3 Payouts (Finance & Logistics → Payout Management)

- **Flow**: Admin sees pending payouts; “Process” calls backend (e.g. admin-advanced) which:
  - Reads vendor bank details (account number, IFSC, holder name).
  - Uses **Razorpay Payouts API** (Composite) with **source** = `RAZORPAY_X_ACCOUNT_NUMBER` (env only today).
  - Creates payout with idempotency (payoutId), updates `payouts` with `razorpay_payout_id` and status.
- **Gaps**: 
  - X account number is read only from env; should also use secret (or single source from `getRazorpayConfig()` / getRazorpayClient()).  
  - Credentials for the Payouts API come from razorpay-client (Secrets Manager / DB / env), so they are consistent for that part. ✅  

### 4.4 Refunds (Finance & Logistics → Refund policies / Payments)

- **Policies**: Refund tiers (e.g. hours-before-service, refund %, cancellation fee) are configured in **Refund Policies** and used for customer cancellations and refund processing.
- **Processing**: Refund is executed via Razorpay in `razorpay.ts` (ProcessRefundHandler): `razorpayRequest('/payments/${paymentId}/refund', 'POST', ...)`. Uses same `getRazorpayConfig()` / razorpayRequest. ✅  
- **Settlement after refund**: Logic exists to update settlement/booking state when refunds occur; vendor share and platform share stay consistent with tier and refund rules.

### 4.5 Settlements

- **Creation**: Settlement records are created with commission from `getVendorTierCommission`, vendor share, and optional Razorpay Route transfer when vendor has linked account.
- **Route transfer**: In razorpay.ts marketplace settlement handler, transfer is created with `account: vendor.razorpay_account_id`, `amount: vendorShare` (paise). ✅  
- **Payout from settlement**: When auto-payout or admin “Process” runs, payouts are created and, if RazorpayX is configured, Razorpay Payouts API is called (settlements.ts / admin-advanced). Source account must be set (env or secret as above).

---

## 5. End-to-End Flow Summary

| Step | What happens | Razorpay / config |
|------|----------------|--------------------|
| 1. Customer pays | Customer web → create-order (keyId from backend) → Checkout → verify-payment. | Keys from secret (per env). ✅ |
| 2. Payment captured | Webhook `payment.captured` (payments-enhanced). | Webhook secret from **env only**. ⚠️ |
| 3. Order creation (Route) | If vendor linked + verified, order created with `transfers` to vendor. | Keys from getRazorpayConfig(). ✅ |
| 4. Settlement | Settlement row created; Route transfer to vendor if applicable. | Tier commission; keys from getRazorpayConfig(). ✅ |
| 5. Payout (admin or auto) | Razorpay Payouts API: platform account → vendor bank. | X account from **env only** in admin flow. ⚠️ Keys from config. ✅ |
| 6. Refund | Refund via Razorpay API. | getRazorpayConfig(). ✅ |

---

## 6. Checklist vs Razorpay Recommendations

| Recommendation | Status | Notes |
|----------------|--------|--------|
| Separate keys (test/live) in secrets | ✅ | Two secrets: `warmpawz/dev/razorpay`, `warmpawz/prod/razorpay`. Dev verified with test key prefix. |
| Separate webhook endpoints + secrets for test and live | ✅ | Per-env secret can hold webhookSecret. Code must use it (see gap). |
| Environment flag to choose key pair | ✅ | ENVIRONMENT/STAGE → which secret is read. No explicit “test/live” flag; env implies it. |
| Don’t reuse entity IDs across modes | ✅ | Dev and prod use different DBs and different Razorpay keys ⇒ orders/payments/accounts are naturally separate. |
| Test cards/UPI only in test mode | ✅ | Handled by using test keys in dev; no test cards in live. |

---

## 7. Gaps and Wrong Implementations

1. **razorpay-settlements.ts uses only env for credentials**  
   - Uses `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` directly. If Lambda has no Razorpay keys in env (only in secret), linked-account and Route logic in this file will fail.  
   - **Fix**: Use `getRazorpayConfig()` (or shared `razorpayRequest` from razorpay-client) so credentials come from the same source as the rest of the app.

2. **Webhook secret not read from secret JSON**  
   - `payments-enhanced.ts` (and `payments.ts`) use only `process.env.RAZORPAY_WEBHOOK_SECRET`. If webhook secret is stored only in Secrets Manager, verification will fail.  
   - **Fix**: In webhook handler, get webhook secret from `getRazorpayConfig().webhookSecret` when available, and fall back to `process.env.RAZORPAY_WEBHOOK_SECRET`.

3. **RazorpayX account number source inconsistency**  
   - Payout processing in admin-advanced (and possibly settlements) uses only `RAZORPAY_X_ACCOUNT_NUMBER` from env. razorpay-client and bank validation use secret (or env).  
   - **Fix**: Use `getRazorpayClient().getRazorpayXAccountNumber()` (or equivalent from config) everywhere payouts need the source account, so one source (secret preferred) drives all flows.

4. **Customer web fallback to NEXT_PUBLIC_RAZORPAY_KEY**  
   - Several flows use `orderRes.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY`. A few use only env. Wrong env (e.g. live key in dev) could mix modes.  
   - **Fix**: Prefer key from create-order response in every flow; restrict NEXT_PUBLIC_RAZORPAY_KEY to same env (dev build = test key, prod build = live key) and document.

5. **No validation that dev uses test keys and prod uses live keys**  
   - Purely operational/convention. Optional: add a check (e.g. in dev, assert keyId starts with `rzp_test_`) to avoid accidental misuse.

---

## 8. Logical Map: Tiers → Split → Payout → Refund

- **Tiers** (admin Finance & Logistics → Tiers): Define `commission_rate` and `payout_period_days` per tier. Used for all commission and payout timing.
- **Split**: On payment, platform keeps `commission_rate%`; vendor gets the rest. When Route is used, Razorpay order is created with `transfers` to vendor’s `razorpay_account_id` for that amount. So **tiers define the split**; implementation is correct.
- **Settlement**: Settlement rows store commission and vendor share; Route transfer is created in the same way. Refunds are applied via Razorpay and reflected in booking/settlement state.
- **Payout**: For vendors without Route (or when payout is done via RazorpayX), payouts are created and processed via Razorpay Payouts API from platform RazorpayX account to vendor bank. Tiers’ `payout_period_days` drive when payout cycles run; actual split is already fixed by tier commission.

End-to-end: **Tiers → commission rate → split at order/settlement → payout to vendor (Route or RazorpayX)** and **refund policies → refund amount → Razorpay refund API** are wired correctly. The main issues are **credential and config source consistency** (settlements, webhook, X account), not the business logic of tiers/split/payout/refund.

---

## 9. Recommended Next Steps

1. **Code** (✅ implemented):  
   - **razorpay-settlements.ts**: Now uses shared `getRazorpayClient().request()` for all Razorpay API calls (credentials from Secrets Manager / DB / env).  
   - **Webhook secret**: `payments-enhanced.ts` and `payments.ts` now get webhook secret from `getRazorpayConfig().webhookSecret` with fallback to `RAZORPAY_WEBHOOK_SECRET` env.  
   - **RazorpayX account**: Admin payout (`admin-advanced.ts`) and auto-payout (`settlements.ts`) now use `getRazorpayClient().getRazorpayXAccountNumber()` with fallback to `RAZORPAY_X_ACCOUNT_NUMBER` env.

2. **Config**:  
   - Ensure dev Lambda has `ENVIRONMENT=dev` and prod has `ENVIRONMENT=prod`.  
   - Ensure each Lambda has the correct Razorpay secret (and, if used, webhook secret and X account in that secret or in env consistently).  
   - Ensure prod secret contains live keys and live webhook secret; dev secret contains test keys and test webhook secret.

3. **Customer web**:  
   - Prefer `keyId` from create-order in every payment flow; document and audit `NEXT_PUBLIC_RAZORPAY_KEY` per environment (test vs live).

4. **Ops**:  
   - Optionally add a small startup or config check that in dev, Razorpay keyId starts with `rzp_test_`, and in prod with `rzp_live_`, to catch misconfiguration early.
