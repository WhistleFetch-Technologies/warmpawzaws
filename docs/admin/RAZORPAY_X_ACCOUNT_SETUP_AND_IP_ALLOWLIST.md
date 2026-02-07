# RazorpayX Payout Account Setup and IP Allowlist

This guide covers:
1. Storing your RazorpayX payout source account in AWS Secrets Manager (so you can change it easily).
2. What to configure in RazorpayX (IP allowlist and where to get the account number).
3. Optional: managing the account via Terraform.

---

## 1. Your account details (for reference)

You provided:

| Field | Value |
|-------|--------|
| **Account holder** | Whistlefetch Technologies Private Limited |
| **Bank** | Axis Bank |
| **Branch** | Southend Road, Jayanagar, Bangalore |
| **Account number** | 925020033295934 |
| **Type** | Current Account |
| **PAN** | AAECW2054R (keep for your records; do **not** put in the payout secret) |

For the **Payouts API**, Razorpay needs the **source account** from which money is debited. This is either:
- Your **RazorpayX Customer Identifier** (from [x.razorpay.com](https://x.razorpay.com) → My Account & Settings → Banking), or  
- Your **bank account number** (if RazorpayX is linked to this Axis account).

Use the value that RazorpayX shows as the **payout source** (often the Customer Identifier). If in doubt, try the account number **925020033295934** first; if payouts fail, use the Customer Identifier from the RazorpayX dashboard instead.

---

## 2. Store the account in AWS Secrets Manager

Two options: **script (recommended)** or **manual**.

### Option A: Script (recommended)

From the repo root, with AWS CLI configured:

```bash
# Required: account number (or RazorpayX Customer Identifier)
STAGE=dev ./scripts/setup-razorpay-x-payout-secret.sh 925020033295934

# Optional: add metadata for your records (Lambda only uses the account number)
STAGE=dev ./scripts/setup-razorpay-x-payout-secret.sh 925020033295934 "Whistlefetch Technologies Private Limited" "Axis Bank" "Southend Road, Jayanagar, Bangalore"
```

- **STAGE** = environment (e.g. `dev`, `prod`). Secret name will be `warmpawz/dev/razorpay` or `warmpawz/prod/razorpay`.
- The script **merges** `razorpayXAccountNumber` into the existing Razorpay secret. Existing keys (`keyId`, `keySecret`, etc.) are kept.
- If the secret does not exist yet, create it first (e.g. via Terraform or Console) with at least `keyId` and `keySecret` for Razorpay API.

After this, Lambda will use the new value on the next payout; no redeploy needed.

### Option B: Manual (AWS Console)

1. Open **AWS Console** → **Secrets Manager** → select secret **`warmpawz/dev/razorpay`** (or your stage).
2. Click **Retrieve secret value** → **Edit**.
3. In the JSON, add or update:
   - **`razorpayXAccountNumber`**: `925020033295934` (or your RazorpayX Customer Identifier).
   - Optional (for your reference only): `razorpayXAccountHolderName`, `razorpayXBankName`, `razorpayXBranchName`.
4. Keep existing keys: **`keyId`**, **`keySecret`** (and `webhookSecret` if present). Lambda expects camelCase.
5. Save.

Example secret value:

```json
{
  "keyId": "rzp_live_...",
  "keySecret": "...",
  "webhookSecret": "...",
  "razorpayXAccountNumber": "925020033295934",
  "razorpayXAccountHolderName": "Whistlefetch Technologies Private Limited",
  "razorpayXBankName": "Axis Bank",
  "razorpayXBranchName": "Southend Road, Jayanagar, Bangalore"
}
```

Do **not** store PAN or other sensitive identity data in this secret; the Payouts API does not need it.

---

## 3. IP allowlist in RazorpayX (required for Payouts API)

Razorpay **requires** that you allowlist the IP addresses from which payout API requests are sent. Requests from other IPs will be rejected.

### 3.1 Where to configure

1. Log in to **[RazorpayX Dashboard](https://x.razorpay.com)**.
2. Click your **profile icon** → **My Account & Settings**.
3. Go to **Developer Controls** → **Share IP Addresses** (or “Allowlist IP” / “IP Allowlist”).
4. Add the IP(s) from which your Lambda calls Razorpay (see below).
5. Save and complete OTP if asked.

Reference: [Razorpay – Allowlist IPs for Payout APIs](https://razorpay.com/docs/x/dashboard/allowlist-ip/).

### 3.2 Which IPs to add

Your Lambda runs on AWS. The IP that Razorpay sees is the **outbound (egress) IP** of the Lambda when it calls Razorpay.

- **Lambda in a VPC with NAT Gateway**  
  Use the **NAT Gateway’s public IP**.  
  - AWS Console → **VPC** → **NAT Gateways** → select the NAT used by your Lambda’s subnet → copy **Public IP** (or Elastic IP).  
  - Add this IP in RazorpayX.

- **Lambda not in a VPC (no NAT)**  
  Lambda uses AWS’s shared egress IPs, which can change. Options:  
  - **Option 1:** Put Lambda in a VPC with a NAT Gateway and use the NAT’s static public IP (recommended for production).  
  - **Option 2:** Use a fixed outbound IP (e.g. NAT or proxy), find that IP (see below), and add it in RazorpayX.

### 3.3 How to find your Lambda’s outbound IP

**If you have a NAT Gateway:**  
Use the NAT’s public/Elastic IP as above.

**If you need to discover the current egress IP:**

1. Temporarily add a test endpoint or use an existing one that calls an external “what’s my IP” service (e.g. `https://api.ipify.org`) and returns the IP.
2. Invoke that from your Lambda (or trigger a payout and check Razorpay logs).
3. Add the returned IP in RazorpayX **Share IP Addresses**.

You can allowlist up to **20 IPs**. For one Lambda in one VPC with one NAT, one IP is usually enough.

### 3.4 Summary: what to configure in RazorpayX

| What | Where | Value |
|------|--------|--------|
| **IP allowlist** | RazorpayX → My Account & Settings → Developer Controls → Share IP Addresses | Your Lambda/NAT outbound IP(s) |
| **Payout source account** | Already set in Warmpawz via Secrets Manager as `razorpayXAccountNumber` | 925020033295934 (or Customer Identifier) |
| **Funding** | RazorpayX Banking / Current Account | Ensure the payout source account has enough balance for vendor payouts |

---

## 4. Optional: Manage the account via Terraform

If you use Terraform for `warmpawz/{env}/razorpay`, you can set the payout account in Terraform so it stays in code and is easy to change.

**Dev example:**

1. In `infra/envs/dev/terraform.tfvars` (or a `.tfvars` file not committed), add:

```hcl
razorpay_x_account_number = "925020033295934"
```

2. Ensure `infra/envs/dev/variables.tf` has the variable (already added):

```hcl
variable "razorpay_x_account_number" {
  description = "RazorpayX Current Account number (payout source) for vendor payouts"
  type        = string
  default     = ""
  sensitive   = true
}
```

3. Apply:

```bash
cd infra/envs/dev
terraform plan   # should show secret version update
terraform apply
```

To change the account later, update `razorpay_x_account_number` and run `terraform apply` again. No need to edit the secret in the Console.

---

## 5. Checklist

- [ ] RazorpayX Current Account opened and linked to your Axis account (if required).
- [ ] **Secrets Manager:** `warmpawz/{stage}/razorpay` contains `razorpayXAccountNumber` (and optionally metadata). Done via script or Console.
- [ ] **RazorpayX Dashboard:** Under Developer Controls → Share IP Addresses, add your Lambda/NAT outbound IP(s).
- [ ] **RazorpayX account:** Funded so payouts can be debited.
- [ ] (Optional) **Terraform:** `razorpay_x_account_number` set in tfvars and applied, if you manage the secret with Terraform.

After this, automatic and manual payouts will use your RazorpayX account as the source and send each vendor their amount to their verified bank account.
