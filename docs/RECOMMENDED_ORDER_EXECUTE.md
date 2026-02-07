# Pharmacy Flow – Recommended Order of Execution

Execute in this order: **Implementation → DB migrations → Verification → Deploy → Forensic testing.**

---

## 1. Complete full implementation

- Code is in place: backend (pharmacy-orders, razorpay, delivery-otp, customer-enhanced), customer app (PharmacyOrderFlow), vendor app (PharmacyOrderDashboard).
- No further code changes required before migrations unless you have local WIP.

**Optional check:**  
`cd backend/lambda && npm run build`  
`cd apps/vendor-web && npm run build`  
`cd apps/customer-web && npm run build`

---

## 2. DB migrations (all together, Node script, AWS RDS)

Use the Node script; it runs against AWS RDS when `DATABASE_URL` is not set (uses ENVIRONMENT + Secrets Manager).

**Dry run (no DB changes):**
```bash
node scripts/run-pharmacy-migrations.js --dry-run
```

**Apply migrations (from repo root):**
```bash
# Option A: With DATABASE_URL
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
node scripts/run-pharmacy-migrations.js

# Option B: AWS RDS (no DATABASE_URL; uses ENVIRONMENT + AWS CLI + Secrets Manager)
export ENVIRONMENT=dev
export AWS_REGION=ap-south-1
node scripts/run-pharmacy-migrations.js
```

**Migrations run in order:**  
`508_pharmacy_orders_status_invoice_generated.sql` → `509_pharmacy_payments_and_convenience.sql`

---

## 3. Verification of implementation

- **Checklist:** `docs/PHARMACY_VERIFICATION_AND_DEPLOY.md` (handlers, API contracts, params).
- **Quick verification:** Run backend and hit health; run vendor/customer apps locally and walk: create order → accept → invoice → pay → track → OTP.

---

## 4. Deploy (scripts in `scripts/`)

**Backend Lambda:**
```bash
cd backend/lambda && ./scripts/deploy.sh dev ap-south-1
```
(Uses `npx serverless deploy`; API: e.g. `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`)

**Customer web:**
```bash
./scripts/deploy-customer-web.sh
```
(Builds `apps/customer-web`, uploads to S3, invalidates CloudFront.)

**Vendor web:**
```bash
./scripts/deploy-vendor-web.sh
```
(Builds `apps/vendor-web`, uploads to S3, invalidates CloudFront.)

**Full platform (CDK):**
```bash
./scripts/deploy-all.sh dev
```
(Builds backend + admin/customer/vendor, then deploys via CDK from `infrastructure/cdk`.)

Ensure env vars (e.g. Razorpay keys, API base URL) are set in each environment.

---

## 5. Forensic systematic test (full implementation)

**Contract tests (Playwright):**
```bash
cd tests/playwright
export API_URL="https://your-api-url"   # or default in spec
npx playwright test specs/contract-tests/pharmacy-flow.spec.ts
```

**End-to-end curl (real data, full flow):**
```bash
export API_BASE_URL="https://your-api-url"
export CUSTOMER_ID="<real-customer-uuid>"
export PHARMACY_VENDOR_ID="<real-pharmacy-vendor-uuid>"
./scripts/forensic-pharmacy-flow-curl.sh
```

To test from an existing order (skip create):
```bash
export ORDER_ID="<existing-pharmacy-order-uuid>"
export PHARMACY_VENDOR_ID="<real-pharmacy-vendor-uuid>"
./scripts/forensic-pharmacy-flow-curl.sh
```

---

## One-page checklist

| Step | Action | Command / doc |
|------|--------|----------------|
| 1 | Implementation complete | Build backend + vendor + customer apps |
| 2 | DB migrations | `node scripts/run-pharmacy-migrations.js` (with DATABASE_URL or AWS RDS) |
| 3 | Verification | `docs/PHARMACY_VERIFICATION_AND_DEPLOY.md` + local flow |
| 4 | Deploy | Backend → Vendor app → Customer app |
| 5 | Forensic test | Playwright: `tests/playwright` → pharmacy-flow.spec.ts; curl: `./scripts/forensic-pharmacy-flow-curl.sh` |

Recommended order: **execute 1 → 2 → 3 → 4 → 5** in sequence.
