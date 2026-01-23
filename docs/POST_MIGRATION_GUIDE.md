# Post-Migration Guide - Migration 300

## ✅ Migration Complete - What's Next?

After successfully running the migration, follow these steps to complete the deployment.

---

## Step 1: Verify Migration Success

### Automatic Verification
The migration script should have already verified:
- ✅ Column `customer_phone` exists
- ✅ Data populated (check percentage)
- ✅ Indexes created
- ✅ Triggers created

### Manual Verification (Optional)

Connect to your database and run:

```sql
-- Check column exists and data type
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name = 'customer_phone';

-- Check data population
SELECT 
    COUNT(*) as total_bookings,
    COUNT(customer_phone) as with_phone,
    COUNT(*) - COUNT(customer_phone) as without_phone,
    ROUND(100.0 * COUNT(customer_phone) / COUNT(*), 2) as percentage_populated
FROM bookings;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'bookings' AND indexname LIKE '%customer_phone%';

-- Check triggers
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'bookings'
  AND trigger_name LIKE '%customer_phone%';

-- Check for sync issues (should be 0 or very low)
SELECT COUNT(*) as mismatches
FROM bookings b
JOIN customers c ON c.id = b.customer_id
WHERE b.customer_phone IS NOT NULL
  AND b.customer_phone != c.phone;
```

**Expected Results:**
- Column exists with type `character varying`
- Population rate: 100% (or close to it)
- 2 indexes created
- 3 triggers created
- 0 or minimal mismatches

---

## Step 2: Deploy Backend Code

The code changes are **already implemented** and **backward compatible**. The code uses `COALESCE(b.customer_phone, c.phone)` so it works both before and after migration.

### Deploy to Staging First (Recommended)

```bash
# Option 1: Using npm script
npm run deploy:staging

# Option 2: Using deployment script
./scripts/deploy-backend.sh staging

# Option 3: Manual deployment
cd backend/lambda
npm run build
# Then deploy using your CI/CD pipeline
```

### Verify Staging Deployment

```bash
# Test endpoints on staging
./scripts/verify-api-fixes.sh https://staging-api.warmpawz.com
```

**Expected:** All 7 endpoints return HTTP 200

### Deploy to Production

After staging verification:

```bash
# Option 1: Using npm script
npm run deploy:production

# Option 2: Using deployment script
./scripts/deploy-backend.sh production

# Option 3: Manual deployment
cd backend/lambda
npm run build
# Then deploy using your CI/CD pipeline
```

**Important:** Deploy during low-traffic window if possible.

---

## Step 3: Run Verification Script

After deployment, verify all endpoints work:

```bash
# Development
./scripts/verify-api-fixes.sh http://localhost:3000

# Staging
./scripts/verify-api-fixes.sh https://staging-api.warmpawz.com

# Production
./scripts/verify-api-fixes.sh https://api.warmpawz.com
```

### What the Script Tests

1. ✅ `GET /reminders/upcoming?serviceStyle=tele` - Tele consultation reminders
2. ✅ `GET /customer/bookings/active?phone=...` - Active bookings
3. ✅ `GET /customer/by-phone?phone=...` - Get customer by phone
4. ✅ `GET /customer/bookings?status=in_progress` - In-progress bookings
5. ✅ `GET /customer/notifications` - Customer notifications
6. ✅ `OPTIONS /customer/discover-services` - CORS preflight
7. ✅ `GET /customer/discover-services` - Service discovery

**Expected Output:**
```
✅ All tests passed!
Passed: 7
Failed: 0
```

---

## Step 4: Manual Endpoint Testing

Test each endpoint manually to ensure they work:

### Test 1: Tele Consultation Reminders
```bash
curl "https://api.warmpawz.com/reminders/upcoming?minutes=60&serviceStyle=tele"
```
**Expected:** `{"success": true, "appointments": [...], "count": N}`

### Test 2: Active Bookings
```bash
curl "https://api.warmpawz.com/customer/bookings/active?phone=0123456780"
```
**Expected:** `{"success": true, "bookings": [...], "count": N}`

### Test 3: Get Customer by Phone
```bash
curl "https://api.warmpawz.com/customer/by-phone?phone=0123456780"
```
**Expected:** `{"success": true, "customer": {...}}` or proper error

### Test 4: Customer Bookings
```bash
curl "https://api.warmpawz.com/customer/bookings?phone=0123456780&status=in_progress"
```
**Expected:** `{"success": true, "bookings": [...], "count": N}`

### Test 5: Customer Notifications
```bash
curl "https://api.warmpawz.com/customer/notifications/0123456780?limit=10"
```
**Expected:** `{"success": true, "notifications": [...], "count": N}`

### Test 6: CORS Preflight
```bash
curl -X OPTIONS "https://api.warmpawz.com/customer/discover-services?category=vet&roleId=veterinarian" \
  -H "Origin: https://customer.warmpawz.com" \
  -H "Access-Control-Request-Method: GET"
```
**Expected:** HTTP 200 with CORS headers

### Test 7: Discover Services
```bash
curl "https://api.warmpawz.com/customer/discover-services?category=vet&roleId=veterinarian"
```
**Expected:** `{"success": true, "vendors": [...], "total": N}`

---

## Step 5: Monitor & Validate

### Monitor for 24-48 Hours

#### CloudWatch Metrics to Watch

1. **Error Rates**
   - 500 errors on customer endpoints (should be zero)
   - 503 Service Unavailable errors (should be zero)
   - Database connection failures (should be minimal)

2. **Performance Metrics**
   - Response times for `/reminders/upcoming` (should improve)
   - Query performance with customer_phone index
   - CORS preflight request times

3. **Data Integrity**
   - customer_phone sync accuracy
   - Missing customer_phone values (should be zero)
   - Trigger execution success rate

#### CloudWatch Queries

```sql
-- Check error rates (run in CloudWatch Insights)
fields @timestamp, @message
| filter @message like /error/i or @message like /500/ or @message like /503/
| stats count() by bin(5m)
```

#### Daily Verification Queries

Run these daily for the first week:

```sql
-- Check data population
SELECT 
    COUNT(*) as total,
    COUNT(customer_phone) as with_phone,
    ROUND(100.0 * COUNT(customer_phone) / COUNT(*), 2) as percentage
FROM bookings;

-- Check for sync issues
SELECT COUNT(*) as mismatches
FROM bookings b
JOIN customers c ON c.id = b.customer_id
WHERE b.customer_phone IS NOT NULL
  AND b.customer_phone != c.phone;

-- Check trigger execution (via logs or monitoring)
-- Triggers should fire automatically on INSERT/UPDATE
```

---

## Step 6: Validate Customer Experience

### Test Customer Flows

1. **Tele Consultation Flow**
   - Create a tele consultation booking
   - Verify reminder is sent correctly
   - Check that customer_phone is populated

2. **Active Bookings Flow**
   - View active bookings in customer app
   - Verify bookings load correctly
   - Check that no errors appear

3. **Notifications Flow**
   - Check notifications load
   - Verify no "Service Unavailable" errors

4. **Service Discovery Flow**
   - Search for services
   - Verify CORS works in browser
   - Check that services load correctly

### Gather Feedback

- Monitor customer support tickets
- Check for error reports
- Review user feedback
- Track error rates in analytics

---

## Step 7: Performance Validation

### Before vs After Comparison

**Before Migration:**
- Queries required JOIN with customers table
- Slower response times
- Higher database load

**After Migration:**
- Direct column access (faster)
- Better query performance
- Lower database load

### Performance Metrics to Track

```sql
-- Query performance comparison
EXPLAIN ANALYZE
SELECT b.*, b.customer_phone
FROM bookings b
WHERE b.customer_phone = '0123456780'
AND b.status = 'in_progress';

-- Should use index: idx_bookings_customer_phone_status
```

---

## Step 8: Rollback Plan (If Needed)

### If Issues Occur

#### Rollback Migration (Last Resort)
```sql
-- Only if absolutely necessary
ALTER TABLE bookings DROP COLUMN IF EXISTS customer_phone;
DROP TRIGGER IF EXISTS trigger_sync_booking_customer_phone_insert ON bookings;
DROP TRIGGER IF EXISTS trigger_sync_booking_customer_phone_update ON bookings;
DROP TRIGGER IF EXISTS trigger_update_bookings_customer_phone ON customers;
DROP FUNCTION IF EXISTS sync_booking_customer_phone();
DROP FUNCTION IF EXISTS update_bookings_customer_phone();
DROP INDEX IF EXISTS idx_bookings_customer_phone;
DROP INDEX IF EXISTS idx_bookings_customer_phone_status;
```

#### Rollback Code (If Needed)
- Revert to previous Lambda version
- Code is backward compatible, so rollback is safe
- No data loss

---

## Step 9: Documentation Updates

### Update Runbooks

1. Add customer_phone column to database schema docs
2. Update API documentation
3. Add troubleshooting steps
4. Document the migration process

### Update Team

- Notify team of successful migration
- Share verification results
- Document any issues encountered
- Update knowledge base

---

## Step 10: Success Validation

### Completion Checklist

- [ ] Migration completed successfully
- [ ] Column exists and data populated
- [ ] Indexes and triggers created
- [ ] Code deployed to staging
- [ ] Endpoints tested on staging
- [ ] Code deployed to production
- [ ] Endpoints tested on production
- [ ] Monitoring active (24 hours)
- [ ] No errors in CloudWatch
- [ ] Customer feedback positive
- [ ] Performance improved
- [ ] Documentation updated

### Success Metrics

**Target Metrics:**
- ✅ Zero 500/503 errors on fixed endpoints
- ✅ 100% data population rate
- ✅ Improved query performance
- ✅ Zero customer complaints
- ✅ All endpoints return 200 OK

---

## Troubleshooting Post-Migration

### Issue: Endpoints Still Failing

**Check:**
1. Code is deployed (check Lambda version)
2. Migration completed (check column exists)
3. CloudWatch logs for errors
4. Database connectivity

**Solution:**
- Redeploy code if needed
- Verify migration status
- Check error logs

### Issue: Data Not Populated

**Check:**
```sql
SELECT COUNT(*) FROM bookings WHERE customer_phone IS NULL;
```

**Solution:**
- Triggers should auto-populate on new bookings
- Run manual update if needed:
  ```sql
  UPDATE bookings b
  SET customer_phone = c.phone
  FROM customers c
  WHERE b.customer_id = c.id
    AND b.customer_phone IS NULL;
  ```

### Issue: Performance Not Improved

**Check:**
- Indexes are being used (EXPLAIN ANALYZE)
- Query plans show index usage
- Database load metrics

**Solution:**
- Verify indexes exist
- Check query plans
- Consider additional indexes if needed

---

## Next Actions Summary

1. ✅ **Verify Migration** - Check all verification queries
2. ✅ **Deploy Code** - Deploy to staging, then production
3. ✅ **Test Endpoints** - Run verification script
4. ✅ **Monitor** - Watch CloudWatch for 24-48 hours
5. ✅ **Validate** - Test customer flows
6. ✅ **Document** - Update documentation

---

## Support

If you encounter issues:
1. Check CloudWatch logs
2. Review error messages
3. Verify database connectivity
4. Check migration status
5. Contact backend team if needed

---

**Status:** Ready for post-migration steps
**Next Action:** Verify migration success, then deploy code
