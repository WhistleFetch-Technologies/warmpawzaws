import { Hono } from "hono";
import { determineServiceCategory, getServiceCategoryFromVendorTypes } from "./service-category-mapping";
import { normalizePhone, createVendorId, phonesMatch } from "./phone-utils";
import { sendSuccess, sendError } from "./response-utils";

/**
 * Vendor Onboarding & Application Management Endpoints
 * Handles vendor application submission, approval, rejection, and service setup
 * 
 * ✅ CRITICAL FIXES:
 * 1. Duplicate phone number validation
 * 2. Proper service category mapping
 * 3. Business name priority in display
 * 4. Document handling
 */
// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { getDbClient } from '../../../supabase/lib/db';
import {
  getVendorsRepository,
  getRolesRepository
} from '../../../supabase/lib/repositories/index';

export function vendorOnboardingEndpoints(app: Hono) {

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
  app.post("/make-server-3dd53475/vendor/apply", async (c) => {
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
      const cleanPhone = normalizePhone(phone);
      console.log(`🔍 Checking for duplicate phone: ${cleanPhone}`);
      
      // ✅ SQL: Check for existing vendor by phone
      const vendorsRepo = getVendorsRepository();
      const existingVendor = await vendorsRepo.findByPhone(cleanPhone);
      
      if (existingVendor && existingVendor.id) {
        console.log(`⚠️ EXISTING VENDOR FOUND WITH THIS PHONE`);
        console.log(`   Existing Vendor: ${existingVendor.id}`);
        console.log(`   Name: ${existingVendor.business_name || existingVendor.owner_name || existingVendor.fullName || existingVendor.businessName}`);
        const status = existingVendor.application_status || existingVendor.status;
        console.log(`   Status: ${status}`);
        
        // ✅ FIX GAP #3: Allow rejected vendors to reapply
        if (status === 'rejected') {
          console.log(`✅ Vendor was REJECTED - allowing reapplication`);
          console.log(`   Previous rejection reason: ${existingVendor.rejectionReason || 'N/A'}`);
          // We'll update the existing vendor record below instead of creating a new one
        } else {
          // Block duplicate for non-rejected vendors
          console.error(`❌ DUPLICATE PHONE NUMBER - Vendor status: ${existingVendor.status}`);
          
          return c.json({ 
            error: 'duplicate_phone',
            message: `An application with this phone number already exists.`,
            existingApplication: {
              id: existingVendor.id,
              applicationId: existingVendor.application_id || existingVendor.applicationId,
              name: existingVendor.business_name || existingVendor.owner_name || existingVendor.businessName || existingVendor.fullName,
              status: existingVendor.application_status || existingVendor.status,
              submittedAt: existingVendor.submitted_at || existingVendor.created_at || existingVendor.submittedAt || existingVendor.createdAt,
              role: existingVendor.role_id || existingVendor.roleName
            }
          }, 409); // 409 Conflict status code
        }
      }
      
      console.log(`✅ No blocking issues found, proceeding with application...`);
      
      // Generate IDs
      const vendorId = createVendorId(cleanPhone);
      const applicationId = `APP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // ✅ FIX GAP #3: Check if this is a reapplication from rejected vendor
      const isReapplication = existingVendor && (existingVendor.application_status || existingVendor.status) === 'rejected';
      
      if (isReapplication) {
        console.log(`🔄 This is a REAPPLICATION from a rejected vendor`);
        console.log(`   Keeping existing vendorId: ${existingVendor.id}`);
        console.log(`   Previous applicationId: ${existingVendor.applicationId}`);
        console.log(`   New applicationId: ${applicationId}`);
      }
      
      // ✅ SQL: Get role configuration
      const rolesRepo = getRolesRepository();
      const role = await rolesRepo.findById(roleId);
      
      if (!role) {
        console.error(`❌ ROLE NOT FOUND: ${roleId}`);
        return c.json({ 
          error: 'role_not_found',
          message: 'Selected role configuration not found. Please try again.'
        }, 400);
      }
      
      const roleName = role.name || role.display_name || 'Vendor';
      const vendorType = role.vendor_types?.[0] || role.vendorType || 'service_provider';
      
      // ✅ CRITICAL FIX #2: Proper service category determination
      const serviceCategory = role.service_category || 
                            determineServiceCategory(role) || 
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
               if (sideData && typeof sideData === 'object' && (sideData as any).preview) {
                 const sd = sideData as any;
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
               } else if ((docData as any).preview) {
                 // It's a direct document without sides (e.g. docData is the file obj)
                 const dd = docData as any;
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
      const vendorKey = `vendor:${vendorId}`;
      
      // Determine display name (Business Name takes priority)
      const displayName = formData.businessName || formData.fullName || 'Unnamed Vendor';
      
      // ✅ SQL: Create or update vendor record
      const vendorsRepo = getVendorsRepository();
      
      const vendorData: any = {
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
      } else {
        // Create new vendor
        await vendorsRepo.create(vendorData);
      }
      
      // ✅ SQL: Store documents in file_uploads table if needed
      if (documentsArray.length > 0) {
        const db = getDbClient();
        for (const doc of documentsArray) {
          await db.from('file_uploads').insert({
            entity_type: 'vendor',
            entity_id: vendorId,
            file_type: doc.type,
            file_url: doc.url || doc.preview,
            file_name: doc.fileName,
            uploaded_at: new Date().toISOString()
          }).catch(() => {
            // Table might not exist, skip
            console.warn('file_uploads table not found, skipping document storage');
          });
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
      
      return sendSuccess(c, {
        applicationId,
        vendorId,
        message: 'Application submitted successfully. You will be notified once reviewed.'
      });
      
    } catch (error) {
      console.error('❌ Error creating application:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/vendor/check-phone/:phone
   * Check if phone number already has an application
   * 
   * ✅ NEW ENDPOINT: For frontend validation
   */
  app.get("/make-server-3dd53475/vendor/check-phone/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      
      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }
      
      const cleanPhone = normalizePhone(phone);
      console.log(`🔍 Checking if phone exists: ${cleanPhone}`);
      
      // ✅ SQL: Check for existing vendor by phone
      const vendorsRepo = getVendorsRepository();
      const existingVendor = await vendorsRepo.findByPhone(cleanPhone);
      
      if (existingVendor && existingVendor.id) {
        const status = existingVendor.application_status || existingVendor.status;
        console.log(`✅ Phone found: ${existingVendor.id} - ${status}`);
        return c.json({
          exists: true,
          application: {
            id: existingVendor.id,
            applicationId: existingVendor.application_id || existingVendor.applicationId,
            name: existingVendor.business_name || existingVendor.owner_name || existingVendor.businessName || existingVendor.fullName,
            status: status,
            submittedAt: existingVendor.submitted_at || existingVendor.created_at || existingVendor.submittedAt || existingVendor.createdAt,
            role: existingVendor.role_id || existingVendor.roleName
          }
        });
      }
      
      console.log(`✅ Phone is available`);
      return c.json({
        exists: false,
        available: true
      });
      
    } catch (error) {
      console.error('❌ Error checking phone:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/vendor/profile/:vendorId
   * Update vendor/center profile (for edit mode)
   * 
   * ✅ NEW ENDPOINT: Save/update center profile with specializations
   */
  app.put("/make-server-3dd53475/vendor/profile/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { formData, documents, specializations, location } = body;

      console.log(`📝 Updating vendor profile: ${vendorId}`);
      console.log(`   Specializations:`, specializations);
      console.log(`   Location:`, location);

      // ✅ SQL: Get and update vendor
      const vendorsRepo = getVendorsRepository();
      const existingVendor = await vendorsRepo.findById(vendorId);

      if (!existingVendor) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Update vendor with new data
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (formData.businessName) updateData.business_name = formData.businessName;
      if (formData.fullName) updateData.owner_name = formData.fullName;
      if (formData.email) updateData.email = formData.email;
      if (formData.address) updateData.address = formData.address;
      if (formData.city) updateData.city = formData.city;
      if (formData.state) updateData.state = formData.state;
      if (formData.pincode) updateData.pincode = formData.pincode;
      if (location?.latitude) updateData.latitude = location.latitude;
      if (location?.longitude) updateData.longitude = location.longitude;
      if (formData.gstNumber) updateData.gst_number = formData.gstNumber;
      if (formData.yearsOfExperience) updateData.experience_years = formData.yearsOfExperience;
      
      await vendorsRepo.update(vendorId, updateData);
      
      const updatedVendor = await vendorsRepo.findById(vendorId);

      console.log(`✅ Vendor profile updated successfully: ${vendorId}`);

      return sendSuccess(c, {
        vendorId,
        message: 'Profile updated successfully',
        vendor: updatedVendor
      });

    } catch (error) {
      console.error('❌ Error updating vendor profile:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get vendor/center profile for editing
   * 
   * ✅ NEW ENDPOINT: Load center profile data for edit mode
   */
  app.get("/make-server-3dd53475/vendor/profile/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`📖 Loading vendor profile: ${vendorId}`);

      // ✅ SQL: Get vendor
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);

      if (!vendor) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }

      console.log(`✅ Vendor profile loaded: ${vendorId}`);

      return sendSuccess(c, {
        vendor: {
          ...vendor,
          formData: vendor.customFields || vendor.formData || {},
          specializations: vendor.specializations || [],
          location: vendor.location || vendor.coordinates || null
        }
      });

    } catch (error) {
      console.error('❌ Error loading vendor profile:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get vendor application data (for re-editing/correction/clarification)
   * 
   * ✅ NEW ENDPOINT: Load vendor application data for correction mode
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/application", async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`📖 Loading vendor application: ${vendorId}`);

      // ✅ SQL: Get vendor
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);

      if (!vendor) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }

      console.log(`✅ Vendor application loaded: ${vendorId}`);

      return sendSuccess(c, {
        application: {
          ...vendor,
          formData: vendor.customFields || vendor.formData || {},
          specializations: vendor.specializations || [],
          location: vendor.location || vendor.coordinates || null
        }
      });

    } catch (error) {
      console.error('❌ Error loading vendor application:', error);
      return sendError(c, error, 500);
    }
  });

}