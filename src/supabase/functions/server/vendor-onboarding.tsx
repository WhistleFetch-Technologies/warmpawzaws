import { Hono } from "npm:hono";
import { determineServiceCategory, getServiceCategoryFromVendorTypes } from "./service-category-mapping.tsx";
import { normalizePhone, createVendorId } from "./phone-utils.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * Vendor Onboarding & Application Management Endpoints
 * Handles vendor application submission, approval, rejection, and service setup
 */
export function vendorOnboardingEndpoints(app: Hono, kv: any) {

  /**
   * GET /make-server-3dd53475/config/roles
   * Get all available roles
   */
  app.get("/make-server-3dd53475/config/roles", async (c) => {
    try {
      console.log("🔍 Fetching roles configuration...");
      
      // Try to get roles from KV store first
      const roles = await kv.getByPrefix('role:config:');
      
      if (roles && roles.length > 0) {
        console.log(`✅ Found ${roles.length} roles in KV store`);
        return sendSuccess(c, { roles });
      }
      
      // Fallback: Return hardcoded roles if KV is empty
      console.log("⚠️ No roles in KV, returning default roles");
      
      const defaultRoles = [
        {
          id: 'veterinarian',
          name: 'Veterinarian',
          description: 'Medical care provider for pets',
          vendorTypes: ['clinic', 'hospital', 'home_visit']
        },
        {
          id: 'pet_groomer',
          name: 'Pet Groomer',
          description: 'Professional grooming services',
          vendorTypes: ['salon', 'mobile_van', 'home_service']
        },
        {
          id: 'pet_boarding',
          name: 'Pet Boarding',
          description: 'Overnight stay and care',
          vendorTypes: ['kennel', 'cattery', 'home_boarding']
        },
        {
          id: 'pet_trainer',
          name: 'Pet Trainer',
          description: 'Behavioral training and obedience',
          vendorTypes: ['center', 'home_training']
        },
        {
          id: 'pet_walker',
          name: 'Pet Walker',
          description: 'Dog walking services',
          vendorTypes: ['individual', 'agency']
        }
      ];
      
      return sendSuccess(c, { roles: defaultRoles });
    } catch (error) {
      console.error('❌ Error fetching roles:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // VENDOR APPLICATION SUBMISSION
  // ============================================

  // Save vendor profile
  app.post("/make-server-3dd53475/vendor/profile/save", async (c) => {
    try {
      const profileData = await c.req.json();
      
      // ✅ CRITICAL FIX: Save to vendor:vendor_xxx pattern ONLY
      // No more vendor:profile: keys - use single pattern for consistency
      const vendorKey = `vendor:${profileData.id}`;
      
      // Check if vendor already exists (merge data)
      let vendor = await kv.get(vendorKey);
      
      if (!vendor) {
        // Create new vendor record
        vendor = {
          id: profileData.id,
          createdAt: new Date().toISOString()
        };
      }
      
      // Merge/update profile data
      vendor = {
        ...vendor,
        ...profileData,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(vendorKey, vendor);
      
      console.log(`✅ Vendor profile saved to ${vendorKey}`);

      return sendSuccess(c, { 
        vendorId: profileData.id 
      }, 'Profile saved successfully');
    } catch (error) {
      console.error('Error saving vendor profile:', error);
      return sendError(c, error, 500);
    }
  });

  // Dynamic vendor onboarding submission (new comprehensive form)
  app.post("/make-server-3dd53475/vendor/onboarding/submit", async (c) => {
    try {
      const body = await c.req.json();
      const { roleId, roleName, applicationId } = body;
      const formData = body.formData || {};
      const documents = body.documents || {};
      
      console.log(`📝 Processing onboarding submission for role: ${roleName}`);
      console.log(`📄 Application ID: ${applicationId}`);
      console.log(`📋 Form data received:`, Object.keys(formData));
      console.log(`📎 Documents received (raw):`, JSON.stringify(Object.keys(documents).map(key => ({
        id: key,
        sides: Object.keys(documents[key] || {})
      }))));
      
      // Get role configuration to extract category and vendorType
      const role = await kv.get(`role:config:${roleId}`);
      
      // Determine service category from role's vendorTypes array
      const serviceCategory = determineServiceCategory(role);
      
      console.log(`🔍 Role config:`, role ? {
        name: role.name,
        vendorTypes: role.vendorTypes,
        serviceCategory: serviceCategory
      } : 'NOT FOUND');
      
      // Generate vendor ID from phone
      const cleanPhone = normalizePhone(formData.phone);
      const vendorId = createVendorId(cleanPhone);
      
      // Convert documents object to array format for display
      const documentsArray = [];
      
      console.log(`🔍 Processing documents for conversion...`);
      
      // Process each document type
      if (documents.aadhar?.front?.preview) {
        console.log(`  ✅ Aadhar Front - Preview length: ${documents.aadhar.front.preview.length}`);
        documentsArray.push({
          name: 'Aadhar Card - Front',
          type: 'aadhaar_front',
          category: 'Identity Proof',
          preview: documents.aadhar.front.preview,
          fileName: documents.aadhar.front.fileName,
          fileType: documents.aadhar.front.fileType
        });
      } else {
        console.log(`  ❌ Aadhar Front - Missing or no preview`);
      }
      
      if (documents.aadhar?.back?.preview) {
        console.log(`  ✅ Aadhar Back - Preview length: ${documents.aadhar.back.preview.length}`);
        documentsArray.push({
          name: 'Aadhar Card - Back',
          type: 'aadhaar_back',
          category: 'Identity Proof',
          preview: documents.aadhar.back.preview,
          fileName: documents.aadhar.back.fileName,
          fileType: documents.aadhar.back.fileType
        });
      } else {
        console.log(`  ❌ Aadhar Back - Missing or no preview`);
      }
      
      if (documents.pan?.front?.preview) {
        console.log(`  ✅ PAN Card - Preview length: ${documents.pan.front.preview.length}`);
        documentsArray.push({
          name: 'PAN Card',
          type: 'pan',
          category: 'Identity Proof',
          preview: documents.pan.front.preview,
          fileName: documents.pan.front.fileName,
          fileType: documents.pan.front.fileType
        });
      } else {
        console.log(`  ❌ PAN Card - Missing or no preview`);
      }
      
      if (documents.cancelled_cheque?.front?.preview) {
        console.log(`  ✅ Cancelled Cheque - Preview length: ${documents.cancelled_cheque.front.preview.length}`);
        documentsArray.push({
          name: 'Cancelled Cheque',
          type: 'cancelled_cheque',
          category: 'Bank Details',
          preview: documents.cancelled_cheque.front.preview,
          fileName: documents.cancelled_cheque.front.fileName,
          fileType: documents.cancelled_cheque.front.fileType
        });
      } else {
        console.log(`  ❌ Cancelled Cheque - Missing or no preview`);
      }
      
      if (documents.gst_certificate?.front?.preview) {
        console.log(`  ✅ GST Certificate - Preview length: ${documents.gst_certificate.front.preview.length}`);
        documentsArray.push({
          name: 'GST Certificate',
          type: 'gst_certificate',
          category: 'Business Documents',
          preview: documents.gst_certificate.front.preview,
          fileName: documents.gst_certificate.front.fileName,
          fileType: documents.gst_certificate.front.fileType
        });
      } else {
        console.log(`  ❌ GST Certificate - Missing or no preview`);
      }
      
      if (documents.license?.front?.preview) {
        console.log(`  ✅ Professional License - Preview length: ${documents.license.front.preview.length}`);
        documentsArray.push({
          name: 'Professional License',
          type: 'license',
          category: 'Professional Documents',
          preview: documents.license.front.preview,
          fileName: documents.license.front.fileName,
          fileType: documents.license.front.fileType
        });
      } else {
        console.log(`  ❌ Professional License - Missing or no preview`);
      }
      
      if (documents.police_verification?.front?.preview) {
        console.log(`  ✅ Police Verification - Preview length: ${documents.police_verification.front.preview.length}`);
        documentsArray.push({
          name: 'Police Verification',
          type: 'police_verification',
          category: 'Verification Documents',
          preview: documents.police_verification.front.preview,
          fileName: documents.police_verification.front.fileName,
          fileType: documents.police_verification.front.fileType
        });
      } else {
        console.log(`  ❌ Police Verification - Missing or no preview`);
      }
      
      console.log(`📎 Converted ${documentsArray.length} documents to array format`);
      if (documentsArray.length > 0) {
        console.log(`📋 First document:`, {
          name: documentsArray[0].name,
          hasPreview: !!documentsArray[0].preview,
          previewLength: documentsArray[0].preview?.length || 0
        });
      } else {
        console.log(`❌ WARNING: No documents were converted! Check document structure.`);
      }
      
      // Prepare vendor record with category information
      const vendor = {
        id: vendorId,
        applicationId,
        roleId,
        roleName,
        
        // Category information - properly map from role's vendorTypes
        serviceCategory: serviceCategory, // Use the determined service category
        vendorType: role?.vendorTypes?.[0] || 'service_provider', // First vendorType from array
        
        // Personal Information
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        
        // Address & Location
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        location: formData.location,
        
        // Professional Details
        yearsOfExperience: formData.yearsOfExperience,
        
        // Business Details (conditional - for centers)
        businessName: formData.businessName,
        gstNumber: formData.gstNumber,
        
        // Bank Details (mandatory for all)
        bankDetails: {
          accountHolderName: formData.accountHolderName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          bankName: formData.bankName,
          branchName: formData.branchName
        },
        
        // Documents - store both formats
        documentsRaw: {
          aadhar: documents.aadhar,
          pan: documents.pan,
          cancelledCheque: documents.cancelled_cheque,
          gstCertificate: documents.gst_certificate,
          professionalLicense: documents.license,
          policeVerification: documents.police_verification
        },
        documents: documentsArray,
        
        // Dynamic fields from configuration
        customFields: formData,
        
        // Status tracking
        status: 'pending', // ✅ CRITICAL: Must be 'pending' to match VendorApp.tsx expectations
        submittedAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        
        // Setup tracking
        setupCompleted: false,
        isActive: false,
        
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save vendor record
      const vendorKey = `vendor:${vendorId}`;
      await kv.set(vendorKey, vendor);
      console.log(`✅ Vendor saved at ${vendorKey} with:`, {
        category: vendor.category,
        vendorType: vendor.vendorType,
        serviceCategory: vendor.serviceCategory,
        documentsCount: vendor.documents.length
      });
      
      // Save application record with category information
      const application = {
        id: applicationId,
        applicationId,
        vendorId,
        roleId,
        roleName,
        
        // Category information - use properly determined service category
        serviceCategory: serviceCategory, // Mapped from role's vendorTypes
        vendorType: role?.vendorTypes?.[0] || 'service_provider', // First vendorType from array
        
        fullName: formData.fullName,
        businessName: formData.businessName,
        phone: formData.phone,
        email: formData.email,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        formData,
        documentsRaw: documents,
        documents: documentsArray
      };
      
      await kv.set(`vendor:application:${applicationId}`, application);
      console.log(`✅ Application saved at vendor:application:${applicationId}`);
      console.log(`   - Category: ${application.category}`);
      console.log(`   - Vendor Type: ${application.vendorType}`);
      console.log(`   - Service Category: ${application.serviceCategory}`);
      console.log(`   - Documents: ${application.documents.length} items`);
      
      // Add to pending applications list
      const pendingApps = await kv.get('vendor:applications:pending') || [];
      if (!pendingApps.includes(applicationId)) {
        pendingApps.push(applicationId);
        await kv.set('vendor:applications:pending', pendingApps);
        console.log(`✅ Added to pending applications list`);
      }
      
      console.log(`🎉 Onboarding submission completed for ${vendorId}`);
      
      return sendSuccess(c, {
        applicationId,
        vendorId
      }, 'Application submitted successfully');
    } catch (error) {
      console.error('❌ Error in onboarding submission:', error);
      return sendError(c, error, 500);
    }
  });

  // Get vendor profile
  app.get("/make-server-3dd53475/vendor/profile/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`🔍 Looking for vendor with ID: ${vendorId}`);
      
      // Try the actual key pattern first: vendor:vendor_xxx
      let vendorProfile = await kv.get(`vendor:${vendorId}`);
      
      // Fallback to old pattern if not found
      if (!vendorProfile) {
        vendorProfile = await kv.get(`vendor:profile:${vendorId}`);
      }
      
      console.log(`📦 Vendor profile found:`, vendorProfile ? 'YES' : 'NO');
      if (vendorProfile) {
        console.log(`   - Status: ${vendorProfile.status}`);
        console.log(`   - Name: ${vendorProfile.fullName}`);
      } else {
        // Try to find vendor by other patterns
        console.log(`🔍 Trying alternate key patterns...`);
        const allVendorProfiles = await kv.getByPrefix('vendor:');
        console.log(`📋 Found ${allVendorProfiles.length} vendor-related keys`);
        allVendorProfiles.slice(0, 10).forEach((v: any, index: number) => {
          console.log(`   ${index + 1}. ID: ${v.id}, Phone: ${v.phone}, Status: ${v.status}`);
        });
      }
      
      if (!vendorProfile) {
        return sendError(c, 'Vendor not found', 404);
      }

      return sendSuccess(c, { vendorProfile });
    } catch (error) {
      console.error('Error fetching vendor profile:', error);
      return sendError(c, error, 500);
    }
  });

  // Find vendor by phone number
  app.get("/make-server-3dd53475/vendor/find-by-phone/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const cleanPhone = normalizePhone(phone);
      
      console.log(`🔍 Searching for vendor with phone: ${phone} (clean: ${cleanPhone})`);
      
      // CRITICAL FIX: Search in vendor:vendor_ keys (actual vendor records with status)
      // NOT vendor:profile: keys which are just initial profile saves
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      
      console.log(`📋 Searching through ${allVendors.length} vendor records...`);
      
      // Debug: Log all phones we're checking
      if (allVendors.length > 0) {
        console.log('📞 Phones in database:');
        allVendors.slice(0, 10).forEach((v, idx) => {
          if (v && v.phone) {
            const vClean = normalizePhone(v.phone);
            console.log(`  [${idx}] ${v.id}: ${v.phone} (clean: ${vClean}) ${vClean === cleanPhone ? '✅ MATCH' : ''}`);
          }
        });
      }
      
      for (const vendor of allVendors) {
        if (vendor && vendor.phone) {
          const vendorCleanPhone = normalizePhone(vendor.phone);
          console.log(`  Comparing: ${vendorCleanPhone} === ${cleanPhone} ? ${vendorCleanPhone === cleanPhone}`);
          if (vendorCleanPhone === cleanPhone) {
            console.log(`✅ Found vendor: ${vendor.id} for phone ${cleanPhone}`);
            console.log(`   - Status: ${vendor.status}`);
            console.log(`   - Setup Completed: ${vendor.setupCompleted}`);
            console.log(`   - Is Active: ${vendor.isActive}`);
            console.log(`   - Type: ${vendor.vendorType}`);
            console.log(`   - Role: ${vendor.roleName} (${vendor.roleId})`);
            console.log(`   - Application ID: ${vendor.applicationId}`);
            return sendSuccess(c, { vendor });
          }
        }
      }
      
      console.log(`❌ No vendor found for phone ${cleanPhone}`);
      console.log(`   Total vendors checked: ${allVendors.length}`);
      return sendSuccess(c, { vendor: null });
    } catch (error) {
      console.error('Error finding vendor by phone:', error);
      return sendError(c, error, 500);
    }
  });

  // Submit vendor application (called after profile creation)
  app.post("/make-server-3dd53475/vendor/application/submit", async (c) => {
    try {
      const applicationData = await c.req.json();
      const applicationId = `APP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      console.log(`📝 Submitting application for vendor: ${applicationData.vendorId}`);
      console.log(`📋 Application has ${applicationData.documents?.length || 0} documents`);
      if (applicationData.documents && applicationData.documents.length > 0) {
        console.log(`📎 Documents being submitted:`, JSON.stringify(applicationData.documents, null, 2));
      } else {
        console.log(`❌ WARNING: No documents in application data!`);
      }
      
      const application = {
        id: applicationId,
        applicationId: applicationId,
        vendorId: applicationData.vendorId,
        fullName: applicationData.fullName,
        businessName: applicationData.businessName,
        vendorType: applicationData.vendorType,
        serviceStyle: applicationData.serviceStyle, // 'at_home' | 'at_center' | 'both'
        email: applicationData.email,
        phone: applicationData.phone,
        location: applicationData.location,
        address: applicationData.address,
        city: applicationData.city,
        state: applicationData.state,
        pincode: applicationData.pincode,
        gstNumber: applicationData.gstNumber,
        panNumber: applicationData.panNumber,
        licenseNumber: applicationData.licenseNumber,
        licenseExpiryDate: applicationData.licenseExpiryDate,
        documents: applicationData.documents || [],
        status: 'pending', // 'pending' | 'under_review' | 'approved' | 'rejected' | 'clarification_requested'
        submittedAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        clarificationNotes: null,
        additionalInfo: applicationData.additionalInfo || {}
      };
      
      console.log(`💾 Application object has ${application.documents.length} documents before saving`);

      // ✅ CRITICAL: Update the vendor record with pending_approval status
      const vendorKey = `vendor:${applicationData.vendorId}`;
      let vendor = await kv.get(vendorKey);
      
      console.log(`🔍 Looking for vendor at key: ${vendorKey}`);
      console.log(`📦 Vendor found:`, vendor ? 'YES' : 'NO');
      
      if (!vendor) {
        console.log(`❌ Vendor not found at ${vendorKey}, creating new record`);
        vendor = {
          id: applicationData.vendorId,
          fullName: applicationData.fullName,
          businessName: applicationData.businessName,
          vendorType: applicationData.vendorType,
          phone: applicationData.phone,
          email: applicationData.email,
          createdAt: new Date().toISOString()
        };
      }
      
      // Update vendor with application details and status
      vendor.applicationId = applicationId;
      vendor.status = 'pending'; // ✅ CRITICAL: Must be 'pending' to match VendorApp.tsx expectations
      vendor.submittedAt = new Date().toISOString();
      vendor.fullName = applicationData.fullName;
      vendor.businessName = applicationData.businessName;
      vendor.vendorType = applicationData.vendorType;
      vendor.serviceStyle = applicationData.serviceStyle;
      vendor.email = applicationData.email;
      vendor.phone = applicationData.phone;
      vendor.address = applicationData.address;
      vendor.city = applicationData.city;
      vendor.state = applicationData.state;
      vendor.pincode = applicationData.pincode;
      vendor.gstNumber = applicationData.gstNumber;
      vendor.panNumber = applicationData.panNumber;
      vendor.licenseNumber = applicationData.licenseNumber;
      vendor.licenseExpiryDate = applicationData.licenseExpiryDate;
      vendor.documents = applicationData.documents || [];
      vendor.location = applicationData.location;
      vendor.setupCompleted = false;
      vendor.isActive = false;
      
      await kv.set(vendorKey, vendor);
      console.log(`✅ Vendor updated at ${vendorKey} with status: pending_approval`);
      
      // Store separate application record for tracking
      await kv.set(`vendor:application:${applicationId}`, application);
      console.log(`✅ Application stored at vendor:application:${applicationId}`);
      
      // Add to pending applications list (for backwards compatibility)
      const pendingApps = await kv.get('vendor:applications:pending') || [];
      if (!pendingApps.includes(applicationId)) {
        pendingApps.push(applicationId);
        await kv.set('vendor:applications:pending', pendingApps);
        console.log(`✅ Added to pending applications list`);
      }

      console.log(`🎉 Application submitted successfully: ${applicationId} for vendor ${applicationData.vendorId}`);

      return sendSuccess(c, { 
        applicationId,
        message: 'Application submitted successfully. Awaiting admin approval.'
      });
    } catch (error) {
      console.error('❌ Error submitting vendor application:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/vendor/applications
   * New endpoint for vendor application submission matching VendorOnboarding.tsx
   */
  app.post("/make-server-3dd53475/vendor/applications", async (c) => {
    try {
      const body = await c.req.json();
      const { roleId, phone, email, serviceStyle, location } = body;
      const formData = body.formData || {};
      const documents = body.documents || {};
      
      console.log(`📝 Received new vendor application submission`);
      console.log(`   Role ID: ${roleId}`);
      console.log(`   Phone: ${phone}`);
      
      // Generate IDs
      const cleanPhone = normalizePhone(phone);
      const vendorId = createVendorId(cleanPhone);
      const applicationId = `APP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Get role configuration
      const role = await kv.get(`role:config:${roleId}`);
      const roleName = role?.name || 'Vendor';
      const vendorType = role?.vendorTypes?.[0] || 'service_provider';
      const serviceCategory = determineServiceCategory(role);
      
      console.log(`🔍 Resolved Role: ${roleName}, Type: ${vendorType}, Category: ${serviceCategory}`);

      // Process documents
      const documentsArray = [];
      if (documents) {
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
                   category: 'Document',
                   preview: sd.preview,
                   fileName: sd.fileName,
                   fileType: sd.fileType
                 });
               } else if ((docData as any).preview) {
                 // It's a direct document without sides (e.g. docData is the file obj)
                 const dd = docData as any;
                 documentsArray.push({
                   name: key,
                   type: key,
                   category: 'Document',
                   preview: dd.preview,
                   fileName: dd.fileName,
                   fileType: dd.fileType
                 });
                 break; // Break inner loop as we handled the parent
               }
             }
          }
        }
      }
      console.log(`📎 Processed ${documentsArray.length} documents`);

      // Create Vendor Record
      const vendorKey = `vendor:${vendorId}`;
      let vendor = await kv.get(vendorKey);
      
      if (!vendor) {
        vendor = {
          id: vendorId,
          createdAt: new Date().toISOString()
        };
      }
      
      // Update vendor fields
      vendor = {
        ...vendor,
        applicationId,
        roleId,
        roleName,
        serviceCategory,
        vendorType,
        serviceStyle,
        
        fullName: formData.fullName,
        email: email || formData.email,
        phone: phone || formData.phone,
        
        // Address
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        location: location || formData.location,
        
        // Business
        businessName: formData.businessName,
        gstNumber: formData.gstNumber,
        yearsOfExperience: formData.yearsOfExperience,
        
        // Bank
        bankDetails: {
          accountHolderName: formData.accountHolderName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          bankName: formData.bankName,
          branchName: formData.branchName
        },
        
        documents: documentsArray,
        documentsRaw: documents,
        customFields: formData,
        
        // Status
        status: 'pending',
        setupCompleted: false,
        isActive: false,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(vendorKey, vendor);
      
      // Store separate application record
      const application = {
        id: applicationId,
        applicationId,
        vendorId,
        roleId,
        roleName,
        serviceCategory,
        vendorType,
        
        fullName: formData.fullName,
        businessName: formData.businessName,
        phone: phone || formData.phone,
        email: email || formData.email,
        
        formData,
        documentsRaw: documents,
        documents: documentsArray,
        
        status: 'pending',
        submittedAt: new Date().toISOString()
      };
      
      await kv.set(`vendor:application:${applicationId}`, application);
      
      // Add to pending applications list
      const pendingApps = await kv.get('vendor:applications:pending') || [];
      if (!pendingApps.includes(applicationId)) {
        pendingApps.push(applicationId);
        await kv.set('vendor:applications:pending', pendingApps);
      }
      
      console.log(`🎉 Application created: ${applicationId} for vendor ${vendorId}`);
      
      return sendSuccess(c, {
        applicationId,
        vendorId,
        message: 'Application submitted successfully'
      });
      
    } catch (error) {
      console.error('❌ Error creating application:', error);
      return sendError(c, error, 500);
    }
  });

}
