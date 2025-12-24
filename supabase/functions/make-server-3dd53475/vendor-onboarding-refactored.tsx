/**
 * ============================================================================
 * VENDOR ONBOARDING ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Vendor onboarding & application management:
 * - Submit vendor application
 * - Check phone number availability
 * - Update vendor profile
 * - Get vendor application data
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { determineServiceCategory, getServiceCategoryFromVendorTypes } from "./service-category-mapping.tsx";
import { normalizePhone, createVendorId, phonesMatch } from "./phone-utils.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getDbClient } from "../../lib/db.ts";

export function vendorOnboardingEndpoints(app: Hono) {
  console.log('✅ Registering Vendor Onboarding Endpoints (SQL-only)...');

  /**
   * POST /make-server-3dd53475/vendor/apply
   * Submit vendor application
   * 
   * REFACTORED: Uses SQL repositories instead of KV
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
      
      // ✅ SQL: Check for existing vendor with this phone
      const existingVendor = await getVendorsRepository().findByPhone(cleanPhone);
      
      if (existingVendor) {
        console.log(`⚠️ EXISTING VENDOR FOUND WITH THIS PHONE`);
        console.log(`   Existing Vendor: ${existingVendor.id}`);
        console.log(`   Name: ${existingVendor.business_name || existingVendor.owner_name}`);
        console.log(`   Status: ${existingVendor.status}`);
        
        // ✅ FIX GAP #3: Allow rejected vendors to reapply
        if (existingVendor.status === 'rejected') {
          console.log(`✅ Vendor was REJECTED - allowing reapplication`);
          console.log(`   Previous rejection reason: ${existingVendor.rejection_reason || 'N/A'}`);
          // We'll update the existing vendor record below instead of creating a new one
        } else {
          // Block duplicate for non-rejected vendors
          console.error(`❌ DUPLICATE PHONE NUMBER - Vendor status: ${existingVendor.status}`);
          
          return c.json({ 
            error: 'duplicate_phone',
            message: `An application with this phone number already exists.`,
            existingApplication: {
              id: existingVendor.id,
              applicationId: existingVendor.application_id,
              name: existingVendor.business_name || existingVendor.owner_name,
              status: existingVendor.status,
              submittedAt: existingVendor.submitted_at || existingVendor.created_at,
              role: existingVendor.role_id
            }
          }, 409); // 409 Conflict status code
        }
      }
      
      console.log(`✅ No blocking issues found, proceeding with application...`);
      
      // Generate IDs
      const vendorId = existingVendor?.id || createVendorId(cleanPhone);
      const applicationId = `APP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // ✅ FIX GAP #3: Check if this is a reapplication from rejected vendor
      const isReapplication = existingVendor && existingVendor.status === 'rejected';
      
      if (isReapplication) {
        console.log(`🔄 This is a REAPPLICATION from a rejected vendor`);
        console.log(`   Keeping existing vendorId: ${existingVendor.id}`);
        console.log(`   Previous applicationId: ${existingVendor.application_id}`);
        console.log(`   New applicationId: ${applicationId}`);
      }
      
      // ✅ SQL: Get role configuration from platform_settings or roles table
      const client = getDbClient();
      const { data: role } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `role:config:${roleId}`)
        .maybeSingle();
      
      if (!role) {
        console.error(`❌ ROLE NOT FOUND: ${roleId}`);
        return c.json({ 
          error: 'role_not_found',
          message: 'Selected role configuration not found. Please try again.'
        }, 400);
      }
      
      const roleConfig = role.setting_value || {};
      const roleName = roleConfig?.name || 'Vendor';
      const vendorType = roleConfig?.vendorTypes?.[0] || 'service_provider';
      
      // ✅ CRITICAL FIX #2: Proper service category determination
      const serviceCategory = roleConfig.serviceCategory || 
                            determineServiceCategory(roleConfig) || 
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

      // ✅ CRITICAL FIX #4: Create/Update Vendor Record with proper field priority
      // Determine display name (Business Name takes priority)
      const displayName = formData.businessName || formData.fullName || 'Unnamed Vendor';
      
      // ✅ FIX GAP #3: For reapplications, preserve history and original creation date
      const baseVendorData: any = {
        application_id: applicationId,
        role_id: roleId,
        category: serviceCategory,
        business_name: formData.businessName || null,
        owner_name: formData.fullName || null,
        email: email || formData.email || null,
        phone: cleanPhone,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        pincode: formData.pincode || null,
        latitude: location?.lat || formData.coordinates?.lat || null,
        longitude: location?.lng || formData.coordinates?.lng || null,
        gst_number: formData.gstNumber || null,
        years_of_experience: formData.yearsOfExperience || 0,
        status: 'pending_approval',
        is_active: false,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Store documents and specializations in JSONB fields
      if (documentsArray.length > 0) {
        baseVendorData.documents = documentsArray;
      }
      if (specializations && specializations.length > 0) {
        baseVendorData.specializations = specializations;
      }
      
      // ✅ SQL: Create or update vendor
      let vendor;
      if (isReapplication && existingVendor) {
        // Update existing vendor for reapplication
        vendor = await getVendorsRepository().update(existingVendor.id, {
          ...baseVendorData,
          status: 'pending_approval', // Reset to pending
          reapplication_count: (existingVendor.reapplication_count || 0) + 1,
        });
      } else {
        // Create new vendor
        vendor = await getVendorsRepository().create(baseVendorData);
      }
      
      // ✅ SQL: Add to pending approvals (using platform_settings or separate table)
      // TODO: Create vendor_approval_queue table or use platform_settings
      const { data: pendingList } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'vendor:pending_approvals')
        .maybeSingle();
      
      const pendingVendors = pendingList?.setting_value || [];
      if (!pendingVendors.includes(vendor.id)) {
        pendingVendors.push(vendor.id);
        await client
          .from('platform_settings')
          .upsert({
            setting_key: 'vendor:pending_approvals',
            setting_value: pendingVendors,
            updated_at: new Date().toISOString(),
          });
      }
      
      console.log(`✅ Added to pending approvals list: ${vendor.id}`);
      
      console.log(`🎉 Application created successfully!`);
      console.log(`   Application ID: ${applicationId}`);
      console.log(`   Vendor ID: ${vendor.id}`);
      console.log(`   Display Name: ${displayName}`);
      console.log(`   Service Category: ${serviceCategory}`);
      console.log(`   Documents: ${documentsArray.length}`);
      
      return sendSuccess(c, {
        applicationId,
        vendorId: vendor.id,
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
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/check-phone/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      
      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }
      
      const cleanPhone = normalizePhone(phone);
      console.log(`🔍 Checking if phone exists: ${cleanPhone}`);
      
      // ✅ SQL: Check for existing vendor
      const existingVendor = await getVendorsRepository().findByPhone(cleanPhone);
      
      if (existingVendor) {
        console.log(`✅ Phone found: ${existingVendor.id} - ${existingVendor.status}`);
        return c.json({
          exists: true,
          application: {
            id: existingVendor.id,
            applicationId: existingVendor.application_id,
            name: existingVendor.business_name || existingVendor.owner_name,
            status: existingVendor.status,
            submittedAt: existingVendor.submitted_at || existingVendor.created_at,
            role: existingVendor.role_id
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
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.put("/make-server-3dd53475/vendor/profile/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { formData, documents, specializations, location } = body;

      console.log(`📝 Updating vendor profile: ${vendorId}`);
      console.log(`   Specializations:`, specializations);
      console.log(`   Location:`, location);

      // ✅ SQL: Get existing vendor
      const existingVendor = await getVendorsRepository().findById(vendorId);

      if (!existingVendor) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Update vendor
      const updatedVendor = await getVendorsRepository().update(vendorId, {
        business_name: formData?.businessName || existingVendor.business_name,
        owner_name: formData?.fullName || existingVendor.owner_name,
        email: formData?.email || existingVendor.email,
        address: formData?.address || existingVendor.address,
        city: formData?.city || existingVendor.city,
        state: formData?.state || existingVendor.state,
        pincode: formData?.pincode || existingVendor.pincode,
        latitude: location?.lat || formData?.coordinates?.lat || existingVendor.latitude,
        longitude: location?.lng || formData?.coordinates?.lng || existingVendor.longitude,
        specializations: specializations || existingVendor.specializations || [],
        documents: documents ? [...(existingVendor.documents || []), ...documents] : existingVendor.documents,
      });

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
   * REFACTORED: Uses SQL repositories instead of KV
   */
  /**
   * GET /make-server-3dd53475/vendor/profile/:vendorId
   * Get vendor profile
   * ✅ FIX: Uses resolveVendorId to handle both UUID and vendor_id string
   */
  app.get("/make-server-3dd53475/vendor/profile/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`📖 Loading vendor profile: ${vendorId}`);

      // ✅ FIX: Use standardized vendor ID resolver
      const { resolveVendor } = await import('../../lib/utils/vendor-id-resolver.ts');
      const vendor = await resolveVendor(vendorId);

      if (!vendor) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: `Vendor not found: ${vendorId}` }, 404);
      }
      
      console.log(`✅ Resolved vendor ID: ${vendorId} -> ${vendor.id}`);

      console.log(`✅ Vendor profile loaded: ${vendorId}`);

      return sendSuccess(c, {
        vendor: {
          ...vendor,
          formData: vendor.custom_fields || {},
          specializations: vendor.specializations || [],
          location: vendor.latitude && vendor.longitude ? {
            lat: vendor.latitude,
            lng: vendor.longitude
          } : null
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
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/application", async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`📖 Loading vendor application: ${vendorId}`);

      // ✅ FIX: Use standardized vendor ID resolver
      const { resolveVendor } = await import('../../lib/utils/vendor-id-resolver.ts');
      const vendor = await resolveVendor(vendorId);

      if (!vendor) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: `Vendor not found: ${vendorId}` }, 404);
      }
      
      console.log(`✅ Resolved vendor ID: ${vendorId} -> ${vendor.id}`);

      console.log(`✅ Vendor application loaded: ${vendorId}`);

      return sendSuccess(c, {
        application: {
          ...vendor,
          formData: vendor.custom_fields || {},
          specializations: vendor.specializations || [],
          location: vendor.latitude && vendor.longitude ? {
            lat: vendor.latitude,
            lng: vendor.longitude
          } : null
        }
      });

    } catch (error) {
      console.error('❌ Error loading vendor application:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Vendor onboarding endpoints registered (SQL-only)');
}

