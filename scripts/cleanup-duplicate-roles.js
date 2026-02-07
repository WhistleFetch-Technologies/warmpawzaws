#!/usr/bin/env node
/**
 * Role Cleanup Script
 * 
 * This script identifies and removes duplicate/inactive roles safely.
 * 
 * SAFETY RULES:
 * 1. NEVER removes roles that have vendors assigned
 * 2. NEVER removes roles that have vendors with active services  
 * 3. Keeps ONE event_organizer role (the oldest one)
 * 4. Only removes truly orphaned duplicate roles
 * 
 * Usage:
 *   node scripts/cleanup-duplicate-roles.js --analyze     # Dry run - show what would be deleted
 *   node scripts/cleanup-duplicate-roles.js --execute     # Actually delete the roles
 *   node scripts/cleanup-duplicate-roles.js --delete-id <uuid>  # Delete specific role by ID
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');

// Load dotenv if available (optional)
try { require('dotenv').config(); } catch (e) { /* dotenv not installed */ }

// AWS Configuration
const REGION = process.env.AWS_REGION || 'ap-south-1';
const SECRET_ARN = process.env.DB_SECRET_ARN || 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI';

// Database defaults
const DB_HOST_DEFAULT = 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
const DB_NAME_DEFAULT = 'warmpawz';

let pool;

/**
 * Fetch database credentials from AWS Secrets Manager
 */
async function getDbCredentials() {
  // Check if credentials are already provided via environment
  if (process.env.DB_USER && process.env.DB_PASSWORD) {
    console.log('✅ Using credentials from environment variables');
    return {
      host: process.env.RDS_HOST || process.env.DB_HOST || DB_HOST_DEFAULT,
      port: parseInt(process.env.RDS_PORT || process.env.DB_PORT || '5432'),
      database: process.env.RDS_DATABASE || process.env.DB_NAME || DB_NAME_DEFAULT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };
  }

  // Fetch from Secrets Manager
  console.log('🔐 Fetching credentials from AWS Secrets Manager...');
  try {
    const secretValue = execSync(
      `aws secretsmanager get-secret-value --secret-id "${SECRET_ARN}" --region "${REGION}" --query SecretString --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();

    const secret = JSON.parse(secretValue);
    console.log('✅ Successfully fetched credentials from Secrets Manager');
    
    return {
      host: secret.host || process.env.DB_HOST || DB_HOST_DEFAULT,
      port: parseInt(secret.port || process.env.DB_PORT || '5432'),
      database: secret.dbname || process.env.DB_NAME || DB_NAME_DEFAULT,
      user: secret.username,
      password: secret.password,
    };
  } catch (error) {
    console.error('❌ Failed to fetch credentials from Secrets Manager:', error.message);
    console.error('   Please ensure AWS CLI is configured or set DB_USER and DB_PASSWORD');
    throw error;
  }
}

/**
 * Initialize database connection pool
 */
async function initPool() {
  const creds = await getDbCredentials();
  pool = new Pool({
    ...creds,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  return pool;
}

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

async function analyzeRoles() {
  console.log('\n📊 ROLE ANALYSIS\n');
  console.log('='.repeat(100));

  // 1. Get all roles with usage counts
  const rolesResult = await query(`
    SELECT 
      r.id,
      r.name,
      r.display_name,
      r.is_system_role,
      r.is_active,
      r.created_at,
      COALESCE(v.vendor_count, 0) as vendor_count,
      COALESCE(s.service_count, 0) as service_count,
      COALESCE(p.permission_count, 0) as permission_count
    FROM roles r
    LEFT JOIN (
      SELECT role_id, COUNT(*) as vendor_count 
      FROM vendors 
      WHERE role_id IS NOT NULL
      GROUP BY role_id
    ) v ON r.id = v.role_id
    LEFT JOIN (
      SELECT vnd.role_id, COUNT(svc.id) as service_count
      FROM vendors vnd
      JOIN services svc ON svc.vendor_id = vnd.id AND svc.is_active = true
      WHERE vnd.role_id IS NOT NULL
      GROUP BY vnd.role_id
    ) s ON r.id = s.role_id
    LEFT JOIN (
      SELECT role_id, COUNT(*) as permission_count
      FROM role_permissions
      GROUP BY role_id
    ) p ON r.id = p.role_id
    ORDER BY r.name, r.created_at
  `);

  console.log('\n📋 ALL ROLES:\n');
  console.log('ID'.padEnd(38) + 'Name'.padEnd(25) + 'Vendors'.padEnd(10) + 'Services'.padEnd(10) + 'System'.padEnd(8) + 'Active'.padEnd(8) + 'Status');
  console.log('-'.repeat(100));
  
  for (const role of rolesResult.rows) {
    let status = '✅ CAN DELETE';
    if (role.vendor_count > 0) status = '🛡️ HAS VENDORS';
    else if (role.service_count > 0) status = '🛡️ HAS SERVICES';
    else if (role.is_system_role) status = '⚠️ SYSTEM ROLE';
    
    console.log(
      role.id.padEnd(38) +
      role.name.substring(0, 24).padEnd(25) +
      String(role.vendor_count).padEnd(10) +
      String(role.service_count).padEnd(10) +
      (role.is_system_role ? 'Yes' : 'No').padEnd(8) +
      (role.is_active ? 'Yes' : 'No').padEnd(8) +
      status
    );
  }

  // 2. Find duplicates
  const duplicatesResult = await query(`
    SELECT 
      name,
      COUNT(*) as duplicate_count,
      array_agg(id ORDER BY created_at) as role_ids
    FROM roles
    GROUP BY name
    HAVING COUNT(*) > 1
    ORDER BY name
  `);

  if (duplicatesResult.rows.length > 0) {
    console.log('\n\n⚠️ DUPLICATE ROLE NAMES:\n');
    for (const dup of duplicatesResult.rows) {
      console.log(`  "${dup.name}" - ${dup.duplicate_count} copies: ${dup.role_ids.join(', ')}`);
    }
  } else {
    console.log('\n\n✅ No duplicate role names found');
  }

  // 3. Event organizer roles
  const eventResult = await query(`
    SELECT 
      r.id,
      r.name,
      r.display_name,
      r.created_at,
      COALESCE(v.vendor_count, 0) as vendor_count
    FROM roles r
    LEFT JOIN (
      SELECT role_id, COUNT(*) as vendor_count 
      FROM vendors 
      WHERE role_id IS NOT NULL
      GROUP BY role_id
    ) v ON r.id = v.role_id
    WHERE LOWER(r.name) LIKE '%event%' 
       OR LOWER(r.display_name) LIKE '%event%'
    ORDER BY r.created_at
  `);

  if (eventResult.rows.length > 0) {
    console.log('\n\n🎉 EVENT ORGANIZER ROLES:\n');
    console.log('(Will keep the oldest one with vendors, or oldest overall)\n');
    for (let i = 0; i < eventResult.rows.length; i++) {
      const role = eventResult.rows[i];
      const isKept = i === 0 || role.vendor_count > 0;
      console.log(
        `  ${isKept ? '✅ KEEP' : '❌ DELETE'}: ${role.name} (${role.id})` +
        ` - Vendors: ${role.vendor_count}, Created: ${role.created_at.toISOString().split('T')[0]}`
      );
    }
  }

  return rolesResult.rows;
}

async function getRolesToDelete() {
  const result = await query(`
    SELECT 
      r.id,
      r.name,
      r.display_name,
      r.is_system_role,
      r.created_at
    FROM roles r
    WHERE 
      -- No vendors using this role
      NOT EXISTS (SELECT 1 FROM vendors v WHERE v.role_id = r.id)
      -- Not the oldest event organizer (we keep one)
      AND r.id NOT IN (
        SELECT id FROM roles 
        WHERE LOWER(name) LIKE '%event%organizer%' 
          OR LOWER(name) LIKE '%event_organizer%'
        ORDER BY created_at ASC 
        LIMIT 1
      )
      -- Is a duplicate OR is inactive
      AND (
        r.name IN (
          SELECT name FROM roles GROUP BY name HAVING COUNT(*) > 1
        )
        OR r.is_active = false
      )
    ORDER BY r.name, r.created_at
  `);
  
  return result.rows;
}

async function deleteRoles(roleIds) {
  console.log('\n🗑️ DELETING ROLES...\n');
  
  for (const roleId of roleIds) {
    try {
      // 1. Unset system role flag
      await query('UPDATE roles SET is_system_role = false WHERE id = $1', [roleId]);
      
      // 2. Delete permissions
      const permResult = await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      
      // 3. Delete role
      const roleResult = await query('DELETE FROM roles WHERE id = $1 RETURNING name', [roleId]);
      
      if (roleResult.rows.length > 0) {
        console.log(`  ✅ Deleted: ${roleResult.rows[0].name} (${roleId}) - ${permResult.rowCount} permissions removed`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to delete ${roleId}: ${error.message}`);
    }
  }
}

async function deleteSpecificRole(roleId) {
  // First verify the role is safe to delete
  const checkResult = await query(`
    SELECT 
      r.id,
      r.name,
      r.is_system_role,
      COALESCE(v.vendor_count, 0) as vendor_count
    FROM roles r
    LEFT JOIN (
      SELECT role_id, COUNT(*) as vendor_count 
      FROM vendors 
      WHERE role_id IS NOT NULL
      GROUP BY role_id
    ) v ON r.id = v.role_id
    WHERE r.id = $1
  `, [roleId]);

  if (checkResult.rows.length === 0) {
    console.log(`❌ Role not found: ${roleId}`);
    return false;
  }

  const role = checkResult.rows[0];
  
  if (role.vendor_count > 0) {
    console.log(`❌ Cannot delete "${role.name}" - ${role.vendor_count} vendors are using this role`);
    console.log('   Please reassign vendors first.');
    return false;
  }

  console.log(`\n🗑️ Deleting role: ${role.name} (${roleId})`);
  console.log(`   System role: ${role.is_system_role ? 'Yes' : 'No'}`);
  console.log(`   Vendors: ${role.vendor_count}`);

  await deleteRoles([roleId]);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--analyze';

  try {
    console.log('🔗 Initializing database connection...');
    
    // Initialize pool with credentials from Secrets Manager
    await initPool();
    
    // Test connection
    await query('SELECT 1');
    console.log('✅ Connected successfully\n');

    if (mode === '--analyze') {
      await analyzeRoles();
      
      const toDelete = await getRolesToDelete();
      
      console.log('\n\n📝 ROLES THAT CAN BE SAFELY DELETED:\n');
      if (toDelete.length === 0) {
        console.log('  No orphaned duplicate roles found to delete.');
      } else {
        for (const role of toDelete) {
          console.log(`  - ${role.name} (${role.id}) - System: ${role.is_system_role ? 'Yes' : 'No'}`);
        }
        console.log(`\n  Total: ${toDelete.length} roles`);
        console.log('\n  To delete these roles, run:');
        console.log('  node scripts/cleanup-duplicate-roles.js --execute');
      }
      
    } else if (mode === '--execute') {
      console.log('⚠️ EXECUTING CLEANUP - This will delete roles!\n');
      
      const toDelete = await getRolesToDelete();
      
      if (toDelete.length === 0) {
        console.log('✅ No orphaned duplicate roles found to delete.');
        return;
      }

      console.log('Roles to be deleted:');
      for (const role of toDelete) {
        console.log(`  - ${role.name} (${role.id})`);
      }
      
      console.log(`\nDeleting ${toDelete.length} roles...`);
      await deleteRoles(toDelete.map(r => r.id));
      
      console.log('\n✅ Cleanup complete!');
      
      // Show remaining roles count
      const countResult = await query('SELECT COUNT(*) as count FROM roles');
      console.log(`\n📊 Remaining roles: ${countResult.rows[0].count}`);
      
    } else if (mode === '--delete-id') {
      const roleId = args[1];
      if (!roleId) {
        console.log('❌ Please provide a role ID: --delete-id <uuid>');
        return;
      }
      await deleteSpecificRole(roleId);
      
    } else {
      console.log('Usage:');
      console.log('  node scripts/cleanup-duplicate-roles.js --analyze      # Dry run - show analysis');
      console.log('  node scripts/cleanup-duplicate-roles.js --execute      # Delete orphaned duplicates');
      console.log('  node scripts/cleanup-duplicate-roles.js --delete-id <uuid>  # Delete specific role');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
