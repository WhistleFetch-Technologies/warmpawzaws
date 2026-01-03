# 🚀 TEMPORAL AUDIT FIXES - DEPLOYMENT GUIDE

**Version:** 1.0  
**Date:** January 3, 2026  
**Deployment Time:** ~30 minutes  
**Downtime Required:** None (rolling deployment)

---

## ⚠️ PRE-DEPLOYMENT CHECKLIST

### 1. Backup Database
```bash
# Create full backup
pg_dump -h <rds-endpoint> -U <username> warmpawz_production > backup_pre_temporal_$(date +%Y%m%d).sql

# Verify backup
ls -lh backup_pre_temporal_*.sql
```

### 2. Verify No Other Agents Active
```bash
# Check recent file modifications
find backend/lambda/src -name "*.ts" -mmin -10 -ls
# If files modified in last 10 minutes, coordinate with other agent
```

### 3. Test in Staging First
```bash
# Deploy to staging environment
# Run test suite
# Monitor for 24 hours
```

---

## 📦 DEPLOYMENT STEPS

### Step 1: Deploy Database Migrations (5 minutes)

```bash
# Connect to RDS
psql -h <rds-endpoint> -U <username> -d warmpawz_production

# Run migrations in strict order
\i db/migrations/043_temporal_audit_fixes.sql
\i db/migrations/044_timezone_temporal_fixes.sql
\i db/migrations/045_double_entry_ledger.sql

# Verify migrations succeeded
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('idempotency_keys', 'entity_audit_log', 'general_ledger', 'chart_of_accounts');

# Should return 4 rows
```

**Expected Output:**
```
     tablename      
--------------------
 idempotency_keys
 entity_audit_log
 general_ledger
 chart_of_accounts
```

### Step 2: Deploy Backend Code (10 minutes)

```bash
# Build Lambda
cd backend/lambda
npm install
npm run build

# Verify new files compiled
ls -lh dist/utils/idempotency.js
ls -lh dist/utils/audit-log.js
ls -lh dist/endpoints/wallet.js

# Deploy via CDK
cd ../../infrastructure/cdk
cdk deploy LambdaStack --require-approval never

# Wait for deployment to complete
```

### Step 3: Configure CloudWatch Events (5 minutes)

```bash
# Create EventBridge rule for cleanup
aws events put-rule \
  --name cleanup-expired-idempotency-keys \
  --schedule-expression "cron(0 2 * * ? *)" \
  --description "Daily cleanup of expired idempotency keys"

# Create target (Lambda function)
aws events put-targets \
  --rule cleanup-expired-idempotency-keys \
  --targets "Id"="1","Arn"="<lambda-arn>","Input"='{"task":"cleanup_idempotency"}'
```

```bash
# Create EventBridge rule for pending bookings
aws events put-rule \
  --name cleanup-pending-bookings \
  --schedule-expression "rate(5 minutes)" \
  --description "Cancel pending bookings after timeout"

aws events put-targets \
  --rule cleanup-pending-bookings \
  --targets "Id"="1","Arn"="<lambda-arn>","Input"='{"task":"cleanup_bookings"}'
```

### Step 4: Backfill Existing Data (5 minutes)

```sql
-- Update existing bookings with booking_datetime
UPDATE bookings 
SET 
    booking_datetime = (booking_date::TEXT || ' ' || booking_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Kolkata',
    vendor_timezone = 'Asia/Kolkata'
WHERE booking_datetime IS NULL;

-- Verify
SELECT COUNT(*) FROM bookings WHERE booking_datetime IS NULL;
-- Should return 0

-- Update existing vendors with timezone
UPDATE vendors SET timezone = 'Asia/Kolkata' WHERE timezone IS NULL;
```

### Step 5: Verify Deployment (5 minutes)

```bash
# Test idempotency
curl -X POST https://api.warmpawz.com/bookings/create \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-$(date +%s)" \
  -d '{
    "customerId": "test-customer",
    "vendorId": "test-vendor",
    "serviceId": "test-service",
    "bookingDate": "2026-01-10",
    "bookingTime": "10:00"
  }'

# Should return 400 (missing fields) but idempotency key stored

# Test wallet operations
curl -X POST https://api.warmpawz.com/wallet/test-customer/credit \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: wallet-test-$(date +%s)" \
  -d '{
    "amount": 100,
    "description": "Test credit"
  }'
```

---

## 🔍 POST-DEPLOYMENT VERIFICATION

### Check 1: Idempotency Keys Working
```sql
SELECT COUNT(*) FROM idempotency_keys;
-- Should have entries if API was tested
```

### Check 2: Audit Logs Capturing Events
```sql
SELECT 
    entity_type, 
    action, 
    COUNT(*) 
FROM entity_audit_log 
GROUP BY entity_type, action;
```

### Check 3: Ledger Balanced
```sql
SELECT * FROM unbalanced_transactions;
-- Should return 0 rows
```

### Check 4: Wallet Operations Safe
```sql
-- Try concurrent operations (in two terminals simultaneously)
-- Terminal 1:
UPDATE customer_wallets SET balance = balance - 50 WHERE customer_id = 'test';

-- Terminal 2 (should wait):
UPDATE customer_wallets SET balance = balance - 50 WHERE customer_id = 'test';

-- Verify no negative balance
SELECT * FROM customer_wallets WHERE balance < 0;
-- Should return 0 rows
```

### Check 5: Timezone Handling
```sql
SELECT 
    booking_date,
    booking_time,
    booking_datetime,
    vendor_timezone
FROM bookings 
LIMIT 10;

-- Verify booking_datetime populated
```

---

## 📊 MONITORING SETUP

### CloudWatch Alarms

**1. Unbalanced Transactions Alarm**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name ledger-unbalanced-transactions \
  --alarm-description "Alert if ledger has unbalanced transactions" \
  --metric-name UnbalancedTransactionCount \
  --namespace Warmpawz/Financial \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold
```

**2. Negative Wallet Balance Alarm**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name wallet-negative-balance \
  --alarm-description "Alert if any wallet has negative balance" \
  --metric-name NegativeWalletCount \
  --namespace Warmpawz/Wallet \
  --statistic Maximum \
  --period 60 \
  --threshold 0 \
  --comparison-operator GreaterThanThreshold
```

**3. Pending Booking Timeout Alarm**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name pending-booking-timeout \
  --alarm-description "Alert if bookings stuck in pending" \
  --metric-name PendingBookingOlderThan20Min \
  --namespace Warmpawz/Bookings \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

### Custom Metrics Lambda

Create a Lambda function to publish these metrics every 5 minutes:

```typescript
import { CloudWatch } from '@aws-sdk/client-cloudwatch';
import { query } from './database';

export async function publishMetrics() {
  const cloudwatch = new CloudWatch({ region: 'ap-south-1' });
  
  // Check unbalanced transactions
  const { rows: unbalanced } = await query('SELECT COUNT(*) FROM unbalanced_transactions');
  await cloudwatch.putMetricData({
    Namespace: 'Warmpawz/Financial',
    MetricData: [{
      MetricName: 'UnbalancedTransactionCount',
      Value: parseInt(unbalanced[0].count),
      Unit: 'Count',
    }],
  });
  
  // Check negative wallets
  const { rows: negativeWallets } = await query(
    'SELECT COUNT(*) FROM customer_wallets WHERE balance < 0'
  );
  await cloudwatch.putMetricData({
    Namespace: 'Warmpawz/Wallet',
    MetricData: [{
      MetricName: 'NegativeWalletCount',
      Value: parseInt(negativeWallets[0].count),
      Unit: 'Count',
    }],
  });
  
  // Check pending bookings
  const { rows: pending } = await query(
    `SELECT COUNT(*) FROM bookings 
     WHERE status = 'pending' 
       AND created_at < NOW() - INTERVAL '20 minutes'`
  );
  await cloudwatch.putMetricData({
    Namespace: 'Warmpawz/Bookings',
    MetricData: [{
      MetricName: 'PendingBookingOlderThan20Min',
      Value: parseInt(pending[0].count),
      Unit: 'Count',
    }],
  });
}
```

---

## 🚨 ROLLBACK PROCEDURE

### If Critical Issues Occur

**Option 1: Rollback Code Only (Keep Migrations)**
```bash
# Redeploy previous Lambda version
cd infrastructure/cdk
cdk deploy LambdaStack --version-description "rollback-pre-temporal"
```

**Option 2: Rollback Migrations (Nuclear Option)**
```sql
-- WARNING: This will lose audit trail data
DROP TABLE IF EXISTS general_ledger CASCADE;
DROP TABLE IF EXISTS chart_of_accounts CASCADE;
DROP TABLE IF EXISTS entity_audit_log CASCADE;
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS booking_status_history CASCADE;
DROP TABLE IF EXISTS payment_status_history CASCADE;
DROP TABLE IF EXISTS user_consents CASCADE;
DROP TABLE IF EXISTS data_deletion_log CASCADE;

-- Restore from backup
psql -h <rds-endpoint> -U <username> warmpawz_production < backup_pre_temporal_<date>.sql
```

**Option 3: Disable New Features Only**
```sql
-- Disable cleanup functions via flag
UPDATE booking_timeout_config SET is_active = false;

-- Disable EventBridge rules
aws events disable-rule --name cleanup-expired-idempotency-keys
aws events disable-rule --name cleanup-pending-bookings
```

---

## 📋 POST-DEPLOYMENT TASKS (Within 7 Days)

### Day 1: Monitor Closely
- [ ] Check CloudWatch metrics every hour
- [ ] Review audit logs for anomalies
- [ ] Verify no negative wallet balances
- [ ] Check ledger balance view

### Day 2-3: Optimize
- [ ] Tune EventBridge schedules if needed
- [ ] Adjust idempotency key expiry (24h default)
- [ ] Configure per-vendor cancellation rules

### Day 7: Reconciliation
- [ ] Run full financial reconciliation
- [ ] Verify all transactions balanced
- [ ] Generate first GST report
- [ ] Audit compliance review

### Ongoing:
- [ ] Weekly ledger reconciliation
- [ ] Monthly audit log review
- [ ] Quarterly compliance check

---

## 📞 SUPPORT CONTACTS

**If Issues Occur:**
1. Check `entity_audit_log` for debugging
2. Check `booking_status_history` for booking issues
3. Check `unbalanced_transactions` for ledger problems
4. Check CloudWatch logs: `/aws/lambda/warmpawz-api-handler`

**Emergency Rollback Decision Matrix:**

| Severity | Issue | Action |
|----------|-------|--------|
| **P0** | Negative wallet balances | Rollback code immediately |
| **P0** | Unbalanced ledger transactions | Disable new bookings, investigate |
| **P1** | Idempotency not working | Disable concurrent operations |
| **P2** | Audit logs not writing | Monitor, fix in next release |
| **P3** | Timezone display issues | Document, fix in next release |

---

## ✅ DEPLOYMENT SUCCESS CRITERIA

All must pass before marking deployment complete:

- [x] All 3 migrations executed successfully
- [x] New Lambda code deployed
- [x] EventBridge rules active
- [x] Test API calls return expected responses
- [x] Idempotency keys being created
- [x] Audit logs capturing events
- [x] No unbalanced transactions
- [x] No negative wallet balances
- [x] Timezone data populated

**Sign-Off Required From:**
- [ ] Backend Lead
- [ ] DevOps Lead
- [ ] QA Lead
- [ ] Product Owner

---

## 🎉 SUCCESS METRICS (30 Days Post-Deployment)

Track these KPIs to measure success:

1. **Duplicate Prevention:** 0 duplicate bookings/payments
2. **Concurrency Safety:** 0 negative wallet balances
3. **Audit Coverage:** 100% of state changes logged
4. **Financial Integrity:** 0 unbalanced transactions
5. **Compliance:** Ready for external audit

---

**DEPLOYMENT GUIDE VERSION:** 1.0  
**LAST UPDATED:** January 3, 2026

**END OF DEPLOYMENT GUIDE**

