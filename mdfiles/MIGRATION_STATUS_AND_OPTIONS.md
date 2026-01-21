# Migration Status & Options

## Current Status

The migration script is ready, but the database connection is failing. This means either:
1. The database is not running
2. The connection string needs to be updated
3. Network/firewall issues

## Options to Run Migrations

### Option 1: Start Local Database (If Using Docker)

```bash
# Start PostgreSQL using Docker Compose
docker-compose up -d postgres

# Wait for it to be ready
sleep 5

# Then run migrations
source .env.local
export DATABASE_URL
cd db
node run-migration.js migrations/064_loyalty_segments_system.sql
node run-migration.js migrations/065_update_loyalty_rules_with_segments.sql
```

### Option 2: Update DATABASE_URL for Your Database

If you're using a remote database (AWS RDS, Supabase, etc.):

```bash
# Update .env.local with your actual database URL
export DATABASE_URL="postgresql://user:password@your-host:5432/database"

# Or edit .env.local directly
nano .env.local
# Add: DATABASE_URL=postgresql://user:password@host:port/database

# Then run migrations
cd db
node run-migration.js migrations/064_loyalty_segments_system.sql
node run-migration.js migrations/065_update_loyalty_rules_with_segments.sql
```

### Option 3: Use Manual Migration Script (For AWS RDS)

If you're using AWS RDS and have Terraform configured:

```bash
./scripts/manual-migrate.sh dev
# This will:
# 1. Get database credentials from Terraform
# 2. Fetch secrets from AWS Secrets Manager
# 3. Run all migrations including 064 and 065
```

### Option 4: Run Migrations Manually via SQL Client

1. Connect to your database using any PostgreSQL client (pgAdmin, DBeaver, etc.)
2. Open the migration files:
   - `db/migrations/064_loyalty_segments_system.sql`
   - `db/migrations/065_update_loyalty_rules_with_segments.sql`
3. Execute them in order

### Option 5: Use Supabase Dashboard (If Using Supabase)

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `db/migrations/064_loyalty_segments_system.sql`
3. Paste and run
4. Repeat for `065_update_loyalty_rules_with_segments.sql`

## Verify After Migration

Once migrations complete, verify:

```sql
-- Should return 14
SELECT COUNT(*) FROM loyalty_segments;

-- View segments
SELECT segment_name, segment_type, is_active 
FROM loyalty_segments 
ORDER BY priority DESC;
```

## Current Database Configuration

From `.env.local`:
```
DATABASE_URL=postgresql://warmpawz:warmpawz@localhost:5432/warmpawz
```

This points to a local PostgreSQL database. If it's not running, you need to either:
- Start the local database
- Update the connection string to point to your actual database

## Next Steps

1. **Choose an option above** based on your setup
2. **Run the migrations**
3. **Verify** the segments were created
4. **Test** the API and UI

---

**Need help?** Check which option matches your setup and follow those instructions.
