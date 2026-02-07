# Pharmacy Flow – Recommended Order Execution Summary

**Recommended order:** Implementation → DB migrations → Verification → Deploy → Forensic testing.  
**Full sequence:** See **`docs/RECOMMENDED_ORDER_EXECUTE.md`**.

---

## 1. DB migrations (Node script, AWS RDS)

- **Dry run:** `node scripts/run-pharmacy-migrations.js --dry-run` — lists 508, 509.
- **Apply:** Use Node script (supports AWS RDS when `DATABASE_URL` is not set):
  ```bash
  # Option A: DATABASE_URL
  export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
  node scripts/run-pharmacy-migrations.js

  # Option B: AWS RDS (ENVIRONMENT, AWS_REGION, AWS CLI + Secrets Manager)
  export ENVIRONMENT=dev
  export AWS_REGION=ap-south-1
  node scripts/run-pharmacy-migrations.js
  ```
  Migrations: `508_pharmacy_orders_status_invoice_generated.sql` → `509_pharmacy_payments_and_convenience.sql`

---

## 2. Verification (checklist)

- Checklist in **`docs/PHARMACY_VERIFICATION_AND_DEPLOY.md`** §2 (handlers, API contracts, params).

---

## 3. Forensic systematic tests

- **Result:** ✅ **16 passed** (pharmacy-flow contract tests).
- **Command:**  
  `cd tests/playwright && npx playwright test specs/contract-tests/pharmacy-flow.spec.ts`
- **API:** Uses `API_URL` or default `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`.

---

## 4. Builds (deploy readiness)

| Component        | Command              | Result  |
|-----------------|----------------------|--------|
| Backend Lambda  | `cd backend/lambda && npm run build`   | ✅ OK  |
| Vendor app      | `cd apps/vendor-web && npm run build`  | ✅ OK  |
| Customer app    | `cd apps/customer-web && npm run build`| ✅ OK  |

---

## 5. Deploy (your step)

1. Run DB migrations (see §1) when `DATABASE_URL` is set.
2. Deploy backend (e.g. `serverless deploy` or your CI).
3. Deploy vendor app (e.g. Vercel/CloudFront).
4. Deploy customer app (e.g. Vercel/CloudFront).
5. After deploy, re-run:  
   `cd tests/playwright && npx playwright test specs/contract-tests/pharmacy-flow.spec.ts`

---

## 6. One-liner (after setting DATABASE_URL)

```bash
# 1. Migrate
export DATABASE_URL="your-connection-string"
node scripts/run-pharmacy-migrations.js

# 2. Run forensic tests
cd tests/playwright && npx playwright test specs/contract-tests/pharmacy-flow.spec.ts
```
