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

## Confirmation: What RAZORPAY_X_ACCOUNT_NUMBER is

| Concept | Meaning |
|--------|--------|
| **RAZORPAY_X_ACCOUNT_NUMBER** | **Your (platform’s) RazorpayX Current Account** – the **source** account. Money is **debited from this account**. |
| **Vendor bank account** | Stored per vendor in `vendor_bank_accounts` (verified). Each vendor has **their own** bank account and **their own** settlement amount. |
| **Each payout** | One transfer: **from** your RazorpayX account **to** one vendor’s verified bank account, for **that vendor’s** settlement amount (in INR). |

So: **one platform source account** (RAZORPAY_X_ACCOUNT_NUMBER) → **many vendor destination accounts**, each with its own amount. Same conditions for automatic disbursal apply to every verified vendor.

---

## Conditions for automatic disbursal (same for all verified vendors)

| Requirement | Notes |
|-------------|--------|
| **Vendor has verified bank** | At least one row with `is_verified = true` in `vendor_bank_accounts` (or `vendor_bank_details` with `is_verified`). Primary account is used if multiple are verified. |
| **RAZORPAY_X_ACCOUNT_NUMBER set** | Lambda env **or** in Razorpay secret as `razorpayXAccountNumber` / `xAccountNumber`. This is **your** RazorpayX source account. If missing, only payout rows are created (status `pending`); admin can process manually later once the account is configured. |
| **Razorpay API credentials** | `keyId` and `keySecret` (e.g. from AWS Secrets Manager) for the **Composite Payout API**. Same secret can hold `razorpayXAccountNumber`. |
| **autoPayout enabled** | From `admin:settings:payout_rules` in platform_settings. Default is **true** when not set – so after a settlement is created, the system will try to create a payout and, if RAZORPAY_X_ACCOUNT_NUMBER is set, call Razorpay to transfer money to that vendor’s bank. |

---

## How the whole flow works after you give account details

Once you set **RAZORPAY_X_ACCOUNT_NUMBER** (and the rest of the checklist below), the flow is:

1. **Settlement run**  
   Admin (or cron) calls **POST /settlements/calculate-daily**. The system finds eligible completed bookings (per vendor tier’s `payout_period_days`), groups by vendor, applies commission and penalties, and creates one **settlement** row per vendor (with that vendor’s `net_amount`).

2. **Auto payout (for each vendor with verified bank)**  
   If `autoPayout` is true (default), for each new settlement the system:
   - Finds that vendor’s **verified** bank (from `vendor_bank_accounts`, primary first).
   - Inserts a **payout** row (vendor_id, amount = that vendor’s settlement net amount, status `pending`).
   - If **RAZORPAY_X_ACCOUNT_NUMBER** is set: calls Razorpay **Composite Payout API** to transfer **that amount** from **your** RazorpayX account to **that vendor’s** bank account; then updates the payout row to `processing` (and later Razorpay webhooks/status can update to completed/failed).
   - If RAZORPAY_X_ACCOUNT_NUMBER is **not** set: the payout row stays `pending`; admin can later use **Finance → Payout Management → Process** to trigger the same Razorpay call (once the account is configured).

3. **Admin “Process” (manual)**  
   In **Admin → Finance → Payout Management**, “Process” on a pending payout does the same Razorpay call: debit from **RAZORPAY_X_ACCOUNT_NUMBER**, credit to that payout’s vendor verified bank, for that payout’s amount.

So after you provide the account details (RazorpayX Customer Identifier as RAZORPAY_X_ACCOUNT_NUMBER, credentials, IP allowlist, and fund the account), **every** eligible vendor with a verified bank gets their **specific** amount transferred from **your** account to **their** account automatically on the next settlement run (and manual Process works the same way).

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

## 4. Storing account in Secrets Manager and IP allowlist

For step-by-step instructions to store your RazorpayX account (e.g. Whistlefetch Axis account) in AWS Secrets Manager and configure **IP allowlisting** in RazorpayX, see:

**[RazorpayX Account Setup and IP Allowlist](RAZORPAY_X_ACCOUNT_SETUP_AND_IP_ALLOWLIST.md)**

That guide includes:
- Script: `scripts/setup-razorpay-x-payout-secret.sh` to add `razorpayXAccountNumber` to the existing Razorpay secret.
- How to find your Lambda’s outbound IP and add it in RazorpayX → My Account & Settings → Developer Controls → Share IP Addresses.
- Optional Terraform variable `razorpay_x_account_number` to manage the account in code.

---

## 5. References

- [Razorpay Payouts API – Create payout to bank account](https://razorpay.com/docs/api/x/payouts/create/bank-account/)
- [RazorpayX Dashboard](https://x.razorpay.com/)
- [IP allowlisting for Payouts](https://razorpay.com/docs/x/dashboard/allowlist-ip/)
- [Payout idempotency](https://razorpay.com/docs/api/x/payout-idempotency/make-request/)
