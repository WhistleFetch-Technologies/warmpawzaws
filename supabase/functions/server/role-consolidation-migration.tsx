/**
 * ========================================
 * ROLE CONSOLIDATION MIGRATION SCRIPT
 * ========================================
 * 
 * PURPOSE:
 * Consolidate multiple vet role IDs into ONE canonical role to fix capability detection issues.
 * 
 * PROBLEM:
 * Vendors were created with different vet role IDs:
 * - 'veterinarian'
 * - 'vet_clinic'
 * - 'role_veterinarian'
 * - 'role_vet_clinic'
 * 
 * This causes capability detection failures because the system checks for specific role IDs.
 * 
 * SOLUTION:
 * Migrate ALL vet vendors to use the canonical role ID: 'pet_clinic'
 * 
 * USAGE:
 * POST /make-server-3dd53475/admin/migrate-vet-roles
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Canonical role mappings
const ROLE_MIGRATIONS = {
  // VET ROLES → pet_clinic
  'veterinarian': 'pet_clinic',
  'vet_clinic': 'pet_clinic',
  'role_veterinarian': 'pet_clinic',
  'role_vet_clinic': 'pet_clinic',
  
  // GROOMING ROLES → pet_groomer
  'groomer': 'pet_groomer',
  'grooming_center': 'pet_groomer',
  'role_groomer': 'pet_groomer',
  'role_grooming_center': 'pet_groomer',
  
  // TRAINING ROLES → pet_trainer
  'trainer': 'pet_trainer',
  'training_center': 'pet_trainer',
  'role_trainer': 'pet_trainer',
  'role_training_center': 'pet_trainer',
  
  // WALKING ROLES → dog_walker
  'walker': 'dog_walker',
  'pet_walker': 'dog_walker',
  'role_walker': 'dog_walker',
  'role_dog_walker': 'dog_walker',
};

/**
 * Migrate all vendor roles to canonical format
 */
app.post('/admin/migrate-vet-roles', async (c) => {
  try {
    console.log('\\n🔄 [ROLE-MIGRATION] Starting role consolidation migration...');
    
    const dryRun = c.req.query('dryRun') === 'true';
    
    if (dryRun) {
      console.log('   📋 DRY RUN MODE - No changes will be made');
    }
    
    // Get all vendors
    const allVendors = await kv.getByPrefix('vendor:');
    console.log(`   📊 Found ${allVendors.length} total vendors`);
    
    const updates: any[] = [];
    const statistics = {
      total: allVendors.length,
      migrated: 0,
      alreadyCorrect: 0,
      byRole: {} as Record<string, number>
    };
    
    // Process each vendor
    for (const vendor of allVendors) {
      const oldRoleId = vendor.roleId;
      const newRoleId = ROLE_MIGRATIONS[oldRoleId];
      
      if (!newRoleId) {
        // Role doesn't need migration
        statistics.alreadyCorrect++;
        continue;
      }
      
      if (oldRoleId === newRoleId) {
        // Already using canonical role
        statistics.alreadyCorrect++;
        continue;
      }
      
      // Track migration
      if (!statistics.byRole[oldRoleId]) {
        statistics.byRole[oldRoleId] = 0;
      }
      statistics.byRole[oldRoleId]++;
      statistics.migrated++;
      
      updates.push({
        vendorId: vendor.id,
        oldRoleId,
        newRoleId,
        businessName: vendor.businessName || vendor.fullName || 'Unknown',
        phone: vendor.phone
      });
      
      if (!dryRun) {
        // Update vendor
        vendor.roleId = newRoleId;
        vendor.oldRoleId = oldRoleId; // Keep history
        vendor.roleMigratedAt = new Date().toISOString();
        await kv.set(`vendor:${vendor.id}`, vendor);
        
        console.log(`   ✅ Migrated vendor ${vendor.id}: ${oldRoleId} → ${newRoleId}`);
        
        // Update any related centers
        const centers = await kv.getByPrefix(`center:${vendor.id}:`);
        for (const center of centers) {
          if (center.roleId === oldRoleId) {
            center.roleId = newRoleId;
            await kv.set(`center:${center.id}`, center);
            console.log(`      ✅ Updated center ${center.id}`);
          }
        }
        
        // Update any related staff
        const staff = await kv.getByPrefix(`staff:${vendor.id}:`);
        for (const staffMember of staff) {
          if (staffMember.roleType === oldRoleId) {
            staffMember.roleType = newRoleId;
            await kv.set(`staff:${staffMember.id}`, staffMember);
            console.log(`      ✅ Updated staff ${staffMember.id}`);
          }
        }
      }
    }
    
    console.log('\\n📊 [ROLE-MIGRATION] Migration Summary:');
    console.log(`   Total vendors: ${statistics.total}`);
    console.log(`   Migrated: ${statistics.migrated}`);
    console.log(`   Already correct: ${statistics.alreadyCorrect}`);
    console.log('\\n   By role:');
    Object.entries(statistics.byRole).forEach(([oldRole, count]) => {
      console.log(`      ${oldRole} → ${ROLE_MIGRATIONS[oldRole]}: ${count} vendors`);
    });
    
    return c.json({
      success: true,
      dryRun,
      statistics,
      updates,
      message: dryRun 
        ? `DRY RUN: Would migrate ${statistics.migrated} vendors` 
        : `Successfully migrated ${statistics.migrated} vendors to canonical roles`
    });
    
  } catch (error) {
    console.error('❌ [ROLE-MIGRATION] Error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Migration failed' 
    }, 500);
  }
});

/**
 * Get migration status
 */
app.get('/admin/migration-status', async (c) => {
  try {
    const allVendors = await kv.getByPrefix('vendor:');
    
    const status = {
      total: allVendors.length,
      byRole: {} as Record<string, number>,
      needsMigration: 0,
      canonical: 0
    };
    
    for (const vendor of allVendors) {
      const roleId = vendor.roleId;
      
      if (!status.byRole[roleId]) {
        status.byRole[roleId] = 0;
      }
      status.byRole[roleId]++;
      
      if (ROLE_MIGRATIONS[roleId] && ROLE_MIGRATIONS[roleId] !== roleId) {
        status.needsMigration++;
      } else {
        status.canonical++;
      }
    }
    
    return c.json({ success: true, status });
    
  } catch (error) {
    console.error('❌ Error getting migration status:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get status' 
    }, 500);
  }
});

export default app;
