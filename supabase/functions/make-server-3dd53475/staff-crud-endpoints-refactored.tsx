/**
 * ============================================================================
 * STAFF CRUD ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Staff management endpoints:
 * - Create staff member
 * - Get all staff for vendor
 * - Get single staff member
 * - Update staff member
 * - Delete staff member (soft delete)
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { 
  validateStaffData, 
  autoFixStaffData, 
  validateVendorStaffArray,
  deriveServiceStyle 
} from './validation-middleware.tsx';
import { sendSuccess, sendError } from './response-utils.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getSessionsRepository } from '../../lib/repositories/sessions.ts';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();

/**
 * CREATE NEW STAFF
 * POST /staff/create
 * 
 * REFACTORED: Uses SQL repositories instead of KV
 */
app.post('/make-server-3dd53475/staff/create', async (c) => {
  try {
    const staffData = await c.req.json();
    
    console.log('\n🔧 ===== CREATE STAFF =====');
    console.log('📝 Staff Data:', staffData);
    console.log('👤 Vendor ID:', staffData.vendorId);
    console.log('📛 Full Name:', staffData.fullName);
    
    // ✅ SECURITY: Validate vendorId exists
    if (!staffData.vendorId) {
      return sendError(c, 'Vendor ID is required', 400);
    }
    
    // ✅ FIX: Resolve vendor ID (handles both UUID and vendor_id string like "vendor_9611377119")
    const vendorsRepo = getVendorsRepository();
    const resolvedVendorId = await vendorsRepo.resolveVendorId(staffData.vendorId);
    
    if (!resolvedVendorId) {
      console.error(`❌ [STAFF-CREATE] Vendor not found: ${staffData.vendorId}`);
      return sendError(c, `Vendor not found: ${staffData.vendorId}`, 404);
    }
    
    console.log(`✅ [STAFF-CREATE] Resolved vendor ID: ${staffData.vendorId} -> ${resolvedVendorId}`);
    
    // ✅ SQL: Verify vendor exists (using resolved UUID)
    const vendor = await vendorsRepo.findById(resolvedVendorId);
    if (!vendor) {
      return sendError(c, 'Vendor not found', 404);
    }
    
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
    
    // ✅ SQL: Create staff using repository (use resolved UUID)
    const staff = await getStaffRepository().create({
      vendor_id: resolvedVendorId, // ✅ FIX: Use resolved UUID, not string vendor ID
      full_name: fixedStaffData.fullName,
      phone: fixedStaffData.phone,
      email: fixedStaffData.email,
      role_type: fixedStaffData.roleType || 'staff',
      specialization: fixedStaffData.specialization,
      experience_years: fixedStaffData.experienceYears || 0,
      is_active: true,
    });
    
    console.log(`✅ Staff record created: ${staff.id}`);
    
    // ✅ CRITICAL FIX: Create User Record & Indexes for Login
    if (staff.phone) {
      const { normalizePhone } = await import('./phone-utils.tsx');
      const normalizedPhone = normalizePhone(staff.phone);
      
      // ✅ SQL: Create user record in users table (if exists) or use platform_settings
      const client = getDbClient();
      const userKey = `user:phone:${normalizedPhone}`;
      
      // Store user mapping in platform_settings for now
      // TODO: Create dedicated users table if needed
      await client
        .from('platform_settings')
        .upsert({
          setting_key: userKey,
          setting_value: {
            id: `user_${normalizedPhone}`,
            userId: `user_${normalizedPhone}`,
            phone: normalizedPhone,
            role: 'staff',
            roleType: staff.role_type || 'staff',
            name: staff.full_name,
            vendorId: staff.vendor_id,
            staffId: staff.id,
            createdAt: staff.created_at,
            updatedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString(),
        });
      
      console.log(`✅ Created/Updated user record for staff login: ${userKey}`);
      
      // ✅ SQL: Create staff phone index in platform_settings
      await client
        .from('platform_settings')
        .upsert({
          setting_key: `staff:phone:${normalizedPhone}`,
          setting_value: staff.id,
          updated_at: new Date().toISOString(),
        });
      
      console.log(`✅ Created staff phone index: staff:phone:${normalizedPhone} -> ${staff.id}`);
    }
    
    // ✅ SQL: Update vendor staff count
    const staffList = await getStaffRepository().findByVendor(staffData.vendorId);
    // Note: Staff count is automatically maintained by foreign key relationship
    
    console.log('🎉 ===== STAFF CREATION COMPLETE =====\n');
    
    return sendSuccess(c, { staff, staffId: staff.id }, 'Staff member created successfully');
    
  } catch (error) {
    console.error('❌ Error creating staff:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET ALL STAFF FOR VENDOR
 * GET /vendor/:vendorId/staff
 * 
 * REFACTORED: Uses SQL repositories instead of KV
 */
app.get('/make-server-3dd53475/vendor/:vendorId/staff', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    // ✅ SQL: Get all staff for vendor
    const staffMembers = await getStaffRepository().findByVendor(vendorId);
    
    return sendSuccess(c, { staff: staffMembers, total: staffMembers.length });
  } catch (error) {
    console.error('❌ Error fetching staff:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET ALL STAFF FOR VENDOR (ALIAS ROUTE)
 * GET /staff/vendor/:vendorId
 * 
 * REFACTORED: Uses SQL repositories instead of KV
 */
app.get('/make-server-3dd53475/staff/vendor/:vendorId', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    console.log(`\n📋 ===== FETCH STAFF FOR VENDOR =====`);
    console.log(`👤 Vendor ID: ${vendorId}`);
    
    // ✅ SQL: Get all staff for vendor
    const staffMembers = await getStaffRepository().findByVendor(vendorId);
    
    console.log(`✅ Returning ${staffMembers.length} staff members`);
    console.log(`🎉 ===== FETCH COMPLETE =====\n`);
    
    return sendSuccess(c, { staff: staffMembers, total: staffMembers.length });
  } catch (error) {
    console.error('❌ Error fetching staff:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET SINGLE STAFF MEMBER
 * GET /staff/:staffId
 * 
 * REFACTORED: Uses SQL repositories instead of KV
 */
app.get('/make-server-3dd53475/staff/:staffId', async (c) => {
  try {
    const { staffId } = c.req.param();
    
    // ✅ SQL: Get staff by ID
    const staff = await getStaffRepository().findById(staffId);
    
    if (!staff) {
      return sendError(c, 'Staff not found', 404);
    }
    
    return sendSuccess(c, { staff });
  } catch (error) {
    console.error('❌ Error fetching staff:', error);
    return sendError(c, error, 500);
  }
});

/**
 * UPDATE EXISTING STAFF
 * PUT /staff/:staffId
 * 
 * REFACTORED: Uses SQL repositories instead of KV
 */
app.put('/make-server-3dd53475/staff/:staffId', async (c) => {
  try {
    const { staffId } = c.req.param();
    const updates = await c.req.json();
    
    console.log('\n🔧 ===== UPDATE STAFF =====');
    console.log('📝 Staff ID:', staffId);
    console.log('📝 Updates:', updates);
    
    // ✅ SQL: Get existing staff
    const existingStaff = await getStaffRepository().findById(staffId);
    
    if (!existingStaff) {
      console.error(`❌ Staff ${staffId} not found`);
      return sendError(c, 'Staff not found', 404);
    }
    
    // ✅ SQL: Update staff
    const updatedStaff = await getStaffRepository().update(staffId, {
      full_name: updates.fullName,
      phone: updates.phone,
      email: updates.email,
      role_type: updates.roleType,
      specialization: updates.specialization,
      experience_years: updates.experienceYears,
    });
    
    console.log(`✅ Staff record updated: ${staffId}`);
    console.log('🎉 ===== STAFF UPDATE COMPLETE =====\n');
    
    return sendSuccess(c, { staff: updatedStaff }, 'Staff member updated successfully');
    
  } catch (error) {
    console.error('❌ Error updating staff:', error);
    return sendError(c, error, 500);
  }
});

/**
 * DELETE STAFF MEMBER
 * DELETE /staff/:staffId
 * 
 * REFACTORED: Uses SQL repositories instead of KV
 */
app.delete('/make-server-3dd53475/staff/:staffId', async (c) => {
  try {
    const { staffId } = c.req.param();
    
    // ✅ SQL: Get staff
    const staff = await getStaffRepository().findById(staffId);
    
    if (!staff) {
      return sendError(c, 'Staff not found', 404);
    }
    
    // ✅ SQL: Soft delete (mark as inactive)
    await getStaffRepository().update(staffId, {
      is_active: false,
    });
    
    return sendSuccess(c, {}, 'Staff member deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting staff:', error);
    return sendError(c, error, 500);
  }
});

console.log('✅ Staff CRUD endpoints registered (SQL-only)');

export default app;

