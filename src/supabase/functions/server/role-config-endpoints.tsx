import { Hono } from 'npm:hono@4';
import { getStandardFieldsForRole, INDIAN_BANKS } from './common-onboarding-fields.tsx';

export function roleConfigEndpoints(app: Hono, kvStore: any) {
  
  // Note: createClient not needed for role config endpoints
  // These endpoints only use KV store, not Supabase client

  // ============================================
  // CONFIGURATION ENDPOINTS
  // ============================================
  
  /**
   * Get Google Maps API Key
   * GET /make-server-3dd53475/config/google-maps-key
   */
  app.get("/make-server-3dd53475/config/google-maps-key", async (c) => {
    try {
      console.log('[CONFIG] Fetching Google Maps API key...');
      console.log('[CONFIG] Deno.env available:', typeof Deno !== 'undefined' && typeof Deno.env !== 'undefined');
      
      // ✅ FIX: Handle case where Deno.env might be undefined
      let apiKey: string | undefined;
      
      try {
        apiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY');
        console.log('[CONFIG] API key from Deno.env:', apiKey ? 'Found' : 'Not found');
      } catch (envError) {
        console.error('[CONFIG] Error accessing Deno.env:', envError);
      }
      
      // Fallback: Try direct environment variable access
      if (!apiKey && typeof process !== 'undefined' && process.env) {
        apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
        console.log('[CONFIG] API key from process.env:', apiKey ? 'Found' : 'Not found');
      }
      
      if (!apiKey) {
        console.error('[CONFIG] Google Maps API key not found in environment');
        console.error('[CONFIG] Please ensure VITE_GOOGLE_MAPS_API_KEY is set in Supabase secrets');
        return c.json({ 
          error: 'Google Maps API key not configured',
          hint: 'Please set VITE_GOOGLE_MAPS_API_KEY in Supabase project secrets'
        }, 500);
      }
      
      // ✅ VALIDATE: Ensure it's not a project number (all digits)
      if (/^\d+$/.test(apiKey)) {
        console.error('[CONFIG] ❌ Invalid API Key: Looks like a project number, not an API key');
        return c.json({ 
          error: 'Invalid API key: Please use a Google Maps API key (starts with AIza...), not a project number' 
        }, 500);
      }
      
      console.log('[CONFIG] ✅ Returning Google Maps API key (first 10 chars):', apiKey.substring(0, 10) + '...');
      return c.json({ apiKey });
    } catch (error) {
      console.error('[CONFIG] Error fetching Google Maps API key:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // ROLE CONFIGURATION ENDPOINTS
  // ============================================
  
  /**
   * Get all roles
   * GET /make-server-3dd53475/config/roles
   */
  app.get("/make-server-3dd53475/config/roles", async (c) => {
    try {
      const roles = await kvStore.getByPrefix('role:config:');
      
      // Sort by order
      roles.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      
      return c.json({ roles, total: roles.length });
    } catch (error) {
      console.error('Error fetching roles:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get single role
   * GET /make-server-3dd53475/config/roles/:roleId
   */
  app.get("/make-server-3dd53475/config/roles/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      const role = await kvStore.get(`role:config:${roleId}`);
      
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }
      
      return c.json({ role });
    } catch (error) {
      console.error('Error fetching role:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get allowed service styles for a vendor
   * GET /make-server-3dd53475/vendor/:vendorId/allowed-service-styles
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/allowed-service-styles", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log('📡 [ALLOWED-STYLES] Fetching allowed service styles for vendor:', vendorId);
      
      // Get vendor
      const vendor = await kvStore.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const roleId = vendor.roleId;
      console.log('📋 [ALLOWED-STYLES] Vendor roleId:', roleId);
      
      if (!roleId) {
        return c.json({ 
          error: 'Vendor has no roleId assigned',
          allowedStyles: []
        }, 400);
      }
      
      // Get role configuration
      const role = await kvStore.get(`role:config:${roleId}`);
      if (!role) {
        return c.json({ 
          error: 'Role configuration not found',
          allowedStyles: []
        }, 404);
      }
      
      console.log('✅ [ALLOWED-STYLES] Role found:', role.name, 'Styles:', role.serviceStyles);
      
      return c.json({
        success: true,
        vendorId,
        roleId,
        roleName: role.name,
        allowedStyles: role.serviceStyles || [],
        roleConfig: {
          id: role.id,
          name: role.name,
          description: role.description,
          icon: role.icon,
          features: role.features,
          capabilities: role.capabilities
        }
      });
    } catch (error) {
      console.error('❌ [ALLOWED-STYLES] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Create new role
   * POST /make-server-3dd53475/config/roles
   */
  app.post("/make-server-3dd53475/config/roles", async (c) => {
    try {
      const {
        name,
        description,
        icon,
        features,
        vendorTypes, // ['service_provider', 'healthcare_provider', 'seller']
        serviceStyles, // ['at_home', 'at_center', 'tele']
        pricingControl, // { canControlPrice: true, canControlDuration: true }
        onboardingFields, // { required: [], optional: [] }
        documentRequirements, // Array of required documents
        staffManagement, // { enabled: true, roles: ['doctor', 'nurse'] }
        multiService, // { enabled: true, allowedServices: [] }
        approvalWorkflow, // { requiresManualApproval: true, autoApproveAfterDays: null }
        capabilities, // ['chat', 'prescription', 'booking', 'catalog']
        order,
        isActive
      } = await c.req.json();

      // Validate required fields
      if (!name || !vendorTypes || vendorTypes.length === 0) {
        return c.json({ error: 'Missing required fields: name, vendorTypes' }, 400);
      }

      // Generate role ID
      const roleId = name.toLowerCase().replace(/\s+/g, '_');

      // Check if role already exists
      const existing = await kvStore.get(`role:config:${roleId}`);
      if (existing) {
        return c.json({ error: 'Role with this name already exists' }, 409);
      }

      const role = {
        id: roleId,
        name,
        description: description || '',
        icon: icon || '🔧',
        features: features || [],
        
        // Vendor Type Configuration
        vendorTypes: vendorTypes || [],
        
        // Service Style Configuration
        serviceStyles: serviceStyles || ['at_center'],
        
        // Pricing Controls
        pricingControl: pricingControl || {
          canControlPrice: false,
          canControlDuration: false,
          priceRangeMin: null,
          priceRangeMax: null
        },
        
        // Onboarding Configuration
        onboardingFields: onboardingFields || {
          required: ['businessName', 'ownerName', 'phone', 'email', 'address'],
          optional: [],
          custom: []
        },
        
        // Document Requirements
        documentRequirements: documentRequirements || [
          { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
          { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] }
        ],
        
        // Staff Management
        staffManagement: staffManagement || {
          enabled: false,
          roles: [],
          requiresStaffDocuments: false
        },
        
        // Multi-Service Support
        multiService: multiService || {
          enabled: false,
          allowedServices: [],
          requiresSeparateApproval: false
        },
        
        // Approval Workflow
        approvalWorkflow: approvalWorkflow || {
          requiresManualApproval: true,
          autoApproveAfterDays: null,
          requiresBackgroundCheck: false,
          requiresLicenseVerification: false
        },
        
        // Capabilities
        capabilities: capabilities || ['booking'],
        
        // Metadata
        order: order || 0,
        isActive: isActive !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kvStore.set(`role:config:${roleId}`, role);

      console.log(`✅ Role created: ${roleId}`);
      return c.json({ success: true, roleId, role });
    } catch (error) {
      console.error('Error creating role:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Update role
   * PUT /make-server-3dd53475/config/roles/:roleId
   */
  app.put("/make-server-3dd53475/config/roles/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      const updates = await c.req.json();

      const role = await kvStore.get(`role:config:${roleId}`);
      
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }

      // Update fields
      const updatedRole = {
        ...role,
        ...updates,
        id: roleId, // Ensure ID doesn't change
        updatedAt: new Date().toISOString()
      };

      await kvStore.set(`role:config:${roleId}`, updatedRole);

      console.log(`✅ Role updated: ${roleId}`);
      return c.json({ success: true, role: updatedRole });
    } catch (error) {
      console.error('Error updating role:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Delete role
   * DELETE /make-server-3dd53475/config/roles/:roleId
   */
  app.delete("/make-server-3dd53475/config/roles/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();

      const role = await kvStore.get(`role:config:${roleId}`);
      
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }

      // Check if any vendors are using this role
      const allVendors = await kvStore.getByPrefix('vendor:vendor_');
      const vendorsUsingRole = allVendors.filter((v: any) => v.role === roleId);

      if (vendorsUsingRole.length > 0) {
        return c.json({ 
          error: 'Cannot delete role with active vendors',
          vendorCount: vendorsUsingRole.length
        }, 400);
      }

      await kvStore.del(`role:config:${roleId}`);

      console.log(`🗑️ Role deleted: ${roleId}`);
      return c.json({ success: true });
    } catch (error) {
      console.error('Error deleting role:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // NOTE: Onboarding config endpoint moved to onboarding-config-endpoints.tsx to avoid duplication
  // The endpoint GET /make-server-3dd53475/config/onboarding/:roleId is now handled there

  /**
   * Seed initial roles (pre-configure existing vendor app roles)
   * POST /make-server-3dd53475/config/roles/seed
   */
  app.post("/make-server-3dd53475/config/roles/seed", async (c) => {
    try {
      const initialRoles = [
        // 1. VETERINARIAN - Healthcare Provider with full control
        {
          id: 'veterinarian',
          name: 'Veterinarian',
          description: 'Licensed veterinary doctors providing medical care for pets',
          icon: '🏥',
          features: [
            'Medical consultations',
            'Vaccinations & treatments',
            'Surgery & emergency care',
            'Health certificates',
            'Prescription management'
          ],
          vendorTypes: ['healthcare_provider'],
          serviceStyles: ['at_home', 'at_center', 'tele'],
          pricingControl: {
            canControlPrice: true,
            canControlDuration: true,
            priceRangeMin: 200,
            priceRangeMax: 5000
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address',
              'gstNumber',
              'licenseNumber',
              'experience'
            ],
            optional: ['website', 'emergencyContact'],
            custom: [
              { id: 'licenseNumber', label: 'Veterinary License Number', type: 'text' },
              { id: 'specialization', label: 'Specialization', type: 'select', options: ['General', 'Surgery', 'Dental', 'Ophthalmology'] }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] },
            { id: 'veterinary_license', name: 'Veterinary License', required: true, sides: ['front'] },
            { id: 'degree_certificate', name: 'Degree Certificate', required: true, sides: ['front'] },
            { id: 'gst_certificate', name: 'GST Certificate', required: true, sides: ['front'] }
          ],
          staffManagement: {
            enabled: true,
            roles: ['doctor', 'nurse', 'assistant'],
            requiresStaffDocuments: true
          },
          multiService: {
            enabled: true,
            allowedServices: ['grooming', 'pharmacy'],
            requiresSeparateApproval: true
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: true
          },
          capabilities: ['booking', 'tele', 'chat', 'prescription', 'medical_records', 'facility_management'],
          order: 1,
          isActive: true
        },

        // 1.5 PET CLINIC - Multi-doctor facility
        {
          id: 'pet_clinic',
          name: 'Pet Clinic',
          description: 'Veterinary clinic or hospital with multiple doctors and facilities',
          icon: '🏥',
          features: [
            'Multi-specialty care',
            'Surgery & diagnostics',
            'In-patient facilities',
            'Emergency services',
            'Pharmacy & lab'
          ],
          vendorTypes: ['healthcare_provider'],
          serviceStyles: ['at_center', 'tele', 'at_home'],
          pricingControl: {
            canControlPrice: true,
            canControlDuration: true,
            priceRangeMin: 200,
            priceRangeMax: 10000
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address',
              'gstNumber',
              'licenseNumber',
              'experience'
            ],
            optional: ['website', 'emergencyContact', 'facilities'],
            custom: [
              { id: 'licenseNumber', label: 'Clinic Registration Number', type: 'text' },
              { id: 'facilities', label: 'Facilities Available', type: 'multiselect', options: ['X-Ray', 'Ultrasound', 'Operation Theatre', 'In-patient Ward', 'Laboratory'] }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Owner Aadhar', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'Business PAN', required: true, sides: ['front'] },
            { id: 'clinic_registration', name: 'Clinic Registration', required: true, sides: ['front'] },
            { id: 'gst_certificate', name: 'GST Certificate', required: true, sides: ['front'] }
          ],
          staffManagement: {
            enabled: true,
            roles: ['doctor', 'nurse', 'admin', 'technician'],
            requiresStaffDocuments: true
          },
          multiService: {
            enabled: true,
            allowedServices: ['grooming', 'pharmacy', 'boarding'],
            requiresSeparateApproval: true
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: true
          },
          capabilities: ['booking', 'tele', 'chat', 'prescription', 'medical_records', 'facility_management', 'staff_management', 'inventory'],
          order: 1,
          isActive: true
        },

        // 2. PET GROOMER - Service Provider with center control
        {
          id: 'pet_groomer',
          name: 'Pet Groomer',
          description: 'Professional pet grooming services - bath, haircut, nail trimming',
          icon: '✂️',
          features: [
            'Bath & dry',
            'Haircut & styling',
            'Nail trimming',
            'Ear cleaning',
            'Teeth brushing'
          ],
          vendorTypes: ['service_provider'],
          serviceStyles: ['at_home', 'at_center'],
          pricingControl: {
            canControlPrice: true, // Only at center
            canControlDuration: true,
            priceRangeMin: 300,
            priceRangeMax: 3000,
            styleBasedControl: {
              at_home: { canControlPrice: false, canControlDuration: false },
              at_center: { canControlPrice: true, canControlDuration: true }
            }
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address',
              'experience'
            ],
            optional: ['website', 'instagram'],
            custom: [
              { id: 'certifications', label: 'Grooming Certifications', type: 'text' },
              { id: 'experience', label: 'Years of Experience', type: 'number' }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] },
            { id: 'police_verification', name: 'Police Verification', required: true, sides: ['front'], requiredFor: ['at_home'] },
            { id: 'shop_photos', name: 'Shop Photos', required: false, requiredFor: ['at_center'] }
          ],
          staffManagement: {
            enabled: true,
            roles: ['groomer', 'assistant'],
            requiresStaffDocuments: false
          },
          multiService: {
            enabled: false,
            allowedServices: [],
            requiresSeparateApproval: false
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: false
          },
          capabilities: ['booking', 'gallery', 'facility_management'],
          order: 2,
          isActive: true
        },

        // 3. PET TRAINER - Service Provider
        {
          id: 'pet_trainer',
          name: 'Pet Trainer',
          description: 'Professional pet training and behavior correction',
          icon: '🎓',
          features: [
            'Obedience training',
            'Behavior correction',
            'Agility training',
            'Puppy training',
            'Advanced training'
          ],
          vendorTypes: ['service_provider'],
          serviceStyles: ['at_home', 'at_center'],
          pricingControl: {
            canControlPrice: true,
            canControlDuration: true,
            priceRangeMin: 500,
            priceRangeMax: 5000
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address',
              'experience'
            ],
            optional: ['certifications', 'specialization'],
            custom: [
              { id: 'trainingMethods', label: 'Training Methods', type: 'multiselect', options: ['Positive Reinforcement', 'Clicker Training', 'Behavior Modification'] },
              { id: 'specialization', label: 'Specialization', type: 'select', options: ['Dogs', 'Cats', 'Birds', 'All'] }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] },
            { id: 'police_verification', name: 'Police Verification', required: true, sides: ['front'] },
            { id: 'certifications', name: 'Training Certifications', required: false, sides: ['front'] }
          ],
          staffManagement: {
            enabled: true,
            roles: ['trainer', 'assistant'],
            requiresStaffDocuments: false
          },
          multiService: {
            enabled: false,
            allowedServices: [],
            requiresSeparateApproval: false
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: false
          },
          capabilities: ['booking', 'progress_tracking', 'facility_management'],
          order: 3,
          isActive: true
        },

        // 4. PET WALKER - Service Provider (No pricing control)
        {
          id: 'pet_walker',
          name: 'Pet Walker',
          description: 'Daily pet walking and exercise services',
          icon: '🚶',
          features: [
            'Daily walks',
            'Exercise sessions',
            'GPS tracking',
            'Photo updates',
            'Multiple pets'
          ],
          vendorTypes: ['service_provider'],
          serviceStyles: ['at_home'],
          pricingControl: {
            canControlPrice: false, // Platform controls pricing
            canControlDuration: false,
            priceRangeMin: 100,
            priceRangeMax: 500,
            platformControlled: true
          },
          onboardingFields: {
            required: [
              'ownerName',
              'phone',
              'email',
              'address',
              'experience'
            ],
            optional: ['aboutMe'],
            custom: [
              { id: 'walkingRadius', label: 'Walking Radius (km)', type: 'number' },
              { id: 'maxPets', label: 'Max Pets per Walk', type: 'number' }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'police_verification', name: 'Police Verification', required: true, sides: ['front'] },
            { id: 'photo', name: 'Photo ID', required: true, sides: ['front'] }
          ],
          staffManagement: {
            enabled: false,
            roles: [],
            requiresStaffDocuments: false
          },
          multiService: {
            enabled: false,
            allowedServices: [],
            requiresSeparateApproval: false
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: false
          },
          capabilities: ['booking', 'gps_tracking', 'photo_updates'],
          order: 4,
          isActive: true
        },

        // 5. PET BOARDER - Service Provider (Center only)
        {
          id: 'pet_boarder',
          name: 'Pet Boarder',
          description: 'Pet boarding and daycare facilities',
          icon: '🏠',
          features: [
            'Overnight boarding',
            'Daycare services',
            'AC rooms',
            'Play areas',
            'CCTV monitoring'
          ],
          vendorTypes: ['service_provider'],
          serviceStyles: ['at_center'],
          pricingControl: {
            canControlPrice: true,
            canControlDuration: true,
            priceRangeMin: 300,
            priceRangeMax: 2000
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address',
              'gstNumber'
            ],
            optional: ['website', 'facilities'],
            custom: [
              { id: 'capacity', label: 'Total Capacity', type: 'number' },
              { id: 'facilities', label: 'Facilities', type: 'multiselect', options: ['AC Rooms', 'Play Area', 'CCTV', 'Vet on Call', 'Swimming Pool'] }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] },
            { id: 'gst_certificate', name: 'GST Certificate', required: true, sides: ['front'] },
            { id: 'facility_photos', name: 'Facility Photos', required: true, sides: ['front'] },
            { id: 'license', name: 'Business License', required: true, sides: ['front'] }
          ],
          staffManagement: {
            enabled: true,
            roles: ['caretaker', 'manager'],
            requiresStaffDocuments: false
          },
          multiService: {
            enabled: false,
            allowedServices: [],
            requiresSeparateApproval: false
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: true
          },
          capabilities: ['booking', 'cctv_access', 'photo_updates', 'facility_management'],
          order: 5,
          isActive: true
        },

        // 6. PET PHOTOGRAPHER - Service Provider
        {
          id: 'pet_photographer',
          name: 'Pet Photographer',
          description: 'Professional pet photography and videography',
          icon: '📸',
          features: [
            'Studio photography',
            'Outdoor shoots',
            'Event coverage',
            'Digital editing',
            'Printed albums'
          ],
          vendorTypes: ['service_provider'],
          serviceStyles: ['at_home', 'at_center'],
          pricingControl: {
            canControlPrice: true,
            canControlDuration: true,
            priceRangeMin: 1000,
            priceRangeMax: 10000
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address',
              'experience'
            ],
            optional: ['website', 'portfolio', 'instagram'],
            custom: [
              { id: 'portfolio', label: 'Portfolio Link', type: 'url' },
              { id: 'equipment', label: 'Equipment', type: 'text' }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] },
            { id: 'portfolio', name: 'Portfolio', required: true, sides: ['front'] }
          ],
          staffManagement: {
            enabled: false,
            roles: [],
            requiresStaffDocuments: false
          },
          multiService: {
            enabled: false,
            allowedServices: [],
            requiresSeparateApproval: false
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: false,
            requiresLicenseVerification: false
          },
          capabilities: ['booking', 'gallery', 'portfolio', 'facility_management'],
          order: 6,
          isActive: true
        },

        // 7. PET PHARMACY - Seller (Medicine seller)
        {
          id: 'pet_pharmacy',
          name: 'Pet Pharmacy',
          description: 'Licensed pet medicine and healthcare product seller',
          icon: '💊',
          features: [
            'Prescription medicines',
            'OTC products',
            'Supplements',
            'Medical devices',
            'Home delivery'
          ],
          vendorTypes: ['seller'],
          serviceStyles: ['at_center'], // Physical store
          pricingControl: {
            canControlPrice: true,
            canControlDuration: false,
            priceRangeMin: 10,
            priceRangeMax: 50000
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address',
              'gstNumber',
              'drugLicense'
            ],
            optional: ['website', 'deliveryRadius'],
            custom: [
              { id: 'drugLicense', label: 'Drug License Number', type: 'text' },
              { id: 'pharmacistName', label: 'Registered Pharmacist Name', type: 'text' },
              { id: 'deliveryRadius', label: 'Delivery Radius (km)', type: 'number' }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] },
            { id: 'gst_certificate', name: 'GST Certificate', required: true, sides: ['front'] },
            { id: 'drug_license', name: 'Drug License', required: true, sides: ['front'] },
            { id: 'shop_act', name: 'Shop Act License', required: true, sides: ['front'] }
          ],
          staffManagement: {
            enabled: true,
            roles: ['pharmacist', 'delivery_person'],
            requiresStaffDocuments: true
          },
          multiService: {
            enabled: false,
            allowedServices: [],
            requiresSeparateApproval: false
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: true
          },
          capabilities: ['catalog', 'inventory', 'orders', 'delivery', 'facility_management'],
          order: 7,
          isActive: true
        },

        // 8. PET CLINIC - Multi-Service (Healthcare + Grooming + Pharmacy)
        {
          id: 'pet_clinic',
          name: 'Pet Clinic',
          description: 'Comprehensive pet healthcare facility with multiple services',
          icon: '🏥',
          features: [
            'Veterinary services',
            'Grooming facility',
            'In-house pharmacy',
            'Surgery unit',
            'Emergency care'
          ],
          vendorTypes: ['healthcare_provider', 'service_provider', 'seller'],
          serviceStyles: ['at_center', 'at_home', 'tele'],
          pricingControl: {
            canControlPrice: true,
            canControlDuration: true,
            priceRangeMin: 200,
            priceRangeMax: 50000
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address',
              'gstNumber',
              'clinicLicense'
            ],
            optional: ['website', 'emergencyHotline'],
            custom: [
              { id: 'clinicLicense', label: 'Clinic License Number', type: 'text' },
              { id: 'services', label: 'Services Offered', type: 'multiselect', options: ['Veterinary', 'Grooming', 'Pharmacy', 'Boarding'] },
              { id: 'operatingHours', label: 'Operating Hours', type: 'text' }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] },
            { id: 'gst_certificate', name: 'GST Certificate', required: true, sides: ['front'] },
            { id: 'clinic_license', name: 'Clinic License', required: true, sides: ['front'] },
            { id: 'drug_license', name: 'Drug License', required: true, sides: ['front'], requiredFor: ['pharmacy'] },
            { id: 'facility_photos', name: 'Facility Photos', required: true, sides: ['front'] }
          ],
          staffManagement: {
            enabled: true,
            roles: ['doctor', 'nurse', 'groomer', 'pharmacist', 'receptionist'],
            requiresStaffDocuments: true
          },
          multiService: {
            enabled: true,
            allowedServices: ['veterinary', 'grooming', 'pharmacy', 'boarding'],
            requiresSeparateApproval: true
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: true
          },
          capabilities: ['booking', 'tele', 'chat', 'prescription', 'catalog', 'inventory', 'medical_records', 'emergency', 'facility_management'],
          order: 8,
          isActive: true
        },

        // 9. PET INSURANCE PROVIDER - Insurance & Financial Services
        {
          id: 'pet_insurance',
          name: 'Pet Insurance Provider',
          description: 'Licensed insurance providers offering pet health & life coverage plans',
          icon: '🛡️',
          features: [
            'Health insurance plans',
            'Accident coverage',
            'Third-party liability',
            'Claim processing',
            'Wellness packages'
          ],
          vendorTypes: ['insurance_provider'],
          serviceStyles: ['tele'], // Online/tele only
          pricingControl: {
            canControlPrice: true, // Can set premium amounts
            canControlDuration: true, // Can set coverage duration
            priceRangeMin: 500,
            priceRangeMax: 50000
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address',
              'gstNumber',
              'irdaiLicense',
              'companyRegistration'
            ],
            optional: ['website', 'claimHotline'],
            custom: [
              { id: 'irdaiLicense', label: 'IRDAI License Number', type: 'text' },
              { id: 'companyRegistration', label: 'Company Registration Number', type: 'text' },
              { id: 'claimTurnaroundTime', label: 'Claim Turnaround (days)', type: 'number' },
              { id: 'networkHospitals', label: 'Network Hospital Count', type: 'number' }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] },
            { id: 'gst_certificate', name: 'GST Certificate', required: true, sides: ['front'] },
            { id: 'irdai_license', name: 'IRDAI License', required: true, sides: ['front'] },
            { id: 'company_registration', name: 'Company Registration Certificate', required: true, sides: ['front'] },
            { id: 'insurance_sample_policy', name: 'Sample Policy Document', required: true, sides: ['front'] }
          ],
          staffManagement: {
            enabled: true,
            roles: ['claims_manager', 'underwriter', 'customer_support'],
            requiresStaffDocuments: false
          },
          multiService: {
            enabled: false,
            allowedServices: [],
            requiresSeparateApproval: false
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: true
          },
          capabilities: ['insurance_plans', 'claim_management', 'chat', 'documents', 'analytics'],
          order: 9,
          isActive: true
        },

        // 10. PET CAFE - Service Provider with reservation management
        {
          id: 'pet_cafe',
          name: 'Pet Cafe',
          description: 'Pet-friendly cafe with dining, playtime, and social experiences',
          icon: '☕',
          features: [
            'Table reservations',
            'Pet dining services',
            'Playtime sessions',
            'Birthday parties',
            'Social events'
          ],
          vendorTypes: ['service_provider'],
          serviceStyles: ['at_center'],
          pricingControl: {
            canControlPrice: true,
            canControlDuration: true,
            priceRangeMin: 200,
            priceRangeMax: 3000
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address',
              'fssaiLicense'
            ],
            optional: ['website', 'instagram', 'seatingCapacity'],
            custom: [
              { id: 'fssaiLicense', label: 'FSSAI License Number', type: 'text' },
              { id: 'seatingCapacity', label: 'Seating Capacity (Pax)', type: 'number' },
              { id: 'petCapacity', label: 'Max Pets at Once', type: 'number' }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] },
            { id: 'fssai_license', name: 'FSSAI License', required: true, sides: ['front'] },
            { id: 'fire_safety', name: 'Fire Safety Certificate', required: true, sides: ['front'] },
            { id: 'cafe_photos', name: 'Cafe Interior Photos', required: false, sides: ['front'] }
          ],
          staffManagement: {
            enabled: true,
            roles: ['manager', 'server', 'pet_handler'],
            requiresStaffDocuments: false
          },
          multiService: {
            enabled: true,
            allowedServices: ['grooming', 'daycare'],
            requiresSeparateApproval: false
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: true
          },
          capabilities: ['booking', 'reservation_management', 'menu', 'events', 'gallery', 'facility_management'],
          order: 10,
          isActive: true
        },

        // 11. SUNSET SERVICES - Compassionate end-of-life care provider
        {
          id: 'sunset_services',
          name: 'Pet Sunset Services',
          description: 'Compassionate end-of-life care, cremation, burial, and memorial services',
          icon: '💜',
          features: [
            'Pet cremation services',
            'Burial arrangements',
            'Memorial ceremonies',
            'Grief support',
            'Keepsake creation'
          ],
          vendorTypes: ['service_provider'],
          serviceStyles: ['at_center', 'at_home'],
          pricingControl: {
            canControlPrice: true,
            canControlDuration: true,
            priceRangeMin: 2000,
            priceRangeMax: 50000
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address',
              'crematoriumLicense'
            ],
            optional: ['website', 'emergencyContact', 'cemeteryAddress'],
            custom: [
              { id: 'crematoriumLicense', label: 'Crematorium License Number', type: 'text' },
              { id: 'cemeteryAddress', label: 'Cemetery Location (if applicable)', type: 'text' },
              { id: 'certifiedCounselor', label: 'Certified Grief Counselor on Staff', type: 'checkbox' }
            ]
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] },
            { id: 'crematorium_license', name: 'Crematorium License', required: true, sides: ['front'] },
            { id: 'pollution_clearance', name: 'Pollution Control Certificate', required: true, sides: ['front'] },
            { id: 'facility_photos', name: 'Facility Photos', required: false, sides: ['front'] }
          ],
          staffManagement: {
            enabled: true,
            roles: ['facility_manager', 'counselor', 'technician'],
            requiresStaffDocuments: true
          },
          multiService: {
            enabled: false,
            allowedServices: [],
            requiresSeparateApproval: false
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: true
          },
          capabilities: ['booking', 'grief_support', 'memorial_services', 'documents', 'chat', 'facility_management'],
          order: 11,
          isActive: true
        },

        // 12. GENERIC SERVICE PROVIDER - Fallback for unmapped vendor types
        {
          id: 'service-provider',
          name: 'Service Provider',
          description: 'Generic service provider role for all service types',
          icon: '🔧',
          features: [
            'Pet care services',
            'Flexible service delivery',
            'Custom service offerings'
          ],
          vendorTypes: ['service_provider'],
          serviceStyles: ['at_home', 'at_center', 'tele'],
          pricingControl: {
            canControlPrice: true,
            canControlDuration: true,
            priceRangeMin: 100,
            priceRangeMax: 10000,
            styleBasedControl: {
              at_home: { canControlPrice: false, canControlDuration: false },
              at_center: { canControlPrice: true, canControlDuration: true },
              tele: { canControlPrice: true, canControlDuration: true }
            }
          },
          onboardingFields: {
            required: [
              'businessName',
              'ownerName',
              'phone',
              'email',
              'address'
            ],
            optional: ['website', 'experience'],
            custom: []
          },
          documentRequirements: [
            { id: 'aadhar', name: 'Aadhar Card', required: true, sides: ['front', 'back'] },
            { id: 'pan', name: 'PAN Card', required: true, sides: ['front'] },
            { id: 'police_verification', name: 'Police Verification', required: true, sides: ['front'], requiredFor: ['at_home'] }
          ],
          staffManagement: {
            enabled: false,
            roles: [],
            requiresStaffDocuments: false
          },
          multiService: {
            enabled: true,
            allowedServices: [],
            requiresSeparateApproval: false
          },
          approvalWorkflow: {
            requiresManualApproval: true,
            autoApproveAfterDays: null,
            requiresBackgroundCheck: true,
            requiresLicenseVerification: false
          },
          capabilities: ['booking', 'catalog'],
          order: 12,
          isActive: true
        }
      ];

      let seededCount = 0;
      const results = [];

      for (const roleData of initialRoles) {
        const existing = await kvStore.get(`role:config:${roleData.id}`);
        
        if (existing) {
          console.log(`⏭️ Role already exists: ${roleData.id}`);
          results.push({ id: roleData.id, status: 'exists' });
          continue;
        }

        const role = {
          ...roleData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await kvStore.set(`role:config:${roleData.id}`, role);
        seededCount++;
        results.push({ id: roleData.id, status: 'created' });
        console.log(`✅ Seeded role: ${roleData.id}`);
      }

      return c.json({ 
        success: true, 
        seeded: seededCount,
        total: initialRoles.length,
        results
      });
    } catch (error) {
      console.error('Error seeding roles:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Role configuration endpoints registered');
}