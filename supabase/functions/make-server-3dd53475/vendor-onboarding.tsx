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

import { Hono } from "npm:hono@4";
import { determineServiceCategory, getServiceCategoryFromVendorTypes } from "./service-category-mapping.tsx";
import { normalizePhone, createVendorId, phonesMatch } from "./phone-utils.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getRolesRepository } from "../../lib/repositories/roles.ts";
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
        console.log(`   Name: ${existingVendor.business_name || existingVendor.full_name}`);
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
              applicationId: existingVendor.metadata?.applicationId || existingVendor.id,
              name: existingVendor.business_name || existingVendor.full_name,
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
        console.log(`   Previous applicationId: ${existingVendor.metadata?.applicationId || 'N/A'}`);
        console.log(`   New applicationId: ${applicationId}`);
      }
      
      // ✅ SQL: Get role configuration from roles table
      // roleId can be either UUID or role name - try both
      const { getRolesRepository } = await import('../../lib/repositories/roles.ts');
      const rolesRepo = getRolesRepository();
      let role = await rolesRepo.findById(roleId); // Try as UUID first
      
      // If not found by UUID, try by name
      if (!role) {
        role = await rolesRepo.findByName(roleId);
      }
      
      if (!role) {
        console.error(`❌ ROLE NOT FOUND: ${roleId}`);
        return c.json({ 
          error: 'role_not_found',
          message: 'Selected role configuration not found. Please try again.'
        }, 400);
      }
      
      const roleConfig = role.config || {};
      const roleName = role.display_name || role.name || 'Vendor';
      const vendorType = roleConfig?.vendorTypes?.[0] || 'service_provider';
      const actualRoleId = role.id; // ✅ Use the UUID from the role record
      
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
      // ✅ Only use columns that exist in vendors table
      const baseVendorData: any = {
        role_id: actualRoleId, // ✅ Use UUID from roles table, not the name
        service_category: serviceCategory,
        business_name: formData.businessName || null,
        full_name: formData.fullName || null, // ✅ Use full_name (not owner_name)
        email: email || formData.email || null,
        phone: cleanPhone,
        address: formData.address ? {
          address: formData.address,
          city: formData.city || null,
          state: formData.state || null,
          pincode: formData.pincode || null,
          landmark: formData.landmark || null,
          latitude: location?.lat || formData.coordinates?.lat || null,
          longitude: location?.lng || formData.coordinates?.lng || null
        } : null, // ✅ Store all address fields including coordinates in JSONB
        gst_number: formData.gstNumber || null,
        pan_number: formData.panNumber || null,
        experience_years: formData.yearsOfExperience || 0,
        status: 'pending',
        approval_status: 'pending',
        is_active: false,
        submitted_at: new Date().toISOString(),
      };
      
      // ✅ Store application_id in metadata JSONB column
      baseVendorData.metadata = {
        applicationId: applicationId,
        ...formData,
        documents: documentsArray,
        specializations: specializations || []
      };
      
      // Documents and specializations are now stored in custom_fields JSONB above
      
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
            applicationId: existingVendor.metadata?.applicationId || existingVendor.id,
            name: existingVendor.business_name || existingVendor.full_name,
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
        full_name: formData?.fullName || existingVendor.full_name,
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
  app.get("/make-server-3dd53475/vendor/profile/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ FIX: Handle empty vendorId
      if (!vendorId || vendorId.trim() === '') {
        console.warn('⚠️ Empty vendorId provided');
        return sendError(c, 'Vendor ID is required', 400);
      }

      console.log(`📖 Loading vendor profile: ${vendorId}`);

      // ✅ SQL: Use resolveVendorId to handle both UUID and vendor_id string
      const vendorsRepo = getVendorsRepository();
      const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedId) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        return sendError(c, `Vendor not found: ${vendorId}`, 404);
      }

      // Get vendor by resolved UUID
      const vendor = await vendorsRepo.findById(resolvedId);

      if (!vendor) {
        console.error(`❌ Vendor not found after resolution: ${vendorId} -> ${resolvedId}`);
        return sendError(c, 'Vendor not found', 404);
      }

      console.log(`✅ Vendor profile loaded: ${vendorId} -> ${vendor.id}`);

      // ✅ BUG FIX #1 & #2: Return only camelCase fields, no snake_case duplicates
      // ✅ BUG FIX #4: Add backward compatibility for metadata structure
      const metadata = vendor.metadata as any;
      const applicationMetadata = metadata?.application || metadata?.application_metadata || {};
      
      return sendSuccess(c, {
        vendor: {
          // Only include camelCase fields, exclude snake_case fields from spread
          id: vendor.id,
          vendorId: vendor.id,
          phone: vendor.phone,
          email: vendor.email,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          status: vendor.status,
          // Convert snake_case to camelCase (only camelCase in response)
          setupCompleted: vendor.setup_completed ?? false,
          isActive: vendor.is_active ?? false,
          roleId: vendor.role_id || applicationMetadata.roleId,
          // Extract from metadata with backward compatibility
          formData: applicationMetadata.formData || vendor.custom_fields || {},
          specializations: vendor.specializations || [],
          location: applicationMetadata.location || (vendor.latitude && vendor.longitude ? {
            lat: vendor.latitude,
            lng: vendor.longitude
          } : null),
          applicationId: applicationMetadata.applicationId,
          // ✅ PHASE 4 FIX 4.2: Include rejection reason (camelCase only)
          rejectionReason: vendor.rejection_reason || null,
        }
      });

    } catch (error) {
      console.error('❌ Error loading vendor profile:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get vendor by phone number
   * GET /make-server-3dd53475/vendor/find-by-phone/:phone
   * 
   * ✅ PHASE 2 FIX 2.2: Created endpoint with camelCase conversion
   */
  app.get("/make-server-3dd53475/vendor/find-by-phone/:phone", async (c) => {
    try {
      const { phone } = c.req.param();

      if (!phone || phone.trim() === '') {
        console.warn('⚠️ Empty phone provided');
        return sendError(c, 'Phone number is required', 400);
      }

      console.log(`📖 Finding vendor by phone: ${phone}`);

      // ✅ SQL: Normalize phone and find vendor
      const { normalizePhone } = await import('./phone-utils.tsx');
      const cleanPhone = normalizePhone(phone);
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findByPhone(cleanPhone);
      
      if (!vendor) {
        console.log(`❌ Vendor not found for phone: ${phone}`);
        return sendError(c, 'Vendor not found', 404);
      }

      console.log(`✅ Vendor found: ${vendor.id}`);

      // ✅ BUG FIX #1 & #2: Return only camelCase fields, no snake_case duplicates
      // ✅ BUG FIX #4: Add backward compatibility for metadata structure
      const metadata = vendor.metadata as any;
      const applicationMetadata = metadata?.application || metadata?.application_metadata || {};
      
      return sendSuccess(c, {
        vendor: {
          // Only include camelCase fields, exclude snake_case fields from spread
          id: vendor.id,
          vendorId: vendor.id,
          phone: vendor.phone,
          email: vendor.email,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          status: vendor.status,
          // Convert snake_case to camelCase (only camelCase in response)
          setupCompleted: vendor.setup_completed ?? false,
          isActive: vendor.is_active ?? false,
          roleId: vendor.role_id || applicationMetadata.roleId,
          roleName: applicationMetadata.roleName,
          // Extract from metadata with backward compatibility
          formData: applicationMetadata.formData || vendor.custom_fields || {},
          specializations: vendor.specializations || [],
          location: applicationMetadata.location || (vendor.latitude && vendor.longitude ? {
            lat: vendor.latitude,
            lng: vendor.longitude
          } : null),
          applicationId: applicationMetadata.applicationId,
          // ✅ PHASE 4 FIX 4.2: Include rejection reason (camelCase only)
          rejectionReason: vendor.rejection_reason || null,
        }
      });

    } catch (error) {
      console.error('❌ Error finding vendor by phone:', error);
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

      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(vendorId);

      if (!vendor) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }

      console.log(`✅ Vendor application loaded: ${vendorId}`);

      // ✅ BUG FIX #1 & #2: Return only camelCase fields, no snake_case duplicates
      // ✅ BUG FIX #4: Add backward compatibility for metadata structure
      const metadata = vendor.metadata as any;
      const applicationMetadata = metadata?.application || metadata?.application_metadata || {};
      
      return sendSuccess(c, {
        application: {
          // Only include camelCase fields, exclude snake_case fields from spread
          id: vendor.id,
          vendorId: vendor.id,
          phone: vendor.phone,
          email: vendor.email,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          status: vendor.status,
          // Convert snake_case to camelCase (only camelCase in response)
          setupCompleted: vendor.setup_completed ?? false,
          isActive: vendor.is_active ?? false,
          roleId: vendor.role_id || applicationMetadata.roleId,
          roleName: applicationMetadata.roleName,
          serviceStyle: applicationMetadata.serviceStyle,
          // ✅ PHASE 4 FIX 4.3: Extract formData from metadata with backward compatibility
          formData: applicationMetadata.formData || vendor.custom_fields || {},
          documents: applicationMetadata.documents || {},
          specializations: vendor.specializations || [],
          location: applicationMetadata.location || (vendor.latitude && vendor.longitude ? {
            lat: vendor.latitude,
            lng: vendor.longitude
          } : null),
          applicationId: applicationMetadata.applicationId,
          // Include rejection reason (camelCase only)
          rejectionReason: vendor.rejection_reason || null,
        }
      });

    } catch (error) {
      console.error('❌ Error loading vendor application:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/vendor/setup/complete
   * Mark vendor setup as complete and activate vendor
   * 
   * ✅ FIX: Created endpoint for vendor setup completion
   */
  app.post("/make-server-3dd53475/vendor/setup/complete", async (c) => {
    try {
      const { vendorId } = await c.req.json();
      
      if (!vendorId) {
        return c.json({ error: 'vendorId is required' }, 400);
      }
      
      console.log(`🎯 Completing setup for vendor: ${vendorId}`);
      
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Update vendor status to active
      const updatedVendor = await vendorsRepo.update(vendorId, {
        setup_completed: true,
        is_active: true,
        status: 'approved', // Ensure status is approved
        // Note: updated_at is automatically set by repository
      });
      
      console.log(`✅ Setup completed for vendor: ${vendorId}`);
      console.log(`   Status: ${updatedVendor.status}`);
      console.log(`   Setup Completed: ${updatedVendor.setup_completed}`);
      console.log(`   Is Active: ${updatedVendor.is_active}`);
      
      return c.json({ 
        success: true, 
        vendor: { 
          id: vendorId, 
          setupCompleted: true, 
          isActive: true,
          status: 'approved'
        } 
      });
    } catch (error) {
      console.error('❌ Error completing setup:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Vendor onboarding endpoints registered (SQL-only)');
}

