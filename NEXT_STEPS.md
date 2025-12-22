# Next Steps - Financial Fixes Implementation

## ✅ Implementation Status: COMPLETE
All code has been written and is ready for deployment.

---

## Step 1: Apply Database Migrations

### 1.1 Apply Financial Flows Migration
```bash
# Connect to your Supabase database and run:
psql -h <your-db-host> -U postgres -d postgres -f db/migrations/008_financial_flows_complete.sql
```

Or via Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `db/migrations/008_financial_flows_complete.sql`
3. Run the migration

### 1.2 Apply RPC Functions Migration
```bash
psql -h <your-db-host> -U postgres -d postgres -f db/migrations/009_financial_rpc_functions.sql
```

Or via Supabase Dashboard:
1. Copy contents of `db/migrations/009_financial_rpc_functions.sql`
2. Run the migration

### 1.3 Verify Migrations
```sql
-- Check if tables exist
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

-- Check if functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'update_vendor_earnings',
  'reverse_vendor_earnings',
  'reverse_platform_commission',
  'check_coupon_usage',
  'get_vendor_commission_rate',
  'create_settlement'
);
```

---

## Step 2: Seed Default Data

### 2.1 Seed Default Tiers
```bash
# Via API call
curl -X POST https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/admin/payments/tiers/seed-defaults \
  -H "Authorization: Bearer <your-anon-key>"
```

Or manually via SQL:
```sql
-- Default tiers are already inserted in migration 008
-- Verify they exist:
SELECT * FROM vendor_tiers WHERE is_active = true;
```

### 2.2 Seed Default GST Rule
```sql
-- Default GST rule is already inserted in migration 008
-- Verify it exists:
SELECT * FROM gst_rules WHERE enabled = true;
```

---

## Step 3: Update Environment Variables

Ensure these are set in your Supabase project:

```bash
# In Supabase Dashboard > Settings > Edge Functions > Secrets
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Step 4: Deploy Edge Functions

### 4.1 Deploy Updated Functions
```bash
# Deploy the main function
supabase functions deploy make-server-3dd53475

# Or if using Supabase CLI
cd supabase/functions/make-server-3dd53475
supabase functions deploy make-server-3dd53475
```

### 4.2 Verify Deployment
```bash
# Check function logs
supabase functions logs make-server-3dd53475

# Test endpoint
curl https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/payments/tiers
```

---

## Step 5: Test Financial Flows

### 5.1 Run Test Suite
```bash
# Run comprehensive tests
deno test tests/financial-flows-complete.test.ts --allow-net --allow-env

# Or test individual flows
deno test tests/financial-flows-complete.test.ts --filter "Commission"
deno test tests/financial-flows-complete.test.ts --filter "GST"
deno test tests/financial-flows-complete.test.ts --filter "Wallet"
```

### 5.2 Manual Testing Checklist

#### Payment Flow
- [ ] Initiate payment with booking
- [ ] Verify GST is calculated correctly
- [ ] Verify commission is calculated from tier
- [ ] Verify payment is stored in SQL
- [ ] Verify wallet deduction (if used)

#### Refund Flow
- [ ] Process full refund
- [ ] Process partial refund
- [ ] Verify commission reversal
- [ ] Verify wallet credit (if refunded to wallet)
- [ ] Verify cumulative refund tracking

#### Settlement Flow
- [ ] Run daily settlement calculation
- [ ] Verify idempotency (run twice, no duplicates)
- [ ] Verify refunded bookings excluded
- [ ] Verify commission from payment record

#### Tier Upgrade Flow
- [ ] Test upfront payment
- [ ] Test split payment (3 installments)
- [ ] Test 6-month subscription with discount
- [ ] Test 12-month subscription with discount
- [ ] Verify tier activation after payment

#### GST Configuration
- [ ] Create GST rule with role + service style
- [ ] Test rule matching (priority-based)
- [ ] Test inter-state vs intra-state (IGST vs CGST+SGST)
- [ ] Verify GST enforcement in payment

---

## Step 6: Update Frontend

### 6.1 Update Payment Components
The payment flow should automatically use the new endpoints. Verify:
- Payment initiation includes `roleId` and `serviceStyle`
- Payment verification handles wallet deduction
- GST is displayed correctly

### 6.2 Update Tier Management UI
- Admin can configure tier payment options
- Vendors can see upgrade options
- Payment flow works for all options

### 6.3 Update GST Configuration UI
- Admin can create rules with role + service style
- Rules are prioritized correctly
- GST is calculated server-side

---

## Step 7: Monitor & Validate

### 7.1 Check Logs
```bash
# Monitor function logs
supabase functions logs make-server-3dd53475 --follow

# Check for errors
supabase functions logs make-server-3dd53475 | grep -i error
```

### 7.2 Validate Data Integrity
```sql
-- Check payments have commission rates
SELECT COUNT(*) FROM payments WHERE commission_rate IS NULL;
-- Should be 0 for new payments

-- Check refunds have commission reversal
SELECT COUNT(*) FROM refunds WHERE commission_reversed IS NULL;
-- Should be 0 for new refunds

-- Check settlements have unique keys
SELECT settlement_key, COUNT(*) 
FROM settlements 
GROUP BY settlement_key 
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

### 7.3 Performance Check
```sql
-- Check index usage
EXPLAIN ANALYZE 
SELECT * FROM payments 
WHERE vendor_id = 'test-vendor-id' 
ORDER BY created_at DESC 
LIMIT 10;

-- Should use indexes efficiently
```

---

## Step 8: Rollback Plan (If Needed)

If issues occur, you can rollback:

### 8.1 Disable New Endpoints
```typescript
// In index.tsx, comment out:
// paymentEndpoints(app, kv);
// tierUpgradeEndpoints(app);
```

### 8.2 Revert to Old Endpoints
```typescript
// Uncomment old endpoints if needed
// import { paymentEndpoints } from './payment-endpoints-refactored.tsx';
```

### 8.3 Database Rollback
```sql
-- Drop new tables (if needed)
DROP TABLE IF EXISTS tier_upgrade_payments CASCADE;
DROP TABLE IF EXISTS vendor_tier_subscriptions CASCADE;
DROP TABLE IF EXISTS gst_rules CASCADE;
-- etc.
```

---

## Step 9: Documentation

### 9.1 Update API Documentation
- Document new payment endpoints
- Document tier upgrade endpoints
- Document GST configuration endpoints

### 9.2 Update User Guides
- Vendor tier upgrade guide
- Admin GST configuration guide
- Payment flow documentation

---

## Step 10: Production Deployment

### 10.1 Pre-Deployment Checklist
- [ ] All migrations applied
- [ ] All tests passing
- [ ] Environment variables set
- [ ] Functions deployed
- [ ] Frontend updated
- [ ] Documentation updated

### 10.2 Deployment Steps
1. Apply migrations to production database
2. Deploy edge functions
3. Update frontend
4. Monitor for 24 hours
5. Validate all flows

### 10.3 Post-Deployment
- Monitor error rates
- Check payment success rates
- Validate commission calculations
- Verify settlement processing

---

## Troubleshooting

### Issue: Migration fails
**Solution:** Check database permissions and ensure extensions are enabled:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### Issue: Functions not found
**Solution:** Ensure all imports are correct in `index.tsx`:
```typescript
import { paymentEndpoints } from '../server/payment-endpoints-fixed.tsx';
import { tierUpgradeEndpoints } from '../server/tier-upgrade-endpoints.tsx';
```

### Issue: GST not calculating
**Solution:** Verify GST rules exist and are enabled:
```sql
SELECT * FROM gst_rules WHERE enabled = true ORDER BY priority;
```

### Issue: Commission wrong
**Solution:** Verify vendor has a tier assigned:
```sql
SELECT v.id, v.current_tier_id, vt.commission_rate 
FROM vendors v 
LEFT JOIN vendor_tiers vt ON v.current_tier_id = vt.id;
```

---

## Support

If you encounter issues:
1. Check logs: `supabase functions logs make-server-3dd53475`
2. Check database: Run validation queries above
3. Check test suite: Run `deno test tests/financial-flows-complete.test.ts`
4. Review implementation: See `IMPLEMENTATION_COMPLETE_SUMMARY.md`

---

**Status:** Ready for deployment ✅
