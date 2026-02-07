# KYC Verification API & PROD Configuration

## Overview

The backend exposes KYC (Know Your Customer) verification APIs for **Aadhaar OTP**, **PAN**, and **GST**, plus status and declarations. Configuration is read from **AWS Secrets Manager** (recommended for PROD), then **database** (`platform_settings` / `platform_integrations`), then **environment variables**.

---

## KYC Verification API Endpoints

Base path: your API base URL (e.g. `https://api.warmpawz.com` or the Lambda function URL). All request/response bodies are JSON.

### Aadhaar

| Method | Path | Description |
|--------|------|-------------|
| **POST** | `/kyc/aadhaar/generate-otp` | Generate OTP for Aadhaar |
| **POST** | `/kyc/aadhaar/verify-otp` | Verify OTP and store result |

**POST /kyc/aadhaar/generate-otp**

- Request: `{ "aadhaarNumber": "123456789012", "vendorId": "<uuid>" }`
- Response (200): `{ "success": true, "requestId": "...", "message": "...", "expiresIn": 600, "maskedAadhaar": "XXXX XXXX 9012" }`
- Aadhaar must be 12 digits.

**POST /kyc/aadhaar/verify-otp**

- Request: `{ "requestId": "...", "otp": "123456", "vendorId": "<uuid>", "aadhaarNumber": "123456789012" }`
- Response (200): `{ "success": true, "verified": true, "message": "Aadhaar verified successfully", "data": { "name": "...", "maskedAadhaar": "..." } }`

---

### PAN

| Method | Path | Description |
|--------|------|-------------|
| **POST** | `/kyc/pan/verify` | Verify PAN and optionally match name |

**POST /kyc/pan/verify**

- Request: `{ "panNumber": "ABCDE1234F", "name": "Optional Name", "vendorId": "<uuid>" }`
- Response (200): `{ "success": true, "verified": true, "message": "PAN verified successfully", "data": { "panNumber", "name", "status", "nameMatchScore", "category" } }`
- PAN format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).

---

### GST

| Method | Path | Description |
|--------|------|-------------|
| **POST** | `/kyc/gst/verify` | Verify GSTIN |

**POST /kyc/gst/verify**

- Request: `{ "gstin": "27AABCU9603R1ZM", "vendorId": "<uuid>" }`
- Response (200): `{ "success": true, "verified": true, "message": "GST verified successfully", "data": { "gstin", "legalName", "tradeName", "status", "stateCode", "stateName", ... } }`
- GSTIN: 15 characters (2 digit state + 10 char PAN + 2 char entity + Z + 1 char).

---

### Status & Declarations

| Method | Path | Description |
|--------|------|-------------|
| **GET** | `/kyc/status/:vendorId` | Get KYC status for a vendor |
| **POST** | `/kyc/declarations` | Submit a declaration (vendorId, declarationType, accepted) |

**GET /kyc/status/:vendorId**

- Response (200): `{ "success": true, "data": { "kyc_status", "kyc_score", "aadhaar_verified", "pan_verified", "gstin_verified", "police_verification_status", ... } }`

**POST /kyc/declarations**

- Request: `{ "vendorId": "<uuid>", "declarationType": "no_criminal_record" | "platform_terms" | ... , "declarationText": "...", "accepted": true }`

---

### Admin (KYC config)

| Method | Path | Description |
|--------|------|-------------|
| **GET** | `/admin/kyc/config` | Get current KYC config (masked; admin only) |
| **POST** | `/admin/kyc/config` | Update KYC config in DB (admin only) |
| **POST** | `/admin/kyc/test-connection` | Test provider connectivity (admin only) |

**POST /admin/kyc/config**

- Request: `{ "provider": "sandbox" | "signzy" | "idfy" | "karza", "apiKey": "...", "apiSecret": "...", "baseUrl": "https://...", "enabled": true }`
- Persists to `platform_settings` (key `platform:integrations:kyc`). Used as fallback when Secrets Manager is not used or fails.

---

## Supported KYC Providers

| Provider | Default base URL | Use case |
|----------|------------------|----------|
| `sandbox` | `https://api.sandbox.co.in` | Testing / mock |
| `signzy` | `https://preproduction.signzy.tech` | Preprod |
| `idfy` | `https://eve.idfy.com` | Production |
| `karza` | `https://api.karza.in` | Production |

Config can override `baseUrl` (and optional `aadhaarApiUrl`, `panApiUrl`, `gstApiUrl`) per provider.

---

## How configuration is loaded (priority)

1. **AWS Secrets Manager** – secret name: `warmpawz/{STAGE}/kyc-provider` (e.g. PROD: `warmpawz/prod/kyc-provider`).
2. **Database** – `platform_settings.setting_key = 'platform:integrations:kyc'` or `platform_integrations.integration_name = 'kyc'`.
3. **Environment variables** – `KYC_PROVIDER`, `KYC_API_KEY`, `KYC_API_SECRET`, `KYC_BASE_URL`, `KYC_ENABLED`, etc.
4. If none found: sandbox mock mode (`enabled: false`).

The Lambda resolves `STAGE` as: `process.env.NODE_ENV || process.env.STAGE || 'dev'`. So for PROD it must see `STAGE=prod` or `NODE_ENV=prod` to read `warmpawz/prod/kyc-provider`.

---

## Configuring PROD

### 1. Ensure Lambda uses PROD stage

The Lambda must resolve to `prod` when reading secrets. It uses:

- `process.env.NODE_ENV` or `process.env.STAGE` (defaults to `'dev'`).

So in PROD, the Lambda environment should include either:

- `NODE_ENV=prod`, or  
- `STAGE=prod`.

If your Terraform only sets `ENVIRONMENT=prod`, add `NODE_ENV` or `STAGE` in the Lambda module’s `common_env_vars` (or equivalent) for the prod environment so that secret name becomes `warmpawz/prod/kyc-provider`.

### 2. Create the KYC secret in AWS Secrets Manager (recommended)

Create a secret named exactly:

- **`warmpawz/prod/kyc-provider`**

Secret value: JSON in this shape (keys camelCase or snake_case as your code expects; the client accepts both and normalizes):

```json
{
  "provider": "idfy",
  "apiKey": "YOUR_PROD_API_KEY",
  "apiSecret": "YOUR_PROD_API_SECRET",
  "baseUrl": "https://eve.idfy.com",
  "enabled": true
}
```

Optional overrides (if your provider uses different paths):

- `aadhaarApiUrl`, `panApiUrl`, `gstApiUrl`

Example (AWS CLI):

```bash
aws secretsmanager create-secret \
  --name "warmpawz/prod/kyc-provider" \
  --description "KYC provider config for production" \
  --secret-string '{"provider":"idfy","apiKey":"YOUR_KEY","apiSecret":"YOUR_SECRET","baseUrl":"https://eve.idfy.com","enabled":true}' \
  --region ap-south-1
```

To update later:

```bash
aws secretsmanager put-secret-value \
  --secret-id "warmpawz/prod/kyc-provider" \
  --secret-string '{"provider":"idfy","apiKey":"NEW_KEY","apiSecret":"NEW_SECRET","baseUrl":"https://eve.idfy.com","enabled":true}' \
  --region ap-south-1
```

Ensure the Lambda execution role has `secretsmanager:GetSecretValue` for `warmpawz/prod/kyc-provider`.

### 3. (Optional) Terraform for the KYC secret

There is no KYC secret resource in `infra/modules/secrets` today. You can add one (e.g. `kyc-provider`) similar to Razorpay/Google Maps, with variables for `provider`, `api_key`, `api_secret`, `base_url`, and `enabled`, and pass prod values from `infra/envs/prod/terraform.tfvars`. That keeps PROD config in code and avoids manual CLI updates.

### 4. Alternative: Database (platform_settings)

If you prefer not to use Secrets Manager in PROD:

- Call **POST /admin/kyc/config** (admin auth) with the same payload as above.  
- The backend stores it in `platform_settings` (`setting_key = 'platform:integrations:kyc'`).  
- This is the first fallback after Secrets Manager; ensure no secret `warmpawz/prod/kyc-provider` exists if you want only DB config, or the secret will take precedence.

### 5. Alternative: Environment variables

Set on the Lambda (e.g. via Terraform `common_env_vars`):

- `KYC_PROVIDER=idfy`
- `KYC_API_KEY=...`
- `KYC_API_SECRET=...`
- `KYC_BASE_URL=https://eve.idfy.com`
- `KYC_ENABLED=true`

Optional: `KYC_AADHAAR_URL`, `KYC_PAN_URL`, `KYC_GST_URL`. This is the last fallback before mock mode.

---

## PROD checklist

- [ ] Lambda has `NODE_ENV=prod` or `STAGE=prod` so secret name is `warmpawz/prod/kyc-provider`.
- [ ] Secret `warmpawz/prod/kyc-provider` created (or DB/env used intentionally) with production provider (e.g. `idfy` or `karza`), correct `baseUrl`, and `enabled: true`.
- [ ] Lambda IAM role can access `warmpawz/prod/kyc-provider` (if using Secrets Manager).
- [ ] Admin UI or API used to **POST /admin/kyc/test-connection** to verify connectivity after deploy.
- [ ] No production API keys in code or in non-prod secrets.

---

## Related code

- Endpoints: `backend/lambda/src/endpoints/kyc-verification.ts`
- Config & provider client: `backend/lambda/src/utils/kyc-verification-client.ts`
- Secret resolution: `backend/lambda/src/utils/secrets-manager.ts` (uses `warmpawz/${STAGE}/${secretName}`)
- Infra secrets module (no KYC yet): `infra/modules/secrets/main.tf`
