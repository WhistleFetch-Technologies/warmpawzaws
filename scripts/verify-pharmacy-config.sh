#!/bin/bash
# ============================================================================
# Verify Pharmacy UAT Configuration Fixes
# ============================================================================
# Quick verification script to check if Pharmacy role configuration is correct
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Pharmacy UAT Configuration Verification                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ] && [ -z "$SUPABASE_DB_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set.${NC}"
    echo "Please set: export DATABASE_URL='postgresql://user:pass@host:port/db'"
    echo ""
    read -p "Do you want to continue with manual verification? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 0
    fi
fi

# Use DATABASE_URL or SUPABASE_DB_URL
DB_URL="${DATABASE_URL:-$SUPABASE_DB_URL}"

echo -e "${BLUE}📋 Verifying Pharmacy Role Configuration...${NC}"
echo "────────────────────────────────────────────────────────────"
echo ""

# Expected capabilities
EXPECTED_CAPS=(
    "inventory_manage"
    "product_catalog"
    "orders"
    "order_dispatch"
    "order_broadcast"
    "availability_check"
    "prescription_create"
    "prescription_verification"
    "delivery"
    "expiry_management"
    "controlled_substances"
)

# Run verification using Node.js
node -e "
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: process.env.SUPABASE_DB_URL ? { rejectUnauthorized: false } : undefined
});

async function verify() {
  try {
    console.log('🔍 Checking Pharmacy role exists...');
    
    // Check role exists
    const roleCheck = await pool.query(\`
      SELECT id, name, display_name, 
             config->'capabilities' as capabilities_json,
             jsonb_array_length(config->'capabilities') as cap_count
      FROM roles 
      WHERE name = 'pharmacy'
    \`);
    
    if (roleCheck.rows.length === 0) {
      console.log('❌ ERROR: Pharmacy role not found in database');
      console.log('   Run migrations 047 and 051 first!');
      process.exit(1);
    }
    
    const role = roleCheck.rows[0];
    console.log(\`✅ Pharmacy role found: \${role.display_name}\`);
    console.log(\`   Role ID: \${role.id}\`);
    console.log(\`   Capabilities in config: \${role.cap_count}\`);
    console.log('');
    
    // Check role_permissions table
    console.log('🔍 Checking role_permissions...');
    const permCheck = await pool.query(\`
      SELECT COUNT(*) as count
      FROM role_permissions
      WHERE role_id = '\${role.id}'
    \`);
    
    console.log(\`✅ Permissions found: \${permCheck.rows[0].count}\`);
    console.log('');
    
    // Get actual permissions
    const permissions = await pool.query(\`
      SELECT permission_name
      FROM role_permissions
      WHERE role_id = '\${role.id}'
      ORDER BY permission_name
    \`);
    
    const actualCaps = permissions.rows.map(r => r.permission_name);
    
    // Expected capabilities
    const expectedCaps = [
      'inventory_manage',
      'product_catalog',
      'orders',
      'order_dispatch',
      'order_broadcast',
      'availability_check',
      'prescription_create',
      'prescription_verification',
      'delivery',
      'expiry_management',
      'controlled_substances'
    ];
    
    console.log('📋 Capability Check:');
    console.log('────────────────────────────────────────────────────────────');
    
    let allFound = true;
    for (const cap of expectedCaps) {
      const found = actualCaps.includes(cap);
      const status = found ? '✅' : '❌';
      console.log(\`  \${status} \${cap}\`);
      if (!found) {
        allFound = false;
      }
    }
    
    console.log('');
    
    // Check for extra capabilities (not necessarily bad, but worth noting)
    const extraCaps = actualCaps.filter(c => !expectedCaps.includes(c));
    if (extraCaps.length > 0) {
      console.log('📝 Additional capabilities (not required):');
      for (const cap of extraCaps) {
        console.log(\`   • \${cap}\`);
      }
      console.log('');
    }
    
    // Final verdict
    if (allFound && actualCaps.length >= expectedCaps.length) {
      console.log('✅ SUCCESS: All required Pharmacy capabilities are configured!');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Clear browser cache and localStorage');
      console.log('  2. Log in as Pharmacy vendor');
      console.log('  3. Verify dashboard shows only Pharmacy-relevant features');
      console.log('  4. Test Inventory button persistence');
      process.exit(0);
    } else {
      console.log('❌ ERROR: Missing required capabilities');
      console.log('');
      console.log('Missing capabilities:');
      const missing = expectedCaps.filter(c => !actualCaps.includes(c));
      for (const cap of missing) {
        console.log(\`   • \${cap}\`);
      }
      console.log('');
      console.log('Action: Run migrations 047 and 051 to fix this.');
      process.exit(1);
    }
    
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    console.error('');
    console.error('Common issues:');
    console.error('  1. Database connection failed - check DATABASE_URL');
    console.error('  2. Migrations not run - run: cd db && npm run migrate:up');
    console.error('  3. Database user lacks permissions');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verify();
"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Verification Complete                                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
