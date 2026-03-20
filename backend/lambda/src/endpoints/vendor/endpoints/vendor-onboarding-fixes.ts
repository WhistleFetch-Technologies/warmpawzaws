/**
 * ============================================================================
 * CRITICAL VENDOR ONBOARDING FIXES
 * ============================================================================
 * 
 * Fixes for vendor onboarding issues:
 * 1. Form schema loading (empty form issue)
 * 2. Application submission not appearing in admin
 * 3. Vendor state not persisting after login
 * 4. Approval flow issues
 * 
 * Date: 2026-01-13
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';

// Default form fields when onboarding_forms doesn't exist
const DEFAULT_FORM_FIELDS = [
  // Business Information
  {
    id: 'businessName',
    name: 'businessName',
    label: 'Business Name',
    type: 'text',
    section: 'business_information',
    placeholder: 'Enter your business name',
    validation: { required: true, minLength: 3 },
    order: 1,
    isActive: true
  },
  {
    id: 'fullName',
    name: 'fullName',
    label: 'Full Name',
    type: 'text',
    section: 'business_information',
    placeholder: 'Enter your full name',
    validation: { required: true },
    order: 2,
    isActive: true
  },
  {
    id: 'email',
    name: 'email',
    label: 'Email Address',
    type: 'email',
    section: 'business_information',
    placeholder: 'your@email.com',
    validation: { required: true },
    order: 3,
    isActive: true
  },
  {
    id: 'phone',
    name: 'phone',
    label: 'Contact Number',
    type: 'tel',
    section: 'business_information',
    placeholder: '+91 XXXXX XXXXX',
    validation: { required: true },
    order: 4,
    isActive: true
  },
  {
    id: 'description',
    name: 'description',
    label: 'Business Description',
    type: 'textarea',
    section: 'business_information',
    placeholder: 'Tell us about your business',
    validation: { required: true, minLength: 50 },
    order: 5,
    isActive: true
  },
  {
    id: 'experience',
    name: 'experience',
    label: 'Years of Experience',
    type: 'number',
    section: 'business_information',
    placeholder: 'Enter years of experience',
    validation: { required: true, min: 0 },
    order: 6,
    isActive: true
  },
  // Location Information
  {
    id: 'address',
    name: 'address',
    label: 'Business Address',
    type: 'textarea',
    section: 'location_information',
    placeholder: 'Enter complete address',
    validation: { required: true },
    order: 7,
    isActive: true
  },
  {
    id: 'city',
    name: 'city',
    label: 'City',
    type: 'text',
    section: 'location_information',
    placeholder: 'Enter city',
    validation: { required: true },
    order: 8,
    isActive: true
  },
  {
    id: 'pincode',
    name: 'pincode',
    label: 'Pincode',
    type: 'text',
    section: 'location_information',
    placeholder: 'Enter pincode',
    validation: { required: true, pattern: '^[0-9]{6}$' },
    order: 9,
    isActive: true
  },
  // Banking Information
  {
    id: 'accountHolderName',
    name: 'accountHolderName',
    label: 'Account Holder Name',
    type: 'text',
    section: 'banking_information',
    placeholder: 'As per bank records',
    validation: { required: true },
    order: 10,
    isActive: true
  },
  {
    id: 'accountNumber',
    name: 'accountNumber',
    label: 'Account Number',
    type: 'text',
    section: 'banking_information',
    placeholder: 'Enter account number',
    validation: { required: true },
    order: 11,
    isActive: true
  },
  {
    id: 'ifscCode',
    name: 'ifscCode',
    label: 'IFSC Code',
    type: 'text',
    section: 'banking_information',
    placeholder: 'Enter IFSC code',
    validation: { required: true, pattern: '^[A-Z]{4}0[A-Z0-9]{6}$' },
    order: 12,
    isActive: true
  },
  // Documents
  {
    id: 'aadhar',
    name: 'aadhar',
    label: 'Aadhar Card',
    type: 'file',
    section: 'documents',
    requiresDocument: true,
    documentType: 'aadhar',
    documentLabel: 'Aadhar Card',
    acceptedFileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    validation: { required: true },
    order: 13,
    isActive: true
  },
  {
    id: 'pan',
    name: 'pan',
    label: 'PAN Card',
    type: 'file',
    section: 'documents',
    requiresDocument: true,
    documentType: 'pan',
    documentLabel: 'PAN Card',
    acceptedFileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    validation: { required: true },
    order: 14,
    isActive: true
  }
];

export function registerVendorOnboardingFixes(app: Hono) {
  /**
   * GET /vendor/onboarding/form-schema-fixed
   * Fixed form schema endpoint with fallback to default fields
   */
  app.get('/vendor/onboarding/form-schema-fixed', async (c) => {
    try {
      const phone = c.req.query('phone');
      const roleIdParam = c.req.query('roleId');
      const vendorTypeParam = c.req.query('vendorType');
      
      // Allow either phone or roleId to be provided
      if (!phone && !roleIdParam) {
        return c.json({ error: 'Phone number or roleId is required' }, 400);
      }

      let selectedRoleId = roleIdParam;
      let vendorType = vendorTypeParam || 'business';
      let identity: any = null;

      // If phone is provided, try to get vendor identity
      if (phone) {
        const identities = await select('vendor_identity', { phone });
        if (identities.length > 0) {
          identity = identities[0];
          // Use identity values if available, fallback to query params
          selectedRoleId = identity.selected_role_id || roleIdParam;
          vendorType = identity.vendor_type || vendorTypeParam || 'business';
        }
      }

      // If still no role ID, return default form schema
      if (!selectedRoleId) {
        console.log(`⚠️ [FORM SCHEMA] No role selected, returning DEFAULT FIELDS`);
        return c.json({
          success: true,
          roleId: null,
          roleName: 'default',
          fields: DEFAULT_FORM_FIELDS,
          sections: getSectionsFromFields(DEFAULT_FORM_FIELDS),
          schema: {
            fields: DEFAULT_FORM_FIELDS,
            sections: getSectionsFromFields(DEFAULT_FORM_FIELDS),
          },
          message: 'Using default form fields. Select a role for role-specific fields.',
        });
      }

      // Get role information
      const roles = await select('roles', { id: selectedRoleId });
      let roleName = 'default';
      
      if (roles.length > 0) {
        roleName = roles[0].name;
      } else {
        // roleId might be a role name, not UUID
        roleName = selectedRoleId;
      }
      
      console.log(`📋 [FORM SCHEMA] Looking for form for role: ${roleName} (UUID: ${selectedRoleId})`);
      
      // Try to get form from onboarding_forms table
      const formsResult = await query(
        `SELECT * FROM onboarding_forms WHERE role_id = $1 OR role_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [roleName, selectedRoleId]
      );
      
      let fields: any[] = [];
      
      if (formsResult.rows && formsResult.rows.length > 0) {
        console.log(`✅ [FORM SCHEMA] Found existing form for role ${roleName}`);
        const form = formsResult.rows[0];
        fields = typeof form.fields === 'string' ? JSON.parse(form.fields) : (form.fields || []);
      } else {
        console.log(`⚠️ [FORM SCHEMA] No form found for role ${roleName}, using DEFAULT FIELDS`);
        fields = DEFAULT_FORM_FIELDS;
        
        // Create the form in database for future use
        try {
          await query(
            `INSERT INTO onboarding_forms (role_id, vendor_type, fields, version, status, created_at, updated_at)
             VALUES ($1, $2, $3, 1, 'published', NOW(), NOW())
             ON CONFLICT (role_id, vendor_type) DO UPDATE SET fields = $3, updated_at = NOW()`,
            [roleName, vendorType || 'center', JSON.stringify(DEFAULT_FORM_FIELDS)]
          );
          console.log(`✅ [FORM SCHEMA] Created default form for role ${roleName}`);
        } catch (insertError) {
          console.error(`❌ [FORM SCHEMA] Failed to create default form:`, insertError);
        }
      }

      // ✅ PRE-DEDUPLICATION: Remove obvious duplicates from database fields first
      const preSeenIds = new Set<string>();
      const preSeenFieldNames = new Set<string>();
      const initialCount = fields.length;
      
      fields = fields.filter((f: any) => {
        const id = f.id || '';
        const fieldName = f.fieldName || f.name || '';
        
        // Skip if duplicate by ID
        if (id && preSeenIds.has(id)) {
          console.log(`[FORM SCHEMA] ⚠️ Pre-dedup: Removing duplicate by ID: ${id} (${f.label || 'unknown'})`);
          return false;
        }
        
        // Skip if duplicate by fieldName (but allow if it's a new_field that will be checked later)
        if (fieldName && preSeenFieldNames.has(fieldName) && fieldName !== 'new_field') {
          console.log(`[FORM SCHEMA] ⚠️ Pre-dedup: Removing duplicate by fieldName: ${fieldName} (${f.label || 'unknown'})`);
          return false;
        }
        
        // Mark as seen
        if (id) preSeenIds.add(id);
        if (fieldName) preSeenFieldNames.add(fieldName);
        
        return true;
      });
      
      if (fields.length < initialCount) {
        console.log(`[FORM SCHEMA] Pre-deduplication removed ${initialCount - fields.length} duplicate(s). Remaining: ${fields.length}`);
      }

      // ✅ NEW: Import and merge KYC fields for the role (same as admin endpoint)
      try {
        const { 
          getKYCFieldsForRole, 
          ROLE_KYC_CONFIGS, 
          KYC_SECTIONS 
        } = await import('../lib/kyc-form-fields');
        
        // Get KYC fields for this role and vendor type
        let kycFields = getKYCFieldsForRole(roleName, vendorType as 'solo' | 'business');
        if (kycFields.length === 0) {
          // Try without vendor type
          kycFields = getKYCFieldsForRole(roleName);
        }
        
        if (kycFields.length > 0) {
          console.log(`[FORM SCHEMA] Adding ${kycFields.length} KYC fields for role ${roleName} (vendorType: ${vendorType})`);
          
          // Convert KYC fields to form field format
          const kycFormFields = kycFields.map((f: any) => ({
            id: f.id,
            fieldName: f.fieldName,
            name: f.fieldName, // Frontend expects 'name'
            label: f.label,
            type: f.type, // Includes 'aadhaar-otp', 'pan-verify', 'gst-verify', 'declaration'
            section: f.section,
            isMandatory: f.isMandatory,
            required: f.isMandatory,
            requiresVerification: f.requiresVerification || false,
            verificationEndpoint: f.verificationEndpoint || null,
            placeholder: f.placeholder || '',
            helpText: f.helpText || '',
            options: f.options || [],
            validation: f.validation || {},
            displayOrder: f.displayOrder || 0,
            order: f.displayOrder || 0,
            isActive: true,
            softBlock: f.softBlock || false,
            declarationText: f.declarationText || null,
            declarationType: f.declarationType || f.id,
          }));
          
          // ✅ AGGRESSIVE DEDUPLICATION: Remove duplicates and new_field conflicts
          const kycFieldIds = new Set(kycFormFields.map((f: any) => f.id));
          const kycFieldNames = new Set(kycFormFields.map((f: any) => f.fieldName || f.name));
          const kycFieldLabels = new Set(kycFormFields.map((f: any) => (f.label || '').toLowerCase().trim()));
          
          // Build a map of KYC fields by semantic key (label + type + section) for duplicate detection
          const kycSemanticMap = new Map<string, any>();
          kycFormFields.forEach((kf: any) => {
            const semanticKey = `${(kf.label || '').toLowerCase().trim()}_${kf.type}_${kf.section}`;
            kycSemanticMap.set(semanticKey, kf);
          });
          
          const dbFields = [...fields]; // copy from onboarding_forms
          
          // ✅ STEP 1: Filter out fields that match KYC by ID, fieldName, or name
          const nonKycFields = fields.filter((f: any) => {
            // Skip if it's a KYC field by ID/fieldName/name
            if (kycFieldIds.has(f.id) || kycFieldNames.has(f.fieldName) || kycFieldNames.has(f.name)) {
              return false;
            }
            
            // ✅ STEP 2: Remove fields with fieldName="new_field" that duplicate KYC fields semantically
            if (f.fieldName === 'new_field' || f.fieldName === 'newField' || f.fieldName === 'new-field') {
              const fieldLabel = (f.label || '').toLowerCase().trim();
              const semanticKey = `${fieldLabel}_${f.type}_${f.section}`;
              
              // If this new_field semantically matches a KYC field, remove it
              if (kycSemanticMap.has(semanticKey)) {
                console.log(`[FORM SCHEMA] ⚠️ Removing duplicate new_field: "${f.label}" (matches KYC field)`);
                return false;
              }
              
              // Also check if label contains keywords that match KYC fields
              const labelKeywords = ['aadhaar', 'aadhar', 'pan', 'gst', 'cancelled cheque', 'cancellation cheque', 'cancelled check'];
              const matchedKeyword = labelKeywords.find(keyword => fieldLabel.includes(keyword.toLowerCase()));
              if (matchedKeyword) {
                // Check if any KYC field has similar label
                const hasMatchingKyc = Array.from(kycSemanticMap.values()).some((kf: any) => {
                  const kycLabel = (kf.label || '').toLowerCase();
                  return kycLabel.includes(matchedKeyword.toLowerCase()) && kf.section === f.section;
                });
                if (hasMatchingKyc) {
                  console.log(`[FORM SCHEMA] ⚠️ Removing duplicate new_field: "${f.label}" (matches KYC keyword: ${matchedKeyword})`);
                  return false;
                }
              }
            }
            
            return true;
          });
          
          // ✅ STEP 3: Merge KYC fields with stored overrides (DB overrides apply on top of KYC defaults)
          const mergedKycFields = kycFormFields.map((kf: any) => {
            const stored = dbFields.find((f: any) => f.id === kf.id || f.fieldName === kf.id || f.name === kf.id);
            return stored ? { ...kf, ...stored } : kf;
          });
          
          // ✅ STEP 4: For business roles, remove solo-specific Aadhaar fields if business-specific ones exist
          if (vendorType === 'business') {
            const hasOwnerAadhaar = mergedKycFields.some((f: any) => 
              f.id === 'ownerAadhaarNumber' || f.fieldName === 'ownerAadhaarNumber'
            );
            
            if (hasOwnerAadhaar) {
              // Remove solo-specific aadhaarNumber if ownerAadhaarNumber exists
              const soloAadhaarIndex = mergedKycFields.findIndex((f: any) => 
                f.id === 'aadhaarNumber' && f.fieldName === 'aadhaarNumber'
              );
              if (soloAadhaarIndex >= 0) {
                console.log(`[FORM SCHEMA] ⚠️ Removing solo-specific aadhaarNumber (business has ownerAadhaarNumber)`);
                mergedKycFields.splice(soloAadhaarIndex, 1);
              }
              
              // Also remove from nonKycFields if present
              const soloAadhaarInNonKyc = nonKycFields.findIndex((f: any) => 
                f.id === 'aadhaarNumber' || f.fieldName === 'aadhaarNumber'
              );
              if (soloAadhaarInNonKyc >= 0) {
                console.log(`[FORM SCHEMA] ⚠️ Removing solo-specific aadhaarNumber from non-KYC fields`);
                nonKycFields.splice(soloAadhaarInNonKyc, 1);
              }
            }
          }
          
          // ✅ STEP 5: AGGRESSIVE Final deduplication using multiple criteria
          const finalFieldsMap = new Map<string, any>();
          const seenIds = new Set<string>();
          const seenFieldNames = new Set<string>();
          const seenSemanticKeys = new Set<string>();
          
          // Helper to generate semantic key for duplicate detection
          const getSemanticKey = (f: any) => {
            const label = (f.label || '').toLowerCase().trim().replace(/\s+/g, '_');
            const type = f.type || 'text';
            const section = f.section || 'additional_information';
            return `${label}_${type}_${section}`;
          };
          
          // Add non-KYC fields first (lower priority)
          nonKycFields.forEach((f: any) => {
            const id = f.id || '';
            const fieldName = f.fieldName || f.name || '';
            const semanticKey = getSemanticKey(f);
            
            // Skip if already seen by any criteria
            if (id && seenIds.has(id)) {
              console.log(`[FORM SCHEMA] ⚠️ Skipping duplicate by ID: ${id} (${f.label})`);
              return;
            }
            if (fieldName && seenFieldNames.has(fieldName)) {
              console.log(`[FORM SCHEMA] ⚠️ Skipping duplicate by fieldName: ${fieldName} (${f.label})`);
              return;
            }
            if (seenSemanticKeys.has(semanticKey)) {
              console.log(`[FORM SCHEMA] ⚠️ Skipping duplicate by semantic key: ${semanticKey} (${f.label})`);
              return;
            }
            
            // Mark as seen
            if (id) seenIds.add(id);
            if (fieldName) seenFieldNames.add(fieldName);
            seenSemanticKeys.add(semanticKey);
            
            // Use ID as primary key, fallback to fieldName, then semantic key
            const key = id || fieldName || semanticKey;
            finalFieldsMap.set(key, f);
          });
          
          // Add merged KYC fields (higher priority - overwrites duplicates)
          mergedKycFields.forEach((f: any) => {
            const id = f.id || '';
            const fieldName = f.fieldName || f.name || '';
            const semanticKey = getSemanticKey(f);
            
            // Mark as seen (KYC fields take precedence)
            if (id) seenIds.add(id);
            if (fieldName) seenFieldNames.add(fieldName);
            seenSemanticKeys.add(semanticKey);
            
            // Use ID as primary key, fallback to fieldName, then semantic key
            const key = id || fieldName || semanticKey;
            finalFieldsMap.set(key, f); // Overwrite if exists
          });
          
          fields = Array.from(finalFieldsMap.values());
          
          console.log(`[FORM SCHEMA] Total fields after aggressive deduplication: ${fields.length} (IDs: ${seenIds.size}, FieldNames: ${seenFieldNames.size}, Semantic: ${seenSemanticKeys.size})`);
        }
      } catch (kycError: any) {
        console.error('[FORM SCHEMA] Error loading KYC fields:', kycError?.message || kycError);
        // Continue with fields from database only
      }

      // Filter active fields only
      const activeFields = fields.filter((f: any) => f.isActive !== false);

      if (activeFields.length === 0) {
        console.error(`❌ [FORM SCHEMA] No active fields found, returning default fields`);
        return c.json({
          success: true,
          roleId: selectedRoleId,
          roleName: roleName,
          fields: DEFAULT_FORM_FIELDS,
          sections: getSectionsFromFields(DEFAULT_FORM_FIELDS),
          schema: {
            fields: DEFAULT_FORM_FIELDS,
            sections: getSectionsFromFields(DEFAULT_FORM_FIELDS),
          },
        });
      }

      // ✅ NEW: Use KYC-aware section grouping if KYC fields were loaded
      let sections: any[];
      try {
        const { ROLE_KYC_CONFIGS, KYC_SECTIONS } = await import('../lib/kyc-form-fields');
        const roleConfig = ROLE_KYC_CONFIGS[roleName] || 
                          ROLE_KYC_CONFIGS[`${roleName}_solo`] || 
                          ROLE_KYC_CONFIGS[`${roleName}_business`];
        const roleSections = roleConfig?.sections || KYC_SECTIONS;
        
        // Use KYC-aware section grouping
        sections = getSectionsFromFieldsWithKYC(activeFields, roleSections);
      } catch {
        // Fallback to basic section grouping
        sections = getSectionsFromFields(activeFields);
      }

      console.log(`✅ [FORM SCHEMA] Returning ${activeFields.length} fields in ${sections.length} sections`);

      return c.json({
        success: true,
        roleId: selectedRoleId,
        roleName: roleName,
        fields: activeFields,
        sections: sections,
        schema: {
          fields: activeFields,
          sections: sections,
        },
      });
    } catch (error: any) {
      console.error('❌ [FORM SCHEMA] Error:', error);
      return c.json({ error: error.message || 'Failed to get form schema' }, 500);
    }
  });

  /**
   * GET /admin/vendors/pending-applications-fixed
   * Fixed endpoint to get all pending applications
   */
  app.get('/admin/vendors/pending-applications-fixed', async (c) => {
    try {
      console.log('📋 [ADMIN] Fetching pending applications...');
      
      // Query vendor_onboarding_applications with JOIN to vendor_identity (include uploaded_documents for admin review)
      const applicationsResult = await query(`
        SELECT 
          voa.id as application_id,
          voa.vendor_identity_id,
          voa.status,
          voa.application_payload,
          voa.uploaded_documents,
          voa.submitted_at,
          voa.created_at,
          vi.phone,
          vi.selected_role_id,
          vi.vendor_type,
          vi.onboarding_status,
          r.name as role_name,
          r.display_name as role_display_name
        FROM vendor_onboarding_applications voa
        LEFT JOIN vendor_identity vi ON voa.vendor_identity_id = vi.id
        LEFT JOIN roles r ON vi.selected_role_id = r.id
        WHERE voa.status IN ('SUBMITTED', 'PENDING', 'UNDER_REVIEW')
        ORDER BY voa.submitted_at DESC
      `);
      
      const applications = (applicationsResult.rows || []).map((row: any) => {
        const payload = typeof row.application_payload === 'string' 
          ? JSON.parse(row.application_payload) 
          : row.application_payload || {};
        
        return {
          id: row.application_id,
          applicationId: row.application_id,
          vendorId: row.vendor_identity_id,
          fullName: payload.fullName || payload.ownerName || payload.businessName || 'N/A',
          businessName: payload.businessName || payload.fullName || 'N/A',
          ownerName: payload.ownerName || payload.fullName || 'N/A',
          phone: row.phone || payload.phone || 'N/A',
          email: payload.email || 'N/A',
          address: payload.address || 'N/A',
          city: payload.city || 'N/A',
          state: payload.state || 'N/A',
          pincode: payload.pincode || payload.pinCode || payload.pin || 'N/A',
          category: row.role_display_name || row.role_name || 'N/A',
          roleName: row.role_name,
          experience: payload.experience || '0',
          status: 'pending_approval',
          submittedAt: row.submitted_at || row.created_at,
          vendorType: row.vendor_type,
          priority: 'medium',
          uploaded_documents: row.uploaded_documents ?? undefined,
          uploadedDocuments: row.uploaded_documents ?? undefined,
          customFields: payload,
          formData: payload,
        };
      });
      
      console.log(`✅ [ADMIN] Found ${applications.length} pending applications`);
      
      return c.json({
        success: true,
        applications: applications,
        total: applications.length
      });
    } catch (error: any) {
      console.error('❌ [ADMIN] Error fetching pending applications:', error);
      return c.json({ error: error.message || 'Failed to fetch applications' }, 500);
    }
  });

  /**
   * ✅ FIX: GET /vendor/application/status/:vendorId
   * Get vendor application status by vendorId (used by VendorApplicationStatus.tsx)
   */
  app.get('/vendor/application/status/:vendorId', async (c) => {
    const vendorId = c.req.param('vendorId');
    console.log('📋 [VENDOR-APPLICATION-STATUS] Getting status for vendorId:', vendorId);
    
    try {
      // First try to find by application ID
      let application = await query(
        `SELECT va.*, vi.phone, vi.vendor_id, vi.selected_role_id, r.name as role_name
         FROM vendor_onboarding_applications va
         LEFT JOIN vendor_identity vi ON va.vendor_identity_id = vi.id
         LEFT JOIN roles r ON vi.selected_role_id = r.id
         WHERE va.id = $1 OR va.vendor_identity_id = $1 OR vi.vendor_id = $1
         ORDER BY va.created_at DESC
         LIMIT 1`,
        [vendorId]
      );
      
      if (!application || !application.rows || application.rows.length === 0) {
        // Try to find by vendor_id in vendors table
        const vendorRecord = await query(
          `SELECT v.*, vi.phone, va.id as application_id, va.status as app_status, va.submitted_at
           FROM vendors v
           LEFT JOIN vendor_identity vi ON v.phone = vi.phone
           LEFT JOIN vendor_onboarding_applications va ON vi.id = va.vendor_identity_id
           WHERE v.id = $1
           ORDER BY va.created_at DESC
           LIMIT 1`,
          [vendorId]
        );
        
        if (vendorRecord && vendorRecord.rows && vendorRecord.rows.length > 0) {
          const vendor = vendorRecord.rows[0];
          return c.json({
            success: true,
            application: {
              id: vendor.application_id || vendorId,
              status: vendor.app_status || vendor.onboarding_status || 'pending',
              submittedAt: vendor.submitted_at || vendor.created_at,
              fullName: vendor.owner_name || vendor.full_name,
              reviewedAt: vendor.reviewed_at,
              clarificationNotes: vendor.clarification_notes,
            },
            canProceedToSetup: vendor.app_status === 'approved' || vendor.onboarding_status === 'APPROVED',
          });
        }
        
        return c.json({ success: false, error: 'Application not found' }, 404);
      }
      
      const app = application.rows[0];
      return c.json({
        success: true,
        application: {
          id: app.id,
          status: app.status,
          submittedAt: app.submitted_at || app.created_at,
          fullName: app.form_data?.fullName || app.form_data?.ownerName || app.application_payload?.fullName || 'Vendor',
          reviewedAt: app.reviewed_at,
          clarificationNotes: app.clarification_notes || app.admin_comments,
        },
        canProceedToSetup: app.status === 'approved' || app.status === 'APPROVED',
      });
    } catch (error: any) {
      console.error('❌ [VENDOR-APPLICATION-STATUS] Error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}

function getSectionsFromFields(fields: any[]) {
  const sections: Record<string, any> = {};
  
  const sectionMeta: Record<string, any> = {
    'business_information': { title: 'Business Information', order: 1 },
    'location_information': { title: 'Location', order: 2 },
    'banking_information': { title: 'Banking Details', order: 3 },
    'document_verification': { title: 'Documents', order: 4 },
    'documents': { title: 'Documents', order: 4 },
    'additional_information': { title: 'Additional Info', order: 5 },
  };

  for (const field of fields) {
    const secKey = field.section || 'additional_information';
    if (!sections[secKey]) {
      sections[secKey] = {
        id: secKey,
        name: secKey,
        title: sectionMeta[secKey]?.title || formatTitle(secKey),
        order: sectionMeta[secKey]?.order || 99,
        isActive: true, // ✅ FIX: Frontend requires isActive for sections
        fields: [],
      };
    }
    // ✅ FIX: Ensure each field has isActive property set
    const fieldWithActive = { ...field, isActive: field.isActive !== false };
    sections[secKey].fields.push(fieldWithActive);
  }

  return Object.values(sections).sort((a: any, b: any) => a.order - b.order);
}

// ✅ NEW: KYC-aware section grouping (similar to admin endpoint)
function getSectionsFromFieldsWithKYC(fields: any[], kycSections?: any[]) {
  const sections: Record<string, any> = {};
  
  // Build section metadata from KYC sections
  const sectionMeta: Record<string, any> = {};
  
  if (kycSections && kycSections.length > 0) {
    kycSections.forEach((s: any) => {
      sectionMeta[s.id] = { 
        title: s.name, 
        order: s.order,
        description: s.description 
      };
    });
  }
  
  // Default sections for backward compatibility
  const defaultSections: Record<string, any> = {
    'business_information': { title: 'Business Information', order: 1 },
    'location_information': { title: 'Local Information', order: 2 },
    'identity_verification': { title: 'Identity Verification', order: 3 },
    'documents': { title: 'Documents', order: 4 },
    'professional': { title: 'Professional', order: 5 },
    'permissions': { title: 'Permissions', order: 6 },
    'declarations': { title: 'Declaration', order: 7 },
    'business_registration': { title: 'Professional', order: 5 },
    'banking_information': { title: 'Banking Details', order: 8 },
    'additional_information': { title: 'Additional Info', order: 9 },
  };
  
  // Merge: KYC sections take precedence
  Object.assign(sectionMeta, defaultSections);
  if (kycSections && kycSections.length > 0) {
    kycSections.forEach((s: any) => {
      sectionMeta[s.id] = { 
        title: s.name, 
        order: s.order,
        description: s.description 
      };
    });
  }

  // Group fields by section
  for (const field of fields) {
    const secKey = field.section || 'additional_information';
    if (!sections[secKey]) {
      sections[secKey] = {
        id: secKey,
        name: secKey,
        title: sectionMeta[secKey]?.title || formatTitle(secKey),
        order: sectionMeta[secKey]?.order || 99,
        description: sectionMeta[secKey]?.description || '',
        fields: [],
        isActive: true,
      };
    }
    sections[secKey].fields.push(field);
  }

  // Sort fields within each section by displayOrder
  Object.values(sections).forEach((section: any) => {
    section.fields.sort((a: any, b: any) => {
      const orderA = a.displayOrder || a.order || 0;
      const orderB = b.displayOrder || b.order || 0;
      return orderA - orderB;
    });
  });

  return Object.values(sections).sort((a: any, b: any) => a.order - b.order);
}

function formatTitle(str: string) {
  return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
