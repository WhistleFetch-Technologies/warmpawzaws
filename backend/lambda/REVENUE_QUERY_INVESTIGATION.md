# Revenue Analytics Query Investigation

## Current Status
✅ **Backend API is running** and accessible at `http://localhost:3000/admin/analytics/revenue?period=30d`
❌ **Query returns empty array** `[]`

## Query Being Tested

```sql
SELECT DATE_TRUNC('day', created_at) as date, 
        COALESCE(SUM(amount), 0) as revenue,
        COALESCE(SUM(COALESCE(platform_fee, commission_amount)), 0) as commission,
        COUNT(*) as count
 FROM payments 
 WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' 
   AND payment_status IN ('completed', 'success')
 GROUP BY DATE_TRUNC('day', created_at)
 ORDER BY date;
```

**Location:** `backend/lambda/src/endpoints/admin/endpoints/analytics.admin.ts` (lines 644-651)

## Investigation Steps

### Step 1: Check if payments table exists
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'payments'
);
```

### Step 2: Check total payments count
```sql
SELECT COUNT(*) as total FROM payments;
```

### Step 3: Check payment_status distribution
```sql
SELECT payment_status, COUNT(*) as count 
FROM payments 
GROUP BY payment_status 
ORDER BY count DESC;
```
**Why:** The query filters for `payment_status IN ('completed', 'success')`. If payments use different status values (e.g., 'paid', 'successful', 'confirmed'), they won't match.

### Step 4: Check payments in date range
```sql
SELECT COUNT(*) as count
FROM payments 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
```

### Step 5: Check payments with completed/success status
```sql
SELECT COUNT(*) as count
FROM payments 
WHERE payment_status IN ('completed', 'success');
```

### Step 6: Check payments matching BOTH conditions
```sql
SELECT COUNT(*) as count
FROM payments 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' 
  AND payment_status IN ('completed', 'success');
```

### Step 7: Sample recent payments
```sql
SELECT 
  id, 
  amount, 
  payment_status, 
  created_at,
  platform_fee,
  commission_amount
FROM payments 
ORDER BY created_at DESC 
LIMIT 10;
```

### Step 8: Check date range boundaries
```sql
SELECT 
  MIN(created_at) as oldest_payment,
  MAX(created_at) as newest_payment,
  CURRENT_DATE - INTERVAL '30 days' as cutoff_date
FROM payments;
```

### Step 9: Check bookings table (alternative revenue source)
```sql
SELECT COUNT(*) as total FROM bookings;

SELECT COUNT(*) as completed_bookings, COALESCE(SUM(total_amount), 0) as revenue
FROM bookings 
WHERE status = 'completed'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';
```

## Most Likely Issues

### Issue 1: Payment Status Mismatch
**Problem:** Payments might have different status values than `'completed'` or `'success'`
**Solution:** Update the query to include all relevant statuses:
```sql
WHERE payment_status IN ('completed', 'success', 'paid', 'successful', 'confirmed')
```

### Issue 2: No Payments in Date Range
**Problem:** All payments are older than 30 days
**Solution:** 
- Increase the period (e.g., `90d` or `1y`)
- Check if `created_at` dates are correct

### Issue 3: Revenue in Bookings Table Instead
**Problem:** Revenue might be tracked in `bookings.total_amount` instead of `payments.amount`
**Solution:** Modify query to use bookings:
```sql
SELECT DATE_TRUNC('day', b.created_at) as date, 
        COALESCE(SUM(b.total_amount), 0) as revenue,
        COALESCE(SUM(b.total_amount * 0.02), 0) as commission, -- 2% default
        COUNT(*) as count
 FROM bookings b
 WHERE b.created_at >= CURRENT_DATE - INTERVAL '30 days' 
   AND b.status = 'completed'
 GROUP BY DATE_TRUNC('day', b.created_at)
 ORDER BY date;
```

### Issue 4: No Payments Exist
**Problem:** The `payments` table is empty
**Solution:** 
- Check if payments are being created when bookings are made
- Verify payment creation logic in the codebase

## Recommended Fixes

### Fix 1: Make Status Filter More Flexible
Update `analytics.admin.ts` line 649:
```typescript
// Current:
AND payment_status IN ('completed', 'success')

// Suggested:
AND payment_status IN ('completed', 'success', 'paid', 'successful', 'confirmed', 'settled')
```

### Fix 2: Add Fallback to Bookings Table
If payments table is empty but bookings exist, query bookings instead:
```typescript
// Check if payments has data first
const paymentsCount = await query('SELECT COUNT(*) FROM payments WHERE payment_status IN (...)');
if (parseInt(paymentsCount.rows[0].count) === 0) {
  // Fallback to bookings
  const revenueData = await query(`
    SELECT DATE_TRUNC('day', created_at) as date, 
            COALESCE(SUM(total_amount), 0) as revenue,
            COALESCE(SUM(total_amount * 0.02), 0) as commission,
            COUNT(*) as count
     FROM bookings 
     WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days' 
       AND status = 'completed'
     GROUP BY DATE_TRUNC('day', created_at)
     ORDER BY date
  `);
}
```

### Fix 3: Handle Empty Results Gracefully
Update the frontend to show a message when no data is available:
```typescript
if (!data || data.length === 0) {
  return <EmptyState message="No revenue data available for this period" />;
}
```

## How to Run Investigation

### Option 1: Via API (if backend is running)
```bash
curl http://localhost:3000/admin/analytics/revenue?period=30d
```

### Option 2: Direct Database Query
If you have access to the database:
```bash
psql -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME>
```
Then run the SQL queries from Steps 1-9 above.

### Option 3: Use the Investigation Script
```bash
cd backend/lambda
node investigate-revenue-empty.js
```
(Requires local PostgreSQL or remote database access)

## Next Steps

1. ✅ **Run Step 3** to check actual payment_status values
2. ✅ **Run Step 4** to check if payments exist in date range
3. ✅ **Run Step 9** to check if bookings table has revenue data
4. ✅ **Update query** based on findings
5. ✅ **Test** the updated query via API endpoint
