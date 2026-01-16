# Next Steps: Create customer_wallets Table

## ✅ Completed
- Fixed `db/check-migration-status.js` to check for `customer_wallets` instead of `wallets`

## 🔧 Next Steps

### Option 1: Using AWS CLI (Recommended if you have AWS credentials configured)

```bash
# Using Node.js script (recommended)
node scripts/create-wallets-table-node.js dev

# OR using bash script
./scripts/create-wallets-table.sh dev
```

This script will:
1. Get RDS cluster endpoint from AWS
2. Get database credentials from AWS Secrets Manager
3. Connect to the database
4. Create `customer_wallets` and `wallet_transactions` tables if they don't exist

### Option 2: Using DATABASE_URL directly

If you have the database credentials, you can set DATABASE_URL and run the migration:

```bash
# Set your database URL (replace with your actual credentials)
export DATABASE_URL="postgresql://warmpawz:warmpawz@warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com:5432/warmpawz?sslmode=require"

# Run the migration directly
cd db
psql "$DATABASE_URL" -f migrations/012_wallet_tables.sql

# OR using Node.js with the migration file
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const sql = fs.readFileSync('migrations/012_wallet_tables.sql', 'utf8');
pool.query(sql).then(() => {
  console.log('✅ Tables created successfully');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
"
```

### Option 3: Verify if table already exists

First, check if the table already exists:

```bash
export DATABASE_URL="postgresql://warmpawz:warmpawz@warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com:5432/warmpawz?sslmode=require"

# Run the status check
node db/check-migration-status.js
```

If `customer_wallets` shows as present, you're done! ✅

## 📋 What Will Be Created

The migration creates two tables:

1. **customer_wallets** - Stores customer wallet balances
   - `id` (UUID, primary key)
   - `customer_id` (UUID, unique, references customers)
   - `balance` (NUMERIC, default 0)
   - `currency` (TEXT, default 'INR')
   - `created_at`, `updated_at` timestamps

2. **wallet_transactions** - Stores wallet transaction history
   - `id` (UUID, primary key)
   - `customer_id` (UUID, references customers)
   - `transaction_type` ('credit', 'debit', 'refund')
   - `amount`, `balance_after` (NUMERIC)
   - `payment_id`, `booking_id`, `order_id` (optional references)
   - `description` (TEXT)
   - `created_at` timestamp

## ✅ Verification

After running the migration, verify it worked:

```bash
node db/check-migration-status.js
```

You should see:
```
✅ Key tables present: 8/8
```

Instead of:
```
⚠️  Missing tables: wallets
```

## 🔍 Troubleshooting

### Error: DATABASE_URL not set
Set the DATABASE_URL environment variable with your database connection string.

### Error: Connection refused / SSL error
- Ensure your IP is whitelisted in RDS security groups
- Check that SSL mode is set correctly (`?sslmode=require`)
- Verify database endpoint and credentials

### Error: Table already exists
This is fine! The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times.

### Error: Permission denied
Ensure your database user has CREATE TABLE permissions.
