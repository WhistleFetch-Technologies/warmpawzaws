# Populate Problem Grid Mappings - Guide

## Overview

The problem grid mappings table (`problem_grid_mappings`) needs to be populated from the problem grid catalog to enable efficient SQL-based discovery.

---

## Method 1: Via API Endpoint (Recommended)

### Prerequisites
- Supabase project URL
- API key (Service Role Key recommended)

### Steps

1. **Set Environment Variables** (optional, can use .env file):
   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

2. **Run the Script**:
   ```bash
   ./scripts/populate-problem-grid-mappings.sh
   ```

3. **Or Call Directly via cURL**:
   ```bash
   curl -X POST \
     "https://your-project.supabase.co/functions/v1/make-server-3dd53475/admin/populate-problem-grid-mappings" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "apikey: YOUR_SERVICE_ROLE_KEY"
   ```

### Expected Response
```json
{
  "success": true,
  "inserted": 150,
  "errors": 0,
  "message": "Problem grid mappings populated: 150 inserted, 0 errors"
}
```

---

## Method 2: Via SQL (Alternative)

### Prerequisites
- Direct database access
- `psql` installed
- `deno` installed

### Steps

1. **Apply Migration** (if not already applied):
   ```bash
   psql $DATABASE_URL -f db/migrations/010_populate_problem_grid_mappings.sql
   ```

2. **Run Migration Service**:
   ```bash
   deno run --allow-net --allow-env --allow-read \
     supabase/lib/services/problem-grid-migration.ts
   ```

   Or use the helper script:
   ```bash
   ./scripts/populate-mappings-via-sql.sh
   ```

---

## Method 3: Via Supabase Dashboard

1. **Go to SQL Editor** in Supabase Dashboard

2. **Apply Migration** (if not already applied):
   - Copy contents of `db/migrations/010_populate_problem_grid_mappings.sql`
   - Paste and run in SQL Editor

3. **Call the RPC Function** (if you have a way to execute TypeScript):
   - The migration service needs to be run to populate from catalog
   - Use Method 1 (API endpoint) instead

---

## Verification

After populating, verify the mappings:

```sql
-- Check total mappings
SELECT COUNT(*) FROM problem_grid_mappings;

-- Check mappings by role
SELECT role_id, COUNT(*) as count
FROM problem_grid_mappings
GROUP BY role_id
ORDER BY role_id;

-- Check a specific problem
SELECT * FROM problem_grid_mappings
WHERE problem_id = 'dentistry'
ORDER BY order_index;
```

**Expected:** Should have mappings for all problem grids across all roles.

---

## Troubleshooting

### Issue: Endpoint returns 404
**Solution:** Ensure the endpoint is registered in `index.tsx`:
```typescript
registerProblemGridMigrationEndpoints(app);
```

### Issue: Endpoint returns 500
**Solution:** 
1. Check that migration 010 is applied
2. Verify the `populate_problem_grid_mapping` function exists
3. Check function logs for errors

### Issue: No mappings inserted
**Solution:**
1. Verify problem grid catalog has `mappedSubCategories`
2. Check that role mappings are correct in `problem-grid-migration.ts`
3. Review error count in response

### Issue: Some errors in response
**Solution:**
- Check which specific mappings failed
- Verify subcategory IDs exist in service catalog
- Check for duplicate entries (should be handled by ON CONFLICT)

---

## What Gets Populated

The migration service populates mappings for:
- **Veterinary problems** → `veterinarian` role
- **Grooming needs** → `groomer` role
- **Training goals** → `trainer` role
- **Walking needs** → `walker` role
- **Behavioral issues** → `behaviourist` role
- **Boarding needs** → `boarding` role
- **Nutrition needs** → `nutritionist` role

Each problem grid's `mappedSubCategories` array is inserted as individual rows in `problem_grid_mappings`.

---

## Next Steps

After populating:
1. ✅ Verify mappings exist: Run verification SQL above
2. ✅ Test discovery endpoints: Try a problem grid search
3. ✅ Monitor performance: Check query execution times
4. ✅ Update indexes: Ensure indexes are optimized

---

**Status:** Ready to populate! Use Method 1 (API endpoint) for easiest approach.

