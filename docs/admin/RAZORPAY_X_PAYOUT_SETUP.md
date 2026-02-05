# RazorpayX Payout Setup (Vendor Payouts)

Admin **Process** payouts (and any flow that sends money to vendors’ bank accounts via the **Razorpay Payouts API**) require a **RazorpayX Current Account** as the **source account**. This is separate from the **Marketplace/Route API** (which splits payments to linked accounts at payment time).

---

## Two ways to pay vendors

| Method | When it’s used | Needs RazorpayX Current Account? |
|--------|----------------|-----------------------------------|
| **Route (Marketplace)** | Auto settlement when vendor has linked account and payment had a transfer | No – money goes from payment → linked account |
| **Payouts API (RazorpayX)** | Admin “Process” payout, settlement process by ID, vendor request payout | **Yes** – you pay from your RazorpayX Current Account to any bank |

So for **admin-triggered payouts** (and similar flows), you must set up RazorpayX and configure the **source account**.

---

## 1. RazorpayX setup (what to do in Razorpay)

1. **Enable RazorpayX**
   - Use the same Razorpay account as your payments (same `keyId` / `keySecret`).
   - Go to [RazorpayX Dashboard](https://x.razorpay.com/) (or **Banking** in the main Razorpay dashboard).

2. **Open a Current Account**
   - In RazorpayX: **Banking → Current Account** (or **RazorpayX Current Account**).
   - Complete KYC if asked.
   - This is the **source** account from which payouts are debited.

3. **Get the Customer Identifier (account number)**
   - Go to **My Account & Settings → Banking**.
   - Find **Customer Identifier** (or **Current Account number**).
   - Example format: `7878780080316316` (numeric string).
   - **Test vs Live:** This value is different in Test and Live mode; use the one that matches your API keys.

4. **Fund the account**
   - Payouts are debited from this account. Add balance (e.g. via bank transfer) so payouts can succeed.

5. **Allowlist IPs (required for Payouts API)**
   - Razorpay requires **IP allowlisting** for payout requests.
   - In RazorpayX: **Settings / Security → Allowlist IP** (or similar).
   - Add the **outbound IPs** of your Lambda (e.g. NAT Gateway IPs or AWS IP ranges used by your Lambda).
   - Without this, payout API calls can fail (e.g. 404 / “not found”).

6. **Idempotency key**
   - The app already sends an idempotency key for payout creation. No extra action needed.

---

## 2. Configure the source account in Warmpawz

The app needs the **RazorpayX Current Account number** (Customer Identifier) in one of these places.

### Option A: AWS Secrets Manager (recommended)

1. Open the same secret you use for Razorpay (e.g. `warmpawz/dev/razorpay`).
2. Ensure the JSON has `keyId` and `keySecret`. Add:
   - **`razorpayXAccountNumber`** (or **`xAccountNumber`**) = your **Customer Identifier** from step 3 above.

Example secret value:

```json
{
  "keyId": "rzp_test_...",
  "keySecret": "...",
  "webhookSecret": "...",
  "razorpayXAccountNumber": "7878780080316316"
}
```

3. Save the secret. Lambda will use it on the next payout request (no code change needed).

### Option B: Lambda environment variable

1. In AWS Lambda console (or your IaC), set:
   - **Name:** `RAZORPAY_X_ACCOUNT_NUMBER`
   - **Value:** your RazorpayX **Customer Identifier** (e.g. `7878780080316316`).
2. Redeploy or update the function so the new env is applied.

---

## 3. Summary checklist

- [ ] RazorpayX enabled; Current Account opened and KYC done if required.
- [ ] Customer Identifier copied from **My Account & Settings → Banking**.
- [ ] RazorpayX Current Account funded so payouts can be debited.
- [ ] IP allowlisting done in RazorpayX for your Lambda outbound IPs.
- [ ] `razorpayXAccountNumber` added to the Razorpay secret in Secrets Manager **or** `RAZORPAY_X_ACCOUNT_NUMBER` set on the Lambda.

After this, **Admin → Finance → Payout Management → Process** (and other payout flows that use the Payouts API) will use your RazorpayX Current Account as the source and send money to the vendor’s verified bank account.

---

## 4. References

- [Razorpay Payouts API – Create payout to bank account](https://razorpay.com/docs/api/x/payouts/create/bank-account/)
- [RazorpayX Dashboard](https://x.razorpay.com/)
- [IP allowlisting for Payouts](https://razorpay.com/docs/x/dashboard/allowlist-ip/)
- [Payout idempotency](https://razorpay.com/docs/api/x/payout-idempotency/make-request/)
