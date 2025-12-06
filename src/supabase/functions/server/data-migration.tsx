import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";

/**
 * DATA MIGRATION ENDPOINTS
 * Consolidates vendor data from multiple key patterns into a single standardized pattern
 */
export function dataMigrationEndpoints(app: Hono, kv: any) {

  // ============================================
  // VENDOR KEY CONSOLIDATION MIGRATION
  // ============================================

  /**
   * Migrate all vendor data to standardized key pattern: vendor:vendor_xxxxx
   * 
   * BEFORE:
   * - vendor:vendor_xxxxx (some records)
   * - vendor:profile:vendor_xxxxx (some records)
   * - vendor:xxxxx (some records)
   * 
   * AFTER:
   * - vendor:vendor_xxxxx (ALL records)
   */
  app.post("/make-server-3dd53475/admin/migration/consolidate-vendor-keys", async (c) => {
    try {
      console.log('🔧 ===== STARTING VENDOR KEY CONSOLIDATION MIGRATION =====');
      
      const results = {
        totalScanned: 0,
        migrated: 0,
        merged: 0,
        deleted: 0,
        errors: [],
        summary: {}
      };

      // Step 1: Get all vendor-related keys - we need to fetch differently
      console.log('\n📋 Step 1: Scanning all vendor keys...');
      
      // Use raw Supabase query to get both key and value
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL'),
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      );
      
      const { data: allVendorKeysRaw, error } = await supabase
        .from('kv_store_3dd53475')
        .select('key, value')
        .like('key', 'vendor:%');
      
      if (error) throw error;
      
      const allVendorKeys = allVendorKeysRaw || [];
      results.totalScanned = allVendorKeys.length;
      console.log(`   Found ${allVendorKeys.length} vendor-related keys`);

      // Categorize keys by pattern
      const vendorRecords = new Map(); // vendorId -> consolidated record
      const keysToDelete = [];

      for (const item of allVendorKeys) {
        const key = item.key;
        const value = item.value;

        // Skip if key or value is invalid
        if (!key || !value) {
          console.warn('Skipping invalid item:', item);
          continue;
        }

        // Skip non-vendor records (applications, services, etc.)
        if (key.startsWith('vendor:application:') || 
            key.startsWith('vendor:service:') ||
            key.startsWith('vendor:applications:') ||
            key.startsWith('vendor:pending_approvals') ||
            key.startsWith('vendor:approved_list') ||
            key.includes(':services') ||
            key.includes(':custom_services') ||
            key.includes(':notifications')) {
          continue;
        }

        // Extract vendor ID and determine pattern
        let vendorId = null;
        let pattern = null;

        if (key.match(/^vendor:vendor_[a-zA-Z0-9_]+$/)) {
          // Pattern: vendor:vendor_xxxxx (CORRECT)
          vendorId = key.replace('vendor:', '');
          pattern = 'correct';
        } else if (key.match(/^vendor:profile:vendor_[a-zA-Z0-9_]+$/)) {
          // Pattern: vendor:profile:vendor_xxxxx (OLD - needs migration)
          vendorId = key.replace('vendor:profile:', '');
          pattern = 'old_profile';
          keysToDelete.push(key);
        } else if (key.match(/^vendor:[a-zA-Z0-9-]+$/) && !key.includes('vendor_')) {
          // Pattern: vendor:xxxxx (LEGACY - needs migration)
          vendorId = 'vendor_' + key.replace('vendor:', '');
          pattern = 'legacy';
          keysToDelete.push(key);
        }

        if (!vendorId || !value || !value.id) {
          continue; // Skip invalid records
        }

        // Normalize vendor ID (ensure it has vendor_ prefix)
        if (!vendorId.startsWith('vendor_')) {
          vendorId = 'vendor_' + vendorId;
        }

        // Merge records with same vendor ID
        if (vendorRecords.has(vendorId)) {
          console.log(`   🔀 Merging duplicate record for ${vendorId} (pattern: ${pattern})`);
          const existing = vendorRecords.get(vendorId);
          // Merge, preferring non-null values from both records
          vendorRecords.set(vendorId, {
            ...existing,
            ...value,
            // Ensure critical fields are not overwritten with nulls
            status: value.status || existing.status,
            documents: value.documents || existing.documents || [],
            createdAt: existing.createdAt || value.createdAt,
            updatedAt: new Date().toISOString()
          });
          results.merged++;
        } else {
          // Normalize the value
          const normalizedValue = {
            ...value,
            id: vendorId,
            updatedAt: new Date().toISOString()
          };
          vendorRecords.set(vendorId, normalizedValue);
        }
      }

      // Step 2: Save all records with correct key pattern
      console.log(`\n💾 Step 2: Saving ${vendorRecords.size} consolidated vendor records...`);
      for (const [vendorId, vendor] of vendorRecords.entries()) {
        const correctKey = `vendor:${vendorId}`;
        await kv.set(correctKey, vendor);
        results.migrated++;
        console.log(`   ✅ Saved: ${correctKey}`);
      }

      // Step 3: Delete old pattern keys
      console.log(`\n🗑️  Step 3: Deleting ${keysToDelete.length} old pattern keys...`);
      for (const key of keysToDelete) {
        await kv.del(key);
        results.deleted++;
        console.log(`   ❌ Deleted: ${key}`);
      }

      // Step 4: Verify migration
      console.log('\n✅ Step 4: Verifying migration...');
      const finalVendorKeys = await kv.getByPrefix('vendor:vendor_');
      const profileKeys = await kv.getByPrefix('vendor:profile:');
      
      results.summary = {
        finalVendorRecords: finalVendorKeys.length,
        remainingProfileKeys: profileKeys.length,
        vendorIds: Array.from(vendorRecords.keys()).slice(0, 10) // First 10 for debugging
      };

      console.log('✅ ===== MIGRATION COMPLETE =====');
      console.log(`   Total scanned: ${results.totalScanned}`);
      console.log(`   Migrated: ${results.migrated}`);
      console.log(`   Merged: ${results.merged}`);
      console.log(`   Deleted: ${results.deleted}`);
      console.log(`   Final vendor records: ${finalVendorKeys.length}`);
      console.log(`   Remaining profile keys: ${profileKeys.length}`);

      return c.json({ 
        success: true, 
        message: 'Vendor key consolidation completed',
        results 
      });

    } catch (error) {
      console.error('❌ Migration error:', error);
      return c.json({ 
        success: false, 
        error: String(error) 
      }, 500);
    }
  });

  // ============================================
  // VENDOR ID NORMALIZATION
  // ============================================

  /**
   * Helper function to normalize vendor IDs
   * Ensures all vendor IDs have the vendor_ prefix
   */
  app.post("/make-server-3dd53475/admin/migration/normalize-vendor-ids", async (c) => {
    try {
      console.log('🔧 ===== NORMALIZING VENDOR IDS =====');
      
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      const updated = [];

      for (const vendor of allVendors) {
        let changed = false;

        // Ensure ID has vendor_ prefix
        if (vendor.id && !vendor.id.startsWith('vendor_')) {
          vendor.id = 'vendor_' + vendor.id;
          changed = true;
        }

        // Update application ID reference if needed
        if (vendor.applicationId && !vendor.applicationId.startsWith('APP')) {
          // Application IDs should start with APP
          if (!vendor.applicationId.includes('APP')) {
            vendor.applicationId = 'APP' + vendor.applicationId;
            changed = true;
          }
        }

        if (changed) {
          await kv.set(`vendor:${vendor.id}`, vendor);
          updated.push(vendor.id);
          console.log(`   ✅ Updated: ${vendor.id}`);
        }
      }

      console.log(`✅ Normalized ${updated.length} vendor IDs`);

      return c.json({
        success: true,
        message: `Normalized ${updated.length} vendor IDs`,
        updated
      });

    } catch (error) {
      console.error('❌ Normalization error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // MIGRATION STATUS CHECK
  // ============================================

  app.get("/make-server-3dd53475/admin/migration/status", async (c) => {
    try {
      // Use raw Supabase query to get both key and value
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL'),
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      );
      
      const { data: allVendorKeysRaw, error } = await supabase
        .from('kv_store_3dd53475')
        .select('key, value')
        .like('key', 'vendor:%');
      
      if (error) throw error;
      
      const allVendorKeys = allVendorKeysRaw || [];
      
      // Count different patterns
      let correctPattern = 0;
      let oldProfilePattern = 0;
      let legacyPattern = 0;
      let other = 0;

      for (const item of allVendorKeys) {
        const key = item.key;
        
        // Skip if key is undefined or null
        if (!key) {
          console.warn('Skipping item with undefined key:', item);
          continue;
        }
        
        if (key.startsWith('vendor:application:') || 
            key.startsWith('vendor:service:') ||
            key.startsWith('vendor:applications:') ||
            key.includes(':services') ||
            key.includes(':custom_services')) {
          other++;
        } else if (key.match(/^vendor:vendor_[a-zA-Z0-9_-]+$/)) {
          correctPattern++;
        } else if (key.match(/^vendor:profile:/)) {
          oldProfilePattern++;
        } else if (key.match(/^vendor:[a-zA-Z0-9-]+$/) && !key.includes('vendor_')) {
          legacyPattern++;
        } else {
          other++;
        }
      }

      const needsMigration = oldProfilePattern > 0 || legacyPattern > 0;

      return c.json({
        needsMigration,
        patterns: {
          correct: `vendor:vendor_xxxxx (${correctPattern})`,
          oldProfile: `vendor:profile:vendor_xxxxx (${oldProfilePattern})`,
          legacy: `vendor:xxxxx (${legacyPattern})`,
          other: `Other vendor keys (${other})`
        },
        totals: {
          correctPattern,
          oldProfilePattern,
          legacyPattern,
          other,
          total: allVendorKeys.length
        },
        recommendation: needsMigration 
          ? 'Migration needed! Run POST /admin/migration/consolidate-vendor-keys'
          : 'All vendor keys use the correct pattern ✅'
      });

    } catch (error) {
      console.error('Error checking migration status:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // FIX VENDOR-APPLICATION LINKAGE
  // ============================================

  /**
   * Ensures all vendor records are properly linked to their applications
   */
  app.post("/make-server-3dd53475/admin/migration/link-applications", async (c) => {
    try {
      console.log('🔧 ===== LINKING VENDORS TO APPLICATIONS =====');
      
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      const allApplications = await kv.getByPrefix('vendor:application:');
      
      const linked = [];
      const errors = [];

      for (const vendor of allVendors) {
        if (vendor.applicationId) {
          // Vendor already has applicationId, verify it exists
          const app = await kv.get(`vendor:application:${vendor.applicationId}`);
          if (app) {
            // Sync status between vendor and application
            if (vendor.status !== app.status) {
              console.log(`   ⚠️  Status mismatch for ${vendor.id}: vendor=${vendor.status}, app=${app.status}`);
              // Use vendor status as source of truth
              app.status = vendor.status;
              await kv.set(`vendor:application:${vendor.applicationId}`, app);
              console.log(`   ✅ Synced application status to: ${vendor.status}`);
            }
            linked.push(vendor.id);
          } else {
            console.log(`   ❌ Application ${vendor.applicationId} not found for vendor ${vendor.id}`);
            errors.push(`Application ${vendor.applicationId} not found for vendor ${vendor.id}`);
          }
        } else {
          // Vendor doesn't have applicationId, try to find it
          const matchingApp = allApplications.find(app => app.vendorId === vendor.id);
          if (matchingApp) {
            vendor.applicationId = matchingApp.id;
            vendor.status = matchingApp.status;
            await kv.set(`vendor:${vendor.id}`, vendor);
            linked.push(vendor.id);
            console.log(`   ✅ Linked vendor ${vendor.id} to application ${matchingApp.id}`);
          }
        }
      }

      console.log(`✅ Linked ${linked.length} vendors to applications`);
      if (errors.length > 0) {
        console.log(`⚠️  ${errors.length} errors encountered`);
      }

      return c.json({
        success: true,
        message: `Linked ${linked.length} vendors to applications`,
        linked: linked.length,
        errors
      });

    } catch (error) {
      console.error('❌ Linking error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

}