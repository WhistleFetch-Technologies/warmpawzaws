# Deployment Checklist - Financial Fixes

## ✅ Step-by-Step Checklist

---

## Step 1: Apply Database Migrations (5 minutes)

### 1.1 Prepare Migration Files
```bash
# Run this to prepare files for copy-paste
./scripts/prepare-migrations-for-copy.sh
```

This creates files in `./migrations-ready/` directory:
- `008_financial_flows_complete.sql` - First migration
- `009_financial_rpc_functions.sql` - Second migration
- `COMBINED_ALL_MIGRATIONS.sql` - Both combined (optional)
- `VERIFY_MIGRATIONS.sql` - Verification query

### 1.2 Apply Migration 008

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Click "SQL Editor" in left sidebar

2. **Copy Migration 008**
   - Open file: `migrations-ready/008_financial_flows_complete.sql`
   - Select ALL (Cmd+A / Ctrl+A)
   - Copy (Cmd+C / Ctrl+C)

3. **Paste and Run**
   - Paste into SQL Editor
   - Click "Run" button or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
   - Wait for "Success" message

4. **Check for Errors**
   - If you see "relation already exists" - that's OK, migration is idempotent
   - If you see other errors, check the error message

### 1.3 Apply Migration 009

1. **Copy Migration 009**
   - Open file: `migrations-ready/009_financial_rpc_functions.sql`
   - Select ALL and Copy

2. **Paste and Run**
   - Paste into SQL Editor (in a new query or same window)
   - Click "Run"
   - Wait for "Success" message

### 1.4 Verify Migrations

1. **Run Verification Query**
   - Open file: `migrations-ready/VERIFY_MIGRATIONS.sql`
   - Copy ALL and paste into SQL Editor
   - Click "Run"

2. **Check Results**
   - **Tables Check:** Should show "✅ PASS" with count = 7
   - **Functions Check:** Should show "✅ PASS" with count = 6
   - **Default Tier:** Should show "✅ PASS" with count >= 1
   - **Default GST Rule:** Should show "✅ PASS" with count >= 1

3. **If Verification Fails**
   - Check which tables/functions are missing
   - Re-run the corresponding migration
   - Check error messages in SQL Editor

**✅ Checklist:**
- [ ] Migration 008 applied successfully
- [ ] Migration 009 applied successfully
- [ ] Verification query shows 7 tables
- [ ] Verification query shows 6 functions
- [ ] Default tier exists
- [ ] Default GST rule exists

---

## Step 2: Deploy Edge Functions (2 minutes)

### 2.1 Check Prerequisites

```bash
# Check if Supabase CLI is installed
supabase --version

# If not installed:
npm install -g supabase
# or
brew install supabase/tap/supabase
```

### 2.2 Login to Supabase

```bash
# Login (if not already logged in)
supabase login
```

### 2.3 Link Project (if needed)

```bash
# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Find your project ref in Supabase Dashboard → Settings → General
```

### 2.4 Deploy Function

```bash
# Deploy the function
supabase functions deploy make-server-3dd53475

# Or use the deployment script
./scripts/deploy-financial-functions.sh
```

### 2.5 Verify Deployment

```bash
# List deployed functions
supabase functions list

# Check function logs
supabase functions logs make-server-3dd53475 --limit 10

# Test endpoint
curl https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/payments/tiers
```

**✅ Checklist:**
- [ ] Supabase CLI installed
- [ ] Logged in to Supabase
- [ ] Project linked
- [ ] Function deployed successfully
- [ ] Endpoint responding

---

## Step 3: Verify Setup (1 minute)

### 3.1 Run Validation Script

```bash
./scripts/validate-financial-setup.sh
```

**Expected Output:**
- ✅ All migration files found
- ✅ All service files found
- ✅ All endpoint files found
- ✅ All UI components found
- ✅ All test files found
- ✅ All integrations verified

### 3.2 Test API Endpoints

```bash
# Test tiers endpoint
curl https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/payments/tiers

# Expected: JSON response with tiers array
```

**✅ Checklist:**
- [ ] Validation script passes
- [ ] API endpoints responding
- [ ] No errors in logs

---

## Step 4: Environment Variables

### 4.1 Set Environment Variables

1. **Go to Supabase Dashboard**
   - Settings → Edge Functions → Secrets

2. **Add/Verify These Variables:**
   - `RAZORPAY_KEY_ID` - Your Razorpay key ID
   - `RAZORPAY_KEY_SECRET` - Your Razorpay key secret
   - `SUPABASE_URL` - Your Supabase URL (usually auto-set)
   - `SUPABASE_SERVICE_ROLE_KEY` - Your service role key

**✅ Checklist:**
- [ ] RAZORPAY_KEY_ID set
- [ ] RAZORPAY_KEY_SECRET set
- [ ] SUPABASE_URL set
- [ ] SUPABASE_SERVICE_ROLE_KEY set

---

## Step 5: Test Financial Flows

### 5.1 Test Payment Initiation

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/ecommerce/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <anon-key>" \
  -d '{
    "bookingId": "test-booking-id",
    "customerId": "test-customer-id",
    "vendorId": "test-vendor-id",
    "amount": 1000,
    "paymentMethod": "razorpay",
    "roleId": "veterinarian",
    "serviceStyle": "at_center"
  }'
```

### 5.2 Test GST Calculation

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/calculate-gst \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "roleId": "veterinarian",
    "serviceStyle": "at_center",
    "customerState": "Maharashtra",
    "vendorState": "Maharashtra"
  }'
```

**✅ Checklist:**
- [ ] Payment initiation works
- [ ] GST calculation works
- [ ] Tier endpoints work
- [ ] No errors in responses

---

## Troubleshooting

### Migration Issues

**Problem:** "relation already exists"
- **Solution:** This is OK - migration is idempotent. Continue.

**Problem:** "permission denied"
- **Solution:** Ensure you're using service role key or have proper DB permissions.

**Problem:** "function already exists"
- **Solution:** This is OK - functions use CREATE OR REPLACE. Continue.

### Deployment Issues

**Problem:** "Function not found"
- **Solution:** Check function directory exists: `supabase/functions/make-server-3dd53475`

**Problem:** "Import errors"
- **Solution:** Verify all files exist and paths are correct in `index.tsx`

**Problem:** "Deployment timeout"
- **Solution:** Check function size, may need to optimize or split

### Runtime Issues

**Problem:** "Table does not exist"
- **Solution:** Verify migrations were applied, check table names

**Problem:** "Function does not exist"
- **Solution:** Verify RPC functions were created in migration 009

---

## Final Verification

Run this comprehensive check:

```bash
# 1. Validate setup
./scripts/validate-financial-setup.sh

# 2. Check database
# Run VERIFY_MIGRATIONS.sql in SQL Editor

# 3. Test endpoints
curl https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/payments/tiers

# 4. Check logs
supabase functions logs make-server-3dd53475 --limit 20
```

**All checks should pass! ✅**

---

## Success Criteria

- ✅ All 7 tables created
- ✅ All 6 functions created
- ✅ Default data seeded
- ✅ Function deployed
- ✅ Endpoints responding
- ✅ No errors in logs

**Once all items are checked, deployment is complete! 🎉**

