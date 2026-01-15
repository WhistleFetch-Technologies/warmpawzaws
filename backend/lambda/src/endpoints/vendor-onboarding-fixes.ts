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
import { query, select, insert, update } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

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
      
      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      // Get vendor identity
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return c.json({ error: 'Vendor identity not found' }, 404);
      }

      const identity = identities[0];

      if (!identity.selected_role_id || !identity.vendor_type) {
        return c.json({ error: 'Role and vendor type must be selected first' }, 400);
      }

      // Get role information
      const roles = await select('roles', { id: identity.selected_role_id });
      if (roles.length === 0) {
        return c.json({ error: 'Role not found' }, 404);
      }
      
      const role = roles[0];
      const roleName = role.name;
      
      console.log(`📋 [FORM SCHEMA] Looking for form for role: ${roleName} (UUID: ${identity.selected_role_id})`);
      
      // Try to get form from onboarding_forms table
      const formsResult = await query(
        `SELECT * FROM onboarding_forms WHERE role_id = $1 OR role_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [roleName, identity.selected_role_id]
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
            [roleName, identity.vendor_type || 'center', JSON.stringify(DEFAULT_FORM_FIELDS)]
          );
          console.log(`✅ [FORM SCHEMA] Created default form for role ${roleName}`);
        } catch (insertError) {
          console.error(`❌ [FORM SCHEMA] Failed to create default form:`, insertError);
        }
      }

      // Filter active fields only
      const activeFields = fields.filter((f: any) => f.isActive !== false);

      if (activeFields.length === 0) {
        console.error(`❌ [FORM SCHEMA] No active fields found, returning default fields`);
        return c.json({
          success: true,
          roleId: identity.selected_role_id,
          roleName: roleName,
          fields: DEFAULT_FORM_FIELDS,
          sections: getSectionsFromFields(DEFAULT_FORM_FIELDS),
          schema: {
            fields: DEFAULT_FORM_FIELDS,
            sections: getSectionsFromFields(DEFAULT_FORM_FIELDS),
          },
        });
      }

      // Group fields by section
      const sections = getSectionsFromFields(activeFields);

      console.log(`✅ [FORM SCHEMA] Returning ${activeFields.length} fields in ${sections.length} sections`);

      return c.json({
        success: true,
        roleId: identity.selected_role_id,
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
      
      // Query vendor_onboarding_applications with JOIN to vendor_identity
      const applicationsResult = await query(`
        SELECT 
          voa.id as application_id,
          voa.vendor_identity_id,
          voa.status,
          voa.application_payload,
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
          fullName: payload.fullName || payload.businessName || 'N/A',
          businessName: payload.businessName || payload.fullName || 'N/A',
          phone: row.phone || payload.phone || 'N/A',
          email: payload.email || 'N/A',
          address: payload.address || 'N/A',
          city: payload.city || 'N/A',
          category: row.role_display_name || row.role_name || 'N/A',
          roleName: row.role_name,
          experience: payload.experience || '0',
          status: 'pending_approval',
          submittedAt: row.submitted_at || row.created_at,
          vendorType: row.vendor_type,
          priority: 'medium',
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

function formatTitle(str: string) {
  return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
