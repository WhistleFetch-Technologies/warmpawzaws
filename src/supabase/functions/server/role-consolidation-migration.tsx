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
 * ENDPOINTS:
 * GET /make-server-3dd53475/admin/migration-status - Check current status
 * POST /make-server-3dd53475/admin/migrate-vet-roles?dryRun=true - Preview changes
 * POST /make-server-3dd53475/admin/migrate-vet-roles - Execute migration
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
 * DEPRECATED: Moved to vendor-role-cleanup-migration.tsx
 */
app.post('/admin/migrate-vet-roles-OLD-DEPRECATED', async (c) => {
  return c.json({
    success: false,
    error: 'This endpoint is deprecated. Use /admin/migrate-vet-roles from vendor-role-cleanup-migration.tsx instead.'
  }, 410);
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
      canonical: 0,
      invalid: 0 // Vendors without proper roleId
    };
    
    for (const vendor of allVendors) {
      const roleId = vendor.roleId;
      
      // Count by role (including undefined)
      const roleKey = roleId || 'undefined';
      if (!status.byRole[roleKey]) {
        status.byRole[roleKey] = 0;
      }
      status.byRole[roleKey]++;
      
      // Categorize vendor
      if (!roleId || roleId === 'undefined' || roleId === 'null') {
        // Invalid - should be deleted by cleanup
        status.invalid++;
      } else if (ROLE_MIGRATIONS[roleId] && ROLE_MIGRATIONS[roleId] !== roleId) {
        // Needs migration to canonical role
        status.needsMigration++;
      } else {
        // Already canonical
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