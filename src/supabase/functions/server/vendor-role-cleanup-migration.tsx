/**
 * ========================================
 * VENDOR ROLE CLEANUP & MIGRATION SCRIPT
 * ========================================
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

/**
 * Analyze vendors for cleanup (what to keep vs delete)
 */
app.get('/admin/analyze-vendor-cleanup', async (c) => {
  try {
    console.log('\n🔍 [ANALYZE-CLEANUP] Starting analysis...');
    
    const allRecords = await kv.getByPrefix('vendor:');
    console.log(`   📊 Total records from KV: ${allRecords.length}`);
    
    const analysis = {
      total: 0,
      readyToMigrate: 0,
      toDelete: 0,
      roleDistribution: {} as Record<string, number>,
      roleDetails: {} as Record<string, any[]>,
      deletionReasons: {} as Record<string, number>,
      deletionSamples: [] as any[],
      migrationSamples: [] as any[],
      readyToMigrateList: [] as any[],
      toDeleteList: [] as any[]
    };
    
    for (const record of allRecords) {
      const key = record.key;
      
      // Skip lookup keys (they contain references, not vendor data)
      if (key.includes(':phone:') || key.includes(':email:') || key.includes(':user:')) {
        continue;
      }
      
      // Only process actual vendor records (vendor:id format)
      const parts = key.split(':');
      if (parts.length !== 2 || parts[0] !== 'vendor') {
        continue;
      }
      
      let vendorData: any;
      
      try {
        if (typeof record.value === 'string') {
          try {
            vendorData = JSON.parse(record.value);
          } catch {
            // Plain string lookup key - skip it
            continue;
          }
        } else {
          vendorData = record.value;
        }
      } catch (err) {
        console.error(`   ⚠️ Failed to process record ${key}:`, err);
        continue;
      }
      
      analysis.total++;
      
      // Ensure vendor has an ID
      if (!vendorData.id) {
        vendorData.id = key.replace('vendor:', '');
      }
      
      // Check roleId validity
      const roleId = vendorData.roleId;
      const hasValidRole = roleId && roleId !== 'undefined' && roleId !== 'null' && roleId !== 'N/A';
      
      // Check approval status
      const isApproved = vendorData.status === 'approved' || vendorData.approvalStatus === 'approved';
      
      // Categorize vendor
      if (hasValidRole && isApproved) {
        // KEEP: Valid role + approved
        analysis.readyToMigrate++;
        
        const roleKey = vendorData.roleId;
        analysis.roleDistribution[roleKey] = (analysis.roleDistribution[roleKey] || 0) + 1;
        
        if (!analysis.roleDetails[roleKey]) {
          analysis.roleDetails[roleKey] = [];
        }
        
        analysis.roleDetails[roleKey].push({
          id: vendorData.id,
          businessName: vendorData.businessName || vendorData.fullName || vendorData.phone || 'N/A',
          phone: vendorData.phone || 'N/A',
          email: vendorData.email || 'N/A',
          city: vendorData.city || 'N/A',
          state: vendorData.state || 'N/A',
          status: vendorData.status || vendorData.approvalStatus || 'unknown',
          roleId: vendorData.roleId
        });
        
        // Add to ready to migrate list
        if (analysis.readyToMigrateList.length < 100) {
          analysis.readyToMigrateList.push({
            id: vendorData.id,
            businessName: vendorData.businessName || vendorData.fullName || vendorData.phone || 'N/A',
            phone: vendorData.phone || 'N/A',
            email: vendorData.email || 'N/A',
            city: vendorData.city || 'N/A',
            state: vendorData.state || 'N/A',
            status: vendorData.status || vendorData.approvalStatus || 'unknown',
            roleId: vendorData.roleId
          });
        }
        
        // Add to migration samples
        if (analysis.migrationSamples.length < 20) {
          analysis.migrationSamples.push({
            id: vendorData.id,
            businessName: vendorData.businessName || vendorData.fullName || 'N/A',
            roleId: vendorData.roleId,
            status: vendorData.status || vendorData.approvalStatus || 'unknown',
            phone: vendorData.phone || 'N/A',
            city: vendorData.city || 'N/A',
            state: vendorData.state || 'N/A'
          });
        }
      } else {
        // DELETE: Invalid role OR not approved
        analysis.toDelete++;
        
        let reason = '';
        if (!hasValidRole && !isApproved) {
          reason = 'No roleId AND not approved';
        } else if (!hasValidRole) {
          reason = `Invalid roleId: "${roleId}"`;
        } else {
          reason = 'Not approved';
        }
        
        analysis.deletionReasons[reason] = (analysis.deletionReasons[reason] || 0) + 1;
        
        // Add to deletion samples
        if (analysis.deletionSamples.length < 50) {
          analysis.deletionSamples.push({
            id: vendorData.id,
            businessName: vendorData.businessName || vendorData.fullName || vendorData.phone || 'N/A',
            phone: vendorData.phone || 'N/A',
            roleId: roleId || 'undefined',
            status: vendorData.status || vendorData.approvalStatus || 'unknown',
            reason
          });
        }
        
        // Add to full delete list
        if (analysis.toDeleteList.length < 100) {
          analysis.toDeleteList.push({
            id: vendorData.id,
            businessName: vendorData.businessName || vendorData.fullName || vendorData.phone || 'N/A',
            phone: vendorData.phone || 'N/A',
            roleId: roleId || 'undefined',
            status: vendorData.status || vendorData.approvalStatus || 'unknown',
            reason
          });
        }
      }
    }
    
    console.log(`\n📊 [ANALYZE-CLEANUP] Summary:`);
    console.log(`   Total: ${analysis.total}`);
    console.log(`   ✅ Ready to Migrate: ${analysis.readyToMigrate}`);
    console.log(`   ❌ To Delete: ${analysis.toDelete}`);
    console.log(`   📋 Role Distribution:`, analysis.roleDistribution);
    console.log(`   📋 Deletion Reasons:`, analysis.deletionReasons);
    
    return c.json({
      success: true,
      analysis
    });
    
  } catch (error) {
    console.error('❌ [ANALYZE-CLEANUP] Error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    }, 500);
  }
});

/**
 * Get all vendors (raw data for analysis)
 */
app.get('/admin/all-vendors-raw', async (c) => {
  try {
    console.log('\n📋 [ALL-VENDORS-RAW] Fetching all vendors...');
    
    const allRecords = await kv.getByPrefix('vendor:');
    console.log(`   📊 Total records from KV: ${allRecords.length}`);
    
    // Filter to actual vendor records (exclude lookup keys)
    const vendorRecords = allRecords.filter(record => {
      const key = record.key;
      if (key.includes(':phone:') || key.includes(':email:') || key.includes(':user:')) {
        return false;
      }
      const parts = key.split(':');
      return parts.length === 2 && parts[0] === 'vendor';
    });
    
    console.log(`   📋 Filtered to ${vendorRecords.length} actual vendor records`);
    
    const allVendors = vendorRecords.map(record => {
      const vendorData = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
      if (!vendorData.id) {
        vendorData.id = record.key.replace('vendor:', '');
      }
      return vendorData;
    });
    
    const statistics = {
      total: allVendors.length,
      withValidRole: 0,
      withInvalidRole: 0,
      approved: 0,
      notApproved: 0,
      byRole: {} as Record<string, number>,
      byStatus: {} as Record<string, number>
    };
    
    for (const vendor of allVendors) {
      const hasRoleId = vendor.roleId && 
                       vendor.roleId !== 'undefined' && 
                       vendor.roleId !== 'null' &&
                       vendor.roleId !== 'N/A';
      const isApproved = vendor.status === 'approved' || vendor.approvalStatus === 'approved';
      
      if (hasRoleId) {
        statistics.withValidRole++;
      } else {
        statistics.withInvalidRole++;
      }
      
      if (isApproved) {
        statistics.approved++;
      } else {
        statistics.notApproved++;
      }
      
      const roleKey = vendor.roleId || 'undefined';
      statistics.byRole[roleKey] = (statistics.byRole[roleKey] || 0) + 1;
      
      const statusKey = vendor.status || vendor.approvalStatus || 'unknown';
      statistics.byStatus[statusKey] = (statistics.byStatus[statusKey] || 0) + 1;
    }
    
    console.log(`   ✅ Statistics:`, statistics);
    
    return c.json({
      success: true,
      vendors: allVendors,
      statistics
    });
    
  } catch (error) {
    console.error('❌ [ALL-VENDORS-RAW] Error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load vendors'
    }, 500);
  }
});

/**
 * Delete vendors with invalid roleIds
 */
app.post('/admin/cleanup-vendors', async (c) => {
  try {
    const url = new URL(c.req.url);
    const dryRun = url.searchParams.get('dryRun') === 'true';
    
    console.log(`\n🗑️  [VENDOR-CLEANUP] ${dryRun ? 'DRY RUN' : 'EXECUTING'} cleanup...`);
    console.log(`   🎯 Target: ALL records with undefined/invalid roleId`);
    
    // CRITICAL: Use EXACT same logic as migration-status - NO FILTERING
    const allRecords = await kv.getByPrefix('vendor:');
    console.log(`   📊 Total records from KV: ${allRecords.length}`);
    
    const statistics = {
      total: allRecords.length,
      deleted: 0,
      kept: 0,
      byReason: {} as Record<string, number>
    };
    
    const deletionList: any[] = [];
    const keptList: any[] = [];
    
    for (const record of allRecords) {
      const key = record.key;
      let vendorData: any;
      
      // SAFE PARSING: Handle lookup keys (plain strings) and vendor objects
      try {
        if (typeof record.value === 'string') {
          // Try to parse as JSON
          try {
            vendorData = JSON.parse(record.value);
          } catch {
            // If parsing fails, it's a lookup key (e.g., "vendor_123")
            // These are references, not actual vendor data - DELETE them if roleId is undefined
            console.log(`   🔍 Lookup key detected: ${key} -> "${record.value}"`);
            statistics.deleted++;
            statistics.byReason['Lookup key (plain string)'] = (statistics.byReason['Lookup key (plain string)'] || 0) + 1;
            deletionList.push({
              key,
              businessName: 'Lookup Key',
              roleId: 'N/A',
              reason: 'Lookup key (plain string value)'
            });
            if (!dryRun) {
              await kv.del(key);
            }
            continue;
          }
        } else {
          vendorData = record.value;
        }
      } catch (err) {
        console.error(`   ⚠️ Failed to process record ${key}:`, err);
        continue;
      }
      
      // Check roleId - EXACT same logic as migration-status
      const roleId = vendorData.roleId;
      const hasValidRole = roleId && roleId !== 'undefined' && roleId !== 'null' && roleId !== 'N/A';
      
      if (hasValidRole) {
        // KEEP: Valid roleId
        statistics.kept++;
        keptList.push({
          key,
          businessName: vendorData.businessName || vendorData.fullName || vendorData.phone || 'N/A',
          roleId: vendorData.roleId
        });
        console.log(`   ✅ KEEP: ${key} - roleId: "${vendorData.roleId}"`);
      } else {
        // DELETE: Invalid/undefined roleId
        const reason = `Invalid roleId: "${roleId}"`;
        statistics.byReason[reason] = (statistics.byReason[reason] || 0) + 1;
        statistics.deleted++;
        
        deletionList.push({
          key,
          businessName: vendorData.businessName || vendorData.fullName || vendorData.phone || 'N/A',
          roleId: roleId || 'undefined',
          reason
        });
        
        console.log(`   ❌ DELETE: ${key} - roleId: "${roleId}"`);
        
        if (!dryRun) {
          await kv.del(key);
        }
      }
    }
    
    console.log(`\n📊 [CLEANUP SUMMARY]`);
    console.log(`   Total: ${statistics.total}`);
    console.log(`   ✅ Kept: ${statistics.kept}`);
    console.log(`   ❌ Deleted: ${statistics.deleted}`);
    console.log(`   📋 By Reason:`, statistics.byReason);
    
    return c.json({
      success: true,
      dryRun,
      statistics,
      deletionList: deletionList.slice(0, 100),
      keptList: keptList.slice(0, 50),
      message: dryRun 
        ? `Dry run complete: ${statistics.deleted} records would be deleted (${statistics.kept} kept)`
        : `Cleanup complete: Deleted ${statistics.deleted} records (${statistics.kept} kept)`
    });
    
  } catch (error) {
    console.error('❌ [VENDOR-CLEANUP] Cleanup error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Cleanup failed'
    }, 500);
  }
});

export default app;