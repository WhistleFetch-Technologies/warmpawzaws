# Walker Discovery – Next Steps

The API `GET /customer/discover-services?category=walker&serviceStyle=at_home` is returning **0 vendors**. The Lambda has been updated with discovery fixes; the remaining work is **data/configuration**.

---

## 1. Run the DB diagnostic (required)

Use the **same RDS/Postgres DB** that the Lambda uses (SSM: `/warmpawz/dev/db/host`, etc., or your `DATABASE_URL`).

```bash
cd db
DATABASE_URL='postgresql://user:pass@YOUR_RDS_HOST:5432/YOUR_DB' node scripts/run-diagnose-walker.js
```

Or with `psql`:

```bash
psql "$DATABASE_URL" -f db/scripts/diagnose-walker-discovery.sql
```

**What to check in the output:**

- **Query 1** – Do your 3 walkers appear? If not, they may have a different role name or `role_id` NULL.
- **Query 2** – For each walker, is `discovery_check` **OK** or **FAIL: …**? Fix the first failing reason.
- **Query 3** – Exact `name` / `display_name` for walker roles (e.g. `pet_walker` vs `Pet Walker`).
- **Query 4** – Any walker-like vendors with `role_id` NULL; those will never be discovered until `role_id` is set.

---

## 2. Fix data so walkers pass discovery

Discovery only returns vendors that satisfy **all** of:

| Condition | Fix |
|-----------|-----|
| `v.status IN ('approved', 'active')` | Set `vendors.status` to `'approved'` or `'active'`. |
| `v.is_active = true` | Set `vendors.is_active = true`. |
| `v.role_id` points to a walker role | Set `vendors.role_id` to the UUID of a role whose `name` is one of: `walker`, `pet_walker`, `walker_solo`, `dog_walker` (or "Pet Walker" with space – backend now normalizes). |
| At least one `vendor_services` row with `is_enabled = true` | Add/update a row in `vendor_services` for that vendor with `is_enabled = true` (and optionally `service_style = 'at_home'`). |
| `business_name` does not contain: clinic, hospital, center, centre, salon, " business" | Rename or correct `business_name` if it matches any of these. |

Example (adjust IDs to your DB):

```sql
-- Ensure walker role exists and get its id
SELECT id, name FROM roles WHERE LOWER(name) IN ('walker', 'pet_walker');

-- Fix a vendor: set status, is_active, role_id
UPDATE vendors
SET status = 'active', is_active = true,
    role_id = (SELECT id FROM roles WHERE name = 'pet_walker' LIMIT 1)
WHERE phone = '9800000000';  -- use your walker phone

-- Ensure they have at least one enabled service
UPDATE vendor_services SET is_enabled = true
WHERE vendor_id = (SELECT id FROM vendors WHERE phone = '9800000000' LIMIT 1)
LIMIT 1;
```

---

## 3. Confirm API ↔ Lambda (optional)

- In **API Gateway** (AWS Console): open the API with ID **z0b3obweb6**.
- Check **Integrations**: the `/{proxy+}` route should point to Lambda **warmpawz-api-dev-api**.
- Our deploy script updates that Lambda; if a different Lambda is attached, update the integration or deploy that Lambda instead.

---

## 4. Re-test discovery

After fixing data (and redeploying Lambda if you changed code):

```bash
curl -s "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/discover-services?category=walker&serviceStyle=at_home"
```

You should see `vendors` / `providers` with at least your 3 walkers once they pass the checks above.
