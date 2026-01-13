# Seed and Test Instructions

## Prerequisites

Set database connection environment variables:

```bash
# Option 1: Full connection string
export DATABASE_URL="postgresql://user:password@host:port/database"

# Option 2: Individual RDS variables
export DB_HOST="your-rds-endpoint"
export DB_PORT="5432"
export DB_NAME="warmpawz"
export DB_USER="your-username"
export DB_PASSWORD="your-password"

# OR use RDS_ prefixed variables
export RDS_HOSTNAME="your-rds-endpoint"
export RDS_PORT="5432"
export RDS_DB_NAME="warmpawz"
export RDS_USERNAME="your-username"
export RDS_PASSWORD="your-password"
```

## Running the Full Test Suite

```bash
# Run seed + tests together
./scripts/run-full-test-suite.sh dev
```

## Running Separately

```bash
# Step 1: Seed test data
node scripts/seed-comprehensive-test-data.js

# Step 2: Run tests (uses seeded IDs from test-data-ids.json)
node scripts/execute-comprehensive-system-test.js dev
```

## What Gets Seeded

- ✅ Customers (with wallets and transactions)
- ✅ Vendors (approved, with roles)
- ✅ Services (linked to vendors)
- ✅ Bookings (confirmed, future dates)
- ✅ Orders
- ✅ Payments
- ✅ Service Categories
- ✅ Refund Rules

All IDs are saved to `test-data-ids.json` for use in tests.
