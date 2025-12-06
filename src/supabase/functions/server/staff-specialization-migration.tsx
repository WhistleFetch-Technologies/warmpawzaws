/**
 * 🔄 STAFF SPECIALIZATION MIGRATION
 * 
 * Migrates all existing staff members to the new specialization system
 * by analyzing their assigned services and setting appropriate specializations
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

const app = new Hono();

/**
 * GET /make-server-3dd53475/admin/migrate-staff-specializations
 * 
 * Migrates all staff to have specializations field based on their assigned services
 */
app.get('/make-server-3dd53475/admin/migrate-staff-specializations', async (c) => {
  try {
    console.log('🚀 Starting staff specialization migration...\n');
    
    // Get all staff members
    const allStaff = await kv.getByPrefix('staff:staff_');
    console.log(`📊 Found ${allStaff.length} staff members to migrate\n`);
    
    if (allStaff.length === 0) {
      return c.json({
        success: true,
        message: 'No staff members found to migrate',
        migratedCount: 0
      });
    }
    
    // Get service catalog for subcategory lookups
    const serviceCatalog = await kv.get('platform:service_catalog') || [];
    console.log(`📚 Loaded ${serviceCatalog.length} catalog services\n`);
    
    // Build a map of serviceName -> subCategoryName for quick lookups
    const serviceToSubcategoryMap = new Map<string, string>();
    serviceCatalog.forEach((service: any) => {
      if (service.serviceName && service.subCategoryName) {
        serviceToSubcategoryMap.set(service.serviceName, service.subCategoryName);
      }
    });
    
    // Import subcategory name to ID mapping
    const { getSubcategoryIdByName } = await import('./problem-subcategory-mapping.tsx');
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    const migrationResults: any[] = [];
    
    // Process each staff member
    for (const staff of allStaff) {
      try {
        console.log(`\n👤 Processing: ${staff.fullName || staff.name} (${staff.id})`);
        console.log(`   Role: ${staff.role}, Vendor: ${staff.vendorId}`);
        
        // Skip if already has specializations
        if (staff.specializations && Array.isArray(staff.specializations) && staff.specializations.length > 0) {
          console.log(`   ⏭️  Already has specializations: ${staff.specializations.join(', ')}`);
          skippedCount++;
          migrationResults.push({
            staffId: staff.id,
            name: staff.fullName || staff.name,
            status: 'skipped',
            reason: 'Already has specializations',
            existingSpecializations: staff.specializations
          });
          continue;
        }
        
        // Collect subcategories from assigned services
        const subcategoryNames = new Set<string>();
        
        // Method 1: Check assignedServices array (new format - service IDs from catalog)
        if (staff.assignedServices && Array.isArray(staff.assignedServices) && staff.assignedServices.length > 0) {
          console.log(`   📋 Has ${staff.assignedServices.length} assigned services (IDs)`);
          
          // Look up these service IDs in the catalog
          for (const serviceId of staff.assignedServices) {
            const catalogService = serviceCatalog.find((s: any) => s.id === serviceId || s.serviceId === serviceId);
            if (catalogService && catalogService.subCategoryName) {
              subcategoryNames.add(catalogService.subCategoryName);
              console.log(`      - ${catalogService.serviceName} → ${catalogService.subCategoryName}`);
            }
          }
        }
        
        // Method 2: Check vendor's services that this staff can perform
        if (staff.vendorId) {
          for (const style of ['at_home', 'at_center', 'tele']) {
            const vendorServices = await kv.get(`vendor_services:${staff.vendorId}:${style}`);
            if (vendorServices && vendorServices.services) {
              const publishedServices = vendorServices.services.filter((s: any) => 
                s.isEnabled && 
                (s.publishStatus === 'published' || s.publishStatus === 'auto_published') &&
                (!staff.assignedServices || staff.assignedServices.includes(s.serviceId))
              );
              
              if (publishedServices.length > 0) {
                console.log(`   📦 Vendor has ${publishedServices.length} ${style} services`);
                
                publishedServices.forEach((svc: any) => {
                  if (svc.subCategoryName) {
                    subcategoryNames.add(svc.subCategoryName);
                    console.log(`      - ${svc.serviceName} → ${svc.subCategoryName}`);
                  }
                });
              }
            }
          }
        }
        
        // Method 3: Check staff-specific services (old format)
        const staffServices = await kv.getByPrefix(`staff:${staff.id}:service:`);
        if (staffServices && staffServices.length > 0) {
          console.log(`   🔧 Has ${staffServices.length} staff-specific services`);
          
          staffServices.forEach((svc: any) => {
            if (svc.isActive && svc.subCategory) {
              subcategoryNames.add(svc.subCategory);
              console.log(`      - ${svc.name} → ${svc.subCategory}`);
            }
          });
        }
        
        // Convert subcategory names to IDs
        const specializationIds: string[] = [];
        subcategoryNames.forEach(name => {
          const id = getSubcategoryIdByName(name);
          if (id) {
            specializationIds.push(id);
          } else {
            console.warn(`      ⚠️  No subcategory ID found for: "${name}"`);
          }
        });
        
        console.log(`   🎯 Collected ${subcategoryNames.size} subcategories → ${specializationIds.length} specialization IDs`);
        
        if (specializationIds.length === 0) {
          console.log(`   ⚠️  No specializations found - setting empty array`);
          // Still set empty array to mark as migrated
        }
        
        // Update staff with specializations
        const updatedStaff = {
          ...staff,
          specializations: specializationIds,
          specializationsMigratedAt: new Date().toISOString()
        };
        
        await kv.set(`staff:${staff.id}`, updatedStaff);
        migratedCount++;
        
        console.log(`   ✅ Migrated with ${specializationIds.length} specializations`);
        
        migrationResults.push({
          staffId: staff.id,
          name: staff.fullName || staff.name,
          role: staff.role,
          vendorId: staff.vendorId,
          status: 'migrated',
          specializations: specializationIds,
          subcategoryNames: Array.from(subcategoryNames)
        });
        
      } catch (error) {
        console.error(`   ❌ Error migrating staff ${staff.id}:`, error);
        errorCount++;
        migrationResults.push({
          staffId: staff.id,
          name: staff.fullName || staff.name,
          status: 'error',
          error: String(error)
        });
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (already had specializations): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total processed: ${allStaff.length}`);
    console.log('='.repeat(60) + '\n');
    
    return c.json({
      success: true,
      message: 'Staff specialization migration completed',
      summary: {
        totalStaff: allStaff.length,
        migrated: migratedCount,
        skipped: skippedCount,
        errors: errorCount
      },
      results: migrationResults
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return c.json({
      success: false,
      error: 'Migration failed',
      message: String(error)
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/admin/migrate-single-staff/:staffId
 * 
 * Migrate a single staff member (useful for testing or manual fixes)
 */
app.post('/make-server-3dd53475/admin/migrate-single-staff/:staffId', async (c) => {
  try {
    const staffId = c.req.param('staffId');
    
    const staff = await kv.get(`staff:${staffId}`);
    if (!staff) {
      return c.json({
        success: false,
        error: 'Staff not found'
      }, 404);
    }
    
    console.log(`\n👤 Migrating single staff: ${staff.fullName || staff.name} (${staff.id})`);
    
    // Get service catalog
    const serviceCatalog = await kv.get('platform:service_catalog') || [];
    const { getSubcategoryIdByName } = await import('./problem-subcategory-mapping.tsx');
    
    // Collect subcategories
    const subcategoryNames = new Set<string>();
    
    // Check assigned services
    if (staff.assignedServices && Array.isArray(staff.assignedServices)) {
      for (const serviceId of staff.assignedServices) {
        const catalogService = serviceCatalog.find((s: any) => s.id === serviceId || s.serviceId === serviceId);
        if (catalogService && catalogService.subCategoryName) {
          subcategoryNames.add(catalogService.subCategoryName);
        }
      }
    }
    
    // Check vendor services
    if (staff.vendorId) {
      for (const style of ['at_home', 'at_center', 'tele']) {
        const vendorServices = await kv.get(`vendor_services:${staff.vendorId}:${style}`);
        if (vendorServices && vendorServices.services) {
          const publishedServices = vendorServices.services.filter((s: any) => 
            s.isEnabled && 
            (s.publishStatus === 'published' || s.publishStatus === 'auto_published') &&
            (!staff.assignedServices || staff.assignedServices.includes(s.serviceId))
          );
          
          publishedServices.forEach((svc: any) => {
            if (svc.subCategoryName) {
              subcategoryNames.add(svc.subCategoryName);
            }
          });
        }
      }
    }
    
    // Check staff-specific services
    const staffServices = await kv.getByPrefix(`staff:${staff.id}:service:`);
    staffServices.forEach((svc: any) => {
      if (svc.isActive && svc.subCategory) {
        subcategoryNames.add(svc.subCategory);
      }
    });
    
    // Convert to IDs
    const specializationIds: string[] = [];
    subcategoryNames.forEach(name => {
      const id = getSubcategoryIdByName(name);
      if (id) {
        specializationIds.push(id);
      }
    });
    
    // Update staff
    const updatedStaff = {
      ...staff,
      specializations: specializationIds,
      specializationsMigratedAt: new Date().toISOString()
    };
    
    await kv.set(`staff:${staff.id}`, updatedStaff);
    
    console.log(`✅ Migrated with ${specializationIds.length} specializations`);
    
    return c.json({
      success: true,
      message: 'Staff member migrated successfully',
      staff: {
        id: staff.id,
        name: staff.fullName || staff.name,
        specializations: specializationIds,
        subcategoryNames: Array.from(subcategoryNames)
      }
    });
    
  } catch (error) {
    console.error('❌ Single staff migration failed:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

export default app;
