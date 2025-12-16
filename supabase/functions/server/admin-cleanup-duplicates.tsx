/**
 * ADMIN CLEANUP UTILITY - REMOVE DUPLICATE VENDOR APPLICATIONS
 * 
 * This endpoint helps admins clean up duplicate vendor applications
 * based on phone number or email duplicates.
 * 
 * Features:
 * - Find duplicate applications
 * - Keep the latest/most complete application
 * - Remove older duplicates
 * - Dry-run mode for safety
 * 
 * ⚠️ CRITICAL: Use with caution! This modifies database.
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';
import { normalizePhone, phonesMatch } from './phone-utils.tsx';

const app = new Hono();
app.use('*', cors());

/**
 * POST /admin/cleanup/find-duplicates
 * Find all duplicate vendor applications
 */
app.post('/admin/cleanup/find-duplicates', async (c) => {
  try {
    console.log('🔍 [CLEANUP] Searching for duplicate vendor applications...');
    
    const allVendors = await kv.getByPrefix('vendor:vendor_');
    console.log(`📊 Total vendors in database: ${allVendors.length}`);
    
    // Group by phone number
    const phoneGroups: Map<string, any[]> = new Map();
    
    for (const vendor of allVendors) {
      if (!vendor || !vendor.phone) continue;
      
      const cleanPhone = normalizePhone(vendor.phone);
      
      if (!phoneGroups.has(cleanPhone)) {
        phoneGroups.set(cleanPhone, []);
      }
      
      phoneGroups.get(cleanPhone)?.push(vendor);
    }
    
    // Find duplicates
    const duplicates = [];
    
    for (const [phone, vendors] of phoneGroups.entries()) {
      if (vendors.length > 1) {
        // Sort by creation date (newest first)
        vendors.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.submittedAt || 0).getTime();
          const dateB = new Date(b.createdAt || b.submittedAt || 0).getTime();
          return dateB - dateA;
        });
        
        duplicates.push({
          phone,
          count: vendors.length,
          vendors: vendors.map(v => ({
            id: v.id,
            vendorId: v.id,
            applicationId: v.applicationId,
            name: v.businessName || v.fullName,
            businessName: v.businessName,
            fullName: v.fullName,
            status: v.status,
            createdAt: v.createdAt || v.submittedAt,
            role: v.roleName,
            serviceCategory: v.serviceCategory
          })),
          recommended: {
            keep: vendors[0].id, // Keep the newest
            remove: vendors.slice(1).map(v => v.id) // Remove older ones
          }
        });
      }
    }
    
    console.log(`✅ [CLEANUP] Found ${duplicates.length} phone numbers with duplicate applications`);
    
    const totalDuplicates = duplicates.reduce((sum, d) => sum + d.count - 1, 0);
    
    return c.json({
      success: true,
      summary: {
        totalVendors: allVendors.length,
        duplicatePhones: duplicates.length,
        duplicateApplications: totalDuplicates,
        message: `Found ${totalDuplicates} duplicate applications that can be removed`
      },
      duplicates: duplicates,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [CLEANUP] Error finding duplicates:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /admin/cleanup/remove-duplicates
 * Remove duplicate vendor applications
 * 
 * Body: { dryRun: boolean, phoneNumbers?: string[] }
 */
app.post('/admin/cleanup/remove-duplicates', async (c) => {
  try {
    const { dryRun = true, phoneNumbers } = await c.req.json().catch(() => ({ dryRun: true }));
    
    console.log(`🧹 [CLEANUP] Starting duplicate removal (Dry Run: ${dryRun})...`);
    
    const allVendors = await kv.getByPrefix('vendor:vendor_');
    
    // Group by phone number
    const phoneGroups: Map<string, any[]> = new Map();
    
    for (const vendor of allVendors) {
      if (!vendor || !vendor.phone) continue;
      
      const cleanPhone = normalizePhone(vendor.phone);
      
      // If phoneNumbers filter is provided, only process those
      if (phoneNumbers && Array.isArray(phoneNumbers)) {
        if (!phoneNumbers.includes(cleanPhone) && !phoneNumbers.includes(vendor.phone)) {
          continue;
        }
      }
      
      if (!phoneGroups.has(cleanPhone)) {
        phoneGroups.set(cleanPhone, []);
      }
      
      phoneGroups.get(cleanPhone)?.push(vendor);
    }
    
    const results = {
      processed: 0,
      kept: 0,
      removed: 0,
      errors: 0,
      details: [] as any[]
    };
    
    // Process each group
    for (const [phone, vendors] of phoneGroups.entries()) {
      if (vendors.length <= 1) continue; // No duplicates
      
      results.processed++;
      
      // Sort by priority:
      // 1. Approved applications first
      // 2. Then by creation date (newest first)
      vendors.sort((a, b) => {
        // Priority: approved > resubmitted > pending > rejected
        const statusPriority: any = {
          'approved': 4,
          'resubmitted': 3,
          'pending': 2,
          'more_info_required': 1,
          'rejected': 0
        };
        
        const priorityA = statusPriority[a.status] || 0;
        const priorityB = statusPriority[b.status] || 0;
        
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Higher priority first
        }
        
        // If same priority, keep newer
        const dateA = new Date(a.createdAt || a.submittedAt || 0).getTime();
        const dateB = new Date(b.createdAt || b.submittedAt || 0).getTime();
        return dateB - dateA;
      });
      
      const toKeep = vendors[0];
      const toRemove = vendors.slice(1);
      
      console.log(`\n📞 Processing phone: ${phone}`);
      console.log(`   Keeping: ${toKeep.id} (${toKeep.businessName || toKeep.fullName}) - ${toKeep.status}`);
      console.log(`   Removing: ${toRemove.length} duplicate(s)`);
      
      results.kept++;
      
      // Remove duplicates
      for (const vendor of toRemove) {
        try {
          console.log(`   - Removing: ${vendor.id} (${vendor.businessName || vendor.fullName}) - ${vendor.status}`);
          
          if (!dryRun) {
            // Delete vendor record
            await kv.del(`vendor:${vendor.id}`);
            
            // Delete application record if exists
            if (vendor.applicationId) {
              await kv.del(`vendor:application:${vendor.applicationId}`);
            }
            
            // Remove from pending list
            const pendingApps = await kv.get('vendor:applications:pending') || [];
            const updatedPending = pendingApps.filter((id: string) => id !== vendor.applicationId);
            await kv.set('vendor:applications:pending', updatedPending);
          }
          
          results.removed++;
          
        } catch (error) {
          console.error(`   ❌ Error removing ${vendor.id}:`, error);
          results.errors++;
        }
      }
      
      results.details.push({
        phone,
        kept: {
          id: toKeep.id,
          name: toKeep.businessName || toKeep.fullName,
          status: toKeep.status,
          createdAt: toKeep.createdAt || toKeep.submittedAt
        },
        removed: toRemove.map(v => ({
          id: v.id,
          name: v.businessName || v.fullName,
          status: v.status,
          createdAt: v.createdAt || v.submittedAt
        }))
      });
    }
    
    console.log(`\n✅ [CLEANUP] Duplicate removal complete!`);
    console.log(`   Processed: ${results.processed} phone numbers`);
    console.log(`   Kept: ${results.kept} applications`);
    console.log(`   Removed: ${results.removed} duplicates`);
    console.log(`   Errors: ${results.errors}`);
    
    return c.json({
      success: true,
      dryRun,
      results,
      message: dryRun 
        ? `DRY RUN: Would remove ${results.removed} duplicate applications` 
        : `Successfully removed ${results.removed} duplicate applications`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [CLEANUP] Error removing duplicates:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /admin/cleanup/remove-specific
 * Remove specific vendor application by ID
 * 
 * Body: { vendorId: string, reason: string, dryRun?: boolean }
 */
app.post('/admin/cleanup/remove-specific', async (c) => {
  try {
    const { vendorId, reason, dryRun = false } = await c.req.json();
    
    if (!vendorId) {
      return c.json({ error: 'vendorId is required' }, 400);
    }
    
    if (!reason) {
      return c.json({ error: 'reason is required' }, 400);
    }
    
    console.log(`🗑️ [CLEANUP] Removing specific vendor: ${vendorId}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Dry Run: ${dryRun}`);
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    if (!dryRun) {
      // Delete vendor record
      await kv.del(`vendor:${vendorId}`);
      
      // Delete application record
      if (vendor.applicationId) {
        await kv.del(`vendor:application:${vendor.applicationId}`);
      }
      
      // Remove from pending list
      const pendingApps = await kv.get('vendor:applications:pending') || [];
      const updatedPending = pendingApps.filter((id: string) => id !== vendor.applicationId);
      await kv.set('vendor:applications:pending', updatedPending);
      
      // Log the deletion
      await kv.set(`vendor:deleted:${vendorId}`, {
        vendor,
        deletedAt: new Date().toISOString(),
        deletedBy: 'admin',
        reason
      });
      
      console.log(`✅ [CLEANUP] Vendor removed: ${vendorId}`);
    } else {
      console.log(`🔍 [DRY RUN] Would remove vendor: ${vendorId}`);
    }
    
    return c.json({
      success: true,
      dryRun,
      vendor: {
        id: vendor.id,
        name: vendor.businessName || vendor.fullName,
        phone: vendor.phone,
        status: vendor.status
      },
      message: dryRun 
        ? `DRY RUN: Would remove vendor ${vendor.id}`
        : `Successfully removed vendor ${vendor.id}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [CLEANUP] Error removing vendor:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
