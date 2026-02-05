# Settlement System – End-to-End Wireframe

This document traces the complete settlement flow from booking completion to bank credit, including API responses, status updates, and failure handling.

---

## 1. Flow Overview

```
Booking Completed (payment_status=paid)
    → vendor_earnings (status: pending)
    → SQS Settlement Queue
    → settlement-processor Lambda
    → settlements record (status: pending → processing → completed | failed)
    → Razorpay Route API transfer (if automatic)
    → Bank credit (vendor's verified bank account)
    → vendor_earnings (status: paid_out)
    → vendors.pending_payout decremented
```

---

## 2. Trigger: Booking Completion

**Endpoint:** `PATCH /vendor/bookings/:bookingId` or equivalent completion action

**File:** `backend/lambda/src/endpoints/vendor-booking-actions.ts`

- Creates `vendor_earnings` record (status: `pending`)
- Sends message to SQS settlement queue:
  ```json
  {
    "bookingId": "...",
    "vendorId": "...",
    "amount": 500,
    "vendorAmount": 425,
    "commission": 75,
    "trigger": "booking_completed"
  }
  ```

---

## 3. Settlement Processor (Lambda)

**File:** `backend/lambda/src/jobs/settlement-processor.ts`

### 3.1 Process Flow

1. **Check duplicate:** Skip if settlement already exists for booking+vendor
2. **Create settlement record** in `settlements` table:
   - `status: 'pending'`
   - `booking_id`, `vendor_id`, `total_amount`, `commission_amount`, `vendor_amount`
   - Tier deduction applied if applicable
3. **Update vendor_earnings:** `settlement_id` set, `status: 'settled'`
4. **Execute transfer (if automatic):**
   - Requires `vendor.razorpay_account_id` and `vendor.bank_verified = true`
   - Razorpay Route API: `POST /transfers` (payment_id from booking)
   - On success: `settlements.status = 'completed'`, `vendor_earnings.status = 'paid_out'`, `vendors.pending_payout` decremented
   - On failure: `settlements.status = 'failed'`, `settlements.failure_reason = error.message`

### 3.2 Bank Account Requirements

- Vendor must have `razorpay_account_id` (from Razorpay Connect onboarding)
- Vendor must have `bank_verified = true` (verified in Admin or via bank verification flow)

### 3.3 Failure Handling

When transfer fails:
- `settlements.status` = `'failed'`
- `settlements.failure_reason` = error message (e.g. "Vendor X bank account is not verified")
- `settlement_logs` entry with `action: 'transfer_failed'`
- Message goes to DLQ for retry (if configured)

---

## 4. Admin APIs (Finance & Logistics)

### 4.1 GET /admin/finance/settlements

**Returns:** Enriched settlements from `settlements` table

- Joins `vendors` for `vendor_name`
- Status: `pending`, `processing`, `completed`, `failed`
- Includes `failure_reason` for failed settlements

### 4.2 GET /admin/payments/settlements

**Returns:** Same source (`settlements`) with status mapping:

- `pending` / `processing` → `Pending`
- `completed` → `Paid`
- `failed` → `Failed`

Both APIs used by Finance & Logistics settlement tabs.

---

## 5. Vendor APIs

### 5.1 GET /vendor/:vendorId/settlements

**File:** `backend/lambda/src/endpoints/vendor-dashboard-enhanced.ts`

Returns settlements for the vendor with breakup details.

### 5.2 GET /vendor/:vendorId/settlements/:settlementId/breakup

Returns detailed settlement breakup (commission, tier deduction, net payout).

---

## 6. UI Components

| Component | Location | Data Source |
|-----------|----------|-------------|
| SettlementDashboard | Finance → Settlements (main) | /admin/payments/settlements |
| SettlementsTab | Finance Management → Settlements | /admin/finance/settlements |
| VendorEarningsSettlementDashboard | Vendor web | /vendor/:id/settlements |

**Status display:**
- `Paid` (green): completed
- `Pending` (yellow): pending, processing
- `Failed` (red): failed, with `failure_reason` shown

---

## 7. Database Tables

| Table | Purpose |
|-------|---------|
| `settlements` | Main settlement records (status, amounts, failure_reason) |
| `vendor_earnings` | Earnings per booking, links to settlement_id |
| `settlement_logs` | Audit log for transfer success/failure |
| `vendors` | `pending_payout`, `bank_verified`, `razorpay_account_id` |

---

## 8. Testing Checklist

1. **Vendor bank verified:** Ensure vendor has verified bank account in Admin
2. **Complete a paid booking:** Trigger settlement queue
3. **Check settlements table:** New row with status progression
4. **Check Finance & Logistics:** Settlement tab shows correct status (Pending/Paid/Failed)
5. **Simulate failure:** e.g. unverify bank → settlement fails → status `Failed` and `failure_reason` visible in admin
