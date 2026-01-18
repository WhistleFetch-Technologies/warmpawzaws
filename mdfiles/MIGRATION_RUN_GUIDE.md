# Migration Run Guide

## Prerequisites

1. **Database Running:**
   - Local: PostgreSQL running on localhost:5432
   - Docker: `docker-compose up -d postgres`
   - RDS: Database accessible via connection string

2. **Environment Variables:**
   ```bash
   export DATABASE_URL="postgresql://warmpawz:warmpawz@localhost:5432/warmpawz"
   # OR for RDS:
   export DATABASE_URL="postgresql://user:pass@host:5432/database"
   ```

## Running Migrations

### Option 1: Using Migration Runner (Recommended)

```bash
cd db
export DATABASE_URL="postgresql://warmpawz:warmpawz@localhost:5432/warmpawz"

# Run Migration 050
node run-migration.js migrations/050_complete_role_form_schemas.sql

# Run Migration 051
node run-migration.js migrations/051_seed_role_permissions.sql
```

### Option 2: Using psql Directly

```bash
# For local database
psql -h localhost -U warmpawz -d warmpawz -f db/migrations/050_complete_role_form_schemas.sql
psql -h localhost -U warmpawz -d warmpawz -f db/migrations/051_seed_role_permissions.sql

# For RDS
psql -h your-rds-host.rds.amazonaws.com -U admin -d warmpawz -f db/migrations/050_complete_role_form_schemas.sql
psql -h your-rds-host.rds.amazonaws.com -U admin -d warmpawz -f db/migrations/051_seed_role_permissions.sql
```

### Option 3: Using Docker Compose

```bash
# Start database
docker-compose up -d postgres

# Wait for database to be ready
sleep 5

# Run migrations
docker-compose exec postgres psql -U warmpawz -d warmpawz -f /docker-entrypoint-initdb.d/migrations/050_complete_role_form_schemas.sql
docker-compose exec postgres psql -U warmpawz -d warmpawz -f /docker-entrypoint-initdb.d/migrations/051_seed_role_permissions.sql
```

## Verification

After running migrations, verify with:

```sql
-- Check form schemas
SELECT 
  name,
  jsonb_array_length(config->'onboardingFields'->'fields') as field_count
FROM roles 
WHERE is_active = true
ORDER BY name;

-- Check permissions
SELECT 
  r.name,
  COUNT(rp.id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.is_active = true
GROUP BY r.name
ORDER BY r.name;
```

Expected: All 20 roles should have field_count > 0 and permission_count > 0

