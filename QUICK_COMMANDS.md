# Quick Commands Reference

## 🚀 Deployment Commands

### 1. Prepare Migrations (Already Done ✅)
```bash
./scripts/prepare-migrations-for-copy.sh
```
**Result:** Files ready in `./migrations-ready/` directory

### 2. Apply Migrations (Manual - Copy to Supabase SQL Editor)

**Files to copy:**
- `./migrations-ready/008_financial_flows_complete.sql` → Copy to SQL Editor → Run
- `./migrations-ready/009_financial_rpc_functions.sql` → Copy to SQL Editor → Run
- `./migrations-ready/VERIFY_MIGRATIONS.sql` → Copy to SQL Editor → Run (to verify)

### 3. Deploy Functions
```bash
# Option A: Direct command
supabase functions deploy make-server-3dd53475

# Option B: Using script
./scripts/deploy-financial-functions.sh
```

### 4. Verify Setup
```bash
./scripts/validate-financial-setup.sh
```

### 5. Test Endpoints
```bash
# Test tiers endpoint
curl https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/payments/tiers

# Test GST calculation
curl -X POST https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/calculate-gst \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "roleId": "veterinarian", "serviceStyle": "at_center"}'
```

---

## 📋 Quick Checklist

- [ ] Migrations prepared (✅ Done)
- [ ] Migration 008 applied in Supabase SQL Editor
- [ ] Migration 009 applied in Supabase SQL Editor
- [ ] Verification query run (7 tables, 6 functions)
- [ ] Functions deployed: `supabase functions deploy make-server-3dd53475`
- [ ] Setup validated: `./scripts/validate-financial-setup.sh`
- [ ] Endpoints tested

---

## 📁 File Locations

**Migration Files (Ready to Copy):**
- `./migrations-ready/008_financial_flows_complete.sql`
- `./migrations-ready/009_financial_rpc_functions.sql`
- `./migrations-ready/COMBINED_ALL_MIGRATIONS.sql` (optional - both in one)
- `./migrations-ready/VERIFY_MIGRATIONS.sql` (verification query)

**Original Migration Files:**
- `db/migrations/008_financial_flows_complete.sql`
- `db/migrations/009_financial_rpc_functions.sql`

**Helper Scripts:**
- `./scripts/prepare-migrations-for-copy.sh` - Prepare files
- `./scripts/deploy-financial-functions.sh` - Deploy function
- `./scripts/validate-financial-setup.sh` - Validate setup

---

## 🔍 Verification Queries

After applying migrations, run in Supabase SQL Editor:

```sql
-- Quick check: Should return 7
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'gst_rules', 'vendor_tiers', 'vendor_tier_subscriptions',
    'tier_upgrade_payments', 'settlement_booking_mappings',
    'coupon_usage', 'platform_revenue_monthly'
);
```

---

## ⚡ One-Liner Commands

```bash
# Prepare + Validate
./scripts/prepare-migrations-for-copy.sh && ./scripts/validate-financial-setup.sh

# Deploy + Verify
supabase functions deploy make-server-3dd53475 && ./scripts/validate-financial-setup.sh
```

