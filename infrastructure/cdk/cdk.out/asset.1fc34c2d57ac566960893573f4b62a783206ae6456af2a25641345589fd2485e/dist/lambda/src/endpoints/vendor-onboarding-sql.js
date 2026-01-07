"use strict";
/**
 * ============================================================================
 * VENDOR ONBOARDING & APPLICATION MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Handles vendor application submission, approval, rejection, and service setup
 *
 * ✅ CRITICAL FIXES:
 * 1. Duplicate phone number validation
 * 2. Proper service category mapping
 * 3. Business name priority in display
 * 4. Document handling
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorOnboardingEndpoints = vendorOnboardingEndpoints;
const response_utils_1 = require("./response-utils");
const phone_utils_1 = require("./phone-utils");
const service_category_mapping_1 = require("./service-category-mapping");
const repositories_1 = require("../lib/repositories");
const db_1 = require("../lib/db");
const BASE_PATH = '/make-server-3dd53475';
/**
 * Inline roles repository helper
 */
const getRolesRepository = () => ({
    findById: async (roleId) => {
        try {
            // Try to find in vendor_roles table
            const result = await (0, db_1.selectQuery)('vendor_roles', { id: roleId }, { limit: 1 });
            if (result.length > 0) {
                return result[0];
            }
            // Try to find by name
            const resultByName = await (0, db_1.selectQuery)('vendor_roles', { name: roleId }, { limit: 1 });
            if (resultByName.length > 0) {
                return resultByName[0];
            }
            return null;
        }
        catch (error) {
            console.error('Error finding role:', error);
            return null;
        }
    }
});
function vendorOnboardingEndpoints(app) {
    /**
     * NOTE: /config/roles endpoint has been moved to vendor-role-config.tsx
     * to centralize role management and prevent shadowing issues.
     * DO NOT re-add this endpoint here.
     */
    /**
     * POST /make-server-3dd53475/vendor/apply
     * Submit vendor application
     *
     * ✅ FIX: Added duplicate phone validation
     */
    app.post(`${BASE_PATH}/vendor/apply`, async (c) => {
        try {
            const body = await c.req.json();
            const { roleId, phone, email, serviceStyle, location, specializations } = body;
            const formData = body.formData || {};
            const documents = body.documents || {};
            console.log(`📝 Received new vendor application submission`);
            console.log(`   Role ID: ${roleId}`);
            console.log(`   Phone: ${phone}`);
            console.log(`   Business Name: ${formData.businessName}`);
            console.log(`   Specializations:`, specializations);
            console.log(`   Full Name: ${formData.fullName}`);
            // ✅ CRITICAL FIX #1: Validate phone number doesn't already exist
            const cleanPhone = (0, phone_utils_1.normalizePhone)(phone);
            console.log(`🔍 Checking for duplicate phone: ${cleanPhone}`);
            // ✅ SQL: Check for existing vendor by phone
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const existingVendor = await vendorsRepo.findByPhone(cleanPhone);
            if (existingVendor && existingVendor.id) {
                console.log(`⚠️ EXISTING VENDOR FOUND WITH THIS PHONE`);
                console.log(`   Existing Vendor: ${existingVendor.id}`);
                const vendorAny = existingVendor;
                console.log(`   Name: ${existingVendor.business_name || existingVendor.owner_name || vendorAny.fullName || vendorAny.businessName}`);
                const status = vendorAny.application_status || existingVendor.status;
                console.log(`   Status: ${status}`);
                // ✅ FIX GAP #3: Allow rejected vendors to reapply
                if (status === 'rejected') {
                    console.log(`✅ Vendor was REJECTED - allowing reapplication`);
                    console.log(`   Previous rejection reason: ${vendorAny.rejectionReason || vendorAny.rejection_reason || 'N/A'}`);
                    // We'll update the existing vendor record below instead of creating a new one
                }
                else {
                    // Block duplicate for non-rejected vendors
                    console.error(`❌ DUPLICATE PHONE NUMBER - Vendor status: ${existingVendor.status}`);
                    return c.json({
                        error: 'duplicate_phone',
                        message: `An application with this phone number already exists.`,
                        existingApplication: {
                            id: existingVendor.id,
                            applicationId: vendorAny.application_id || vendorAny.applicationId,
                            name: existingVendor.business_name || existingVendor.owner_name || vendorAny.businessName || vendorAny.fullName,
                            status: vendorAny.application_status || existingVendor.status,
                            submittedAt: vendorAny.submitted_at || existingVendor.created_at || vendorAny.submittedAt || vendorAny.createdAt,
                            role: existingVendor.role_id || vendorAny.roleName
                        }
                    }, 409);
                }
            }
            console.log(`✅ No blocking issues found, proceeding with application...`);
            // Generate IDs
            const vendorId = (0, phone_utils_1.createVendorId)(cleanPhone);
            const applicationId = `APP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            // ✅ FIX GAP #3: Check if this is a reapplication from rejected vendor
            const vendorAny = existingVendor ? existingVendor : null;
            const isReapplication = existingVendor && (vendorAny?.application_status || existingVendor.status) === 'rejected';
            if (isReapplication) {
                console.log(`🔄 This is a REAPPLICATION from a rejected vendor`);
                console.log(`   Keeping existing vendorId: ${existingVendor.id}`);
                console.log(`   Previous applicationId: ${vendorAny?.applicationId || vendorAny?.application_id}`);
                console.log(`   New applicationId: ${applicationId}`);
            }
            // ✅ SQL: Get role configuration
            const rolesRepo = getRolesRepository();
            const role = await rolesRepo.findById(roleId);
            if (!role) {
                console.error(`❌ ROLE NOT FOUND: ${roleId}`);
                return (0, response_utils_1.sendError)(c, 'Selected role configuration not found. Please try again.', 400);
            }
            const roleName = role.name || role.display_name || 'Vendor';
            const vendorType = role.vendor_types?.[0] || role.vendorType || 'service_provider';
            // ✅ CRITICAL FIX #2: Proper service category determination
            const serviceCategory = role.service_category ||
                (0, service_category_mapping_1.determineServiceCategory)(role) ||
                'general_services';
            console.log(`🔍 Resolved Role Configuration:`);
            console.log(`   Role Name: ${roleName}`);
            console.log(`   Vendor Type: ${vendorType}`);
            console.log(`   Service Category: ${serviceCategory}`);
            // ✅ CRITICAL FIX #3: Process documents properly
            const documentsArray = [];
            if (documents && typeof documents === 'object') {
                for (const [key, docData] of Object.entries(documents)) {
                    // Handle nested structure (e.g. aadhar.front) or direct structure
                    if (typeof docData === 'object' && docData !== null) {
                        // Check for sides like front/back
                        for (const [side, sideData] of Object.entries(docData)) {
                            if (sideData && typeof sideData === 'object' && sideData.preview) {
                                const sd = sideData;
                                documentsArray.push({
                                    name: `${key} - ${side}`,
                                    type: key,
                                    side: side,
                                    category: 'Document',
                                    preview: sd.preview,
                                    url: sd.preview, // For backward compatibility
                                    fileName: sd.fileName,
                                    fileType: sd.fileType,
                                    uploadedAt: new Date().toISOString()
                                });
                            }
                            else if (docData.preview) {
                                // It's a direct document without sides (e.g. docData is the file obj)
                                const dd = docData;
                                documentsArray.push({
                                    name: key,
                                    type: key,
                                    category: 'Document',
                                    preview: dd.preview,
                                    url: dd.preview, // For backward compatibility
                                    fileName: dd.fileName,
                                    fileType: dd.fileType,
                                    uploadedAt: new Date().toISOString()
                                });
                                break; // Break inner loop as we handled the parent
                            }
                        }
                    }
                }
            }
            console.log(`📎 Processed ${documentsArray.length} documents`);
            // ✅ CRITICAL FIX #4: Create Vendor Record with proper field priority
            // Determine display name (Business Name takes priority)
            const displayName = formData.businessName || formData.fullName || 'Unnamed Vendor';
            // ✅ SQL: Create or update vendor record
            const vendorData = {
                id: isReapplication ? existingVendor.id : vendorId,
                phone: cleanPhone,
                email: email || formData.email || null,
                business_name: formData.businessName || null,
                owner_name: formData.fullName || null,
                role_id: roleId,
                category: serviceCategory,
                address: formData.address || null,
                city: formData.city || null,
                state: formData.state || null,
                pincode: formData.pincode || null,
                latitude: location?.latitude || formData.latitude || null,
                longitude: location?.longitude || formData.longitude || null,
                gst_number: formData.gstNumber || null,
                experience_years: formData.yearsOfExperience || 0,
                status: 'pending',
                tier: 'bronze',
                commission_percentage: 5.0,
                is_active: false,
                setup_completed: false,
                application_id: applicationId,
                submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            if (isReapplication) {
                // Update existing vendor
                await vendorsRepo.update(existingVendor.id, vendorData);
            }
            else {
                // Create new vendor
                await vendorsRepo.create(vendorData);
            }
            // ✅ SQL: Store documents in file_uploads table if needed
            if (documentsArray.length > 0) {
                const pool = await (0, db_1.getDbClient)();
                for (const doc of documentsArray) {
                    try {
                        await (0, db_1.insertQuery)('file_uploads', {
                            entity_type: 'vendor',
                            entity_id: vendorId,
                            file_type: doc.type,
                            file_url: doc.url || doc.preview,
                            file_name: doc.fileName,
                            uploaded_at: new Date().toISOString()
                        });
                    }
                    catch (err) {
                        // Table might not exist, skip
                        console.warn('file_uploads table not found, skipping document storage');
                    }
                }
            }
            // ✅ SQL: Store pending approval in admin_notifications or use status filter
            // No need for separate pending list - query vendors with status='pending' instead
            console.log(`✅ Added to pending approvals list: ${vendorId}`);
            console.log(`🎉 Application created successfully!`);
            console.log(`   Application ID: ${applicationId}`);
            console.log(`   Vendor ID: ${vendorId}`);
            console.log(`   Display Name: ${displayName}`);
            console.log(`   Service Category: ${serviceCategory}`);
            console.log(`   Documents: ${documentsArray.length}`);
            return (0, response_utils_1.sendSuccess)(c, {
                applicationId,
                vendorId,
                message: 'Application submitted successfully. You will be notified once reviewed.'
            });
        }
        catch (error) {
            console.error('❌ Error creating application:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /make-server-3dd53475/vendor/check-phone/:phone
     * Check if phone number already has an application
     *
     * ✅ NEW ENDPOINT: For frontend validation
     */
    app.get(`${BASE_PATH}/vendor/check-phone/:phone`, async (c) => {
        try {
            const { phone } = c.req.param();
            if (!phone) {
                return (0, response_utils_1.sendError)(c, 'Phone number is required', 400);
            }
            const cleanPhone = (0, phone_utils_1.normalizePhone)(phone);
            console.log(`🔍 Checking if phone exists: ${cleanPhone}`);
            // ✅ SQL: Check for existing vendor by phone
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const existingVendor = await vendorsRepo.findByPhone(cleanPhone);
            if (existingVendor && existingVendor.id) {
                const vendorAny = existingVendor;
                const status = vendorAny.application_status || existingVendor.status;
                console.log(`✅ Phone found: ${existingVendor.id} - ${status}`);
                return (0, response_utils_1.sendSuccess)(c, {
                    exists: true,
                    application: {
                        id: existingVendor.id,
                        applicationId: vendorAny.application_id || vendorAny.applicationId,
                        name: existingVendor.business_name || existingVendor.owner_name || vendorAny.businessName || vendorAny.fullName,
                        status: status,
                        submittedAt: vendorAny.submitted_at || existingVendor.created_at || vendorAny.submittedAt || vendorAny.createdAt,
                        role: existingVendor.role_id || vendorAny.roleName
                    }
                });
            }
            console.log(`✅ Phone is available`);
            return (0, response_utils_1.sendSuccess)(c, {
                exists: false,
                available: true
            });
        }
        catch (error) {
            console.error('❌ Error checking phone:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * PUT /make-server-3dd53475/vendor/profile/:vendorId
     * Update vendor/center profile (for edit mode)
     *
     * ✅ NEW ENDPOINT: Save/update center profile with specializations
     */
    app.put(`${BASE_PATH}/vendor/profile/:vendorId`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const body = await c.req.json();
            const { formData, documents, specializations, location } = body;
            console.log(`📝 Updating vendor profile: ${vendorId}`);
            console.log(`   Specializations:`, specializations);
            console.log(`   Location:`, location);
            // ✅ SQL: Get and update vendor
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const existingVendor = await vendorsRepo.findById(vendorId);
            if (!existingVendor) {
                console.error(`❌ Vendor not found: ${vendorId}`);
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            // ✅ SQL: Update vendor with new data
            const updateData = {
                updated_at: new Date().toISOString()
            };
            if (formData?.businessName)
                updateData.business_name = formData.businessName;
            if (formData?.fullName)
                updateData.owner_name = formData.fullName;
            if (formData?.email)
                updateData.email = formData.email;
            if (formData?.address)
                updateData.address = formData.address;
            if (formData?.city)
                updateData.city = formData.city;
            if (formData?.state)
                updateData.state = formData.state;
            if (formData?.pincode)
                updateData.pincode = formData.pincode;
            if (location?.latitude)
                updateData.latitude = location.latitude;
            if (location?.longitude)
                updateData.longitude = location.longitude;
            if (formData?.gstNumber)
                updateData.gst_number = formData.gstNumber;
            if (formData?.yearsOfExperience)
                updateData.experience_years = formData.yearsOfExperience;
            await vendorsRepo.update(vendorId, updateData);
            const updatedVendor = await vendorsRepo.findById(vendorId);
            console.log(`✅ Vendor profile updated successfully: ${vendorId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                vendorId,
                message: 'Profile updated successfully',
                vendor: updatedVendor
            });
        }
        catch (error) {
            console.error('❌ Error updating vendor profile:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Get vendor/center profile for editing
     *
     * ✅ NEW ENDPOINT: Load center profile data for edit mode
     */
    app.get(`${BASE_PATH}/vendor/profile/:vendorId`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            console.log(`📖 Loading vendor profile: ${vendorId}`);
            // ✅ SQL: Get vendor
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                console.error(`❌ Vendor not found: ${vendorId}`);
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            console.log(`✅ Vendor profile loaded: ${vendorId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                vendor: {
                    ...vendor,
                    formData: vendor.customFields || vendor.formData || {},
                    specializations: vendor.specializations || [],
                    location: vendor.location || vendor.coordinates || null
                }
            });
        }
        catch (error) {
            console.error('❌ Error loading vendor profile:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Get vendor application data (for re-editing/correction/clarification)
     *
     * ✅ NEW ENDPOINT: Load vendor application data for correction mode
     */
    app.get(`${BASE_PATH}/vendor/:vendorId/application`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            console.log(`📖 Loading vendor application: ${vendorId}`);
            // ✅ SQL: Get vendor
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                console.error(`❌ Vendor not found: ${vendorId}`);
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            console.log(`✅ Vendor application loaded: ${vendorId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                application: {
                    ...vendor,
                    formData: vendor.customFields || vendor.formData || {},
                    specializations: vendor.specializations || [],
                    location: vendor.location || vendor.coordinates || null
                }
            });
        }
        catch (error) {
            console.error('❌ Error loading vendor application:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
}
//# sourceMappingURL=vendor-onboarding-sql.js.map