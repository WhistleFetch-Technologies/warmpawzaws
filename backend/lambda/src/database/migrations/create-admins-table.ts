/**
 * ============================================================================
 * MIGRATION: Create Admins Table
 * ============================================================================
 * Creates the admins table if it doesn't exist
 * Run this migration to enable admin authentication
 * ============================================================================
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from '../rds-connection';

export async function createAdminsTable(): Promise<void> {
  try {
    const schemaPath = join(__dirname, '../schemas/admins-table.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    // Execute the schema
    await query(schema);
    
    console.log('✅ Admins table created successfully');
  } catch (error: any) {
    // If table already exists, that's fine
    if (error.message?.includes('already exists') || error.code === '42P07') {
      console.log('ℹ️  Admins table already exists');
      return;
    }
    
    console.error('❌ Failed to create admins table:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createAdminsTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
