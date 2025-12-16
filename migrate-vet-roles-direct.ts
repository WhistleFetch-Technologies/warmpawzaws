/**
 * Direct Migration Script for Vet Roles
 * This script runs the migration logic directly without needing the endpoint to be deployed
 */

import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://vpvpbdwtyugbknrntkho.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Helper function to normalize phone
function normalizePhone(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('91') && clean.length === 12) {
    clean = clean.substring(2);
  }
  if (clean.startsWith('0') && clean.length === 11) {
    clean = clean.substring(1);
  }
  return clean;
}

async function migrateVetRoles(dryRun: boolean = false) {
  console.log(`🔧 ${dryRun ? 'DRY RUN: ' : ''}Migrating vet roles to pet_clinic...`);
  
  // Vet role variations that should be migrated to 'pet_clinic'
  const vetRoleVariations = [
    'veterinarian',
    'vet_clinic',
    'veterinary_clinic',
    'role_veterinarian',
    'role_vet_clinic',
    'role_pet_clinic',
    'role_veterinary_clinic',
    'veterinarian_clinic',
    'vet',
    'veterinary'
  ];
  
  const targetRole = 'pet_clinic';
  
  // Get all vendors from KV store via Supabase
  console.log('📋 Fetching all vendors...');
  const { data: kvRecords, error } = await supabase
    .from('kv_store_3dd53475')
    .select('key, value')
    .like('key', 'vendor:%')
    .limit(10000);
  
  if (error) {
    console.error('❌ Error fetching vendors:', error);
    Deno.exit(1);
  }
  
  const allVendors = kvRecords?.map((r: any) => r.value).filter((v: any) => v && typeof v === 'object') || [];
  console.log(`📋 Found ${allVendors.length} total vendors`);
  
  // Find vendors with vet-related roles
  const vendorsToMigrate: any[] = [];
  
  allVendors.forEach((vendor: any) => {
    if (!vendor || typeof vendor !== 'object') return;
    
    const currentRole = vendor.roleId || vendor.role || vendor.roleName || '';
    const normalizedRole = currentRole.toLowerCase().trim();
    
    // Check if this vendor has a vet-related role
    if (vetRoleVariations.includes(normalizedRole) || 
        normalizedRole.includes('vet') || 
        normalizedRole.includes('clinic')) {
      
      // Only skip if already using target role (pet_clinic)
      if (normalizedRole === targetRole || 
          normalizedRole === `role_${targetRole}` ||
          normalizedRole === 'pet_clinic') {
        return;
      }
      
      vendorsToMigrate.push({
        vendorId: vendor.id || vendor.vendorId,
        currentRole: currentRole,
        normalizedRole: normalizedRole,
        vendor: vendor
      });
    }
  });
  
  console.log(`📊 Found ${vendorsToMigrate.length} vendors to migrate`);
  
  if (dryRun) {
    console.log('\n📋 DRY RUN - Would migrate the following vendors:');
    vendorsToMigrate.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.vendorId}: ${v.currentRole} → ${targetRole} (${v.vendor.businessName || v.vendor.fullName || 'N/A'})`);
    });
    
    return {
      dryRun: true,
      totalVendors: allVendors.length,
      vendorsToMigrate: vendorsToMigrate.length,
      vendors: vendorsToMigrate.map(v => ({
        vendorId: v.vendorId,
        currentRole: v.currentRole,
        newRole: targetRole,
        businessName: v.vendor.businessName || v.vendor.fullName
      }))
    };
  }
  
  // Actually migrate
  let migratedCount = 0;
  let errorCount = 0;
  const migrated: any[] = [];
  const errors: any[] = [];
  
  for (const item of vendorsToMigrate) {
    try {
      const vendor = item.vendor;
      const vendorId = item.vendorId;
      const vendorKey = `vendor:${vendorId}`;
      
      // Update role fields
      const updatedVendor = {
        ...vendor,
        roleId: targetRole,
        role: targetRole,
        roleName: 'Pet Clinic',
        updatedAt: new Date().toISOString(),
        migratedAt: new Date().toISOString(),
        migrationNote: `Migrated from ${item.currentRole} to ${targetRole}`
      };
      
      // Save updated vendor
      const { error: updateError } = await supabase
        .from('kv_store_3dd53475')
        .update({ value: updatedVendor })
        .eq('key', vendorKey);
      
      if (updateError) {
        throw updateError;
      }
      
      // Also update application if it exists
      if (vendor.applicationId) {
        try {
          const { data: appData } = await supabase
            .from('kv_store_3dd53475')
            .select('value')
            .eq('key', `application:${vendor.applicationId}`)
            .single();
          
          if (appData?.value) {
            const updatedApplication = {
              ...appData.value,
              roleId: targetRole,
              updatedAt: new Date().toISOString()
            };
            
            await supabase
              .from('kv_store_3dd53475')
              .update({ value: updatedApplication })
              .eq('key', `application:${vendor.applicationId}`);
          }
        } catch (appError) {
          console.warn(`⚠️ Could not update application for vendor ${vendorId}`);
        }
      }
      
      migratedCount++;
      migrated.push({
        vendorId: vendorId,
        oldRole: item.currentRole,
        newRole: targetRole,
        businessName: vendor.businessName || vendor.fullName
      });
      
      console.log(`✅ Migrated vendor ${vendorId}: ${item.currentRole} → ${targetRole}`);
      
    } catch (error) {
      console.error(`❌ Error migrating vendor ${item.vendorId}:`, error);
      errorCount++;
      errors.push({
        vendorId: item.vendorId,
        currentRole: item.currentRole,
        error: String(error)
      });
    }
  }
  
  console.log(`\n✅ Migration complete: ${migratedCount} migrated, ${errorCount} errors`);
  
  return {
    dryRun: false,
    totalVendors: allVendors.length,
    vendorsToMigrate: vendorsToMigrate.length,
    migrated: migratedCount,
    errors: errorCount,
    migrated: migrated,
    errors: errors.length > 0 ? errors : undefined
  };
}

// Run migration
const dryRun = Deno.args.includes('--dry-run') || Deno.args.includes('-d');
const result = await migrateVetRoles(dryRun);

console.log('\n📊 Migration Results:');
console.log(JSON.stringify(result, null, 2));


