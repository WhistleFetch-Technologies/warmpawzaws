# Payout Flow: End-to-End Forensic Validation (360°)

This document describes the full wiring from **earnings to payment** and how to validate it.

**Full forensic report (UI, endpoints, handlers, CRUD, wire flow, dynamic behavior):**  
See [reports/FORENSIC_VALIDATION_SETTLEMENT_PAYOUT_E2E.md](../../reports/FORENSIC_VALIDATION_SETTLEMENT_PAYOUT_E2E.md).

---

## 1. Flow Overview

```
Booking completed (paid)
    → vendor_earnings record (pending → settled)
    → Settlement message to SQS (or scheduled)
    → settlements row (pending)
    → [Auto: Razorpay Route transfer if linked account] OR [Admin: Process → Razorpay Payouts API]
    → payouts row (pending → processing → completed/failed)
    → Vendor’s verified bank account credited (Razorpay)
```

---

## 2. Data & API Wiring

### 2.1 Earnings

| Source | What |
|--------|------|
| **Table** | `vendor_earnings` |
| **Created when** | Booking marked completed (payment paid) in `vendor-booking-actions.ts` |
| **Fields** | `vendor_id`, `booking_id`, `amount`, `commission_amount`, `total_amount`, `status` (`pending` → `settled` → `paid_out`), `settlement_id`, `payout_id` |
| **Also** | `vendors.pending_payout` and `vendors.total_earnings` updated |

### 2.2 Settlements

| Source | What |
|--------|------|
| **Table** | `settlements` |
| **Created when** | SQS settlement processor (`settlement-processor.ts`) after message from booking completion (or cron) |
| **Fields** | `id`, `booking_id`, `vendor_id`, `net_amount` / `vendor_amount`, `status` / `settlement_status` (`pending`, `processing`, `completed`, `failed`), `failure_reason`, `razorpay_transfer_id` (Route) or payout linked via `payouts` |
| **Admin API** | `GET /admin/finance/settlements` – list for Finance tab |
| **Process** | Admin “Process” for a settlement row → `POST /settlements/process` with `{ settlementId }` |

### 2.3 Bank Account (Verified)

| Source | What |
|--------|------|
| **Tables** | `vendor_bank_accounts` (preferred, `is_verified = true`) or `vendor_bank_details` |
| **Used for** | All payouts: admin process, vendor request, bulk process. Only **verified** accounts are used for Razorpay payout. |
| **Razorpay** | Marketplace bank verification (penny drop) → `vendors.bank_verified` and `vendor_bank_accounts.is_verified` |

### 2.4 Payouts

| Source | What |
|--------|------|
| **Table** | `payouts` |
| **Fields** | `id`, `vendor_id`, `amount`, `settlement_id`, `bank_account_number`, `ifsc_code`, `account_holder_name`, `payout_status` (`pending` / `scheduled` → `processing` → `completed` / `failed`), `razorpay_payout_id`, `failure_reason` |
| **Admin API** | `GET /admin/payouts` – list (includes both direct payouts and settlement-sourced rows), `GET /admin/payouts/stats` |
| **Process** | Admin “Process” for a **payout** row → `POST /admin/payouts/:id/process` |

### 2.5 Razorpay

| Path | When | API |
|------|------|-----|
| **Route (transfer)** | Auto settlement when vendor has `razorpay_account_id` and `bank_verified` | `POST /transfers` (Route API) from payment to linked account |
| **Payouts (direct)** | Admin process, vendor request payout, settlement process by `settlementId` | `razorpayClient.payouts.create()` – pays to bank account (IMPS) |

---

## 3. Admin UI Behaviour

- **Finance → Payout Management**:  
  - List from `GET /admin/payouts` (payouts + pending settlements as “payout-like” rows with `source: 'settlement'` and `settlement_id`).
- **Process button**:
  - If row is **settlement-sourced** (`source === 'settlement'` or id like `settlement-*`):  
    `POST /settlements/process` with `{ settlementId }`.
  - Else (direct payout row):  
    `POST /admin/payouts/:id/process`.
- **Status**:  
  `pending` / `scheduled` → Process → `processing`; then Razorpay → `completed` or `failed` (with `failure_reason`). UI shows `failed` as “rejected” where appropriate.

---

## 4. Failure & Ad-hoc Handling

- **Razorpay payout fails**:  
  Backend updates `payouts.payout_status = 'failed'`, `payouts.failure_reason`; for settlement flow also updates `settlements.settlement_status` and `settlements.failure_reason` when applicable.
- **Ad-hoc / manual payout**:  
  Same path: create or use existing payout row, call `payouts.create` with verified bank details; status and failure_reason updated the same way.
- **Vendor has no verified bank**:  
  Process returns error (e.g. “Vendor bank details not found” or “bank not verified”); no payout created.

---

## 5. Validation Checklist (Manual / Automated)

- [ ] **Earnings**: After a paid booking completion, `vendor_earnings` has a row and `vendors.pending_payout` increased.
- [ ] **Settlements**: Pending settlements appear in `GET /admin/finance/settlements` and in Payout Management as settlement-sourced rows.
- [ ] **Bank**: Payout process uses only verified bank (`vendor_bank_accounts.is_verified = true` or equivalent).
- [ ] **Process by settlementId**: `POST /settlements/process` with `{ settlementId: "<uuid>" }` creates payout, calls Razorpay, updates settlement and payout status (and failure_reason on failure).
- [ ] **Process by payout id**: `POST /admin/payouts/:id/process` works for a pending payout row; on Razorpay failure, payout status and failure_reason are set.
- [ ] **Stats**: `GET /admin/payouts/stats` includes pending/processing/completed counts and amounts; pending settlements are included in pending count/amount.

---

## 6. Automated Script

Run the forensic script (uses `API_BASE_URL` or `config/urls.json` / `cdk-outputs.json`):

```bash
API_BASE_URL=https://your-api.execute-api.region.amazonaws.com node scripts/validate-payout-flow-forensic.js
```

This checks:

1. `GET /admin/finance/settlements` – 200, array.
2. `GET /admin/payouts` – 200, array.
3. `GET /admin/payouts/stats` – 200, stats object.
4. `GET /settlements` – valid response.
5. Payout row contract (vendor, amount, status).
6. `POST /settlements/process` with a fake `settlementId` – endpoint accepts body and returns a handled response (200 with results or 404/400).
7. `POST /admin/payouts/:id/process` with invalid id – 400/404 or 200.

---

## 7. Summary

- **Earnings → settlement → payout** are wired through `vendor_earnings`, `settlements`, and `payouts`.
- **Razorpay Marketplace** is used for both Route (auto) and Payouts API (admin/vendor request); payouts go to the **verified bank account** in the vendor profile.
- **Failures and ad-hoc payments** are reflected in `payout_status` and `failure_reason` (and settlement status where applicable).
- Use the checklist and `scripts/validate-payout-flow-forensic.js` for 360° validation.
