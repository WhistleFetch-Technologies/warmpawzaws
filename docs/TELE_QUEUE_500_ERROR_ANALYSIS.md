# Tele Queue Join - 500 Error Analysis

## Error Details

**Error Message:**
```
Failed to load resource: the server responded with a status of 500
Error joining queue: ApiError: HTTP 500
```

**Location:** `POST /customer/tele/join-queue` endpoint

## Root Causes

The 500 error can occur due to several issues in the join-queue endpoint:

### 1. **Database Migration 216 Not Applied** ⚠️ MOST LIKELY

**Issue:** The `tele_queue` table is missing the `vendor_id` column required for solo vendors.

**Error Location:** Lines 1067-1075 in `instant-tele-queue.ts`

```typescript
if (isSoloVendor && !hasVendorIdColumn) {
  return c.json({ 
    error: 'Database migration required. Please run migration 216...',
    migrationRequired: true,
    migrationNumber: 216
  }, 500);
}
```

**Solution:** Run migration 216 to add `vendor_id` column and make `staff_id` nullable.

**Check Migration Status:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'tele_queue' AND column_name = 'vendor_id';
```

### 2. **UUID Type Mismatch Error** 🔴

**Error:** `operator does not exist: uuid = text`

**Potential Locations:**
- **Line 994:** `WHERE ss.staff_id = $1 AND ss.service_id = $2::uuid`
  - If `actualStaffId` is passed as text instead of UUID
  - If `resolvedServiceId` is not a valid UUID format
  
- **Line 1008:** `ss.service_id::text = $2`
  - Comparing UUID column (cast to text) with parameter that might be UUID type

**Solution:** Ensure all UUID parameters are properly validated and cast:
```typescript
// Validate UUID format before using
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(actualStaffId)) {
  return c.json({ error: 'Invalid staff ID format' }, 400);
}
```

### 3. **Database Constraint Violation** 🔴

**Error:** `null value in column "staff_id" violates not-null constraint`

**Location:** Lines 1144-1154

**Cause:** Trying to insert a queue entry with `staff_id = null` when the column is NOT NULL (migration 216 not applied).

**Solution:** Migration 216 should make `staff_id` nullable to support solo vendors.

### 4. **Service ID Resolution Failure** ⚠️

**Location:** Lines 798-829

**Issue:** If `serviceId` cannot be resolved to a valid UUID, the query at line 1017 might fail.

**Error Flow:**
1. `serviceId` is not a UUID
2. Service lookup fails (lines 814-819)
3. Returns 404, but if error handling fails, could result in 500

### 5. **Staff ID Validation Issues** ⚠️

**Location:** Lines 772-788

**Issue:** If `staffId` is in format `vendor_<uuid>` but UUID extraction fails, validation might pass but queries fail later.

## Debugging Steps

### Step 1: Check CloudWatch Logs

Look for these log messages:
```
[TELE-QUEUE] Join queue request: { isSoloVendor, originalStaffId, actualVendorId, actualStaffId, serviceId }
Error joining tele queue: <error details>
```

### Step 2: Verify Database Schema

```sql
-- Check if vendor_id column exists
SELECT column_name, is_nullable, data_type
FROM information_schema.columns 
WHERE table_name = 'tele_queue' 
AND column_name IN ('vendor_id', 'staff_id');

-- Check staff_id nullable status
SELECT is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tele_queue' AND column_name = 'staff_id';
```

### Step 3: Test with Specific Parameters

Use the test script:
```bash
node scripts/test-tele-queue-join.js
```

### Step 4: Check Request Payload

Verify the frontend is sending correct data:
```typescript
{
  customerId: string (UUID),
  staffId: string (UUID or 'vendor_<uuid>'),
  petId: string (UUID),
  serviceId: string (UUID or service name),
  symptoms?: string,
  urgency?: 'normal' | 'urgent',
  notes?: string
}
```

## Common Scenarios

### Scenario 1: Solo Vendor Without Migration
- **Request:** `staffId: "vendor_123e4567-e89b-12d3-a456-426614174000"`
- **Error:** 500 - Migration 216 required
- **Fix:** Run migration 216

### Scenario 2: Invalid UUID Format
- **Request:** `staffId: "invalid-uuid"` or `serviceId: "not-a-uuid"`
- **Error:** 500 - UUID type mismatch
- **Fix:** Validate UUIDs before database queries

### Scenario 3: Service Not Found
- **Request:** `serviceId: "non-existent-service"`
- **Expected:** 404 - Service not found
- **Actual:** Could be 500 if error handling fails

## Fixes Applied

The code already includes several error handling improvements:

1. ✅ **UUID Validation** (lines 770-788)
2. ✅ **Migration Check** (lines 1059-1076)
3. ✅ **Constraint Error Handling** (lines 1144-1154)
4. ✅ **Service Resolution** (lines 798-829)

## Recommended Actions

1. **Check Migration Status:**
   ```bash
   # Check if migration 216 has been applied
   # Look for vendor_id column in tele_queue table
   ```

2. **Add Better Error Logging:**
   ```typescript
   console.error('[TELE-QUEUE] Join queue error:', {
     error: error.message,
     stack: error.stack,
     requestBody: { customerId, staffId, petId, serviceId },
     isSoloVendor,
     actualStaffId,
     actualVendorId
   });
   ```

3. **Validate All UUIDs Before Queries:**
   - Ensure `customerId` is valid UUID
   - Ensure `petId` is valid UUID
   - Ensure `staffId` or extracted `actualStaffId`/`actualVendorId` is valid UUID
   - Ensure `resolvedServiceId` is valid UUID or handle text properly

4. **Improve Error Messages:**
   - Return specific error codes for different failure types
   - Include migration status in error response
   - Provide actionable error messages

## Error Response Format

Current error responses:
```json
{
  "error": "Error message",
  "details": "Stack trace (dev only)",
  "migrationRequired": true,  // If migration issue
  "migrationNumber": 216      // Migration number needed
}
```

## Next Steps

1. ✅ Check CloudWatch logs for specific error message
2. ✅ Verify migration 216 status
3. ✅ Test with valid UUIDs
4. ✅ Add enhanced logging for debugging
5. ✅ Fix UUID type casting issues

## Debugging Tools

### Quick Diagnostic Script

Run the comprehensive diagnostic tool:

```bash
# Check all aspects of the tele queue setup
node scripts/debug-tele-queue-500.js

# For production environment
ENVIRONMENT=prod node scripts/debug-tele-queue-500.js
```

This script checks:
- ✅ Migration 216 status (vendor_id column, nullable staff_id)
- ✅ Table data and constraints
- ✅ Service schema compatibility
- ✅ Recent CloudWatch logs for errors

### Check Migration 216 Status

Quick check if migration is applied:

```bash
node scripts/check-migration-216-status.js
```

### Check CloudWatch Logs

View recent tele queue errors from CloudWatch:

```bash
# Check logs from last 30 minutes (default)
./scripts/check-tele-queue-logs.sh

# Check logs from last 60 minutes
./scripts/check-tele-queue-logs.sh dev ap-south-1 60

# For production
./scripts/check-tele-queue-logs.sh prod ap-south-1 30
```

### Apply Migration 216

If migration is not applied:

```bash
node scripts/run-migration-216-tele-queue-vendor-support.js
```

### Test Queue Join

Test the queue join endpoint:

```bash
node scripts/test-tele-queue-join.js
```

## Debugging Workflow

1. **Run Diagnostic Script:**
   ```bash
   node scripts/debug-tele-queue-500.js
   ```
   This will show you:
   - Migration status
   - Database schema issues
   - Recent error logs

2. **If Migration 216 Not Applied:**
   ```bash
   node scripts/run-migration-216-tele-queue-vendor-support.js
   ```

3. **Check Recent Errors:**
   ```bash
   ./scripts/check-tele-queue-logs.sh
   ```

4. **Test the Fix:**
   ```bash
   node scripts/test-tele-queue-join.js
   ```

5. **If Still Failing:**
   - Check CloudWatch logs for detailed error context
   - Verify request payload has valid UUIDs
   - Check if provider/service exists in database
   - Review error response for specific error code
