/**
 * STAFF CRUD ENDPOINTS
 * Create, Read, Update, Delete staff members
 * Ensures vendor:vendorId:staff array is properly maintained
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { 
  validateStaffData, 
  autoFixStaffData, 
  validateVendorStaffArray,
  deriveServiceStyle 
} from './validation-middleware.tsx';
import { sendSuccess, sendError } from './response-utils.ts';
import { requireAuth } from './auth-middleware.tsx'; // ✅ FIX: Import auth middleware

const app = new Hono();

/**
 * CREATE NEW STAFF
 * POST /staff/create
 * ✅ PROTECTED: Requires authentication
 */
app.post('/make-server-3dd53475/staff/create', requireAuth, async (c) => {
  try {
    const staffData = await c.req.json();
    
    console.log('\n🔧 ===== CREATE STAFF =====');
    console.log('📝 Staff Data:', staffData);
    console.log('👤 Vendor ID:', staffData.vendorId);
    console.log('📛 Full Name:', staffData.fullName);
    
    // ✅ CRITICAL FIX: Validate and auto-fix staff data
    const validationResult = validateStaffData(staffData);
    console.log('📋 Validation Result:', validationResult);
    
    if (!validationResult.valid) {
      console.error('❌ Validation failed:', validationResult.errors);
      return sendError(c, 'Validation failed', 400, { errors: validationResult.errors });
    }
    
    // ✅ CRITICAL FIX: Pass validationResult.data (not the whole object!) to autoFix
    const fixedStaffData = await autoFixStaffData(validationResult.data);
    console.log('✅ Fixed Staff Data:', fixedStaffData);
    
    // Generate staff ID
    const staffId = `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create staff profile
    const staff = {
      id: staffId,
      ...fixedStaffData,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save staff record
    await kv.set(`staff:${staffId}`, staff);
    console.log(`✅ Staff record created: staff:${staffId}`);
    
    // ✅ CRITICAL FIX: Create User Record & Indexes for Login
    // This ensures the staff member can log in via the main app flow
    // and is routed correctly (avoiding "Choose Role" screen)
    if (staff.phone) {
      const { normalizePhone } = await import('./phone-utils.tsx');
      const normalizedPhone = normalizePhone(staff.phone);
      
      // 1. Create User Record (if it doesn't exist or update it)
      // We use the phone as the key for the user lookup in auth
      const userId = `user_${normalizedPhone}`; 
      const userKey = `user:phone:${normalizedPhone}`;
      
      const existingUser = await kv.get(userKey);
      
      const userRecord = {
        id: userId,
        userId: userId,
        phone: normalizedPhone,
        role: 'staff', // Critical for routing
        roleType: staff.roleType || 'staff',
        name: staff.fullName,
        vendorId: staff.vendorId,
        staffId: staffId,
        createdAt: staff.createdAt,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(userKey, userRecord);
      console.log(`✅ Created/Updated user record for staff login: ${userKey}`);
      
      // 2. Create Staff Phone Index
      await kv.set(`staff:phone:${normalizedPhone}`, staffId);
      console.log(`✅ Created staff phone index: staff:phone:${normalizedPhone} -> ${staffId}`);
    }
    
    // ✅ CRITICAL: Add staff ID to vendor's staff array
    const vendorStaffKey = `vendor:${staffData.vendorId}:staff`;
    const existingStaffArray = await kv.get(vendorStaffKey) || [];
    
    console.log(`📋 Existing staff array for vendor ${staffData.vendorId}:`, existingStaffArray);
    
    // Add new staff ID if not already present
    if (!existingStaffArray.includes(staffId)) {
      existingStaffArray.push(staffId);
      await kv.set(vendorStaffKey, existingStaffArray);
      console.log(`✅ Added ${staffId} to vendor staff array`);
      console.log(`✅ New staff array:`, existingStaffArray);
    } else {
      console.log(`ℹ️  ${staffId} already exists in vendor staff array`);
    }
    
    // Also update vendor record to track staff count
    const vendor = await kv.get(`vendor:${staffData.vendorId}`);
    if (vendor) {
      vendor.staffCount = existingStaffArray.length;
      vendor.hasStaff = true;
      vendor.updatedAt = new Date().toISOString();
      await kv.set(`vendor:${staffData.vendorId}`, vendor);
      console.log(`✅ Updated vendor ${staffData.vendorId} staff count: ${existingStaffArray.length}`);
    }
    
    console.log('🎉 ===== STAFF CREATION COMPLETE =====\n');
    
    return sendSuccess(c, { staff, staffId }, 'Staff member created successfully');
    
  } catch (error) {
    console.error('❌ Error creating staff:', error);
    return sendError(c, error, 500);
  }
});

/**
 * UPDATE EXISTING STAFF
 * PUT /staff/:staffId
 * ✅ PROTECTED: Requires authentication
 */
app.put('/make-server-3dd53475/staff/:staffId', requireAuth, async (c) => {
  try {
    const { staffId } = c.req.param();
    const updates = await c.req.json();
    
    console.log('\n🔧 ===== UPDATE STAFF =====');
    console.log('📝 Staff ID:', staffId);
    console.log('📝 Updates:', updates);
    
    // Get existing staff
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!staff) {
      console.error(`❌ Staff ${staffId} not found`);
      return sendError(c, 'Staff not found', 404);
    }
    
    // Update staff record
    const updatedStaff = {
      ...staff,
      ...updates,
      id: staffId, // Preserve ID
      vendorId: staff.vendorId, // Preserve vendor association
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`staff:${staffId}`, updatedStaff);
    console.log(`✅ Staff record updated: staff:${staffId}`);
    
    console.log('🎉 ===== STAFF UPDATE COMPLETE =====\n');
    
    return sendSuccess(c, { staff: updatedStaff }, 'Staff member updated successfully');
    
  } catch (error) {
    console.error('❌ Error updating staff:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET VENDOR STAFF LIST
 * GET /vendor/:vendorId/staff
 */
app.get('/make-server-3dd53475/vendor/:vendorId/staff', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    console.log(`\n📋 ===== GET VENDOR STAFF =====`);
    console.log(`👤 Vendor ID: ${vendorId}`);
    
    // Get staff array
    const vendorStaffKey = `vendor:${vendorId}:staff`;
    let staffIds = await kv.get(vendorStaffKey) || [];
    console.log(`📋 Staff IDs in array (Initial):`, staffIds);

    // SELF-HEALING: Check for orphaned staff records
    // Some staff might exist in DB but be missing from the vendor's index array
    try {
        const allStaff = await kv.getByPrefix('staff:') || [];
        const orphanedStaff = allStaff.filter((s: any) => 
            s.vendorId === vendorId && 
            s.isActive !== false && 
            !staffIds.includes(s.id) &&
            // ✅ FIX: Ensure we don't add service records to staff list
            s.id && !s.id.startsWith('staffsvc_')
        );

        if (orphanedStaff.length > 0) {
            console.log(`🔧 [SELF-HEAL] Found ${orphanedStaff.length} orphaned staff members. Fixing index...`);
            const newIds = orphanedStaff.map((s: any) => s.id);
            staffIds = [...staffIds, ...newIds];
            
            // Update the index
            await kv.set(vendorStaffKey, staffIds);
            console.log(`✅ [SELF-HEAL] Updated staff index with:`, newIds);
        }
    } catch (healErr) {
        console.warn('⚠️ [SELF-HEAL] Failed to check orphaned staff:', healErr);
    }
    
    // Fetch all staff records
    const staffRecords = [];
    
    // ✅ CRITICAL FIX: Filter out invalid staff IDs (specifically staffsvc_ which are service records)
    const validIds = staffIds.filter((id: string) => 
      typeof id === 'string' && 
      (id.startsWith('staff_') || id.includes('_staff_self')) &&
      !id.startsWith('staffsvc_')
    );
    
    for (const staffId of validIds) {
      const staff = await kv.get(`staff:${staffId}`);
      // Also verify the object ID matches
      if (staff && staff.isActive !== false && !staff.id.startsWith('staffsvc_')) {
        staffRecords.push(staff);
        console.log(`   ✅ ${staff.fullName || staff.name} (${staffId})`);
      } else if (staff) {
        console.log(`   ⚠️  ${staff.fullName || staff.name} (${staffId}) - INACTIVE`);
      } else {
        console.log(`   ❌ ${staffId} - NOT FOUND`);
      }
    }
    
    console.log(`✅ Returning ${staffRecords.length} active staff members`);
    console.log('🎉 ===== STAFF LIST COMPLETE =====\n');
    
    return sendSuccess(c, {
      staff: staffRecords,
      total: staffRecords.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching vendor staff:', error);
    return sendError(c, error, 500);
  }
});

/**
 * DELETE STAFF (Soft delete)
 * DELETE /staff/:staffId
 */
app.delete('/make-server-3dd53475/staff/:staffId', async (c) => {
  try {
    const { staffId } = c.req.param();
    
    console.log(`\n🗑️  ===== DELETE STAFF =====`);
    console.log(`📝 Staff ID: ${staffId}`);
    
    // Get staff record
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!staff) {
      console.error(`❌ Staff ${staffId} not found`);
      return sendError(c, 'Staff not found', 404);
    }
    
    // Soft delete - mark as inactive
    staff.isActive = false;
    staff.deletedAt = new Date().toISOString();
    staff.updatedAt = new Date().toISOString();
    
    await kv.set(`staff:${staffId}`, staff);
    console.log(`✅ Staff ${staffId} marked as inactive`);
    
    // Update vendor staff count
    const vendor = await kv.get(`vendor:${staff.vendorId}`);
    if (vendor) {
      const staffIds = await kv.get(`vendor:${staff.vendorId}:staff`) || [];
      const activeStaffIds = [];
      
      for (const id of staffIds) {
        const s = await kv.get(`staff:${id}`);
        if (s && s.isActive !== false) {
          activeStaffIds.push(id);
        }
      }
      
      vendor.staffCount = activeStaffIds.length;
      vendor.updatedAt = new Date().toISOString();
      await kv.set(`vendor:${staff.vendorId}`, vendor);
      console.log(`✅ Updated vendor ${staff.vendorId} staff count: ${activeStaffIds.length}`);
    }
    
    console.log('🎉 ===== STAFF DELETE COMPLETE =====\n');
    
    return sendSuccess(c, {}, 'Staff member deleted successfully');
    
  } catch (error) {
    console.error('❌ Error deleting staff:', error);
    return sendError(c, error, 500);
  }
});

export default app;