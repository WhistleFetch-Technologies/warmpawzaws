# Migrations Ready to Copy - Step 1

## ✅ Migration Files Prepared

All migration files are ready in `./migrations-ready/` directory.

---

## 📋 Step 1: Apply Migrations in Supabase SQL Editor

### Option A: Apply Separately (Recommended)

#### 1.1 Apply Migration 008

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Click "SQL Editor" in left sidebar
   - Click "New query"

2. **Copy Migration 008**
   - Open file: `./migrations-ready/008_financial_flows_complete.sql`
   - Select ALL (Cmd+A / Ctrl+A)
   - Copy (Cmd+C / Ctrl+C)

3. **Paste and Run**
   - Paste into SQL Editor
   - Click "Run" button
   - Wait for "Success" message

#### 1.2 Apply Migration 009

1. **Copy Migration 009**
   - Open file: `./migrations-ready/009_financial_rpc_functions.sql`
   - Select ALL and Copy

2. **Paste and Run**
   - Paste into SQL Editor (new query or same window)
   - Click "Run"
   - Wait for "Success" message

#### 1.3 Verify Migrations

1. **Copy Verification Query**
   - Open file: `./migrations-ready/VERIFY_MIGRATIONS.sql`
   - Select ALL and Copy

2. **Paste and Run**
   - Paste into SQL Editor
   - Click "Run"

3. **Check Results**
   - **Tables Check:** Should show "✅ PASS" with count = 7
   - **Functions Check:** Should show "✅ PASS" with count = 6
   - **Default Tier:** Should show "✅ PASS"
   - **Default GST Rule:** Should show "✅ PASS"

### Option B: Apply Combined (Faster)

1. **Copy Combined Migration**
   - Open file: `./migrations-ready/COMBINED_ALL_MIGRATIONS.sql`
   - Select ALL and Copy

2. **Paste and Run**
   - Paste into Supabase SQL Editor
   - Click "Run"
   - Wait for "Success" message

3. **Verify** (same as above)

---

## ✅ Expected Results

After running migrations, you should see:

- **7 Tables Created:**
  - `gst_rules`
  - `vendor_tiers`
  - `vendor_tier_subscriptions`
  - `tier_upgrade_payments`
  - `settlement_booking_mappings`
  - `coupon_usage`
  - `platform_revenue_monthly`

- **6 Functions Created:**
  - `update_vendor_earnings`
  - `reverse_vendor_earnings`
  - `reverse_platform_commission`
  - `check_coupon_usage`
  - `get_vendor_commission_rate`
  - `create_settlement`

- **Default Data:**
  - 1 default tier (Bronze)
  - 1 default GST rule

---

## 📝 Quick Copy Commands

If you want to view the files in terminal:

```bash
# View Migration 008
cat migrations-ready/008_financial_flows_complete.sql

# View Migration 009
cat migrations-ready/009_financial_rpc_functions.sql

# View Combined
cat migrations-ready/COMBINED_ALL_MIGRATIONS.sql

# View Verification Query
cat migrations-ready/VERIFY_MIGRATIONS.sql
```

---

## ⚠️ Important Notes

- Migrations are **idempotent** - safe to run multiple times
- If you see "relation already exists" - that's OK, continue
- If you see "function already exists" - that's OK, functions use CREATE OR REPLACE
- Always run the verification query after migrations

---

**Once migrations are applied, proceed to Step 2: Deploy Functions**

