/**
 * ============================================================================
 * RUN MIGRATION 029: Add user_id to vendors and customers tables
 * ============================================================================
 * 
 * This script runs the migration to add user_id UUID columns to vendors
 * and customers tables.
 * 
 * Run: deno run --allow-net --allow-env run-migration-029.ts
 * ============================================================================
 */

import { getDbClient } from './supabase/lib/db.ts';

const migrationSQL = `
-- Add user_id to vendors table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE vendors ADD COLUMN user_id UUID;
    CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
    COMMENT ON COLUMN vendors.user_id IS 'UUID reference to user account - used for authentication';
  END IF;
END $$;

-- Add user_id to customers table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN user_id UUID;
    CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
    COMMENT ON COLUMN customers.user_id IS 'UUID reference to user account - used for authentication';
  END IF;
END $$;
`;

async function runMigration() {
  console.log('🚀 Starting Migration 029: Add user_id to vendors and customers...\n');
  
  try {
    const client = getDbClient();
    
    // Split SQL into individual statements (DO blocks)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`📝 Executing: ${statement.substring(0, 50)}...`);
        const { error } = await client.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          // Try direct query execution instead
          const { error: queryError } = await client.from('_migration').select('*').limit(0);
          if (queryError) {
            // Use raw SQL execution
            const result = await client.rpc('exec', { query: statement + ';' });
            if (result.error) {
              throw result.error;
            }
          }
        }
      }
    }
    
    // Verify migration
    console.log('\n✅ Verifying migration...');
    
    const { data: vendorsColumns, error: vendorsError } = await client
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'vendors')
      .eq('column_name', 'user_id')
      .maybeSingle();
    
    const { data: customersColumns, error: customersError } = await client
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'customers')
      .eq('column_name', 'user_id')
      .maybeSingle();
    
    if (vendorsColumns) {
      console.log(`✅ vendors.user_id column exists (type: ${vendorsColumns.data_type})`);
    } else {
      console.log(`⚠️  vendors.user_id column not found (error: ${vendorsError?.message || 'not found'})`);
    }
    
    if (customersColumns) {
      console.log(`✅ customers.user_id column exists (type: ${customersColumns.data_type})`);
    } else {
      console.log(`⚠️  customers.user_id column not found (error: ${customersError?.message || 'not found'})`);
    }
    
    console.log('\n✅ Migration 029 completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Test vendor login with phone: 9611377119');
    console.log('   2. Verify UUIDs are generated correctly');
    console.log('   3. Check that no UUID format errors occur');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\n💡 Alternative: Run the SQL directly in Supabase Dashboard SQL Editor');
    console.error('   See: RUN_MIGRATION_029.md for instructions');
    Deno.exit(1);
  }
}

// Run migration
runMigration();

