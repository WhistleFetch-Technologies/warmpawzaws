# Deployment Guide - Financial Fixes

## Step-by-Step Deployment Instructions

---

## Step 1: Apply Database Migrations

### Option A: Via Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Apply Migration 008**
   - Open file: `db/migrations/008_financial_flows_complete.sql`
   - Copy ALL contents (463 lines)
   - Paste into SQL Editor
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Wait for "Success" message

4. **Apply Migration 009**
   - Open file: `db/migrations/009_financial_rpc_functions.sql`
   - Copy ALL contents (181 lines)
   - Paste into SQL Editor
   - Click "Run"
   - Wait for "Success" message

5. **Verify Migrations**
   - Run this query in SQL Editor:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN (
     'gst_rules',
     'vendor_tiers',
     'vendor_tier_subscriptions',
     'tier_upgrade_payments',
     'settlement_booking_mappings',
     'coupon_usage',
     'platform_revenue_monthly'
   );
   ```
   - **Expected Result:** 7 rows

### Option B: Using Combined File

A combined migration file has been created at:
```
/tmp/financial_migrations_combined.sql
```

You can copy this entire file and paste it into Supabase SQL Editor to apply both migrations at once.

---

## Step 2: Deploy Edge Functions

### Option A: Using Supabase CLI (Recommended)

```bash
# 1. Install Supabase CLI (if not installed)
npm install -g supabase
# or
brew install supabase/tap/supabase

# 2. Login to Supabase
supabase login

# 3. Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# 4. Deploy the function
supabase functions deploy make-server-3dd53475

# 5. Verify deployment
supabase functions list
```

### Option B: Using Deployment Script

```bash
# Run the deployment script
./scripts/deploy-financial-functions.sh
```

### Option C: Manual Deployment via Dashboard

1. **Go to Supabase Dashboard**
   - Navigate to: Edge Functions
   - Click on `make-server-3dd53475` function

2. **Deploy via Dashboard**
   - Click "Deploy" or "Update"
   - Wait for deployment to complete

---

## Step 3: Verify Setup

### Run Validation Script

```bash
./scripts/validate-financial-setup.sh
```

### Manual Verification

#### 3.1 Verify Database Tables

Run in SQL Editor:
```sql
-- Check all new tables exist
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN (
    'gst_rules',
    'vendor_tiers',
    'vendor_tier_subscriptions',
    'tier_upgrade_payments',
    'settlement_booking_mappings',
    'coupon_usage',
    'platform_revenue_monthly'
)
ORDER BY table_name;
```

**Expected:** 7 tables with columns

#### 3.2 Verify Database Functions

Run in SQL Editor:
```sql
-- Check all RPC functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'update_vendor_earnings',
    'reverse_vendor_earnings',
    'reverse_platform_commission',
    'check_coupon_usage',
    'get_vendor_commission_rate',
    'create_settlement'
)
ORDER BY routine_name;
```

**Expected:** 6 functions

#### 3.3 Verify Default Data

Run in SQL Editor:
```sql
-- Check default tier exists
SELECT * FROM vendor_tiers WHERE tier_name = 'bronze';

-- Check default GST rule exists
SELECT * FROM gst_rules WHERE rule_name LIKE '%Default%';
```

**Expected:** 1 tier (Bronze) and 1 GST rule

#### 3.4 Test API Endpoints

```bash
# Test tiers endpoint
curl https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/payments/tiers

# Expected: JSON response with tiers array
```

---

## Step 4: Environment Variables

Ensure these are set in Supabase Dashboard:

1. **Go to:** Settings → Edge Functions → Secrets
2. **Add/Verify:**
   - `RAZORPAY_KEY_ID` - Your Razorpay key ID
   - `RAZORPAY_KEY_SECRET` - Your Razorpay key secret
   - `SUPABASE_URL` - Your Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your service role key

---

## Step 5: Test Financial Flows

### 5.1 Test Payment Flow

```bash
# Initiate a test payment
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

### 5.3 Test Tier Endpoints

```bash
# Get tiers
curl https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/payments/tiers

# Get vendor tier
curl https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/vendor/<vendor-id>/payment-tier
```

---

## Troubleshooting

### Migration Errors

**Error: "relation already exists"**
- Some tables may already exist
- Migration uses `CREATE TABLE IF NOT EXISTS` - safe to rerun
- Check which tables exist: `\dt` in psql

**Error: "function already exists"**
- Functions use `CREATE OR REPLACE` - safe to rerun
- This is expected if rerunning migrations

**Error: "permission denied"**
- Ensure you're using service role key or have proper permissions
- Check database user permissions

### Deployment Errors

**Error: "Function not found"**
- Verify function directory exists: `supabase/functions/make-server-3dd53475`
- Check `index.tsx` exists in function directory

**Error: "Import not found"**
- Verify all imported files exist
- Check import paths in `index.tsx`

**Error: "Type errors"**
- Run: `deno check supabase/functions/make-server-3dd53475/index.tsx`
- Fix any TypeScript errors

### Runtime Errors

**Error: "Table does not exist"**
- Verify migrations were applied
- Check table names match exactly

**Error: "Function does not exist"**
- Verify RPC functions were created
- Check function names match exactly

**Error: "Commission calculation failed"**
- Verify vendor has a tier assigned
- Check `vendor_tiers` table has data

---

## Verification Checklist

- [ ] Migration 008 applied successfully
- [ ] Migration 009 applied successfully
- [ ] All 7 tables created
- [ ] All 6 RPC functions created
- [ ] Default tier (Bronze) exists
- [ ] Default GST rule exists
- [ ] Edge function deployed
- [ ] Environment variables set
- [ ] API endpoints responding
- [ ] Payment flow working
- [ ] GST calculation working
- [ ] Tier endpoints working

---

## Next Steps After Deployment

1. **Monitor Logs**
   ```bash
   supabase functions logs make-server-3dd53475 --follow
   ```

2. **Test Real Scenarios**
   - Create a real payment
   - Process a refund
   - Run settlement calculation
   - Upgrade a vendor tier

3. **Update Frontend**
   - Ensure payment components use new endpoints
   - Update tier management UI
   - Update GST configuration UI

4. **Monitor Performance**
   - Check database query performance
   - Monitor function execution time
   - Check error rates

---

## Support

If you encounter issues:
1. Check logs: `supabase functions logs make-server-3dd53475`
2. Check database: Run verification queries above
3. Review implementation: See `IMPLEMENTATION_COMPLETE_SUMMARY.md`
4. Check troubleshooting section above

---

**Status:** Ready for deployment! 🚀
