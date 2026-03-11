# Setup Local PostgreSQL Database

## Quick Setup Guide

### Prerequisites
1. PostgreSQL installed locally (version 12+ recommended)
2. Node.js installed (for migration scripts)

### Step 1: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE warmpawz;

# Exit psql
\q
```

### Step 2: Set Environment Variables

Create a `.env.local` file in the project root or export variables:

```bash
# Option 1: Using full DATABASE_URL
export DATABASE_URL="postgresql://postgres:your_password@localhost:5432/warmpawz"

# Option 2: Using individual components
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=warmpawz
export DB_USER=postgres
export DB_PASSWORD=your_password
```

### Step 3: Run Migrations

**Option A: Using Node.js Script (Recommended)**
```bash
# Run all three base migrations
node db/run-migration-all.js
```

**Option B: Using psql directly**
```bash
# Run migrations in order
psql $DATABASE_URL -f db/migrations/001_initial_schema.sql
psql $DATABASE_URL -f db/migrations/002_foreign_keys.sql
psql $DATABASE_URL -f db/migrations/003_indexes.sql
```

**Option C: Using psql interactively**
```bash
psql -U postgres -d warmpawz

# Then run:
\i db/migrations/001_initial_schema.sql
\i db/migrations/002_foreign_keys.sql
\i db/migrations/003_indexes.sql
```

### Step 4: Verify Setup

```bash
# Check migration status
node db/check-migration-status.js

# Or manually check tables
psql -U postgres -d warmpawz -c "\dt"
```

### What Gets Created

- **71 base tables** from `001_initial_schema.sql`
  - customers, vendors, staff, services, bookings, payments, etc.
- **Foreign key constraints** from `002_foreign_keys.sql`
  - Ensures referential integrity between tables
- **Performance indexes** from `003_indexes.sql`
  - Speeds up queries on commonly searched columns

### Troubleshooting

**Connection Error:**
```bash
# Make sure PostgreSQL is running
# Windows: Check Services
# Mac/Linux: sudo service postgresql start
```

**Permission Error:**
```bash
# Grant permissions to your user
psql -U postgres
GRANT ALL PRIVILEGES ON DATABASE warmpawz TO your_username;
```

**Migration Already Applied:**
- Migrations are idempotent - safe to re-run
- They use `IF NOT EXISTS` so won't fail if already applied

### Next Steps

After base setup, you can optionally run additional migrations:
```bash
# Run all remaining migrations (004-999)
node db/run-migration-all.js
```
