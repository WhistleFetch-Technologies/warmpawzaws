// ============================================================================
// VENDOR ONBOARDING API ENDPOINTS
// ============================================================================
// Complete database-driven onboarding flow with state machine
// All state transitions are persisted, no UI-only flows
// ============================================================================

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler-enhanced';
import { select, insert, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// PHASE 1: AUTH & ENTRY
// ============================================================================

class GetOnboardingStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    console.log('[GetOnboardingStatusHandler] Handler called');
    console.log('[GetOnboardingStatusHandler] Phone from query params:', phone);
    console.log('[GetOnboardingStatusHandler] Request ID:', context.requestId);
    if (!phone) {
      return this.error('Phone number is required', 400);
    }

    try {
      //Normalize phone number (remove non-digits, handle country codes)
      // If phone has country code (11+ digits), take last 10 digits
      // If phone is 9 digits, pad with leading 0 to make it 10 digits (handles cases like "985342940" -> "0985342940")
      const phoneDigits = phone.replace(/\D/g, '');

      let normalizedPhone = phoneDigits.length > 10
        ? phoneDigits.slice(-10)
        : phoneDigits.length === 9
          ? '0' + phoneDigits
          : phoneDigits;

      //Check which columns exist in vendor_identity
      const viSchemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'user_type') as has_user_type,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'metadata') as has_metadata,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'full_name') as has_full_name
      `);
      const viSchema = viSchemaCheck.rows[0] || {};

      // Get or create vendor identity (try both original and normalized phone)
      let identity = await select('vendor_identity', { phone });
      if (identity.length === 0 && normalizedPhone !== phone) {
        identity = await select('vendor_identity', { phone: normalizedPhone });
      }

      // Create vendor identity if it doesn't exist
      if (identity.length === 0) {
        // Regular vendor - create with INIT status
        const insertFields = ['phone', 'onboarding_status'];
        const insertValues: any[] = [normalizedPhone, 'INIT'];

        if (viSchema.has_user_type) {
          insertFields.push('user_type');
          insertValues.push('vendor');
        }

        const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
        const insertQuery = `INSERT INTO vendor_identity (${insertFields.join(', ')}) VALUES (${placeholders}) RETURNING *`;

        const newIdentityResult = await query(insertQuery, insertValues);
        identity = newIdentityResult.rows;
      }

      const vendorIdentity = identity[0];

      // Get application if exists
      let application = null;
      if (vendorIdentity.application_id) {
        const apps = await select('vendor_onboarding_applications', {
          id: vendorIdentity.application_id,
        });
        application = apps.length > 0 ? apps[0] : null;
      }

      // Get role info if selected
      let role = null;
      if (vendorIdentity.selected_role_id) {
        const roles = await select('roles', {
          id: vendorIdentity.selected_role_id,
          is_active: true,
        });
        role = roles.length > 0 ? roles[0] : null;
      }

      // Extract clarification notes and rejection reason
      const clarificationNote = application?.admin_comments || application?.clarification_notes || null;
      const rejectionReason = application?.rejection_reason || null;
      const reviewedAt = application?.reviewed_at || null;
      const reviewedBy = application?.reviewed_by || null;

      return this.success({
        identity: vendorIdentity,
        application,
        role,
        nextStep: this.getNextStep(vendorIdentity.onboarding_status),
        feedback: {
          clarificationNote,
          rejectionReason,
          reviewedAt,
          reviewedBy,
          status: vendorIdentity.onboarding_status,
        },
      });
    } catch (error: any) {
      console.error('[GetOnboardingStatusHandler] Error caught in catch block');
      console.error('[GetOnboardingStatusHandler] Error message:', error?.message);
      console.error('[GetOnboardingStatusHandler] Error stack:', error?.stack);
      console.error('[GetOnboardingStatusHandler] Full error:', error);
      return this.error(error.message || 'Failed to get onboarding status', 500);
    }
  }

  private getNextStep(status: string): string {
    const stepMap: Record<string, string> = {
      INIT: '/onboarding/role-selection',
      ROLE_PENDING: '/onboarding/vendor-type',
      FORM_PENDING: '/onboarding/form',
      UNDER_REVIEW: '/onboarding/pending-review',
      CLARIFICATION_REQUIRED: '/onboarding/form', // ✅ FIX GAP VO-3: Go back to form for corrections
      APPROVED: '/onboarding/approved',
      REJECTED: '/onboarding/role-selection', // ✅ FIX: Go back to role selection after rejection
      ACTIVATED: '/dashboard',
    };
    return stepMap[status] || '/onboarding/role-selection';
  }
}

// ============================================================================
// PHASE 2: ROLE SELECTION (DYNAMIC)
// ============================================================================

class GetAvailableRolesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      // Get all active roles
      const roles = await select('roles', { is_active: true });

      // Get permissions for each role
      const rolesWithConfig = await Promise.all(
        roles.map(async (role) => {
          const permissions = await select('role_permissions', {
            role_id: role.id,
          });

          return {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            config: role.config || {},
            capabilities: permissions.map(p => p.permission_name),
            vendor_types_supported: role.config?.vendorTypes || ['solo', 'business'],
          };
        })
      );

      return this.success({ roles: rolesWithConfig });
    } catch (error: any) {
      console.error('Error getting roles:', error);
      return this.error(error.message || 'Failed to get roles', 500);
    }
  }
}

class SelectRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone, role_id } = body;

    if (!phone || !role_id) {
      return this.error('Phone and role_id are required', 400);
    }

    try {
      // Get vendor identity
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404);
      }

      const identity = identities[0];

      // Validate role exists and is active
      const roles = await select('roles', { id: role_id, is_active: true });
      if (roles.length === 0) {
        return this.error('Role not found or inactive', 404);
      }

      // Update identity with selected role
      await update(
        'vendor_identity',
        { id: identity.id },
        {
          selected_role_id: role_id,
          updated_at: new Date().toISOString(),
        }
      );

      // Transition to ROLE_PENDING if currently INIT
      if (identity.onboarding_status === 'INIT') {
        await query(
          `SELECT transition_onboarding_status($1, $2, NULL, 'system', 'role_selected', '{}'::jsonb)`,
          [identity.id, 'ROLE_PENDING']
        );
      }

      return this.success({
        message: 'Role selected successfully',
        nextStep: '/onboarding/vendor-type',
      });
    } catch (error: any) {
      console.error('Error selecting role:', error);
      return this.error(error.message || 'Failed to select role', 500);
    }
  }
}

// ============================================================================
// PHASE 3: VENDOR TYPE
// ============================================================================

class SelectVendorTypeHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone, vendor_type } = body;

    if (!phone || !vendor_type) {
      return this.error('Phone and vendor_type are required', 400);
    }

    if (!['solo', 'business'].includes(vendor_type)) {
      return this.error('Invalid vendor_type. Must be solo or business', 400);
    }

    try {
      // Get vendor identity
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404);
      }

      const identity = identities[0];

      if (!identity.selected_role_id) {
        return this.error('Role must be selected first', 400);
      }

      // Validate vendor_type is supported by role
      const roles = await select('roles', { id: identity.selected_role_id });
      if (roles.length === 0) {
        return this.error('Role not found', 404);
      }

      const role = roles[0];
      const supportedTypes = role.config?.vendorTypes || [];

      if (!supportedTypes.includes(vendor_type)) {
        return this.error(
          `Vendor type '${vendor_type}' is not supported for this role. Supported: ${supportedTypes.join(', ')}`,
          400
        );
      }

      // Update identity
      await update(
        'vendor_identity',
        { id: identity.id },
        {
          vendor_type,
          updated_at: new Date().toISOString(),
        }
      );

      // Transition to FORM_PENDING
      if (identity.onboarding_status === 'ROLE_PENDING') {
        await query(
          `SELECT transition_onboarding_status($1, $2, NULL, 'system', 'vendor_type_selected', '{}'::jsonb)`,
          [identity.id, 'FORM_PENDING']
        );
      }

      return this.success({
        message: 'Vendor type selected successfully',
        nextStep: '/onboarding/form',
      });
    } catch (error: any) {
      console.error('Error selecting vendor type:', error);
      return this.error(error.message || 'Failed to select vendor type', 500);
    }
  }
}

// ============================================================================
// PHASE 4: DYNAMIC ONBOARDING FORM
// ============================================================================

class GetOnboardingFormSchemaHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    const roleId = context.event.queryStringParameters?.roleId;

    if (!phone && !roleId) {
      return this.error('Phone number or roleId is required', 400);
    }

    try {
      let selectedRoleId = roleId;

      // If phone is provided, get role from vendor identity
      if (phone && !roleId) {
        const identities = await select('vendor_identity', { phone });
        if (identities.length === 0) {
          return this.error('Vendor identity not found', 404);
        }

        const identity = identities[0];

        if (!identity.selected_role_id) {
          return this.error('Role must be selected first. Please select a role.', 400);
        }

        selectedRoleId = identity.selected_role_id;
      }

      if (!selectedRoleId) {
        return this.error('Role ID is required', 400);
      }

      // Get onboarding form for this role using the new endpoint structure
      // This matches the reference implementation: /onboarding-form/:roleId
      const forms = await select('onboarding_forms', { role_id: selectedRoleId });
      let fields: any[] = [];

      if (forms.length > 0) {
        // Parse JSONB fields
        fields = typeof forms[0].fields === 'string'
          ? JSON.parse(forms[0].fields)
          : forms[0].fields || [];
      }

      // ✅ NEW: Inject role-specific fields (legacy)
      const roleSpecificFields = this.getRoleSpecificFields(selectedRoleId);
      fields = [...fields, ...roleSpecificFields];

      // ✅ NEW: Import and merge KYC fields for the role
      try {
        const { getKYCFieldsForRole, ROLE_KYC_CONFIGS, KYC_SECTIONS } = await import('../lib/kyc-form-fields');

        // Get vendor type from identity if available
        let vendorType: 'solo' | 'business' | undefined;
        if (phone) {
          const identities = await select('vendor_identity', { phone });
          if (identities.length > 0 && identities[0].vendor_type) {
            vendorType = identities[0].vendor_type;
          }
        }

        // Get KYC fields for this role
        const kycFields = getKYCFieldsForRole(selectedRoleId, vendorType);

        if (kycFields.length > 0) {
          console.log(`[FORM-SCHEMA] Adding ${kycFields.length} KYC fields for role ${selectedRoleId}`);

          // Convert KYC fields to form field format
          const kycFormFields = kycFields.map((f: any) => ({
            id: f.id,
            name: f.fieldName, // Frontend expects 'name'
            fieldName: f.fieldName,
            label: f.label,
            type: f.type, // Includes 'aadhaar-otp', 'pan-verify', 'gst-verify', 'declaration'
            section: f.section,
            required: f.isMandatory,
            isMandatory: f.isMandatory,
            requiresVerification: f.requiresVerification || false,
            verificationEndpoint: f.verificationEndpoint || null,
            placeholder: f.placeholder || '',
            helpText: f.helpText || '',
            options: f.options || [],
            validation: f.validation || {},
            displayOrder: f.displayOrder || 0,
            isActive: true,
            softBlock: f.softBlock || false,
            declarationText: f.declarationText || null,
            declarationType: f.declarationType || f.id, // Use explicit declarationType if set, otherwise fallback to id
          }));

          // Merge KYC fields - KYC fields replace existing fields with same ID
          const kycFieldIds = new Set(kycFormFields.map((f: any) => f.id));
          const nonKycFields = fields.filter((f: any) => !kycFieldIds.has(f.id) && !kycFieldIds.has(f.name));
          fields = [...nonKycFields, ...kycFormFields];
        }
      } catch (kycError) {
        console.error('[FORM-SCHEMA] Error loading KYC fields:', kycError);
        // Continue without KYC fields if import fails
      }

      // Filter active fields only
      const activeFields = fields.filter((f: any) => f.isActive !== false);

      // ✅ UPDATED: Section mapping with KYC sections
      const sections: Record<string, any> = {};
      const sectionMeta: Record<string, any> = {
        // KYC sections
        'basic': { title: 'Basic Information', order: 1 },
        'identity_verification': { title: 'Identity Verification', order: 2 },
        'professional': { title: 'Professional Details', order: 3 },
        'business_registration': { title: 'Business Registration', order: 4 },
        'documents': { title: 'Documents', order: 5 },
        'declarations': { title: 'Declarations & Consent', order: 6 },
        'location': { title: 'Location & Service Area', order: 7 },
        'banking': { title: 'Banking Details', order: 8 },
        // Legacy sections (for backward compatibility)
        'business_information': { title: 'Business Information', order: 1 },
        'location_information': { title: 'Location', order: 7 },
        'document_verification': { title: 'Documents', order: 5 },
        'additional_information': { title: 'Additional Info', order: 9 },
      };

      for (const field of activeFields) {
        const secKey = field.section || 'business_information';
        if (!sections[secKey]) {
          sections[secKey] = {
            id: secKey,
            name: secKey,
            title: sectionMeta[secKey]?.title || secKey.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            order: sectionMeta[secKey]?.order || 99,
            fields: [],
          };
        }
        sections[secKey].fields.push(field);
      }

      const sectionsArray = Object.values(sections).sort((a: any, b: any) => a.order - b.order);

      // Get role info
      const roles = await select('roles', { name: selectedRoleId });
      const role = roles.length > 0 ? roles[0] : null;

      // Get existing application if phone was provided
      let application = null;
      if (phone) {
        const identities = await select('vendor_identity', { phone });
        if (identities.length > 0 && identities[0].application_id) {
          const apps = await select('vendor_onboarding_applications', {
            id: identities[0].application_id,
          });
          application = apps.length > 0 ? apps[0] : null;
        }
      }

      return this.success({
        success: true,
        roleId: selectedRoleId,
        roleName: role?.display_name || role?.name || selectedRoleId,
        fields: activeFields,
        sections: sectionsArray,
        schema: {
          fields: activeFields,
          sections: sectionsArray,
        },
        existingApplication: application,
        canEdit: !application || application.status === 'DRAFT' || application.status === 'CLARIFICATION_REQUIRED',
        version: forms.length > 0 ? (forms[0].version || 1) : 1,
      });
    } catch (error: any) {
      console.error('Error getting form schema:', error);
      return this.error(error.message || 'Failed to get form schema', 500);
    }
  }

  /**
   * Get role-specific onboarding fields
   * Returns additional fields based on the vendor role
   */
  private getRoleSpecificFields(roleId: string): any[] {
    const normalizedRoleId = (roleId || '').toLowerCase().trim();
    const fields: any[] = [];

    // Walker-specific fields - Only fields actually used in operations
    if (normalizedRoleId === 'walker' || normalizedRoleId === 'pet_walker') {
      fields.push(
        {
          id: 'walker_gps_tracking',
          name: 'gpsTrackingEnabled',
          label: 'Enable GPS Tracking',
          type: 'checkbox',
          section: 'additional_information',
          helpText: 'Allow customers to track your location during active walks',
          validation: { required: true },
          defaultValue: true,
          order: 1,
          isActive: true,
        },
        {
          id: 'walker_background_check',
          name: 'backgroundCheck',
          label: 'Background Check Certificate',
          type: 'file',
          section: 'document_verification',
          helpText: 'Upload your background check certificate',
          acceptedFileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
          validation: { required: true },
          order: 2,
          isActive: true,
        },
        {
          id: 'walker_insurance',
          name: 'insuranceCertificate',
          label: 'Pet Care Insurance Certificate',
          type: 'file',
          section: 'document_verification',
          helpText: 'Upload your insurance certificate',
          acceptedFileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
          validation: { required: true },
          order: 3,
          isActive: true,
        },
        // Note: Emergency contact fields moved to vendor dashboard settings
      );
    }

    // Seller/E-commerce-specific fields - Only fields actually used in operations
    // Note: Delivery is handled by Warmpawz via Shiprocket/Nimbus Posts, so shipping radius not needed
    // Note: Return policy simplified - most products don't allow returns, delivery charges handled by platform
    if (normalizedRoleId === 'seller' || normalizedRoleId === 'pet_products_store' || normalizedRoleId === 'ecommerce') {
      fields.push(
        {
          id: 'seller_business_type',
          name: 'businessType',
          label: 'Business Type',
          type: 'select',
          section: 'business_information',
          helpText: 'Type of business you operate',
          options: [
            { value: 'individual', label: 'Individual seller' },
            { value: 'small_business', label: 'Small business' },
            { value: 'retail_store', label: 'Retail store' },
            { value: 'online_store', label: 'Online store' },
            { value: 'manufacturer', label: 'Manufacturer' },
          ],
          validation: { required: true },
          order: 2,
          isActive: true,
        },
        {
          id: 'seller_product_categories',
          name: 'productCategories',
          label: 'Product Categories You Sell',
          type: 'multiselect',
          section: 'business_information',
          helpText: 'Select all product categories you sell (minimum 1 required)',
          options: [
            { value: 'pet_food_treats', label: 'Pet Food & Treats' },
            { value: 'toys_accessories', label: 'Toys & Accessories' },
            { value: 'grooming_products', label: 'Grooming Products' },
            { value: 'health_wellness', label: 'Health & Wellness' },
            { value: 'beds_furniture', label: 'Beds & Furniture' },
            { value: 'leashes_collars', label: 'Leashes & Collars' },
            { value: 'training_equipment', label: 'Training Equipment' },
            { value: 'pet_clothing', label: 'Pet Clothing' },
            { value: 'crates_carriers', label: 'Crates & Carriers' },
            { value: 'litter_waste', label: 'Litter & Waste Management' },
            { value: 'aquarium_supplies', label: 'Aquarium Supplies' },
            { value: 'bird_supplies', label: 'Bird Supplies' },
            { value: 'small_animal_supplies', label: 'Small Animal Supplies' },
            { value: 'reptile_supplies', label: 'Reptile Supplies' },
          ],
          validation: { required: true },
          order: 3,
          isActive: true,
        },
        {
          id: 'seller_payment_methods',
          name: 'paymentMethods',
          label: 'Payment Methods Accepted',
          type: 'multiselect',
          section: 'business_information',
          helpText: 'Payment methods you accept (delivery charges handled by platform)',
          options: [
            { value: 'cod', label: 'Cash on delivery' },
            { value: 'card', label: 'Credit/Debit card' },
            { value: 'upi', label: 'UPI' },
            { value: 'netbanking', label: 'Net banking' },
            { value: 'wallet', label: 'Wallet' },
          ],
          validation: { required: true },
          defaultValue: ['upi', 'card'],
          order: 4,
          isActive: true,
        },
        {
          id: 'seller_gst_vat',
          name: 'gstVatNumber',
          label: 'GST/VAT Registration Number',
          type: 'text',
          section: 'business_information',
          helpText: 'Your tax registration number for e-commerce (if applicable)',
          validation: { required: false },
          order: 5,
          isActive: true,
        },
        {
          id: 'seller_product_catalog',
          name: 'productCatalog',
          label: 'Product Catalog (PDF or images)',
          type: 'file',
          section: 'document_verification',
          helpText: 'Upload a sample of your product catalog (PDF or ZIP for multiple images, max 10MB)',
          acceptedFileTypes: ['pdf', 'zip', 'jpg', 'jpeg', 'png'],
          validation: { required: true },
          order: 6,
          isActive: true,
        }
      );
    }

    return fields;
  }
}

class SubmitApplicationHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);

    // ✅ FIX: Handle both wrapped (application_payload) and unwrapped payload formats
    // Some frontends send: { phone, application_payload: {...}, uploaded_documents: [...] }
    // Others send: { phone, businessName, roleId, ... } (flat structure)
    let normalizedBody = body;

    if (!body.application_payload && body.businessName) {
      // Convert flat structure to expected format
      const { phone, uploaded_documents, specializations, agreedToTerms, ...restFields } = body;
      normalizedBody = {
        phone,
        application_payload: restFields,
        uploaded_documents: uploaded_documents || [],
      };
      console.log('📦 [SUBMIT] Normalized flat payload to wrapped format');
    }

    let { phone, application_payload, uploaded_documents } = normalizedBody;

    if (!phone || !application_payload) {
      return this.error('Phone and application_payload are required', 400);
    }

    // ✅ FIX: Validate and sanitize phone field
    if (typeof phone !== 'string') {
      return this.error('Phone must be a string', 400);
    }
    phone = phone.trim().replace(/\D/g, ''); // Remove non-digits
    if (phone.length !== 10) {
      return this.error('Phone must be a 10-digit number', 400);
    }

    // ✅ FIX: Validate application_payload is an object
    if (typeof application_payload !== 'object' || application_payload === null) {
      return this.error('application_payload must be a valid object', 400);
    }

    // ✅ FIX: Sanitize application_payload - remove invalid fields and values
    const invalidFieldPatterns = ['new_field', 'newfield', 'new-field'];
    const invalidValuePatterns = ['xxxxxxxx', 'placeholder'];

    const sanitizedPayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(application_payload)) {
      // Skip fields with placeholder names
      if (invalidFieldPatterns.some(pattern => key.toLowerCase().includes(pattern))) {
        console.warn(`[SubmitApplication] Skipping invalid field: ${key}`);
        continue;
      }
      // Skip boolean values for fields that should be strings (e.g., phone: true)
      if (key === 'phone' && typeof value === 'boolean') {
        console.warn(`[SubmitApplication] Skipping boolean phone field`);
        continue;
      }
      // Skip placeholder values
      if (typeof value === 'string' && invalidValuePatterns.some(pattern => value.toLowerCase().includes(pattern))) {
        console.warn(`[SubmitApplication] Skipping placeholder value for ${key}`);
        continue;
      }
      sanitizedPayload[key] = value;
    }
    application_payload = sanitizedPayload;

    // ✅ FIX: Sanitize uploaded_documents - filter out invalid entries
    if (uploaded_documents && Array.isArray(uploaded_documents)) {
      uploaded_documents = uploaded_documents.filter((doc: any) => {
        // Must have a type that isn't a placeholder
        if (!doc.type || invalidFieldPatterns.some(pattern => doc.type.toLowerCase().includes(pattern))) {
          console.warn(`[SubmitApplication] Skipping invalid document type: ${doc?.type}`);
          return false;
        }
        // Must have a valid URL
        if (!doc.url || typeof doc.url !== 'string' || doc.url.trim() === '') {
          console.warn(`[SubmitApplication] Skipping document without URL: ${doc?.type}`);
          return false;
        }
        return true;
      });
    } else {
      uploaded_documents = [];
    }

    try {
      // Get vendor identity
      let identities = await select('vendor_identity', { phone });

      // ✅ FIX: Auto-create vendor identity if not found
      if (identities.length === 0) {
        console.log('📦 [SUBMIT] Creating new vendor identity for phone:', phone);
        const newIdentity = await insert('vendor_identity', {
          phone,
          onboarding_status: 'FORM_PENDING',
          metadata: {},
        });
        identities = newIdentity;
      }

      let identity = identities[0];

      // ✅ FIX: Extract roleId and vendorType from payload or body if not in identity
      // Note: businessType (e.g., "veterinarian") is different from vendor_type (e.g., "solo" or "business")
      // vendor_type refers to whether the vendor is a solo provider or a business with staff
      const payloadRoleId = application_payload?.roleId || application_payload?.role_id || body.roleId || body.role_id;

      // Only use explicit vendor_type values, NOT businessType (which is the category like "veterinarian")
      let payloadVendorType = application_payload?.vendorType || application_payload?.vendor_type ||
        body.vendorType || body.vendor_type;

      // Validate vendor_type is a valid value, otherwise default to 'business'
      if (!payloadVendorType || !['solo', 'business', 'center'].includes(payloadVendorType)) {
        payloadVendorType = 'business';
      }

      // ✅ FIX: Auto-update vendor_identity with role and vendor_type from payload if missing
      if ((!identity.selected_role_id || !identity.vendor_type) && (payloadRoleId || payloadVendorType)) {
        console.log('📦 [SUBMIT] Auto-setting role and vendor_type from payload:', {
          payloadRoleId,
          payloadVendorType,
          currentRoleId: identity.selected_role_id,
          currentVendorType: identity.vendor_type
        });

        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (!identity.selected_role_id && payloadRoleId) {
          updateData.selected_role_id = payloadRoleId;
        }
        if (!identity.vendor_type && payloadVendorType) {
          updateData.vendor_type = payloadVendorType;
        }
        // Also update onboarding_status to FORM_PENDING if it's still INIT or ROLE_PENDING
        if (['INIT', 'ROLE_PENDING'].includes(identity.onboarding_status)) {
          updateData.onboarding_status = 'FORM_PENDING';
        }

        await update('vendor_identity', { id: identity.id }, updateData);

        // Refresh identity with updated values
        const refreshedIdentities = await select('vendor_identity', { id: identity.id });
        if (refreshedIdentities.length > 0) {
          identity = refreshedIdentities[0];
        }

        console.log('✅ [SUBMIT] Updated vendor_identity with role and vendor_type');
      }

      // Final check - if still no role or vendor_type, return error with helpful message
      if (!identity.selected_role_id && !payloadRoleId) {
        return this.error('Role ID is required. Please provide roleId in the payload or select a role first.', 400);
      }

      // Use payloadVendorType as fallback if identity.vendor_type is still not set
      const effectiveVendorType = identity.vendor_type || payloadVendorType || 'business';
      const effectiveRoleId = identity.selected_role_id || payloadRoleId;

      // Get form schema version
      const roles = await select('roles', { id: effectiveRoleId });
      const formVersion = roles[0]?.config?.onboardingFormSchema?.[effectiveVendorType]?.version || '1.0';

      // Check if application exists
      let applicationId = identity.application_id;

      if (applicationId) {
        const apps = await select('vendor_onboarding_applications', {
          id: applicationId,
        });

        if (apps.length > 0) {
          const app = apps[0];

          // ✅ FIX: Allow editing if DRAFT, CLARIFICATION_REQUIRED, or REJECTED (vendor can resubmit after rejection)
          if (app.status !== 'DRAFT' && app.status !== 'CLARIFICATION_REQUIRED' && app.status !== 'REJECTED') {
            return this.error('Application is locked and cannot be edited', 403);
          }

          // Update existing application
          await update(
            'vendor_onboarding_applications',
            { id: applicationId },
            {
              application_payload,
              uploaded_documents: uploaded_documents || app.uploaded_documents || [],
              form_version: formVersion,
              status: 'SUBMITTED',
              submitted_at: new Date().toISOString(),
              is_locked: true,
              locked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          );
        }
      } else {
        // Create new application
        const newApp = await insert('vendor_onboarding_applications', {
          vendor_identity_id: identity.id,
          role_id: effectiveRoleId,
          vendor_type: effectiveVendorType,
          application_payload,
          uploaded_documents: uploaded_documents || [],
          form_version: formVersion,
          status: 'SUBMITTED',
          submitted_at: new Date().toISOString(),
          is_locked: true,
          locked_at: new Date().toISOString(),
        });

        applicationId = newApp[0].id;

        // Link application to identity
        await update(
          'vendor_identity',
          { id: identity.id },
          { application_id: applicationId }
        );
      }

      // Transition to UNDER_REVIEW
      if (identity.onboarding_status === 'FORM_PENDING' || identity.onboarding_status === 'CLARIFICATION_REQUIRED') {
        await query(
          `SELECT transition_onboarding_status($1, $2, NULL, 'vendor', 'application_submitted', '{}'::jsonb)`,
          [identity.id, 'UNDER_REVIEW']
        );
      }

      return this.success({
        message: 'Application submitted successfully',
        applicationId,
        nextStep: '/onboarding/pending-review',
      });
    } catch (error: any) {
      console.error('Error submitting application:', error);
      // ✅ FIX: Ensure error message is always a string
      const errorMessage = typeof error?.message === 'string'
        ? error.message
        : (typeof error === 'string' ? error : 'Failed to submit application');
      return this.error(errorMessage, 500);
    }
  }
}

// ============================================================================
// PHASE 6: ADMIN DECISION FLOW
// ============================================================================

class AdminReviewApplicationHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const applicationId = context.event.pathParameters?.applicationId;
    const body = this.parseBody(context.event);
    const { action, admin_id, comments, rejection_reason } = body;

    if (!applicationId || !action || !admin_id) {
      return this.error('applicationId, action, and admin_id are required', 400);
    }

    if (!['APPROVE', 'REQUEST_CLARIFICATION', 'REJECT'].includes(action)) {
      return this.error('Invalid action. Must be APPROVE, REQUEST_CLARIFICATION, or REJECT', 400);
    }

    try {
      // Get application
      const apps = await select('vendor_onboarding_applications', {
        id: applicationId,
      });

      if (apps.length === 0) {
        return this.error('Application not found', 404);
      }

      const application = apps[0];

      if (application.status !== 'UNDER_REVIEW') {
        return this.error('Application is not in UNDER_REVIEW status', 400);
      }

      // Get vendor identity
      const identities = await select('vendor_identity', {
        id: application.vendor_identity_id,
      });

      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404);
      }

      const identity = identities[0];

      // Update application based on action
      let newStatus: string;
      let newOnboardingStatus: string;

      if (action === 'APPROVE') {
        newStatus = 'APPROVED';
        newOnboardingStatus = 'APPROVED';

        await update(
          'vendor_onboarding_applications',
          { id: applicationId },
          {
            status: newStatus,
            reviewed_by: admin_id,
            reviewed_at: new Date().toISOString(),
            admin_comments: comments || null,
            updated_at: new Date().toISOString(),
          }
        );
      } else if (action === 'REQUEST_CLARIFICATION') {
        if (!comments) {
          return this.error('Comments are required for clarification request', 400);
        }

        newStatus = 'CLARIFICATION_REQUIRED';
        newOnboardingStatus = 'CLARIFICATION_REQUIRED';

        // Unlock application for editing
        await update(
          'vendor_onboarding_applications',
          { id: applicationId },
          {
            status: newStatus,
            reviewed_by: admin_id,
            reviewed_at: new Date().toISOString(),
            admin_comments: comments,
            is_locked: false,
            locked_at: null,
            updated_at: new Date().toISOString(),
          }
        );
      } else { // REJECT
        if (!rejection_reason) {
          return this.error('Rejection reason is required', 400);
        }

        newStatus = 'REJECTED';
        newOnboardingStatus = 'REJECTED';

        // ✅ FIX: Unlock application when rejected so vendor can resubmit
        await update(
          'vendor_onboarding_applications',
          { id: applicationId },
          {
            status: newStatus,
            reviewed_by: admin_id,
            reviewed_at: new Date().toISOString(),
            rejection_reason,
            admin_comments: comments || null,
            is_locked: false,
            locked_at: null,
            updated_at: new Date().toISOString(),
          }
        );
      }

      // Transition onboarding status
      await query(
        `SELECT transition_onboarding_status($1, $2, $3, 'admin', $4, $5::jsonb)`,
        [
          identity.id,
          newOnboardingStatus,
          admin_id,
          action.toLowerCase(),
          JSON.stringify({ comments, rejection_reason }),
        ]
      );

      // ✅ FIX GAP VO-1, VO-2, GN-1: Send push notification to vendor
      try {
        const { pushNotificationService } = await import('../aws/aws-sns-notification-service');

        if (action === 'APPROVE') {
          await pushNotificationService.sendEventNotification({
            eventType: 'vendor_application_approved',
            recipientId: identity.id,
            recipientType: 'vendor',
            relatedId: applicationId,
            data: { applicationId },
          });
        } else if (action === 'REQUEST_CLARIFICATION') {
          await pushNotificationService.sendEventNotification({
            eventType: 'vendor_application_clarification',
            recipientId: identity.id,
            recipientType: 'vendor',
            relatedId: applicationId,
            data: {
              applicationId,
              comment: comments,
            },
          });
        } else if (action === 'REJECT') {
          await pushNotificationService.sendEventNotification({
            eventType: 'vendor_application_rejected',
            recipientId: identity.id,
            recipientType: 'vendor',
            relatedId: applicationId,
            data: {
              applicationId,
              reason: rejection_reason,
            },
          });
        }
      } catch (notifError) {
        console.warn('Failed to send notification:', notifError);
        // Don't fail the whole operation for notification failure
      }

      // ✅ SMS is the standard notification for all vendor onboarding activities
      const vendorPhone = identity.phone || identity.phone_number;
      let notificationTitle = '';
      let notificationMessage = '';
      if (action === 'APPROVE') {
        notificationTitle = 'Application Approved';
        notificationMessage = 'Your WARMPAWS provider application has been approved. You can now access your dashboard.';
      } else if (action === 'REQUEST_CLARIFICATION') {
        notificationTitle = 'More Information Required';
        notificationMessage = `We need additional information: ${(comments || '').slice(0, 120)}${(comments || '').length > 120 ? '...' : ''}. Please log in and update your application.`;
      } else if (action === 'REJECT') {
        notificationTitle = 'Application Rejected';
        notificationMessage = `Your application was not approved. Reason: ${(rejection_reason || '').slice(0, 100)}${(rejection_reason || '').length > 100 ? '...' : ''}. Log in to see details or resubmit.`;
      }

      try {
        await insert('notifications', {
          recipient_id: identity.id,
          recipient_type: 'vendor',
          notification_type: action === 'APPROVE' ? 'vendor_approved' : action === 'REQUEST_CLARIFICATION' ? 'vendor_clarification_requested' : 'vendor_rejected',
          title: notificationTitle,
          message: notificationMessage,
          channels: { email: false, sms: true, inApp: true, push: false },
          is_read: false,
        });
      } catch (insertErr: any) {
        console.warn('Failed to insert onboarding notification:', insertErr?.message);
      }

      if (vendorPhone && notificationMessage) {
        try {
          const { sendSMS } = await import('../lib/services/sms-service');
          await sendSMS(vendorPhone, `${notificationTitle}. ${notificationMessage}`);
        } catch (smsErr: any) {
          console.warn('Failed to send onboarding SMS:', smsErr?.message);
        }
      }

      return this.success({
        message: `Application ${action.toLowerCase()}d successfully`,
        status: newStatus,
        // ✅ Include feedback in response for immediate UI update
        feedback: action === 'APPROVE' ? null : {
          clarificationNote: action === 'REQUEST_CLARIFICATION' ? comments : null,
          rejectionReason: action === 'REJECT' ? rejection_reason : null,
        },
      });
    } catch (error: any) {
      console.error('Error reviewing application:', error);
      return this.error(error.message || 'Failed to review application', 500);
    }
  }
}

// ============================================================================
// PHASE 7: GET STARTED → ACTIVATION
// ============================================================================

class ActivateVendorHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone } = body;

    if (!phone) {
      return this.error('Phone number is required', 400);
    }

    try {
      // Get vendor identity
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404);
      }

      const identity = identities[0];

      if (identity.onboarding_status !== 'APPROVED') {
        return this.error('Vendor must be approved before activation', 400);
      }

      // Get application
      if (!identity.application_id) {
        return this.error('Application not found', 404);
      }

      const apps = await select('vendor_onboarding_applications', {
        id: identity.application_id,
      });

      if (apps.length === 0) {
        return this.error('Application not found', 404);
      }

      const application = apps[0];

      // ✅ FIX: Extract profile photo, pincode, and service_radius from application (PROD FIX)
      const { extractProfilePhotoFromApplication, extractPincodeFromPayload } = await import('../utils/extract-profile-photo');
      const payload = application.application_payload || {};
      const profilePhotoUrl = extractProfilePhotoFromApplication(application, payload);
      const pincodeValue = extractPincodeFromPayload(payload);

      // ✅ FIX: Extract service_radius from payload
      let serviceRadius: number | null = null;
      const radiusFields = ['service_radius', 'serviceRadius', 'serviceRadiusKm', 'radius', 'radiusKm', 'service_radius_km'];
      for (const field of radiusFields) {
        if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
          const radiusValue = typeof payload[field] === 'string' ? parseFloat(payload[field]) : Number(payload[field]);
          if (!isNaN(radiusValue) && radiusValue > 0) {
            serviceRadius = radiusValue;
            break;
          }
        }
      }

      // Create vendor record from application
      const vendorData = {
        phone: identity.phone,
        email: payload.email || identity.email || '',
        business_name: payload.businessName || '',
        owner_name: payload.ownerName || '',
        role_id: application.role_id,
        vendor_type: application.vendor_type,
        vendor_identity_id: identity.id,
        onboarding_status: 'ACTIVATED',
        status: 'active',
        address: payload.address || '',
        city: payload.city || '',
        state: payload.state || '',
        pincode: pincodeValue, // ✅ FIX: Use enhanced pincode extraction (PROD FIX)
        profile_photo_url: profilePhotoUrl, // ✅ FIX: Save profile photo from onboarding (PROD FIX)
        service_radius: serviceRadius, // ✅ FIX: Save service_radius from onboarding (PROD FIX)
        ...payload, // Include all other fields
      };

      const vendors = await insert('vendors', vendorData);
      const vendor = vendors[0];

      // Create setup completion record
      await insert('vendor_setup_completion', {
        vendor_id: vendor.id,
        profile_completed: false,
        bank_account_completed: false,
        business_hours_completed: false,
        staff_management_completed: false,
        services_configured: false,
        is_go_live_ready: false,
      });

      // Transition to ACTIVATED
      await query(
        `SELECT transition_onboarding_status($1, $2, NULL, 'vendor', 'vendor_activated', $3::jsonb)`,
        [identity.id, 'ACTIVATED', JSON.stringify({ vendor_id: vendor.id })]
      );

      return this.success({
        message: 'Vendor activated successfully',
        vendor_id: vendor.id,
        nextStep: '/dashboard',
      });
    } catch (error: any) {
      console.error('Error activating vendor:', error);
      return this.error(error.message || 'Failed to activate vendor', 500);
    }
  }
}

// ============================================================================
// PHASE 8: POST-ACTIVATION SETUP
// ============================================================================

class UpdateSetupCompletionHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { vendor_id, step, completed } = body;

    if (!vendor_id || !step || typeof completed !== 'boolean') {
      return this.error('vendor_id, step, and completed are required', 400);
    }

    const validSteps = [
      'profile',
      'bank_account',
      'business_hours',
      'staff_management',
      'services',
    ];

    if (!validSteps.includes(step)) {
      return this.error(`Invalid step. Must be one of: ${validSteps.join(', ')}`, 400);
    }

    try {
      // Get or create setup completion record
      let setup = await select('vendor_setup_completion', { vendor_id });

      if (setup.length === 0) {
        const newSetup = await insert('vendor_setup_completion', {
          vendor_id,
          profile_completed: false,
          bank_account_completed: false,
          business_hours_completed: false,
          staff_management_completed: false,
          services_configured: false,
          is_go_live_ready: false,
        });
        setup = newSetup;
      }

      const setupRecord = setup[0];

      // Update step completion
      const stepField = `${step}_completed` as keyof typeof setupRecord;
      const stepAtField = `${step}_completed_at` as keyof typeof setupRecord;

      const updateData: any = {
        [stepField]: completed,
        updated_at: new Date().toISOString(),
      };

      if (completed) {
        updateData[stepAtField] = new Date().toISOString();
      } else {
        updateData[stepAtField] = null;
      }

      await update('vendor_setup_completion', { vendor_id }, updateData);

      // Check if all required steps are completed
      const updatedSetup = await select('vendor_setup_completion', { vendor_id });
      const updated = updatedSetup[0];

      const allRequired =
        updated.profile_completed &&
        updated.bank_account_completed &&
        updated.business_hours_completed &&
        updated.services_configured;

      if (allRequired && !updated.is_go_live_ready) {
        await update(
          'vendor_setup_completion',
          { vendor_id },
          {
            is_go_live_ready: true,
            go_live_ready_at: new Date().toISOString(),
          }
        );
      } else if (!allRequired && updated.is_go_live_ready) {
        await update(
          'vendor_setup_completion',
          { vendor_id },
          {
            is_go_live_ready: false,
            go_live_ready_at: null,
          }
        );
      }

      return this.success({
        message: 'Setup completion updated',
        is_go_live_ready: allRequired,
      });
    } catch (error: any) {
      console.error('Error updating setup completion:', error);
      return this.error(error.message || 'Failed to update setup completion', 500);
    }
  }
}

class GoLiveHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { vendor_id } = body;

    if (!vendor_id) {
      return this.error('vendor_id is required', 400);
    }

    try {
      // Check if go-live ready
      const readyResult = await query(
        `SELECT is_vendor_go_live_ready($1) as ready`,
        [vendor_id]
      );

      if (!readyResult.rows[0]?.ready) {
        return this.error('Vendor is not ready for go-live. Complete all required setup steps.', 400);
      }

      // Update setup completion
      await update(
        'vendor_setup_completion',
        { vendor_id },
        {
          go_live_at: new Date().toISOString(),
        }
      );

      // Update vendor status
      await update(
        'vendors',
        { id: vendor_id },
        {
          is_active: true,
          status: 'active',
        }
      );

      // Sync services to customer app (service catalog, discovery filters, etc.)
      try {
        const { queueSearchIndexUpdate } = require('../utils/aws-clients');

        // Get vendor info for name
        const vendors = await select('vendors', { id: vendor_id });
        const vendorInfo = vendors[0] || {};

        // Get all vendor services
        const vendorServices = await select('vendor_services', {
          vendor_id: vendor_id,
          is_active: true,
        });

        // Queue search index updates for each service
        for (const service of vendorServices) {
          await queueSearchIndexUpdate('service', 'update', service.id, {
            vendor_id: vendor_id,
            vendor_name: vendorInfo.business_name,
            is_active: true,
          });
        }

        // Queue vendor index update
        await queueSearchIndexUpdate('vendor', 'update', vendor_id, {
          is_active: true,
          status: 'active',
        });

        console.log(`✅ Services synced to search index for vendor ${vendor_id}`);
      } catch (error: any) {
        console.warn('Failed to sync services to search index:', error);
        // Don't fail the go-live process if sync fails
      }

      return this.success({
        message: 'Vendor is now live!',
        go_live_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error going live:', error);
      return this.error(error.message || 'Failed to go live', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

// Helper to create a handler context from Hono context
function createHandlerContext(c: any): HandlerContext {
  const requestId = c.req.header('x-request-id') || randomUUID();
  return {
    event: {
      pathParameters: c.req.param ? Object.fromEntries(Object.entries(c.req.param())) : {},
      queryStringParameters: Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams),
      body: null, // Will be parsed by handler
      headers: Object.fromEntries([...c.req.raw.headers.entries()]),
      requestContext: { requestId } as any,
    } as any,
    context: {
      awsRequestId: requestId,
      functionName: 'hono-handler',
      functionVersion: '1.0',
      invokedFunctionArn: 'arn:aws:lambda:local:000000000000:function:hono-handler',
      memoryLimitInMB: '512',
      logGroupName: '/aws/lambda/hono-handler',
      logStreamName: 'local',
      getRemainingTimeInMillis: () => 30000,
      callbackWaitsForEmptyEventLoop: true,
      done: () => { },
      fail: () => { },
      succeed: () => { },
    } as any,
    requestId,
  };
}

// Helper to convert HandlerResponse to Hono response
async function toHonoResponse(c: any, handler: BaseHandler, context: HandlerContext): Promise<Response> {
  // Store body for parseBody
  try {
    const rawBody = await c.req.text();
    if (rawBody) {
      context.event.body = rawBody;
    }
  } catch (e) {
    // No body
  }

  const result = await handler.handle(context);
  return c.json(JSON.parse(result.body), result.statusCode as 200 | 400 | 404 | 500);
}

export function registerVendorOnboardingEndpoints(app: Hono) {
  // Phase 1: Auth & Entry
  app.get('/vendor/onboarding/status', async (c) => {
    const phone = c.req.query('phone');
    console.log('[ENDPOINT] /vendor/onboarding/status called');
    console.log('[ENDPOINT] Phone parameter:', phone);
    console.log('[ENDPOINT] Request URL:', c.req.url);
    console.log('[ENDPOINT] Request method:', c.req.method);
    return toHonoResponse(c, new GetOnboardingStatusHandler(), createHandlerContext(c));
  });

  // Phase 2: Role Selection
  app.get('/vendor/onboarding/roles', async (c) => {
    return toHonoResponse(c, new GetAvailableRolesHandler(), createHandlerContext(c));
  });
  app.post('/vendor/onboarding/select-role', async (c) => {
    return toHonoResponse(c, new SelectRoleHandler(), createHandlerContext(c));
  });

  // Phase 3: Vendor Type
  app.post('/vendor/onboarding/select-vendor-type', async (c) => {
    return toHonoResponse(c, new SelectVendorTypeHandler(), createHandlerContext(c));
  });

  // Phase 4: Dynamic Form
  app.get('/vendor/onboarding/form-schema', async (c) => {
    return toHonoResponse(c, new GetOnboardingFormSchemaHandler(), createHandlerContext(c));
  });
  app.post('/vendor/onboarding/submit-application', async (c) => {
    return toHonoResponse(c, new SubmitApplicationHandler(), createHandlerContext(c));
  });

  // ✅ FIX: Add /vendor/application/status/:vendorId endpoint (used by VendorApplicationStatus.tsx)
  app.get('/vendor/application/status/:vendorId', async (c) => {
    const vendorId = c.req.param('vendorId');
    console.log('📋 [VENDOR-APPLICATION-STATUS] Getting status for vendorId:', vendorId);

    try {
      // First try to find by application ID
      let application = await query(
        `SELECT va.*, vi.phone, vi.vendor_id, vi.current_role_id, r.name as role_name
         FROM vendor_onboarding_applications va
         LEFT JOIN vendor_identity vi ON va.vendor_identity_id = vi.id
         LEFT JOIN roles r ON vi.current_role_id = r.id
         WHERE va.id = $1 OR va.vendor_identity_id = $1 OR vi.vendor_id = $1
         ORDER BY va.created_at DESC
         LIMIT 1`,
        [vendorId]
      );

      if (!application || application.rows.length === 0) {
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

        if (vendorRecord && vendorRecord.rows.length > 0) {
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
      const isReEditable = ['REJECTED', 'CLARIFICATION_REQUIRED'].includes(String(app.status));
      const payload = app.application_payload || app.form_data || null;
      return c.json({
        success: true,
        application: {
          id: app.id,
          status: app.status,
          submittedAt: app.submitted_at || app.created_at,
          fullName: app.form_data?.fullName || app.form_data?.ownerName || 'Vendor',
          reviewedAt: app.reviewed_at,
          clarificationNotes: app.clarification_notes || app.admin_comments,
          ...(isReEditable && payload ? { form_data: payload, application_payload: payload } : {}),
        },
        canProceedToSetup: app.status === 'approved' || app.status === 'APPROVED',
      });
    } catch (error: any) {
      console.error('❌ [VENDOR-APPLICATION-STATUS] Error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Phase 6: Admin Review
  app.post('/admin/vendor/onboarding/:applicationId/review', async (c) => {
    return toHonoResponse(c, new AdminReviewApplicationHandler(), createHandlerContext(c));
  });

  // Phase 7: Activation
  app.post('/vendor/onboarding/activate', async (c) => {
    return toHonoResponse(c, new ActivateVendorHandler(), createHandlerContext(c));
  });

  // Phase 8: Post-Activation Setup
  app.post('/vendor/setup/update-completion', async (c) => {
    return toHonoResponse(c, new UpdateSetupCompletionHandler(), createHandlerContext(c));
  });

  app.post('/vendor/setup/go-live', async (c) => {
    return toHonoResponse(c, new GoLiveHandler(), createHandlerContext(c));
  });
}
