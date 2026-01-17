#!/bin/bash
# ============================================================================
# Run Migrations 050 & 051 using existing migration runner
# ============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT/db"

# Use existing migration runner
echo "Running migrations 050 and 051..."
echo ""

# Run migration 050
echo "📋 Migration 050: Complete Form Schemas"
node run-migration.js ../db/migrations/050_complete_role_form_schemas.sql

echo ""

# Migration 051 (Role Permissions seeding) removed - no longer seeding roles on rollout
# echo "🔐 Migration 051: Role Permissions"
# node run-migration.js ../db/migrations/051_seed_role_permissions.sql

echo ""
echo "✅ Migrations completed!"
echo ""

# Verify
echo "🔍 Verifying migrations..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://warmpawz:warmpawz@localhost:5432/warmpawz' });

async function verify() {
  try {
    const schemaResult = await pool.query(\`
      SELECT COUNT(*) as count
      FROM roles 
      WHERE is_active = true 
        AND config->'onboardingFields'->'fields' IS NOT NULL
        AND jsonb_array_length(config->'onboardingFields'->'fields') > 0
    \`);
    
    const permResult = await pool.query(\`
      SELECT COUNT(DISTINCT r.id) as count
      FROM roles r
      INNER JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.is_active = true
    \`);
    
    console.log(\`✅ Roles with schemas: \${schemaResult.rows[0].count}/20\`);
    console.log(\`✅ Roles with permissions: \${permResult.rows[0].count}/20\`);
    
    if (schemaResult.rows[0].count === 20 && permResult.rows[0].count === 20) {
      console.log('✅ All migrations verified successfully!');
      process.exit(0);
    } else {
      console.log('⚠️  Some roles may be missing schemas or permissions');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verify();
"

