import { Hono } from 'npm:hono@4';
import { getStandardFieldsForRole, INDIAN_BANKS } from './common-onboarding-fields.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { normalizePhone, createVendorId } from './phone-utils.tsx';
import { determineServiceCategory } from './service-category-mapping.tsx';

/**
 * Onboarding Configuration Management Endpoints
 * Manages dynamic onboarding forms and document requirements per role
 */
export function onboardingConfigEndpoints(app: Hono, kv: any) {
  
  // Initialize Supabase client for document upload
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  /**
   * Get onboarding configuration for a role
   * GET /make-server-3dd53475/config/onboarding/:roleId
   */
  app.get("/make-server-3dd53475/config/onboarding/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      console.log(`📋 Fetching onboarding config for roleId: ${roleId}`);
      
      // Get role configuration
      const role = await kv.get(`role:config:${roleId}`);
      if (!role) {
        console.log(`❌ Role not found: ${roleId}`);
        return c.json({ error: 'Role not found' }, 404);
      }

      console.log(`✅ Role found:`, {
        name: role.name,
        category: role.category,
        vendorType: role.vendorType,
        serviceCategory: role.serviceCategory
      });

      // Get standard fields that should be added to all roles
      const standardFields = getStandardFieldsForRole(role);
      
      // Combine role-specific custom fields with standard fields
      const allCustomFields = [
        ...(role.onboardingFields?.custom || []),
        ...standardFields
      ];

      // Get onboarding config (or return role's onboarding fields)
      const onboardingConfig = await kv.get(`onboarding:config:${roleId}`);
      
      return c.json({ 
        roleId,
        roleName: role.name,
        category: role.category,
        vendorType: role.vendorType,
        serviceCategory: role.serviceCategory,
        config: {
          ...(onboardingConfig || role.onboardingFields || {}),
          custom: allCustomFields,
          banksList: INDIAN_BANKS
        },
        documentRequirements: role.documentRequirements || [],
        serviceStyles: role.serviceStyles || [],
        staffManagement: role.staffManagement,
        multiService: role.multiService,
        vendorTypes: role.vendorTypes
      });
    } catch (error) {
      console.error('Error fetching onboarding config:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Update onboarding configuration for a role
   * PUT /make-server-3dd53475/config/onboarding/:roleId
   */
  app.put("/make-server-3dd53475/config/onboarding/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      const { fields, documentRequirements } = await c.req.json();

      const role = await kv.get(`role:config:${roleId}`);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }

      // Update role with new onboarding configuration
      const updatedRole = {
        ...role,
        onboardingFields: fields,
        documentRequirements: documentRequirements,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`role:config:${roleId}`, updatedRole);

      console.log(`✅ Onboarding config updated for role: ${roleId}`);
      return c.json({ success: true, role: updatedRole });
    } catch (error) {
      console.error('Error updating onboarding config:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // VENDOR APPLICATION ENDPOINTS
  // ============================================

  /**
   * Submit vendor application
   * POST /make-server-3dd53475/vendor/applications
   */
  app.post("/make-server-3dd53475/vendor/applications", async (c) => {
    try {
      console.log('🚀 [VENDOR-APPLICATION] Starting application submission...');
      
      const applicationData = await c.req.json();
      console.log('📦 [VENDOR-APPLICATION] Received data:', {
        roleId: applicationData.roleId,
        phone: applicationData.phone,
        email: applicationData.email,
        hasFormData: !!applicationData.formData,
        hasDocuments: !!applicationData.documents
      });
      
      const {
        roleId,
        phone,
        email,
        formData,
        documents,
        serviceStyle,
        location
      } = applicationData;

      // Generate application ID
      const timestamp = Date.now();
      const applicationId = `APP-${roleId.toUpperCase()}-${timestamp}`;
      console.log('🆔 [VENDOR-APPLICATION] Generated applicationId:', applicationId);

      // ✅ CRITICAL FIX: Use proper vendor ID pattern matching vendor-onboarding.tsx
      // Generate vendor ID using standardized utility (returns vendor_XXXXXXXXXX)
      const cleanPhone = normalizePhone(phone);
      const vendorId = createVendorId(cleanPhone); // Returns: vendor_9611377119
      console.log('🆔 [VENDOR-APPLICATION] Generated vendorId:', vendorId, 'from phone:', phone, '(clean:', cleanPhone, ')');
      
      // Get role configuration to extract serviceCategory
      const role = await kv.get(`role:config:${roleId}`);
      console.log('📋 [VENDOR-APPLICATION] Role config:', role ? 'FOUND' : 'NOT FOUND');
      
      const serviceCategory = role ? determineServiceCategory(role) : 'services';
      console.log('🏷️ [VENDOR-APPLICATION] Service category:', serviceCategory);
      
      // ✅ CRITICAL FIX: Extract ALL role information for vendor profile
      const roleName = role?.name || 'Unknown Role';
      const vendorTypes = role?.vendorTypes || [];
      console.log('📋 [VENDOR-APPLICATION] Role details:', {
        roleName,
        serviceCategory,
        vendorTypes
      });
      
      const vendorProfile = {
        id: vendorId,
        phone,
        email: formData.email || email,
        roleId,
        roleName, // ✅ ADD: Store role name
        vendorType: roleId, // Role ID is the vendor type
        vendorTypes, // ✅ ADD: Store vendor types from role
        serviceCategory, // ✅ ADD: Store service category
        serviceStyle,
        
        // Application metadata
        applicationId,
        status: 'pending', // ✅ ADD: Main status field for consistency
        applicationStatus: 'pending',
        applicationSubmittedAt: new Date().toISOString(),
        
        // Form data
        fullName: formData.fullName || formData.ownerName || '',
        businessName: formData.businessName || '',
        ownerName: formData.ownerName || formData.fullName || '',
        address: formData.address || '',
        city: formData.city || '',
        state: formData.state || '',
        pincode: formData.pincode || '',
        
        // Location data
        location: location || null,
        latitude: location?.lat || null,
        longitude: location?.lng || null,
        
        // Documents (store references)
        documents: documents || {},
        
        // Additional fields
        ...formData,
        
        // Status flags
        isActive: false,
        setupCompleted: false,
        isVerified: false,
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('👤 [VENDOR-APPLICATION] Vendor profile created:', {
        id: vendorProfile.id,
        phone: vendorProfile.phone,
        status: vendorProfile.status,
        applicationId: vendorProfile.applicationId
      });

      // ✅ PERMANENT FIX: Use saveVendor utility that ALWAYS creates indexes
      const { saveVendor } = await import('./vendor-utils.tsx');
      
      console.log(`💾 [VENDOR-APPLICATION] Saving vendor with automatic index creation...`);
      
      try {
        await saveVendor(vendorProfile);
        console.log(`✅ [VENDOR-APPLICATION] Vendor saved with all indexes created!`);
        
        // Verify it was saved
        const verifyVendor = await kv.get(`vendor:${vendorId}`);
        if (verifyVendor) {
          console.log(`✅ [VENDOR-APPLICATION] VERIFICATION: Vendor retrieved successfully!`, {
            id: verifyVendor.id,
            status: verifyVendor.status
          });
        } else {
          console.error(`❌ [VENDOR-APPLICATION] VERIFICATION FAILED: Could not retrieve vendor after saving!`);
        }
      } catch (vendorSaveError) {
        console.error(`❌ [VENDOR-APPLICATION] ERROR saving vendor:`, vendorSaveError);
        throw vendorSaveError;
      }
      
      // Save application
      const application = {
        id: applicationId,
        vendorId,
        roleId,
        phone,
        email: formData.email || email,
        status: 'pending',
        formData,
        documents,
        serviceStyle,
        location,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewNotes: [],
        history: [
          {
            status: 'pending',
            timestamp: new Date().toISOString(),
            note: 'Application submitted'
          }
        ]
      };

      console.log(`💾 [VENDOR-APPLICATION] Saving application with key: "application:${applicationId}"`);
      
      try {
        await kv.set(`application:${applicationId}`, application);
        console.log(`✅ [VENDOR-APPLICATION] Application saved successfully!`);
        
        // Verify it was saved
        const verifyApp = await kv.get(`application:${applicationId}`);
        if (verifyApp) {
          console.log(`✅ [VENDOR-APPLICATION] VERIFICATION: Application retrieved successfully!`, {
            id: verifyApp.id,
            status: verifyApp.status,
            vendorId: verifyApp.vendorId
          });
        } else {
          console.error(`❌ [VENDOR-APPLICATION] VERIFICATION FAILED: Could not retrieve application after saving!`);
        }
      } catch (appSaveError) {
        console.error(`❌ [VENDOR-APPLICATION] ERROR saving application:`, appSaveError);
        throw appSaveError;
      }
      
      // Add to pending applications list
      console.log(`💾 [VENDOR-APPLICATION] Adding to pending list: "application:pending:${applicationId}"`);
      
      try {
        await kv.set(`application:pending:${applicationId}`, { 
          applicationId, 
          vendorId, 
          submittedAt: application.submittedAt 
        });
        console.log(`✅ [VENDOR-APPLICATION] Added to pending list successfully!`);
      } catch (pendingError) {
        console.error(`❌ [VENDOR-APPLICATION] ERROR adding to pending list:`, pendingError);
        // Don't throw - this is not critical
      }

      console.log(`🎉 [VENDOR-APPLICATION] Application submission COMPLETE!`);
      console.log(`   📋 Application ID: ${applicationId}`);
      console.log(`   👤 Vendor ID: ${vendorId}`);
      console.log(`   📞 Phone: ${phone} (clean: ${cleanPhone})`);
      
      return c.json({ 
        success: true, 
        applicationId, 
        vendorId,
        status: 'pending'
      });
    } catch (error) {
      console.error('❌ [VENDOR-APPLICATION] FATAL ERROR submitting application:', error);
      console.error('   Error details:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      });
      return c.json({ 
        error: String(error),
        details: error?.message 
      }, 500);
    }
  });

  /**
   * Get application details
   * GET /make-server-3dd53475/vendor/applications/:applicationId
   */
  app.get("/make-server-3dd53475/vendor/applications/:applicationId", async (c) => {
    try {
      const { applicationId } = c.req.param();
      
      const application = await kv.get(`application:${applicationId}`);
      
      if (!application) {
        return c.json({ error: 'Application not found' }, 404);
      }

      // Get vendor profile
      const vendor = await kv.get(`vendor:${application.vendorId}`);
      
      // Get role config to show what was required
      const role = await kv.get(`role:config:${application.roleId}`);

      return c.json({ 
        application,
        vendor,
        role: {
          id: role?.id,
          name: role?.name,
          documentRequirements: role?.documentRequirements,
          onboardingFields: role?.onboardingFields
        }
      });
    } catch (error) {
      console.error('Error fetching application:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get all applications (with filters)
   * GET /make-server-3dd53475/vendor/applications?status=pending&roleId=vet
   */
  app.get("/make-server-3dd53475/vendor/applications", async (c) => {
    try {
      const status = c.req.query('status');
      const roleId = c.req.query('roleId');

      // Get all applications
      const allApplications = await kv.getByPrefix('application:');
      
      // Filter out the status-specific keys
      let applications = allApplications.filter((app: any) => 
        app.id && app.id.startsWith('APP-')
      );

      // Apply filters
      if (status) {
        applications = applications.filter((app: any) => app.status === status);
      }

      if (roleId) {
        applications = applications.filter((app: any) => app.roleId === roleId);
      }

      // Sort by submission date (newest first)
      applications.sort((a: any, b: any) => 
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

      return c.json({ applications, total: applications.length });
    } catch (error) {
      console.error('Error fetching applications:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Approve application
   * POST /make-server-3dd53475/vendor/applications/:applicationId/approve
   */
  app.post("/make-server-3dd53475/vendor/applications/:applicationId/approve", async (c) => {
    try {
      const { applicationId } = c.req.param();
      const { reviewerName, notes } = await c.req.json();

      const application = await kv.get(`application:${applicationId}`);
      
      if (!application) {
        return c.json({ error: 'Application not found' }, 404);
      }

      // Update application status
      application.status = 'approved';
      application.reviewedBy = reviewerName || 'Admin';
      application.reviewedAt = new Date().toISOString();
      application.reviewNotes = notes || '';
      application.updatedAt = new Date().toISOString();
      application.history.push({
        status: 'approved',
        timestamp: new Date().toISOString(),
        note: notes || 'Application approved',
        reviewedBy: reviewerName || 'Admin'
      });

      await kv.set(`application:${applicationId}`, application);

      // Update vendor profile using proper vendor: prefix
      const vendor = await kv.get(`vendor:${application.vendorId}`);
      if (vendor) {
        vendor.applicationStatus = 'approved';
        vendor.status = 'approved'; // ✅ Also update status field
        vendor.isActive = true;
        vendor.isVerified = true;
        vendor.approvedAt = new Date().toISOString();
        vendor.updatedAt = new Date().toISOString();
        
        await kv.set(`vendor:${application.vendorId}`, vendor);
      }

      // Remove from pending list
      await kv.del(`application:pending:${applicationId}`);
      
      // Add to approved list
      await kv.set(`application:approved:${applicationId}`, { 
        applicationId, 
        vendorId: application.vendorId, 
        approvedAt: new Date().toISOString() 
      });

      console.log(`✅ Application approved: ${applicationId}`);
      
      return c.json({ success: true, application });
    } catch (error) {
      console.error('Error approving application:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Reject application
   * POST /make-server-3dd53475/vendor/applications/:applicationId/reject
   */
  app.post("/make-server-3dd53475/vendor/applications/:applicationId/reject", async (c) => {
    try {
      const { applicationId } = c.req.param();
      const { reviewerName, reason } = await c.req.json();

      const application = await kv.get(`application:${applicationId}`);
      
      if (!application) {
        return c.json({ error: 'Application not found' }, 404);
      }

      // Update application status
      application.status = 'rejected';
      application.reviewedBy = reviewerName || 'Admin';
      application.reviewedAt = new Date().toISOString();
      application.rejectionReason = reason || '';
      application.updatedAt = new Date().toISOString();
      application.history.push({
        status: 'rejected',
        timestamp: new Date().toISOString(),
        note: reason || 'Application rejected',
        reviewedBy: reviewerName || 'Admin'
      });

      await kv.set(`application:${applicationId}`, application);

      // Update vendor profile
      const vendor = await kv.get(`vendor:${application.vendorId}`);
      if (vendor) {
        vendor.applicationStatus = 'rejected';
        vendor.status = 'rejected'; // ✅ Also update status field
        vendor.isActive = false;
        vendor.rejectionReason = reason;
        vendor.rejectedAt = new Date().toISOString();
        vendor.updatedAt = new Date().toISOString();
        
        await kv.set(`vendor:${application.vendorId}`, vendor);
      }

      // Remove from pending list
      await kv.del(`application:pending:${applicationId}`);
      
      // Add to rejected list
      await kv.set(`application:rejected:${applicationId}`, { 
        applicationId, 
        vendorId: application.vendorId, 
        rejectedAt: new Date().toISOString() 
      });

      console.log(`❌ Application rejected: ${applicationId}`);
      
      return c.json({ success: true, application });
    } catch (error) {
      console.error('Error rejecting application:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Request clarification
   * POST /make-server-3dd53475/vendor/applications/:applicationId/clarify
   */
  app.post("/make-server-3dd53475/vendor/applications/:applicationId/clarify", async (c) => {
    try {
      const { applicationId } = c.req.param();
      const { reviewerName, notes, requiredFields } = await c.req.json();

      const application = await kv.get(`application:${applicationId}`);
      
      if (!application) {
        return c.json({ error: 'Application not found' }, 404);
      }

      // Update application status
      application.status = 'clarification_requested';
      application.reviewedBy = reviewerName || 'Admin';
      application.reviewedAt = new Date().toISOString();
      application.clarificationNotes = notes || '';
      application.requiredFields = requiredFields || [];
      application.updatedAt = new Date().toISOString();
      application.history.push({
        status: 'clarification_requested',
        timestamp: new Date().toISOString(),
        note: notes || 'Clarification requested',
        reviewedBy: reviewerName || 'Admin',
        requiredFields
      });

      await kv.set(`application:${applicationId}`, application);

      // Update vendor profile
      const vendor = await kv.get(`vendor:${application.vendorId}`);
      if (vendor) {
        vendor.applicationStatus = 'clarification_requested';
        vendor.status = 'clarification_requested'; // ✅ Also update status field
        vendor.clarificationNotes = notes;
        vendor.updatedAt = new Date().toISOString();
        
        await kv.set(`vendor:${application.vendorId}`, vendor);
      }

      console.log(`📝 Clarification requested: ${applicationId}`);
      
      return c.json({ success: true, application });
    } catch (error) {
      console.error('Error requesting clarification:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Upload document
   * POST /make-server-3dd53475/vendor/documents/upload
   */
  app.post("/make-server-3dd53475/vendor/documents/upload", async (c) => {
    try {
      const { vendorId, documentType, file, fileName, fileData } = await c.req.json();

      const bucketName = 'make-3dd53475-vendor-documents';
      
      // Ensure bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        const { error: bucketError } = await supabase.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
        });
        
        // Ignore "already exists" error (409)
        if (bucketError && bucketError.statusCode !== '409' && !bucketError.message?.includes('already exists')) {
          console.error('❌ Error creating bucket:', bucketError);
          // Continue anyway - bucket might exist from race condition
        }
      }

      // Convert base64 to blob if needed
      let fileBuffer;
      if (fileData) {
        // Base64 data
        const base64Data = fileData.split(',')[1] || fileData;
        fileBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      }

      // Upload file
      const filePath = `${vendorId}/${documentType}/${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileBuffer, {
          contentType: file?.type || 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return c.json({ error: uploadError.message }, 500);
      }

      // Create signed URL (valid for 1 year)
      const { data: signedUrlData } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 31536000); // 1 year in seconds

      console.log(`✅ Document uploaded: ${filePath}`);
      
      return c.json({ 
        success: true, 
        path: filePath,
        url: signedUrlData?.signedUrl
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get document URL
   * GET /make-server-3dd53475/vendor/documents/:vendorId/:documentType/:fileName
   */
  app.get("/make-server-3dd53475/vendor/documents/:vendorId/:documentType/:fileName", async (c) => {
    try {
      const { vendorId, documentType, fileName } = c.req.param();
      
      const bucketName = 'make-3dd53475-vendor-documents';
      const filePath = `${vendorId}/${documentType}/${fileName}`;

      // Create signed URL (valid for 1 hour)
      const { data: signedUrlData, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 3600); // 1 hour

      if (error) {
        return c.json({ error: error.message }, 404);
      }

      return c.json({ url: signedUrlData?.signedUrl });
    } catch (error) {
      console.error('Error getting document URL:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}