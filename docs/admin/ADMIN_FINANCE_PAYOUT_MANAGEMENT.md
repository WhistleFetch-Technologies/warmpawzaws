# Payout Management – Admin Guide

## What is Payout Management?

Payout Management is where you **review, approve, and process vendor payouts**. It shows pending, processing, and completed payouts; vendor details; net amount (after commission and TDS); and lets you **Process** or **Reject** payouts. Export to CSV for reconciliation.

---

## How to Use Payout Management

1. Go to **Finance & Logistics** → **Payout Management**.
2. View **stats**: Pending amount/count, Processing amount/count, Completed amount/count.
3. Use **search** (vendor name, phone) and **status filter** (all, pending, processing, completed, rejected) to find payouts.
4. Click a payout to see **details** (amount, commission, TDS, net amount, bank account, period, bookings/orders count).
5. Click **Process** to send the payout to the vendor’s bank (via your payment gateway or bank integration).
6. Click **Reject** to reject a payout (e.g. invalid bank details); provide a reason.
7. Use **Export** to download a CSV for accounting or reconciliation.

---

## Where Payout Management Is Used

| Where | How |
|-------|-----|
| **Settlements** | Settlements (Finance → Settlements) generate payables; Payout Management is where you actually disburse them. |
| **Vendor bank account** | Payouts are sent to the bank account linked to the vendor profile; ensure account is verified. |
| **Payment gateway / bank API** | Process action typically calls your payout API (e.g. Razorpay, bank transfer) to credit the vendor. |
| **TDS** | TDS (if applicable) is deducted before net payout; ensure TDS reports align with payout records. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Process** | Marks payout as processing and triggers the actual transfer to the vendor’s bank. |
| **Reject** | Cancels the payout; vendor does not receive the amount. Use for wrong bank details or disputes. |
| **Status (pending / processing / completed / rejected)** | pending = ready to process; processing = transfer in progress; completed = paid; rejected = cancelled. |
| **Export** | Gives a CSV of payouts for the current view/filters for reconciliation or accounting. |

---

## Tips

- Verify **vendor bank account** (account number, IFSC, account holder) before processing.
- Use **Reject** with a clear reason so support can inform the vendor and fix details.
- Run **Export** regularly for audit and reconciliation with bank statements.
