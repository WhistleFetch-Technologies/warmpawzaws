# Vendor Earnings & Settlement Integration Fixes

## Date: 2026-01-27
## Review: Complete vendor earnings, tier-based commission, and Razorpay settlement integration

---

## 📋 Latest Updates (2026-01-27)

### Tier-Based Commission System
1. **Commission calculated from vendor tier** - Uses `vendor_tiers` table for commission rates
2. **Tier upgrade payment options**:
   - Direct payment via Razorpay
   - Deduction from first 2 settlements
3. **Clear settlement breakup** showing why, what, and how each amount is calculated

### New Database Tables
- `tier_upgrade_deductions` - Tracks tier costs to be recovered from settlements
- `tier_deduction_transactions` - Individual deduction transactions

### New API Endpoints
- `POST /vendor/:vendorId/tier/upgrade` - Upgrade tier with payment method selection
- `GET /vendor/:vendorId/tier/deductions` - View pending tier deductions
- `GET /vendor/:vendorId/settlements/:settlementId/breakup` - Detailed settlement breakup

---

## 🔍 Gaps Identified

### 1. **Missing vendor_earnings Record Creation**
- **Issue**: When a booking was completed, no `vendor_earnings` record was being created immediately
- **Impact**: Earnings were calculated on-the-fly from bookings table, but no persistent record existed
- **Fix**: Added immediate `vendor_earnings` record creation when booking is completed

### 2. **Settlement Processor Using Wrong Razorpay Account Field**
- **Issue**: Settlement processor was looking for `razorpay_linked_account_id` but vendors have `razorpay_account_id`
- **Impact**: Settlements would fail even when vendor had configured Razorpay account
- **Fix**: Updated to use `razorpay_account_id` with fallback to `razorpay_linked_account_id`

### 3. **Missing Bank Account Verification Check**
- **Issue**: Settlement processor didn't verify bank account was verified before processing
- **Impact**: Could attempt to transfer to unverified bank accounts
- **Fix**: Added explicit `bank_verified` check before processing settlement

### 4. **Missing Dedicated Earnings Endpoint**
- **Issue**: No dedicated `/vendor/:id/earnings` endpoint reading from `vendor_earnings` table
- **Impact**: Frontend had to calculate earnings from bookings, not from actual earnings records
- **Fix**: Created new endpoint that reads from `vendor_earnings` table with proper filtering

### 5. **Incorrect Razorpay Transfer API Usage**
- **Issue**: Settlement processor tried to use `razorpayClient.transfers.create()` which doesn't exist
- **Impact**: Transfers would fail with method not found errors
- **Fix**: Updated to use `razorpayRequest('/transfers', 'POST', ...)` directly

### 6. **Missing vendor_earnings Update on Settlement Completion**
- **Issue**: When settlement completed, `vendor_earnings` status wasn't updated to 'paid_out'
- **Impact**: Earnings would show as 'settled' even after money was transferred
- **Fix**: Added update to mark earnings as 'paid_out' when settlement completes

---

## ✅ Fixes Implemented

### 1. **vendor-booking-actions.ts**
- ✅ Added `vendor_earnings` record creation immediately after booking completion
- ✅ Calculates commission using vendor tier commission rate
- ✅ Updates vendor's `pending_payout` and `total_earnings` fields
- ✅ Queues settlement for automatic processing
- ✅ Handles both in-person and tele consultation bookings

### 2. **settlement-processor.ts**
- ✅ Fixed to use `razorpay_account_id` (correct field from onboarding)
- ✅ Added bank account verification check before processing
- ✅ Fixed Razorpay transfer API call to use `razorpayRequest` directly
- ✅ Updates `vendor_earnings` status to 'paid_out' when settlement completes
- ✅ Updates vendor's `pending_payout` to reduce by settled amount
- ✅ Links `vendor_earnings` records with settlement IDs

### 3. **vendor-dashboard-enhanced.ts**
- ✅ Added new `GET /vendor/:vendorId/earnings` endpoint
- ✅ Reads from `vendor_earnings` table (not calculated from bookings)
- ✅ Returns proper earnings summary with status breakdown
- ✅ Includes bank verification status and Razorpay account info
- ✅ Supports period filtering (day, week, month, year, lifetime)

---

## 📊 Data Flow After Fixes

### Booking Completion Flow:
```
1. Vendor completes booking (POST /vendor/bookings/:id/complete)
   ↓
2. Booking status updated to 'completed'
   ↓
3. vendor_earnings record created immediately:
   - Calculates commission from vendor tier
   - Stores vendor_amount, commission_amount, total_amount
   - Status: 'pending'
   - realized_at: NOW()
   ↓
4. Vendor's pending_payout and total_earnings updated
   ↓
5. Settlement queued to SQS
   ↓
6. Settlement processor picks up message
   ↓
7. Checks:
   - vendor.razorpay_account_id exists
   - vendor.bank_verified === true
   ↓
8. Creates settlement record
   ↓
9. Links vendor_earnings.settlement_id
   ↓
10. Creates Razorpay transfer via Route API
    ↓
11. Updates settlement status to 'completed'
    ↓
12. Updates vendor_earnings.status to 'paid_out'
    ↓
13. Reduces vendor.pending_payout by settled amount
```

---

## 🔐 Bank Account Verification Flow

### Verification Requirements:
1. ✅ Vendor must have `razorpay_account_id` (created during onboarding)
2. ✅ Vendor must have bank account added via `/razorpay/linked-account/bank`
3. ✅ Bank account must be verified (`bank_verified === true`)
4. ✅ Settlement processor checks verification before processing

### Verification Process:
```
1. Vendor adds bank account details
   ↓
2. Razorpay penny drop verification initiated
   ↓
3. Verification status checked via `/razorpay/linked-account/verify-bank`
   ↓
4. vendor.bank_verified updated to true when verified
   ↓
5. Settlements can now be processed automatically
```

---

## 📝 API Endpoints

### New/Updated Endpoints:

#### `GET /vendor/:vendorId/earnings?period=month`
- **Purpose**: Get vendor earnings from `vendor_earnings` table
- **Returns**:
  - Total earnings summary
  - Pending settlement amount
  - Settled amount
  - Paid out amount
  - Transaction list with booking details
  - Bank verification status
  - Razorpay account ID

#### `POST /vendor/bookings/:bookingId/complete`
- **Updated**: Now creates `vendor_earnings` record immediately
- **Returns**: Booking with earnings information

---

## 🗄️ Database Tables Used

### `vendor_earnings`
- Stores earnings per booking
- Links to `bookings`, `settlements`, `payouts`
- Tracks status: `pending` → `settled` → `paid_out`

### `settlements`
- Stores settlement records
- Links to `vendor_earnings` via `settlement_id`
- Tracks Razorpay transfer IDs

### `vendors`
- `pending_payout`: Amount pending settlement
- `total_earnings`: Lifetime earnings
- `razorpay_account_id`: Razorpay linked account ID
- `bank_verified`: Bank account verification status

---

## ⚠️ Important Notes

1. **Bank Account Verification is Required**: Settlements will not process if `bank_verified !== true`

2. **Commission Calculation**: Uses vendor tier commission rate from:
   - Active tier subscription (priority 1)
   - Vendor's current tier (priority 2)
   - Default tier (priority 3)
   - Fallback: 10%

3. **Settlement Queue**: Uses SQS for async processing to avoid blocking booking completion

4. **Razorpay Route API**: Transfers are created from payments to linked accounts. The payment ID from the booking is included in transfer notes.

5. **Error Handling**: If settlement fails, booking completion still succeeds. Settlement can be retried manually or via cron job.

---

## 🧪 Testing Checklist

- [ ] Complete a booking with payment_status='paid'
- [ ] Verify `vendor_earnings` record is created
- [ ] Verify vendor's `pending_payout` is updated
- [ ] Verify settlement is queued
- [ ] Verify settlement processor creates Razorpay transfer
- [ ] Verify `vendor_earnings.status` updates to 'paid_out'
- [ ] Verify `GET /vendor/:id/earnings` returns correct data
- [ ] Test with unverified bank account (should fail gracefully)
- [ ] Test with missing Razorpay account (should fail gracefully)
- [ ] Verify tele consultation bookings also create earnings

---

## 📋 Remaining Considerations

1. **Mock Data Removal**: Check frontend components for any remaining mock earnings data
2. **Error Notifications**: Consider adding notifications when settlement fails
3. **Settlement Retry Logic**: May need automatic retry for failed settlements
4. **Audit Trail**: Consider adding more detailed logging for financial operations
5. **Reconciliation**: May need periodic reconciliation job to verify earnings match settlements

---

## 💰 Tier-Based Commission System

### Tier Configuration (from `vendor_tiers` table)

| Tier | Commission Rate | Monthly Fee | Yearly Fee |
|------|-----------------|-------------|------------|
| Bronze (Free) | 15% | ₹0 | ₹0 |
| Silver | 12% | ₹999 | ₹9,990 |
| Gold | 10% | ₹2,499 | ₹24,990 |
| Platinum | 8% | ₹4,999 | ₹49,990 |

### Commission Lookup Priority
1. Active `vendor_tier_subscriptions` record
2. Vendor's current tier from `vendors.tier` column
3. Default tier (Bronze) as fallback

### Tier Upgrade Payment Options

#### Option 1: Direct Payment (via Razorpay)
```
POST /vendor/:vendorId/tier/upgrade
{
  "newTier": "Gold",
  "paymentMethod": "upfront",
  "subscriptionPeriod": "monthly",
  "razorpayPaymentId": "pay_xxx",
  "razorpayOrderId": "order_xxx"
}
```

#### Option 2: Settlement Deduction
```
POST /vendor/:vendorId/tier/upgrade
{
  "newTier": "Gold",
  "paymentMethod": "settlement_deduction",
  "subscriptionPeriod": "monthly"
}
```
- Tier cost is split across first 2 settlements
- Deduction shown in settlement breakup

---

## 📊 Settlement Breakup Example

### API Response (`GET /vendor/:vendorId/settlements/:id/breakup`)

```json
{
  "breakup": {
    "booking": {
      "label": "Booking Amount",
      "amount": 1500,
      "explanation": "Total amount charged to customer for this service"
    },
    "commission": {
      "label": "Platform Commission (10%)",
      "amount": 150,
      "explanation": "Platform fee based on your Gold tier. Lower tiers have higher commission.",
      "how": "₹1500 × 10% = ₹150.00"
    },
    "tierDeduction": {
      "label": "Tier upgrade recovery (1/2)",
      "amount": 1250,
      "explanation": "Recovering tier upgrade cost from your earnings. This amount is being deducted from your first 2 payouts.",
      "how": "Tier upgrade cost ÷ 2 installments = ₹1250.00 per payout",
      "remaining": 1249,
      "installmentNumber": 1,
      "totalInstallments": 2
    },
    "netPayout": {
      "label": "Net Amount to Bank",
      "amount": 100,
      "explanation": "This amount will be credited to your verified bank account",
      "how": "Booking (₹1500) - Commission (₹150) - Tier Recovery (₹1250) = ₹100.00"
    },
    "summary": {
      "tierName": "Gold",
      "commissionRate": 10,
      "tierBenefit": "Gold tier gives you 10% commission rate"
    }
  },
  "explanation": {
    "title": "How Your Settlement Was Calculated",
    "steps": [
      {
        "step": 1,
        "title": "Booking Amount",
        "description": "Customer paid ₹1500 for this service"
      },
      {
        "step": 2,
        "title": "Platform Commission",
        "description": "As a Gold tier vendor, you pay 10% commission (₹150.00)",
        "tip": "Tip: Upgrade to Platinum tier to reduce your commission rate!"
      },
      {
        "step": 3,
        "title": "Tier Upgrade Deduction",
        "description": "₹1250.00 deducted for tier upgrade cost recovery",
        "note": "Remaining: ₹1249.00"
      },
      {
        "step": 4,
        "title": "Your Earnings",
        "description": "₹100.00 credited to your bank account"
      }
    ]
  }
}
```

---

## ✅ Summary

All critical gaps in the vendor earnings and settlement flow have been addressed:

1. ✅ Earnings records created immediately on booking completion
2. ✅ Settlement processor uses correct Razorpay account field
3. ✅ Bank verification checked before settlement
4. ✅ Dedicated earnings endpoint created
5. ✅ Razorpay transfer API usage corrected
6. ✅ Earnings status updated throughout settlement lifecycle
7. ✅ **Commission calculated from vendor tier** (from `vendor_tiers` table)
8. ✅ **Tier upgrade with payment options** (upfront OR settlement deduction)
9. ✅ **Tier cost recovery from first 2 settlements**
10. ✅ **Detailed settlement breakup** with clear explanations (why/what/how)

The system now properly tracks earnings from booking completion through settlement to payout, with:
- Tier-based commission calculation
- Tier upgrade cost recovery from settlements
- Detailed breakup of every deduction
- Clear explanations for vendors to understand their earnings

---

## Admin–Vendor alignment (2026-01-30)

Settlement and earnings data are now aligned between admin and vendor so there is no mismatch in calculation, attributes, or functionality.

### Backend alignment

1. **Settlements table columns**
   - DB uses `total_amount`, `vendor_amount`, `commission_amount` (from settlement-processor).
   - Admin `GET /settlements` and `GET /settlements/summary` now read both naming styles: `gross_amount ?? total_amount`, `net_amount ?? vendor_amount`, so admin views work regardless of which columns exist.

2. **Vendor `GET /vendor/:vendorId/settlements`**
   - Response per settlement: `grossAmount` (from `total_amount`), `netAmount` (from `vendor_amount`), `amount` (same as net), `commissionAmount`, `tierDeduction`, `status`.
   - Summary aligned with admin semantics: `pendingAmount`, `processingAmount`, `completedAmount`, `totalSettled`, `pending`, `processing`, `completed` (counts).

3. **Vendor `GET /vendor/:vendorId/earnings`**
   - Response includes: `totalEarnings`, `pendingSettlement`, `thisPeriod`, `transactions`, `totalBookings`, `completedBookings`, `averageBookingValue` (same semantics as admin).
   - Frontend must read from `response.earnings` (e.g. `response.earnings.totalEarnings`, `response.earnings.thisPeriod` for period-specific totals).

### Frontend alignment

4. **VendorEarningsSettlementDashboard**
   - `loadEarnings` reads from `response.earnings` and maps: `today` ← `earnings.thisPeriod` (period=day), `thisWeek` ← period=week, `thisMonth` ← period=month, `totalEarnings` / `pendingSettlement` / `totalBookings` / `completedBookings` / `averageBookingValue` from lifetime response.
   - Settlement list uses `settlement.grossAmount ?? settlement.gross_amount`, `settlement.netAmount ?? settlement.net_amount ?? settlement.amount`.
   - Analytics summary uses `summary.pendingAmount`, `summary.processingAmount` (with snake_case fallbacks).

5. **VendorCapabilityDashboard (EarningsSection)**
   - `loadEarnings` updated to use `response.earnings` (e.g. `earningsRes.earnings.totalEarnings`, `earningsRes.earnings.thisPeriod`).

6. **VendorEarningsPage**
   - Already uses `earningsRes.earnings`; no change.

### Single source of truth

- **Settlements**: One `settlements` table; admin and vendor both query it (admin: all vendors, vendor: `vendor_id = :id`). Same columns and aggregation logic.
- **Earnings**: `vendor_earnings` table; vendor earnings API reads from it; admin can aggregate from same table or from settlements for payouts.
- **Attributes**: Vendor APIs return camelCase (`grossAmount`, `netAmount`, `pendingAmount`, etc.); UIs accept camelCase with snake_case fallbacks so both shapes work.
