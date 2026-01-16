# 🚀 Run Loyalty Segments Migrations - Quick Guide

## ✅ Everything is Ready!

All code is in place. You just need to run the database migrations.

---

## Option 1: Using the Migration Script (Recommended)

### Step 1: Set Database URL

```bash
# For local database
export DATABASE_URL="postgresql://user:password@localhost:5432/warmpawz"

# For AWS RDS
export DATABASE_URL="postgresql://admin:password@your-rds-endpoint.region.rds.amazonaws.com:5432/warmpawz"

# For Supabase
export DATABASE_URL="postgresql://postgres:password@db.project.supabase.co:5432/postgres"
```

### Step 2: Run the Script

```bash
./scripts/run-loyalty-segments-migrations.sh
```

The script will:
- ✅ Check database connection
- ✅ Run Migration 064 (creates segments system)
- ✅ Run Migration 065 (updates rules)
- ✅ Verify migrations succeeded
- ✅ Show segment count and sample data

---

## Option 2: Using psql Directly

### Step 1: Connect to Database

```bash
psql $DATABASE_URL
```

### Step 2: Run Migrations

```sql
-- Run Migration 064
\i db/migrations/064_loyalty_segments_system.sql

-- Run Migration 065
\i db/migrations/065_update_loyalty_rules_with_segments.sql
```

### Step 3: Verify

```sql
-- Should return 14
SELECT COUNT(*) FROM loyalty_segments;

-- View segments
SELECT segment_name, segment_type, is_active 
FROM loyalty_segments 
ORDER BY priority DESC;
```

---

## Option 3: Using Node.js Migration Runner

If you have the db/run-migration.js script:

```bash
cd db
export DATABASE_URL="your-connection-string"

# Run Migration 064
node run-migration.js migrations/064_loyalty_segments_system.sql

# Run Migration 065
node run-migration.js migrations/065_update_loyalty_rules_with_segments.sql
```

---

## ✅ Verification Checklist

After running migrations, verify:

```sql
-- 1. Check segments table exists
SELECT COUNT(*) FROM loyalty_segments;
-- Expected: 14

-- 2. Check segment assignments table exists
SELECT COUNT(*) FROM customer_segment_assignments;
-- Expected: 0 initially (will populate as customers match)

-- 3. Check default segments
SELECT segment_name, segment_type 
FROM loyalty_segments 
WHERE is_active = true
ORDER BY priority DESC;
-- Should show: Medicine Buyers, Grooming Service Users, etc.

-- 4. Check if rules were updated
SELECT action_name, conditions->>'segment_ids' as segment_ids
FROM loyalty_action_rules
WHERE conditions->>'segment_ids' IS NOT NULL
LIMIT 5;
-- Should show some rules with segment_ids
```

---

## 🎯 What Happens After Migrations

### ✅ Created:
- `loyalty_segments` table
- `customer_segment_assignments` table  
- `vendor_segment_assignments` table
- 14 default segments
- Updated loyalty rules with segment references

### ✅ Ready to Use:
- API endpoints: `/admin/loyalty-segments`
- UI component: `/loyalty` → Segments tab
- Rule engine: Can now use segments in conditions

---

## 🔧 Troubleshooting

### Error: "relation already exists"
- This is OK! Migrations use `IF NOT EXISTS`
- Tables already exist, migration skipped safely

### Error: "connection refused"
- Check DATABASE_URL is correct
- Verify database is running
- Check network/firewall settings

### Error: "permission denied"
- Verify database user has CREATE TABLE permissions
- Check user has access to the database

### Migration runs but no segments?
- Check migration output for errors
- Verify migration file was read correctly
- Check database logs

---

## 📞 Next Steps After Migrations

1. **Test API:**
   ```bash
   curl http://your-api.com/admin/loyalty-segments
   ```

2. **Test UI:**
   - Navigate to `/loyalty` page
   - Click "Segments" tab
   - Should see 14 segments

3. **Create a Test Segment:**
   - Use UI or API to create a custom segment
   - Verify it appears in the list

4. **Use in Rules:**
   - Update a loyalty rule to reference a segment
   - Test with a transaction
   - Verify points are awarded

---

## 🎉 Success!

Once migrations complete successfully, your loyalty segmentation system is live!

**All code is already deployed** - you just needed to run the database migrations.

---

**Ready?** Run: `./scripts/run-loyalty-segments-migrations.sh`
