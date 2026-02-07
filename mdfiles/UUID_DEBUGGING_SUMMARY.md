# UUID Issue Debugging Summary

## Problem
The `/customer/behavior-journal` endpoint returns error: `"operator does not exist: uuid = text"`

## Root Cause Analysis

The error occurs when PostgreSQL tries to compare a UUID column with a text value without proper type casting. This happens in several scenarios:

1. **JOIN operations**: When joining UUID columns from different tables
2. **Parameter binding**: When passing string parameters to UUID columns
3. **Subqueries**: When comparing UUID columns in subqueries

## Solutions Attempted

### 1. UUID Casting in JOINs
- **Attempted**: Using `CAST(bj.pet_id AS TEXT) = CAST(p.id AS TEXT)`
- **Result**: Still failed - error persisted

### 2. Subquery Approach
- **Attempted**: Using subqueries instead of JOINs
- **Result**: Still failed - subqueries also had UUID comparison issues

### 3. Using `select()` Function
- **Attempted**: Using the built-in `select()` function which has UUID handling
- **Status**: Currently being tested
- **Expected**: Should handle UUID casting automatically

### 4. Separate Enrichment Queries
- **Attempted**: Fetching pet/customer data separately using `select()`
- **Status**: Implemented
- **Expected**: Avoids JOIN UUID issues

## Current Implementation

The endpoint now:
1. Uses `select()` for main query (handles UUIDs automatically)
2. Uses `select()` for enrichment queries (avoids UUID casting issues)
3. Uses `select()` for trends calculation (avoids UUID issues)
4. Returns early if no filters provided

## Next Steps

1. **Test current implementation** - Verify if `select()` resolves the issue
2. **Check Lambda logs** - If error persists, check exact query causing issue
3. **Alternative approach** - If `select()` also fails, may need to:
   - Check database schema for type mismatches
   - Verify migration created table with correct types
   - Consider using `::text` casting on both sides consistently

## Files Modified

- `backend/lambda/src/endpoints/behavior-journal.ts` - Multiple iterations of UUID handling fixes

## Testing Command

```bash
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/behavior-journal?limit=10" \
  -H "Content-Type: application/json"
```

Expected: Should return `{"success": true, "journal": [], "trends": [], "total": 0, ...}` when no filters provided.
