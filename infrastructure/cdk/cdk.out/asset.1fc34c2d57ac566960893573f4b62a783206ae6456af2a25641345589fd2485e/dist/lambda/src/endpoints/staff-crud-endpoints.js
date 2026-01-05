"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStaffCrudEndpoints = registerStaffCrudEndpoints;
const hono_1 = require("hono");
// TODO: Create validation-middleware.ts in Lambda endpoints
// For now, using simple inline validation
const validateStaffData = (data) => {
    const errors = [];
    if (!data.fullName && !data.name)
        errors.push('Full name or name is required');
    if (!data.phone)
        errors.push('Phone is required');
    if (!data.vendorId)
        errors.push('Vendor ID is required');
    return { valid: errors.length === 0, errors, data };
};
const autoFixStaffData = async (data) => {
    return {
        fullName: data.fullName || data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        roleType: data.roleType || data.role || 'staff',
        specialization: data.specialization || '',
        experienceYears: data.experienceYears || 0,
    };
};
const response_utils_1 = require("./response-utils");
const staff_1 = require("../lib/repositories/staff");
const vendors_1 = require("../lib/repositories/vendors");
const db_1 = require("../lib/db");
const app = new hono_1.Hono();
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
            return (0, response_utils_1.sendError)(c, 'Vendor ID is required', 400);
        }
        // ✅ FIX: Resolve vendor ID (handles both UUID and vendor_id string like "vendor_9611377119")
        const vendorsRepo = (0, vendors_1.getVendorsRepository)();
        const resolvedVendorId = await vendorsRepo.resolveVendorId(staffData.vendorId);
        if (!resolvedVendorId) {
            console.error(`❌ [STAFF-CREATE] Vendor not found: ${staffData.vendorId}`);
            return (0, response_utils_1.sendError)(c, `Vendor not found: ${staffData.vendorId}`, 404);
        }
        console.log(`✅ [STAFF-CREATE] Resolved vendor ID: ${staffData.vendorId} -> ${resolvedVendorId}`);
        // ✅ SQL: Verify vendor exists (using resolved UUID)
        const vendor = await vendorsRepo.findById(resolvedVendorId);
        if (!vendor) {
            return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
        }
        // ✅ CRITICAL FIX: Ensure vendor has role_id (backfill if missing)
        if (!vendor.role_id) {
            console.warn(`⚠️ [STAFF-CREATE] Vendor ${resolvedVendorId} has no role_id, attempting to backfill...`);
            // Try to infer role_id from category or business_name
            // Note: RPC function may not exist in Aurora, using simple logic instead
            let inferredRoleId = null;
            // Simple role inference logic
            const category = vendor.category?.toLowerCase() || '';
            const businessName = vendor.business_name?.toLowerCase() || '';
            if (category.includes('vet') || category.includes('clinic') || businessName.includes('vet')) {
                inferredRoleId = 'vet_clinic';
            }
            else if (category.includes('groom') || businessName.includes('groom')) {
                inferredRoleId = 'grooming_parlor';
            }
            else if (category.includes('train') || businessName.includes('train')) {
                inferredRoleId = 'training_center';
            }
            else if (category.includes('board') || businessName.includes('board')) {
                inferredRoleId = 'boarding_facility';
            }
            else {
                // Default role
                inferredRoleId = 'service_provider';
            }
            if (inferredRoleId) {
                // Update vendor with inferred role_id
                await vendorsRepo.update(resolvedVendorId, { role_id: inferredRoleId });
                vendor.role_id = inferredRoleId;
                console.log(`✅ [STAFF-CREATE] Backfilled role_id: ${inferredRoleId}`);
            }
            else {
                console.error(`❌ [STAFF-CREATE] Could not infer role_id for vendor ${resolvedVendorId}`);
                return (0, response_utils_1.sendError)(c, 'Vendor role not configured. Please contact support.', 400);
            }
        }
        // ✅ CRITICAL FIX: Validate and auto-fix staff data
        const validationResult = validateStaffData(staffData);
        console.log('📋 Validation Result:', validationResult);
        if (!validationResult.valid) {
            console.error('❌ Validation failed:', validationResult.errors);
            return (0, response_utils_1.sendError)(c, 'Validation failed', 400, { errors: validationResult.errors });
        }
        // ✅ CRITICAL FIX: Pass validationResult.data (not the whole object!) to autoFix
        const fixedStaffData = await autoFixStaffData(validationResult.data);
        console.log('✅ Fixed Staff Data:', fixedStaffData);
        // ✅ SQL: Create staff using repository (use resolved UUID)
        const staff = await (0, staff_1.getStaffRepository)().create({
            vendor_id: resolvedVendorId, // ✅ FIX: Use resolved UUID, not string vendor ID
            name: fixedStaffData.fullName, // Use 'name' field from Staff interface
            full_name: fixedStaffData.fullName, // Also set full_name if supported
            phone: fixedStaffData.phone,
            email: fixedStaffData.email,
            role: fixedStaffData.roleType || 'staff',
            role_type: fixedStaffData.roleType || 'staff',
            specialization: fixedStaffData.specialization,
            experience_years: fixedStaffData.experienceYears || 0,
            is_active: true,
        });
        console.log(`✅ Staff record created: ${staff.id}`);
        // ✅ CRITICAL FIX: Create User Record & Indexes for Login
        if (staff.phone) {
            const { normalizePhone } = await Promise.resolve().then(() => __importStar(require('./phone-utils')));
            const normalizedPhone = normalizePhone(staff.phone);
            // ✅ SQL: Create user record in users table (if exists) or use platform_settings
            const userKey = `user:phone:${normalizedPhone}`;
            // Store user mapping in platform_settings for now
            // TODO: Create dedicated users table if needed
            await (0, db_1.upsertQuery)('platform_settings', {
                setting_key: userKey,
                setting_value: {
                    id: `user_${normalizedPhone}`,
                    userId: `user_${normalizedPhone}`,
                    phone: normalizedPhone,
                    role: 'staff',
                    roleType: staff.role_type || staff.role || 'staff',
                    name: staff.full_name || staff.name,
                    vendorId: staff.vendor_id,
                    staffId: staff.id,
                    createdAt: staff.created_at,
                    updatedAt: new Date().toISOString()
                },
                updated_at: new Date().toISOString(),
            }, 'setting_key');
            console.log(`✅ Created/Updated user record for staff login: ${userKey}`);
            // ✅ SQL: Create staff phone index in platform_settings
            await (0, db_1.upsertQuery)('platform_settings', {
                setting_key: `staff:phone:${normalizedPhone}`,
                setting_value: staff.id,
                updated_at: new Date().toISOString(),
            }, 'setting_key');
            console.log(`✅ Created staff phone index: staff:phone:${normalizedPhone} -> ${staff.id}`);
        }
        // ✅ SQL: Update vendor staff count (use resolved UUID)
        const staffList = await (0, staff_1.getStaffRepository)().findByVendor(resolvedVendorId);
        // Note: Staff count is automatically maintained by foreign key relationship
        console.log('🎉 ===== STAFF CREATION COMPLETE =====\n');
        return (0, response_utils_1.sendSuccess)(c, { staff, staffId: staff.id }, 'Staff member created successfully');
    }
    catch (error) {
        console.error('❌ Error creating staff:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
        const staffMembers = await (0, staff_1.getStaffRepository)().findByVendor(vendorId);
        return (0, response_utils_1.sendSuccess)(c, { staff: staffMembers, total: staffMembers.length });
    }
    catch (error) {
        console.error('❌ Error fetching staff:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
        const staffMembers = await (0, staff_1.getStaffRepository)().findByVendor(vendorId);
        console.log(`✅ Returning ${staffMembers.length} staff members`);
        console.log(`🎉 ===== FETCH COMPLETE =====\n`);
        return (0, response_utils_1.sendSuccess)(c, { staff: staffMembers, total: staffMembers.length });
    }
    catch (error) {
        console.error('❌ Error fetching staff:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
        const staff = await (0, staff_1.getStaffRepository)().findById(staffId);
        if (!staff) {
            return (0, response_utils_1.sendError)(c, 'Staff not found', 404);
        }
        return (0, response_utils_1.sendSuccess)(c, { staff });
    }
    catch (error) {
        console.error('❌ Error fetching staff:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
        // ✅ SQL: Get existing staff (handle both UUID and staff_id string)
        const staffRepo = (0, staff_1.getStaffRepository)();
        let existingStaff = await staffRepo.findById(staffId);
        // If not found by UUID, try by staff_id
        if (!existingStaff) {
            const { selectQuery } = await Promise.resolve().then(() => __importStar(require('../lib/db')));
            const staffByStringId = await selectQuery('staff', { staff_id: staffId }, { limit: 1 });
            if (staffByStringId && staffByStringId.length > 0) {
                existingStaff = await staffRepo.findById(staffByStringId[0].id);
            }
        }
        if (!existingStaff) {
            console.error(`❌ Staff ${staffId} not found`);
            return (0, response_utils_1.sendError)(c, 'Staff not found', 404);
        }
        // ✅ SQL: Update staff (include service_radius for home services)
        const updateData = {};
        if (updates.fullName !== undefined)
            updateData.full_name = updates.fullName;
        if (updates.phone !== undefined)
            updateData.phone = updates.phone;
        if (updates.email !== undefined)
            updateData.email = updates.email;
        if (updates.roleType !== undefined)
            updateData.role_type = updates.roleType;
        if (updates.role !== undefined)
            updateData.role = updates.role;
        if (updates.specialization !== undefined)
            updateData.specialization = updates.specialization;
        if (updates.experienceYears !== undefined)
            updateData.experience_years = updates.experienceYears;
        if (updates.serviceRadius !== undefined)
            updateData.service_radius = updates.serviceRadius; // ✅ NEW: Service radius for home services
        if (updates.workingHours !== undefined)
            updateData.working_hours = updates.workingHours;
        // ✅ FIX: Use existingStaff.id (UUID) for update
        const updatedStaff = await staffRepo.update(existingStaff.id, updateData);
        console.log(`✅ Staff record updated: ${staffId}`);
        console.log('🎉 ===== STAFF UPDATE COMPLETE =====\n');
        return (0, response_utils_1.sendSuccess)(c, { staff: updatedStaff }, 'Staff member updated successfully');
    }
    catch (error) {
        console.error('❌ Error updating staff:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
        const staff = await (0, staff_1.getStaffRepository)().findById(staffId);
        if (!staff) {
            return (0, response_utils_1.sendError)(c, 'Staff not found', 404);
        }
        // ✅ SQL: Soft delete (mark as inactive)
        await (0, staff_1.getStaffRepository)().update(staffId, {
            is_active: false,
        });
        return (0, response_utils_1.sendSuccess)(c, {}, 'Staff member deleted successfully');
    }
    catch (error) {
        console.error('❌ Error deleting staff:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
    }
});
console.log('✅ Staff CRUD endpoints registered (SQL-only)');
function registerStaffCrudEndpoints(appInstance) {
    // Mount routes on the provided app instance
    appInstance.route('/make-server-3dd53475', app);
}
//# sourceMappingURL=staff-crud-endpoints.js.map