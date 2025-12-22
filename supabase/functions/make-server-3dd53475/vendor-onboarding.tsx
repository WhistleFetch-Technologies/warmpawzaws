import { Hono } from "npm:hono";
import { determineServiceCategory, getServiceCategoryFromVendorTypes } from "./service-category-mapping.tsx";
import { normalizePhone, createVendorId, phonesMatch } from "./phone-utils.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

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
export function vendorOnboardingEndpoints(app: Hono, kv: any) {

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
      
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      const existingVendor = allVendors.find((v: any) => {
        if (!v || !v.phone) return false;
        const vendorCleanPhone = normalizePhone(v.phone);
        return phonesMatch(vendorCleanPhone, cleanPhone);
      });
      
      if (existingVendor) {
        console.log(`⚠️ EXISTING VENDOR FOUND WITH THIS PHONE`);
        console.log(`   Existing Vendor: ${existingVendor.id}`);
        console.log(`   Name: ${existingVendor.fullName || existingVendor.businessName}`);
        console.log(`   Status: ${existingVendor.status}`);
        
        // ✅ FIX GAP #3: Allow rejected vendors to reapply
        if (existingVendor.status === 'rejected') {
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
              applicationId: existingVendor.applicationId,
              name: existingVendor.businessName || existingVendor.fullName,
              status: existingVendor.status,
              submittedAt: existingVendor.submittedAt || existingVendor.createdAt,
              role: existingVendor.roleName
            }
          }, 409); // 409 Conflict status code
        }
      }
      
      console.log(`✅ No blocking issues found, proceeding with application...`);
      
      // Generate IDs
      const vendorId = createVendorId(cleanPhone);
      const applicationId = `APP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // ✅ FIX GAP #3: Check if this is a reapplication from rejected vendor
      const isReapplication = existingVendor && existingVendor.status === 'rejected';
      
      if (isReapplication) {
        console.log(`🔄 This is a REAPPLICATION from a rejected vendor`);
        console.log(`   Keeping existing vendorId: ${existingVendor.id}`);
        console.log(`   Previous applicationId: ${existingVendor.applicationId}`);
        console.log(`   New applicationId: ${applicationId}`);
      }
      
      // Get role configuration
      const role = await kv.get(`role:config:${roleId}`);
      if (!role) {
        console.error(`❌ ROLE NOT FOUND: ${roleId}`);
        return c.json({ 
          error: 'role_not_found',
          message: 'Selected role configuration not found. Please try again.'
        }, 400);
      }
      
      const roleName = role?.name || 'Vendor';
      const vendorType = role?.vendorTypes?.[0] || 'service_provider';
      
      // ✅ CRITICAL FIX #2: Proper service category determination
      const serviceCategory = role.serviceCategory || 
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
      
      // ✅ FIX GAP #3: For reapplications, preserve history and original creation date
      const baseVendor = isReapplication ? {
        // Keep original creation date and history
        createdAt: existingVendor.createdAt,
        originalApplicationId: existingVendor.applicationId,
        rejectionHistory: [
          ...(existingVendor.rejectionHistory || []),
          {
            applicationId: existingVendor.applicationId,
            rejectedAt: existingVendor.reviewedAt,
            rejectionReason: existingVendor.rejectionReason,
            reviewedBy: existingVendor.reviewedBy
          }
        ]
      } : {
        createdAt: new Date().toISOString()
      };
      
      const vendor = {
        id: vendorId,
        applicationId,
        roleId,
        roleName,
        serviceCategory, // ✅ FIX: Always set service category
        vendorType,
        serviceStyle: serviceStyle || role.defaultServiceStyle || null,
        
        // ✅ NEW: Specializations for center/vendor
        specializations: specializations || [],
        
        // ✅ FIX: Names with proper priority
        businessName: formData.businessName || null,
        fullName: formData.fullName || null,
        displayName: displayName, // For UI display purposes
        
        // Contact
        email: email || formData.email || null,
        phone: phone || formData.phone,
        
        // Address
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        pincode: formData.pincode || null,
        location: location || formData.location || null,
        
        // Business Details
        gstNumber: formData.gstNumber || null,
        yearsOfExperience: formData.yearsOfExperience || 0,
        
        // Bank Details
        bankDetails: {
          accountHolderName: formData.accountHolderName || null,
          accountNumber: formData.accountNumber || null,
          ifscCode: formData.ifscCode || null,
          bankName: formData.bankName || null,
          branchName: formData.branchName || null
        },
        
        // Documents
        documents: documentsArray,
        documentsRaw: documents, // Keep raw for reference
        
        // All form data for reference
        customFields: formData,
        
        // Status & Timestamps
        // ✅ FIX #3: Standardized status terminology
        status: 'pending_approval', // Will be 'pending_approval', 'approved', 'rejected', 'more_info_required'
        setupCompleted: false,
        isActive: false,
        submittedAt: new Date().toISOString(),
        ...baseVendor, // ✅ Merge history for reapplications
        updatedAt: new Date().toISOString(),
        
        // Progress tracking
        onboardingProgress: 100, // Application is complete
        applicationComplete: true,
        
        // ✅ FIX GAP #3: Mark as reapplication if applicable
        isReapplication: isReapplication || false,
        reapplicationCount: isReapplication ? (existingVendor.reapplicationCount || 0) + 1 : 0
      };
      
      await kv.set(vendorKey, vendor);
      
      // ✅ FIX #6: REMOVED DUPLICATE APPLICATION RECORD STORAGE
      // The vendor record itself contains all application data (applicationId, status, documents, etc.)
      // No need to store a separate application record - reduces data redundancy
      
      // Add vendorId (not applicationId) to pending list
      const pendingVendors = await kv.get('vendor:pending_approvals') || [];
      if (!pendingVendors.includes(vendorId)) {
        pendingVendors.push(vendorId);
        await kv.set('vendor:pending_approvals', pendingVendors);
      }
      
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
      
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      const existingVendor = allVendors.find((v: any) => {
        if (!v || !v.phone) return false;
        const vendorCleanPhone = normalizePhone(v.phone);
        return phonesMatch(vendorCleanPhone, cleanPhone);
      });
      
      if (existingVendor) {
        console.log(`✅ Phone found: ${existingVendor.id} - ${existingVendor.status}`);
        return c.json({
          exists: true,
          application: {
            id: existingVendor.id,
            applicationId: existingVendor.applicationId,
            name: existingVendor.businessName || existingVendor.fullName,
            status: existingVendor.status,
            submittedAt: existingVendor.submittedAt || existingVendor.createdAt,
            role: existingVendor.roleName
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

      // Get existing vendor
      const vendorKey = `vendor:${vendorId}`;
      const existingVendor = await kv.get(vendorKey);

      if (!existingVendor) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Update vendor with new data
      const updatedVendor = {
        ...existingVendor,
        // Update form data
        ...formData,
        // Update specializations
        specializations: specializations || existingVendor.specializations || [],
        // Update location
        location: location || formData?.location || existingVendor.location,
        coordinates: location || formData?.coordinates || existingVendor.coordinates,
        // Update documents if provided
        documents: documents ? [...(existingVendor.documents || []), ...documents] : existingVendor.documents,
        // Track update
        updatedAt: new Date().toISOString(),
        lastProfileUpdate: new Date().toISOString()
      };

      await kv.set(vendorKey, updatedVendor);

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

      const vendorKey = `vendor:${vendorId}`;
      const vendor = await kv.get(vendorKey);

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

      const vendorKey = `vendor:${vendorId}`;
      const vendor = await kv.get(vendorKey);

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