# Automatic Payouts – Validation & Existing Verified Accounts

**Date:** 2026-02-05  
**Purpose:** Confirm automatic payout flow and that **existing** verified accounts receive payouts the same way as newly verified ones.

---

## 1. Flow Summary

1. **Settlement run** (cron or Admin → Schedule Settings → Process Now) calls `POST /settlements/calculate-daily`.
2. For each vendor with eligible bookings (by **tier** `payout_period_days`), a **settlement** row is created.
3. If `rules.autoPayout` is true (default), **createPayout(settlementId, vendorId, netAmount)** is called.
4. **createPayout**:
   - Resolves bank from **vendor_bank_accounts** (`is_verified = true`) or **vendor_bank_details** (`is_verified = true`).
   - If no verified bank → skips (no payout row).
   - Inserts a **payout** row (status `pending`).
   - If **RAZORPAY_X_ACCOUNT_NUMBER** is set → calls Razorpay Composite Payout API and updates the payout row to `processing` or `failed`.

---

## 2. Existing Verified Accounts – Confirmation

**Question:** Do vendors who verified their bank **before** this change still get automatic payouts?

**Answer: Yes.** There is no date or “new vs existing” filter.

- **vendor_bank_accounts:**  
  `WHERE vendor_id = $1 AND is_verified = true ORDER BY is_primary DESC LIMIT 1`  
  Any row with `is_verified = true` is used, regardless of when it was verified.

- **vendor_bank_details:**  
  `WHERE vendor_id = $1 AND is_verified = true LIMIT 1`  
  Same: any verified row is used.

So:

- **Existing** verified accounts (verified days/months ago) are picked up the same way.
- **New** verified accounts (verified after this deployment) are picked up the same way.
- The only condition is: at least one bank record with **is_verified = true** for that vendor.

---

## 3. Validation Performed

| Check | Result |
|-------|--------|
| Payout forensic script (`scripts/validate-payout-flow-forensic.js`) | 6/6 passed |
| createPayout bank source | vendor_bank_accounts (is_verified) then vendor_bank_details (is_verified) |
| Date / “new only” filter in createPayout | None – existing and new verified accounts treated the same |
| autoPayout default in calculate-daily | `true` when payout_rules not set |

---

## 4. Requirements for Automatic Disbursal

- **Vendor:** At least one bank record with **is_verified = true** (in `vendor_bank_accounts` or `vendor_bank_details`).
- **Platform:** **RAZORPAY_X_ACCOUNT_NUMBER** set in Lambda env (RazorpayX source account).
- **Platform:** Razorpay credentials (e.g. AWS Secrets Manager) and RazorpayX enabled with IP allowlist.

If **RAZORPAY_X_ACCOUNT_NUMBER** is not set, payout **rows** are still created (status `pending`), and admins can process them manually from Payout Management.

---

*Validation confirms: existing verified accounts will process payouts automatically in the same way as newly verified accounts.*
