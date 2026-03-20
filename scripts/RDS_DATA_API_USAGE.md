# RDS Data API Utilities - Usage Guide

This guide shows how to use the RDS Data API utilities to interact with dev RDS database via AWS CLI.

## Setup

The utilities use AWS CLI, so ensure your credentials are configured:

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="ap-south-1"
export ENVIRONMENT="dev"
```

## Utility Functions

### `getClusterInfo()`
Returns cluster ARN and secret ARN (cached after first lookup).

```javascript
const { getClusterInfo } = require('./rds-data-api-utils-dev');

const info = await getClusterInfo();
console.log(info.clusterArn);
console.log(info.secretArn);
```

### `executeSQL(sql, expectResult)`
Executes a SQL statement and optionally returns results.

```javascript
const { executeSQL } = require('./rds-data-api-utils-dev');

// DDL/DML statement (no results expected)
await executeSQL('ALTER TABLE bookings ADD COLUMN test_col TEXT;', false);

// SELECT query (results expected)
const result = await executeSQL('SELECT * FROM bookings LIMIT 1;', true);
```

### `query(sql)`
Executes a SELECT query and returns parsed records.

```javascript
const { query } = require('./rds-data-api-utils-dev');

const bookings = await query('SELECT id, customer_id, service_id FROM bookings LIMIT 5;');
bookings.forEach(b => {
  console.log(`Booking ${b.id}: customer ${b.customer_id}, service ${b.service_id}`);
});
```

### `parseRecord(record)` and `parseRecords(result)`
Parse RDS Data API response format.

```javascript
const { parseRecords } = require('./rds-data-api-utils-dev');

const result = await executeSQL('SELECT * FROM bookings LIMIT 1;', true);
const records = parseRecords(result);
```

### `executeSQLFile(filePath)`
Execute SQL from a file.

```javascript
const { executeSQLFile } = require('./rds-data-api-utils-dev');

await executeSQLFile('./db/migrations/001_initial_schema.sql');
```

## Examples

### Example 1: SELECT Query

```javascript
const { query } = require('./rds-data-api-utils-dev');

async function getBookings() {
  const bookings = await query(`
    SELECT 
      id,
      customer_id,
      service_id,
      status,
      total_amount
    FROM bookings
    WHERE status = 'pending'
    LIMIT 10
  `);
  
  console.log(`Found ${bookings.length} pending bookings`);
  bookings.forEach(b => {
    console.log(`  - ${b.id}: $${b.total_amount}`);
  });
}

getBookings();
```

### Example 2: DDL Statement (ALTER TABLE)

```javascript
const { executeSQL } = require('./rds-data-api-utils-dev');

async function addColumn() {
  await executeSQL(`
    ALTER TABLE bookings 
    ADD COLUMN IF NOT EXISTS test_column TEXT;
  `, false);
  
  console.log('Column added successfully');
}

addColumn();
```

### Example 3: DML Statement (UPDATE)

```javascript
const { executeSQL } = require('./rds-data-api-utils-dev');

async function updateBookings() {
  const result = await executeSQL(`
    UPDATE bookings
    SET status = 'completed'
    WHERE status = 'pending'
    AND booking_date < CURRENT_DATE - INTERVAL '7 days';
  `, false);
  
  console.log('Old bookings updated');
}

updateBookings();
```

### Example 4: CREATE INDEX

```javascript
const { executeSQL } = require('./rds-data-api-utils-dev');

async function createIndex() {
  await executeSQL(`
    CREATE INDEX IF NOT EXISTS idx_bookings_status_date 
    ON bookings(status, booking_date);
  `, false);
  
  console.log('Index created');
}

createIndex();
```

### Example 5: Running a Migration

```javascript
const { executeSQL, query } = require('./rds-data-api-utils-dev');

async function runMigration() {
  // Step 1: Check current state
  const constraints = await query(`
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'bookings'::regclass::oid
  `);
  
  console.log('Current constraints:', constraints.map(c => c.conname));
  
  // Step 2: Drop old constraint
  if (constraints.some(c => c.conname === 'old_constraint')) {
    await executeSQL('ALTER TABLE bookings DROP CONSTRAINT old_constraint;', false);
  }
  
  // Step 3: Add new constraint
  await executeSQL(`
    ALTER TABLE bookings 
    ADD CONSTRAINT new_constraint 
    FOREIGN KEY (service_id) REFERENCES vendor_services(id);
  `, false);
  
  // Step 4: Verify
  const newConstraints = await query(`
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'bookings'::regclass::oid
    AND conname = 'new_constraint'
  `);
  
  if (newConstraints.length > 0) {
    console.log('✅ Migration completed');
  }
}

runMigration();
```

## Important Notes

### RDS Data API Limitations

1. **No Multi-Statements**: RDS Data API doesn't support multiple statements in a single call. Split your SQL into individual statements.

2. **No DO Blocks**: DO $$ blocks with multiple statements won't work. Use conditional logic in your script instead.

3. **Data Types**: Some PostgreSQL-specific data types may not be supported. Use `::oid` or `::regclass` casts when needed.

4. **File Paths**: Always use `file://` prefix for SQL files to avoid shell escaping issues.

### Best Practices

1. **Error Handling**: Always wrap SQL execution in try-catch blocks.

2. **Idempotency**: Use `IF NOT EXISTS` and `IF EXISTS` clauses for idempotent migrations.

3. **Verification**: Always verify changes after executing DDL statements.

4. **Temporary Files**: The utility automatically cleans up temporary files, but ensure your script handles errors gracefully.

5. **Connection Caching**: Cluster info is cached after first lookup for performance.

## Troubleshooting

### Error: "Multistatements aren't supported"
- **Solution**: Split your SQL into individual statements and execute them separately.

### Error: "HttpEndpointEnabled must be true"
- **Solution**: Enable RDS Data API on your cluster:
  1. Go to AWS RDS Console
  2. Select your cluster
  3. Modify cluster
  4. Enable "Data API"
  5. Apply changes

### Error: "UnsupportedResultException: The result contains the unsupported data type"
- **Solution**: Use type casts (e.g., `::text`, `::oid`) in your queries.

### Connection Timeout
- **Solution**: RDS Data API doesn't require direct network access. If you see timeouts, check:
  - AWS credentials are correct
  - Region matches your cluster
  - Cluster ARN and Secret ARN are correct

## Running Migration 613

To run migration 613 (fix bookings.service_id FK constraint):

```bash
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_DEFAULT_REGION="ap-south-1"
export ENVIRONMENT="dev"

node scripts/run-migration-613-rds-data-api.js
```

This migration:
- Drops old FK constraint `bookings_service_id_fkey`
- Updates existing bookings to reference `vendor_services.id`
- Adds new FK constraint `bookings_service_id_vendor_services_fkey`
- Creates performance index
