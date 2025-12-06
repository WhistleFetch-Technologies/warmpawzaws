import { Hono } from "npm:hono";
import { normalizePhone, createVendorId } from "./phone-utils.tsx";

/**
 * One-time migration endpoint to fix vendor IDs with incorrect phone prefixes
 * This will:
 * 1. Find all vendors with vendor_91XXXXXXXXXX pattern (12 digits with country code)
 * 2. Create new records with vendor_XXXXXXXXXX pattern (10 digits)
 * 3. Copy all data to new key
 * 4. Delete old key
 */
export function vendorPhoneMigrationEndpoints(app: Hono, kv: any) {
  
  /**
   * Migrate specific vendor by old vendor ID
   * POST /make-server-3dd53475/admin/migrate-vendor/:oldVendorId
   */
  app.post("/make-server-3dd53475/admin/migrate-vendor/:oldVendorId", async (c) => {
    try {
      const { oldVendorId } = c.req.param();
      
      console.log(`🔄 Starting migration for vendor: ${oldVendorId}`);
      
      // Get old vendor record
      const oldVendor = await kv.get(`vendor:${oldVendorId}`);
      
      if (!oldVendor) {
        console.log(`❌ Old vendor not found at vendor:${oldVendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      console.log(`✅ Found old vendor: ${oldVendor.fullName}, Phone: ${oldVendor.phone}`);
      
      // Create new vendor ID with normalized phone
      const normalizedPhone = normalizePhone(oldVendor.phone);
      const newVendorId = `vendor_${normalizedPhone}`;
      
      console.log(`📱 Old ID: ${oldVendorId}`);
      console.log(`📱 New ID: ${newVendorId}`);
      console.log(`📱 Normalized Phone: ${normalizedPhone}`);
      
      // Check if new vendor already exists
      const existingNewVendor = await kv.get(`vendor:${newVendorId}`);
      
      if (existingNewVendor) {
        console.log(`⚠️ New vendor ID already exists! Merging data...`);
        // Merge old data into new (prefer newer data from old vendor)
        const mergedVendor = {
          ...existingNewVendor,
          ...oldVendor,
          id: newVendorId, // Keep new ID
          phone: oldVendor.phone, // Keep phone format
          migratedFrom: oldVendorId,
          migratedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await kv.set(`vendor:${newVendorId}`, mergedVendor);
        console.log(`✅ Merged vendor data into ${newVendorId}`);
      } else {
        // Create new vendor with corrected ID
        const newVendor = {
          ...oldVendor,
          id: newVendorId,
          migratedFrom: oldVendorId,
          migratedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await kv.set(`vendor:${newVendorId}`, newVendor);
        console.log(`✅ Created new vendor at vendor:${newVendorId}`);
      }
      
      // Migrate application record if it exists
      if (oldVendor.applicationId) {
        const oldApp = await kv.get(`vendor:application:${oldVendor.applicationId}`);
        if (oldApp) {
          const newApp = {
            ...oldApp,
            vendorId: newVendorId,
            migratedFrom: oldVendorId,
            migratedAt: new Date().toISOString()
          };
          await kv.set(`vendor:application:${oldVendor.applicationId}`, newApp);
          console.log(`✅ Updated application ${oldVendor.applicationId} to point to ${newVendorId}`);
        }
      }
      
      // Migrate services if they exist
      const oldServices = await kv.get(`vendor:${oldVendorId}:services`);
      if (oldServices) {
        await kv.set(`vendor:${newVendorId}:services`, oldServices);
        console.log(`✅ Migrated services list`);
      }
      
      const oldCustomServices = await kv.get(`vendor:${oldVendorId}:custom_services`);
      if (oldCustomServices) {
        await kv.set(`vendor:${newVendorId}:custom_services`, oldCustomServices);
        console.log(`✅ Migrated custom services list`);
      }
      
      // Delete old vendor record
      await kv.del(`vendor:${oldVendorId}`);
      console.log(`🗑️ Deleted old vendor record at vendor:${oldVendorId}`);
      
      // Clean up old service records
      if (oldServices) {
        await kv.del(`vendor:${oldVendorId}:services`);
      }
      if (oldCustomServices) {
        await kv.del(`vendor:${oldVendorId}:custom_services`);
      }
      
      console.log(`🎉 Migration complete: ${oldVendorId} → ${newVendorId}`);
      
      return c.json({
        success: true,
        message: 'Vendor migrated successfully',
        oldVendorId,
        newVendorId,
        normalizedPhone,
        vendor: await kv.get(`vendor:${newVendorId}`)
      });
      
    } catch (error) {
      console.error('❌ Migration error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Migrate ALL vendors with incorrect phone prefixes
   * POST /make-server-3dd53475/admin/migrate-all-vendors
   */
  app.post("/make-server-3dd53475/admin/migrate-all-vendors", async (c) => {
    try {
      console.log(`🔄 Starting bulk vendor migration...`);
      
      // Get all vendors
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      console.log(`📋 Found ${allVendors.length} vendors`);
      
      const migrationResults = [];
      let migratedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      for (const vendor of allVendors) {
        try {
          const oldVendorId = vendor.id;
          const normalizedPhone = normalizePhone(vendor.phone);
          const newVendorId = `vendor_${normalizedPhone}`;
          
          // Check if migration is needed
          if (oldVendorId === newVendorId) {
            console.log(`✅ Skipping ${oldVendorId} - already correct`);
            skippedCount++;
            migrationResults.push({
              oldId: oldVendorId,
              newId: newVendorId,
              status: 'skipped',
              reason: 'ID already correct'
            });
            continue;
          }
          
          console.log(`🔄 Migrating ${oldVendorId} → ${newVendorId}`);
          
          // Check if new ID already exists
          const existingNewVendor = await kv.get(`vendor:${newVendorId}`);
          
          if (existingNewVendor && existingNewVendor.id !== oldVendorId) {
            console.log(`⚠️ Conflict: ${newVendorId} already exists`);
            // Merge data, preferring the newer one
            const mergedVendor = {
              ...existingNewVendor,
              ...vendor,
              id: newVendorId,
              migratedFrom: oldVendorId,
              migratedAt: new Date().toISOString(),
              conflictResolved: true
            };
            await kv.set(`vendor:${newVendorId}`, mergedVendor);
          } else {
            // Create new vendor
            const newVendor = {
              ...vendor,
              id: newVendorId,
              migratedFrom: oldVendorId,
              migratedAt: new Date().toISOString()
            };
            await kv.set(`vendor:${newVendorId}`, newVendor);
          }
          
          // Update application if exists
          if (vendor.applicationId) {
            const app = await kv.get(`vendor:application:${vendor.applicationId}`);
            if (app) {
              app.vendorId = newVendorId;
              app.migratedFrom = oldVendorId;
              await kv.set(`vendor:application:${vendor.applicationId}`, app);
            }
          }
          
          // Migrate services
          const services = await kv.get(`vendor:${oldVendorId}:services`);
          if (services) {
            await kv.set(`vendor:${newVendorId}:services`, services);
            await kv.del(`vendor:${oldVendorId}:services`);
          }
          
          const customServices = await kv.get(`vendor:${oldVendorId}:custom_services`);
          if (customServices) {
            await kv.set(`vendor:${newVendorId}:custom_services`, customServices);
            await kv.del(`vendor:${oldVendorId}:custom_services`);
          }
          
          // Delete old vendor
          await kv.del(`vendor:${oldVendorId}`);
          
          migratedCount++;
          migrationResults.push({
            oldId: oldVendorId,
            newId: newVendorId,
            phone: vendor.phone,
            normalizedPhone,
            status: 'migrated',
            name: vendor.fullName
          });
          
          console.log(`✅ Migrated ${migratedCount}/${allVendors.length}: ${oldVendorId} → ${newVendorId}`);
          
        } catch (error) {
          console.error(`❌ Error migrating ${vendor.id}:`, error);
          errorCount++;
          migrationResults.push({
            oldId: vendor.id,
            status: 'error',
            error: String(error)
          });
        }
      }
      
      console.log(`🎉 Bulk migration complete:`);
      console.log(`   Total: ${allVendors.length}`);
      console.log(`   Migrated: ${migratedCount}`);
      console.log(`   Skipped: ${skippedCount}`);
      console.log(`   Errors: ${errorCount}`);
      
      return c.json({
        success: true,
        message: 'Bulk migration complete',
        total: allVendors.length,
        migrated: migratedCount,
        skipped: skippedCount,
        errors: errorCount,
        results: migrationResults
      });
      
    } catch (error) {
      console.error('❌ Bulk migration error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  console.log('✅ Vendor phone migration endpoints registered');
}
