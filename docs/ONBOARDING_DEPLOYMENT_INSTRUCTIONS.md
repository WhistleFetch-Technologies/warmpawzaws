# Vendor Onboarding - Deployment Instructions

## 🚀 Deployment Checklist

### Pre-Deployment Verification ✅

All components verified and ready:
- ✅ Database migrations created (049, 050)
- ✅ API endpoints implemented and registered
- ✅ Frontend route map created
- ✅ Documentation complete

---

## Step 1: Deploy Code to Dev Environment

The API endpoints are already in the codebase and registered. Deploy to trigger the build:

```bash
# Commit and push changes
git add .
git commit -m "feat: Add vendor onboarding state machine and API endpoints"
git push origin develop
```

This will trigger the GitHub Actions workflow which will:
- Build backend Lambda
- Deploy to AWS
- API endpoints will be available at `https://dev.api.warmpawz.com`

---

## Step 2: Run Database Migrations

**After deployment completes**, run migrations:

### Option A: Via GitHub Actions (if enabled)
The workflow will automatically run migrations if the `database-migrations` job is enabled.

### Option B: Manual Migration (Recommended)

```bash
# Ensure RDS is publicly accessible for dev
./scripts/enable-rds-public-access-dev.sh

# Run migrations
./scripts/manual-migrate.sh dev
```

**Expected Output:**
```
✅ Migration 049 applied successfully
✅ Migration 050 applied successfully
✅ Tables created: vendor_identity, vendor_onboarding_applications, etc.
✅ Functions created: validate_onboarding_transition, etc.
```

### Option C: Direct Database Access

If you have direct database access:

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# Run migrations
cd db
npm run migrate:up
```

---

## Step 3: Verify Database Schema

After migrations run, verify:

```bash
cd db
npm run migrate:status
```

**Check for:**
- `vendor_identity` table
- `vendor_onboarding_applications` table
- `vendor_onboarding_transitions` table
- `vendor_setup_completion` table
- State machine functions

**SQL Verification:**
```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_name IN (
  'vendor_identity',
  'vendor_onboarding_applications',
  'vendor_onboarding_transitions',
  'vendor_setup_completion'
);

-- Check functions
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN (
  'validate_onboarding_transition',
  'transition_onboarding_status',
  'get_onboarding_form_schema',
  'is_vendor_go_live_ready'
);

-- Check role configs
SELECT name, 
       config->'onboardingFormSchema' IS NOT NULL as has_form_schema
FROM roles
WHERE is_active = true;
```

---

## Step 4: Test API Endpoints

Once deployed, test the endpoints:

```bash
# Test onboarding status
curl "https://dev.api.warmpawz.com/vendor/onboarding/status?phone=+919876543210"

# Test get roles
curl "https://dev.api.warmpawz.com/vendor/onboarding/roles"

# Or use the test script
./scripts/test-onboarding-api.sh
```

**Expected Responses:**
- Status endpoint: Returns `onboarding_status: "INIT"` for new vendors
- Roles endpoint: Returns array of roles with configurations

---

## Step 5: Update Role Configurations

Ensure all active roles have `onboardingFormSchema` in their config:

```sql
-- Check which roles need config
SELECT name, display_name
FROM roles
WHERE is_active = true 
  AND (config->'onboardingFormSchema' IS NULL 
       OR config->'onboardingFormSchema' = 'null'::jsonb);

-- Update a role (example)
UPDATE roles
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{onboardingFormSchema}',
  '{
    "solo": {
      "version": "1.0",
      "fields": [...]
    },
    "business": {
      "version": "1.0",
      "fields": [...]
    }
  }'::jsonb
)
WHERE name = 'groomer';
```

**Or use migration 050** which seeds common roles.

---

## Step 6: Frontend Implementation

After backend is deployed and tested:

1. **Create route components** (see `docs/VENDOR_ONBOARDING_NEXT_STEPS.md`)
2. **Implement dynamic form renderer**
3. **Add state recovery on refresh**
4. **Build admin review interface**

---

## Step 7: Admin Panel Setup

1. **Create review page** at `/admin/vendors/onboarding`
2. **List pending applications**
3. **Implement approve/reject/clarify actions**

---

## Troubleshooting

### Migration Fails

**Error:** `relation "vendor_identity" already exists`
- **Solution:** Migration is idempotent, this is safe to ignore

**Error:** `function "validate_onboarding_transition" already exists`
- **Solution:** Function already created, migration can continue

**Error:** Cannot connect to database
- **Solution:** 
  - Enable RDS public access: `./scripts/enable-rds-public-access-dev.sh`
  - Check security groups allow your IP
  - Verify RDS is running

### API Endpoints Not Found

**Error:** 404 on API endpoints
- **Solution:**
  - Verify endpoints are registered in `handler/index.ts`
  - Check Lambda deployment succeeded
  - Verify API Gateway routes are configured

### Form Schema Not Found

**Error:** `Form schema not found for this role and vendor type`
- **Solution:**
  - Check `roles.config->'onboardingFormSchema'` exists
  - Verify vendor_type matches role's supported types
  - Run migration 050 to seed configs

---

## Post-Deployment Verification

Run this checklist:

- [ ] Migrations applied successfully
- [ ] All tables created
- [ ] All functions created
- [ ] API endpoints responding
- [ ] Role configs have form schemas
- [ ] Frontend routes accessible
- [ ] State recovery works on refresh
- [ ] Admin can review applications

---

## Rollback Plan

If issues occur:

1. **Database Rollback:**
   ```sql
   -- Drop tables (CAUTION: This deletes data)
   DROP TABLE IF EXISTS vendor_setup_completion CASCADE;
   DROP TABLE IF EXISTS vendor_onboarding_transitions CASCADE;
   DROP TABLE IF EXISTS vendor_onboarding_applications CASCADE;
   DROP TABLE IF EXISTS vendor_identity CASCADE;
   
   -- Drop functions
   DROP FUNCTION IF EXISTS validate_onboarding_transition;
   DROP FUNCTION IF EXISTS transition_onboarding_status;
   DROP FUNCTION IF EXISTS get_onboarding_form_schema;
   DROP FUNCTION IF EXISTS is_vendor_go_live_ready;
   ```

2. **API Rollback:**
   - Remove endpoint registration from `handler/index.ts`
   - Redeploy Lambda

---

## Support

- **Database Issues:** Check `vendor_onboarding_transitions` for audit trail
- **API Issues:** Check CloudWatch logs for Lambda errors
- **State Issues:** Call `GET /vendor/onboarding/status` to debug

---

**Status:** Ready for deployment! 🚀

