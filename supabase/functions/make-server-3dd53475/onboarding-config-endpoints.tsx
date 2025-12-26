/**
 * ============================================================================
 * ONBOARDING CONFIG ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Onboarding configuration management endpoints for dynamic onboarding forms
 * and vendor application management
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()`, `kv.getByPrefix()` with repository calls
 * - All roles stored in roles table
 * - All vendor applications stored in vendors table with status='pending'
 * - Application metadata stored in vendors.application_metadata JSONB column
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono@4';
import { getStandardFieldsForRole, INDIAN_BANKS } from './common-onboarding-fields.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { normalizePhone, createVendorId } from './phone-utils.tsx';
import { determineServiceCategory } from './service-category-mapping.tsx';
import { getRolesRepository } from '../../lib/repositories/roles.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';

export function onboardingConfigEndpoints(app: Hono) {
  
  // Initialize Supabase client for document upload
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const rolesRepo = getRolesRepository();
  const vendorsRepo = getVendorsRepository();
  const db = getDbClient();
  
  /**
   * Get onboarding configuration for a role
   * GET /make-server-3dd53475/config/onboarding/:roleId
   */
  app.get("/make-server-3dd53475/config/onboarding/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      console.log(`📋 Fetching onboarding config for roleId: ${roleId}`);
      
      // ✅ SQL: Get role configuration
      const role = await rolesRepo.findById(roleId);
      if (!role) {
        console.log(`❌ Role not found: ${roleId}`);
        return c.json({ error: 'Role not found' }, 404);
      }

      console.log(`✅ Role found:`, {
        name: role.name,
        display_name: role.display_name,
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

      // Get onboarding config from platform_settings or use role's onboarding fields
      const { data: configData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `onboarding:config:${roleId}`)
        .maybeSingle();
      
      const onboardingConfig = configData?.setting_value || role.onboardingFields || {};
      
      return c.json({ 
        roleId,
        roleName: role.name,
        category: role.category,
        vendorType: role.vendorType,
        serviceCategory: role.serviceCategory,
        config: {
          ...onboardingConfig,
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

      const role = await rolesRepo.findById(roleId);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }

      // Update role with new onboarding configuration
      const updatedRole = await rolesRepo.update(roleId, {
        onboardingFields: fields,
        documentRequirements: documentRequirements,
        updated_at: new Date().toISOString()
      });

      // Also store in platform_settings for easy access
      await db
        .from('platform_settings')
        .upsert({
          setting_key: `onboarding:config:${roleId}`,
          setting_value: { fields, documentRequirements },
          setting_type: 'object',
          updated_at: new Date().toISOString(),
        });

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

  // OPTIONS handler for vendor applications
  app.options("/make-server-3dd53475/vendor/applications", (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    return c.text('', 204);
  });

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
      
      // ✅ SQL: Get role configuration to extract serviceCategory
      // ✅ FIX: roles.id is UUID, but roleId might be a name string - findById handles both
      const role = await rolesRepo.findById(roleId);
      if (!role) {
        console.error(`❌ [VENDOR-APPLICATION] Role ${roleId} not found in roles table`);
        return c.json({ 
          error: 'Invalid role',
          message: `Role ${roleId} not found. Please ensure the role exists before submitting an application.`
        }, 400);
      }
      console.log('📋 [VENDOR-APPLICATION] Role config:', `FOUND (id: ${role.id}, name: ${role.name})`);
      
      const serviceCategory = role ? determineServiceCategory(role) : 'services';
      console.log('🏷️ [VENDOR-APPLICATION] Service category:', serviceCategory);
      
      // ✅ CRITICAL FIX: Extract ALL role information for vendor profile
      const roleName = role?.name || role?.display_name || 'Unknown Role';
      const vendorTypes = role?.vendorTypes || [];
      console.log('📋 [VENDOR-APPLICATION] Role details:', {
        roleName,
        serviceCategory,
        vendorTypes,
        roleId: role?.id
      });
      
      // ✅ SQL: Create vendor with application metadata
      // ✅ FIX: vendors table has address as JSONB, not separate city/state/pincode columns
      // ✅ FIX: role_id must be UUID from roles table, not the string roleId
      const vendorProfile: any = {
        vendor_id: vendorId, // Use the generated vendor ID
        phone: cleanPhone,
        email: formData.businessEmail || formData.email || email,
        business_name: formData.businessName || '',
        full_name: formData.ownerName || formData.fullName || formData.businessName || '',
        ...(role?.id && { role_id: role.id }), // Only set if role exists and has UUID id
        vendor_type: roleId, // Keep original roleId string for vendor_type
        service_category: serviceCategory,
        address: {
          line1: formData.addressLine1 || formData.address || '',
          line2: formData.addressLine2 || '',
          city: formData.city || '',
          state: formData.state || '',
          pincode: formData.pincode || '',
          landmark: formData.landmark || ''
        },
        status: 'pending', // Use 'pending' as it's a valid status value
        approval_status: 'pending',
        is_active: false,
        submitted_at: new Date().toISOString(),
        // ✅ FIX: Store application metadata in metadata JSONB column
        metadata: {
          application: {
            applicationId,
            roleId,
            roleName,
            vendorType: roleId,
            vendorTypes,
            serviceCategory,
            serviceStyle,
            formData,
            documents,
            location,
            submittedAt: new Date().toISOString(),
            history: [{
              status: 'pending',
              timestamp: new Date().toISOString(),
              note: 'Application submitted'
            }]
          }
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('👤 [VENDOR-APPLICATION] Vendor profile created:', {
        phone: vendorProfile.phone,
        status: vendorProfile.status,
        role_id: vendorProfile.role_id,
        role_found: !!role,
        role_uuid: role?.id,
        applicationId
      });

      // ✅ SQL: Create vendor (this will fail if vendor already exists)
      try {
        // Ensure role_id is set (we already validated role exists above)
        if (!role.id) {
          console.error('❌ [VENDOR-APPLICATION] Role found but has no ID:', role);
          return c.json({ 
            error: 'Invalid role data',
            message: 'Role found but missing ID. Please contact support.'
          }, 500);
        }
        
        console.log('💾 [VENDOR-APPLICATION] Creating vendor with role_id:', role.id);
        const vendor = await vendorsRepo.create(vendorProfile);
        console.log(`✅ [VENDOR-APPLICATION] Vendor created with application metadata!`);
        
        // Also store application reference in platform_settings for easy lookup
        await db
          .from('platform_settings')
          .upsert({
            setting_key: `application:${applicationId}`,
            setting_value: {
              id: applicationId,
              vendorId: vendor.id,
              roleId,
              phone,
              email: formData.email || email,
              status: 'pending',
              submittedAt: new Date().toISOString(),
            },
            setting_type: 'object',
          });
        
        console.log(`🎉 [VENDOR-APPLICATION] Application submission COMPLETE!`);
        console.log(`   📋 Application ID: ${applicationId}`);
        console.log(`   👤 Vendor ID: ${vendor.id}`);
        console.log(`   📞 Phone: ${phone} (clean: ${cleanPhone})`);
        
        return c.json({ 
          success: true, 
          applicationId, 
          vendorId: vendor.id,
          status: 'pending'
        });
      } catch (vendorError: any) {
        // Vendor might already exist - update it instead
        if (vendorError.message?.includes('duplicate') || vendorError.message?.includes('unique')) {
          console.log(`⚠️ [VENDOR-APPLICATION] Vendor already exists, updating...`);
          const existingVendor = await vendorsRepo.findByPhone(cleanPhone);
          if (existingVendor) {
            // ✅ PHASE 1 FIX 1.3: Merge application metadata into existing metadata JSONB
            // ✅ BUG FIX #4: Add backward compatibility for metadata structure
            const existingMetadata = (existingVendor.metadata as any) || {};
            const existingApplication = existingMetadata.application || existingMetadata.application_metadata || {};
            await vendorsRepo.update(existingVendor.id, {
              ...vendorProfile,
              metadata: {
                ...existingMetadata,
                application: {
                  ...existingApplication,
                  ...vendorProfile.metadata.application,
                }
              }
            });
            return c.json({ 
              success: true, 
              applicationId, 
              vendorId: existingVendor.id,
              status: 'pending'
            });
          }
        }
        throw vendorError;
      }
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
      
      // ✅ SQL: Get application from platform_settings
      const { data: appData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `application:${applicationId}`)
        .maybeSingle();
      
      if (!appData) {
        return c.json({ error: 'Application not found' }, 404);
      }
      
      const application = appData.setting_value;

      // ✅ SQL: Get vendor profile
      const vendor = await vendorsRepo.findById(application.vendorId);
      
      // ✅ SQL: Get role config to show what was required
      const role = await rolesRepo.findById(application.roleId);

      return c.json({ 
        application,
        vendor,
        role: {
          id: role?.id,
          name: role?.name || role?.display_name,
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

      // ✅ SQL: Get all vendors with pending status (applications)
      let query = db
        .from('vendors')
        .select('*')
        .eq('status', status || 'pending');
      
      if (roleId) {
        // ✅ PHASE 3 FIX 3.1: Filter by roleId from metadata.application (not application_metadata)
        // Filtering will be done in code after fetching vendors
      }
      
      const { data: vendors } = await query;
      
      // ✅ PHASE 3 FIX 3.1: Convert vendors to applications format using metadata.application
      // ✅ BUG FIX #4: Add backward compatibility for metadata structure
      const applications = (vendors || []).map((v: any) => {
        const metadata = v.metadata as any;
        const applicationMetadata = metadata?.application || metadata?.application_metadata || {};
        
        return {
          id: applicationMetadata.applicationId || `APP-${v.id}`,
          vendorId: v.id,
          roleId: v.role_id || applicationMetadata.roleId,
          phone: v.phone,
          email: v.email,
          status: v.status,
          formData: applicationMetadata.formData || {},
          documents: applicationMetadata.documents || {},
          serviceStyle: applicationMetadata.serviceStyle,
          location: applicationMetadata.location || (v.latitude && v.longitude ? {
            lat: v.latitude,
            lng: v.longitude
          } : null),
          submittedAt: applicationMetadata.submittedAt || v.submitted_at || v.created_at,
          updatedAt: v.updated_at,
          reviewNotes: applicationMetadata.reviewNotes || [],
          history: applicationMetadata.history || []
        };
      });

      // Apply filters
      let filteredApplications = applications;
      if (status) {
        filteredApplications = filteredApplications.filter((app: any) => app.status === status);
      }
      if (roleId) {
        filteredApplications = filteredApplications.filter((app: any) => app.roleId === roleId);
      }

      // Sort by submission date (newest first)
      filteredApplications.sort((a: any, b: any) => 
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

      return c.json({ applications: filteredApplications, total: filteredApplications.length });
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

      // ✅ SQL: Get application
      const { data: appData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `application:${applicationId}`)
        .maybeSingle();
      
      if (!appData) {
        return c.json({ error: 'Application not found' }, 404);
      }
      
      const application = appData.setting_value;

      // ✅ SQL: Update application status
      const updatedApplication = {
        ...application,
        status: 'approved',
        reviewedBy: reviewerName || 'Admin',
        reviewedAt: new Date().toISOString(),
        reviewNotes: notes || '',
        updatedAt: new Date().toISOString(),
        history: [
          ...(application.history || []),
          {
            status: 'approved',
            timestamp: new Date().toISOString(),
            note: notes || 'Application approved',
            reviewedBy: reviewerName || 'Admin'
          }
        ]
      };
      
      await db
        .from('platform_settings')
        .update({ setting_value: updatedApplication })
        .eq('setting_key', `application:${applicationId}`);

      // ✅ SQL: Update vendor profile
      const vendor = await vendorsRepo.findById(application.vendorId);
      if (vendor) {
        await vendorsRepo.update(application.vendorId, {
          status: 'approved',
          is_active: true,
          approved_at: new Date().toISOString(),
          application_metadata: {
            ...vendor.application_metadata,
            ...updatedApplication
          },
          updated_at: new Date().toISOString(),
        });
      }

      console.log(`✅ Application approved: ${applicationId}`);
      
      return c.json({ success: true, application: updatedApplication });
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

      // ✅ SQL: Get application
      const { data: appData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `application:${applicationId}`)
        .maybeSingle();
      
      if (!appData) {
        return c.json({ error: 'Application not found' }, 404);
      }
      
      const application = appData.setting_value;

      // ✅ SQL: Update application status
      const updatedApplication = {
        ...application,
        status: 'rejected',
        reviewedBy: reviewerName || 'Admin',
        reviewedAt: new Date().toISOString(),
        rejectionReason: reason || '',
        updatedAt: new Date().toISOString(),
        history: [
          ...(application.history || []),
          {
            status: 'rejected',
            timestamp: new Date().toISOString(),
            note: reason || 'Application rejected',
            reviewedBy: reviewerName || 'Admin'
          }
        ]
      };
      
      await db
        .from('platform_settings')
        .update({ setting_value: updatedApplication })
        .eq('setting_key', `application:${applicationId}`);

      // ✅ SQL: Update vendor profile
      const vendor = await vendorsRepo.findById(application.vendorId);
      if (vendor) {
        await vendorsRepo.update(application.vendorId, {
          status: 'rejected',
          is_active: false,
          application_metadata: {
            ...vendor.application_metadata,
            ...updatedApplication
          },
          updated_at: new Date().toISOString(),
        });
      }

      console.log(`❌ Application rejected: ${applicationId}`);
      
      return c.json({ success: true, application: updatedApplication });
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

      // ✅ SQL: Get application
      const { data: appData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `application:${applicationId}`)
        .maybeSingle();
      
      if (!appData) {
        return c.json({ error: 'Application not found' }, 404);
      }
      
      const application = appData.setting_value;

      // ✅ SQL: Update application status
      const updatedApplication = {
        ...application,
        status: 'clarification_requested',
        reviewedBy: reviewerName || 'Admin',
        reviewedAt: new Date().toISOString(),
        clarificationNotes: notes || '',
        requiredFields: requiredFields || [],
        updatedAt: new Date().toISOString(),
        history: [
          ...(application.history || []),
          {
            status: 'clarification_requested',
            timestamp: new Date().toISOString(),
            note: notes || 'Clarification requested',
            reviewedBy: reviewerName || 'Admin',
            requiredFields
          }
        ]
      };
      
      await db
        .from('platform_settings')
        .update({ setting_value: updatedApplication })
        .eq('setting_key', `application:${applicationId}`);

      // ✅ SQL: Update vendor profile
      const vendor = await vendorsRepo.findById(application.vendorId);
      if (vendor) {
        await vendorsRepo.update(application.vendorId, {
          status: 'clarification_requested',
          application_metadata: {
            ...vendor.application_metadata,
            ...updatedApplication
          },
          updated_at: new Date().toISOString(),
        });
      }

      console.log(`📝 Clarification requested: ${applicationId}`);
      
      return c.json({ success: true, application: updatedApplication });
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
  
  console.log('✅ Onboarding config endpoints registered (SQL-only)');
}

