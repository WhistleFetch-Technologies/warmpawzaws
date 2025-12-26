import { Hono } from 'npm:hono@4';
import { getStandardFieldsForRole, INDIAN_BANKS } from './common-onboarding-fields.tsx';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getRolesRepository } from '../../lib/repositories/roles.ts';

export function roleConfigEndpoints(app: Hono) {
  
  // ✅ FIXED: Now uses SQL for all role operations - no KV dependencies

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
   * Get all roles (MASTER DATA - No region dependency)
   * GET /make-server-3dd53475/config/roles
   * ✅ FIXED: Loads all roles from SQL independently of region
   * Roles are master data - regions enable/disable them dynamically
   */
  app.get("/make-server-3dd53475/config/roles", async (c) => {
    try {
      const supabase = getDbClient();
      const { regionId } = c.req.query();
      
      console.log('📋 [GET ROLES] Loading all roles (master data, no region dependency)');
      
      // ✅ ALWAYS load all active roles from SQL (master data)
      const { data: sqlRoles, error: sqlError } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('display_name', { ascending: true });
      
      if (sqlError) {
        console.error('❌ [GET ROLES] SQL error:', sqlError);
        return c.json({ error: 'Failed to fetch roles', details: String(sqlError) }, 500);
      }
      
      if (!sqlRoles || sqlRoles.length === 0) {
        console.warn('⚠️ [GET ROLES] No roles found in database');
        return c.json({ roles: [], total: 0 });
      }
      
      // Map SQL roles to expected format
      let roles = sqlRoles.map((role: any) => {
        const config = typeof role.config === 'string' ? JSON.parse(role.config || '{}') : (role.config || {});
        return {
          ...config,
          id: role.name || role.id,
          name: role.display_name || role.name,
          displayName: role.display_name,
          description: role.description,
          icon: config.icon || '🔧',
          isActive: role.is_active,
          isSystemRole: role.is_system_role || false,
        };
      });
      
      // ✅ If regionId provided, add enabled status for that region
      if (regionId) {
        const { getRegionRolesRepository } = await import('../../lib/repositories/region-roles.ts');
        const regionRolesRepo = getRegionRolesRepository();
        const regionRoles = await regionRolesRepo.getRegionRoles(regionId).catch(() => []); // Handle errors gracefully
        
        // Create a map of role_id -> enabled status
        const roleStatusMap = new Map<string, boolean>();
        regionRoles.forEach(rr => {
          roleStatusMap.set(rr.role_id, rr.is_enabled);
        });
        
        // Add enabled status to each role
        roles = roles.map((role: any) => ({
          ...role,
          enabledInRegion: roleStatusMap.get(role.id) ?? true, // Default to enabled if not configured
        }));
      }
      
      // Sort by order if available
      roles.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      
      console.log(`✅ [GET ROLES] Returning ${roles.length} roles${regionId ? ` (with region ${regionId} status)` : ' (all roles)'}`);
      
      return c.json({ 
        roles, 
        total: roles.length,
        regionId: regionId || null,
        note: 'Roles are master data. Regions enable/disable them dynamically.'
      });
    } catch (error) {
      console.error('❌ [GET ROLES] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get single role
   * GET /make-server-3dd53475/config/roles/:roleId
   * ✅ FIXED: Uses SQL repository instead of KV
   */
  app.get("/make-server-3dd53475/config/roles/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      const rolesRepo = getRolesRepository();
      
      // Try to find by ID (handles both UUID and name)
      const role = await rolesRepo.findById(roleId);
      
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }
      
      // Map to expected format
      const config = typeof role.config === 'string' ? JSON.parse(role.config || '{}') : (role.config || {});
      const mappedRole = {
        ...config,
        id: role.name || role.id,
        name: role.display_name || role.name,
        displayName: role.display_name,
        description: role.description,
        icon: config.icon || '🔧',
        isActive: role.is_active,
        isSystemRole: role.is_system_role || false,
      };
      
      return c.json({ role: mappedRole });
    } catch (error) {
      console.error('Error fetching role:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Delete a role
   * DELETE /make-server-3dd53475/config/roles/:roleId
   * ✅ FIXED: Uses SQL repository instead of KV
   */
  app.delete("/make-server-3dd53475/config/roles/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      console.log(`🗑️ [DELETE ROLE] Deleting role: ${roleId}`);
      
      const rolesRepo = getRolesRepository();
      
      // Check if role exists (findById handles both UUID and name)
      const role = await rolesRepo.findById(roleId);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }
      
      // Soft delete: set is_active to false
      await rolesRepo.update(role.id, { is_active: false });
      
      console.log(`✅ [DELETE ROLE] Successfully deleted role: ${roleId}`);
      
      return c.json({ 
        success: true, 
        message: `Role "${role.display_name || role.name}" deleted successfully`,
        deletedRoleId: roleId
      });
    } catch (error) {
      console.error('Error deleting role:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get allowed service styles for a vendor
   * GET /make-server-3dd53475/vendor/:vendorId/allowed-service-styles
   * ✅ PERMANENT FIX: Uses SQL RPC function - NO KV dependencies
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/allowed-service-styles", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log('📡 [ALLOWED-STYLES] Fetching allowed service styles for vendor:', vendorId);
      
      // ✅ PERMANENT FIX: Use SQL RPC function (no KV dependencies)
      const supabase = getDbClient();
      
      // Call SQL function to get allowed service styles
      const { data, error } = await supabase.rpc('get_vendor_allowed_service_styles', {
        p_vendor_id: vendorId
      });
      
      if (error) {
        console.error('❌ [ALLOWED-STYLES] SQL RPC error:', error);
        return c.json({ error: error.message || 'Failed to fetch vendor service styles' }, 500);
      }
      
      if (!data || data.length === 0) {
        console.error('❌ [ALLOWED-STYLES] Vendor not found:', vendorId);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const result = data[0];
      const allowedStyles = result.allowed_styles || [];
      const roleId = result.role_id;
      const roleName = result.role_name;
      const roleConfig = result.role_config || {};
      
      // ✅ BUG FIX: Resolve vendor ID to UUID (handles legacy format like vendor_9611377119)
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        console.error('❌ [ALLOWED-STYLES] Failed to resolve vendor ID:', vendorId);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      console.log('✅ [ALLOWED-STYLES] Found vendor:', {
        vendorId,
        resolvedVendorId,
        roleId,
        roleName,
        allowedStyles
      });
      
      // Extract service styles from role config if available
      const roleServiceStyles = roleConfig?.serviceStyles || allowedStyles;
      
      // ✅ BUG FIX: Use resolved UUID for querying vendor_role_config_view
      // The view's vendor_id column is a UUID, not a legacy vendor ID string
      const { data: vendorData } = await supabase
        .from('vendor_role_config_view')
        .select('vendor_id')
        .eq('vendor_id', resolvedVendorId)
        .single();
      
      const { data: centresData } = await supabase
        .from('centres')
        .select('id')
        .eq('vendor_id', resolvedVendorId);
      const centresCount = centresData?.length || 0;
      
      // Calculate resolved capabilities
      const resolvedCapabilities = {
        canManageCentres: roleConfig?.staffManagement?.enabled || false,
        canManageStaff: roleConfig?.staffManagement?.enabled || false,
        canCreatePackages: (centresCount > 0) && (roleConfig?.capabilities?.includes('package_management') || false),
        canOfferHomeServices: roleServiceStyles?.includes('at_home') || allowedStyles.includes('at_home'),
        canOfferTeleServices: roleServiceStyles?.includes('tele') || allowedStyles.includes('tele'),
        canOfferCentreServices: roleServiceStyles?.includes('at_center') || allowedStyles.includes('at_center')
      };
      
      return c.json({
        success: true,
        vendorId,
        roleId,
        roleName: roleName || roleConfig?.name || 'unknown',
        allowedStyles: allowedStyles,
        resolvedCapabilities,
        roleConfig: {
          id: roleId,
          name: roleName || roleConfig?.name,
          description: roleConfig?.description,
          icon: roleConfig?.icon,
          features: roleConfig?.features,
          capabilities: roleConfig?.capabilities,
          serviceStyles: roleServiceStyles
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
      const rolesRepo = getRolesRepository();

      // Check if role already exists (findById handles both UUID and name)
      const existing = await rolesRepo.findById(roleId);
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

      // Create role in SQL
      const createdRole = await rolesRepo.create({
        name: roleId,
        display_name: name,
        description: description || '',
        is_system_role: false,
        is_active: isActive !== false,
        config: {
          icon: icon || '🔧',
          features: features || [],
          vendorTypes: vendorTypes || [],
          serviceStyles: serviceStyles || ['at_center'],
          pricingControl: pricingControl || {},
          onboardingFields: onboardingFields || {},
          documentRequirements: documentRequirements || [],
          staffManagement: staffManagement || {},
          multiService: multiService || {},
          approvalWorkflow: approvalWorkflow || {},
          capabilities: capabilities || ['booking'],
          order: order || 0,
        },
      });

      console.log(`✅ Role created: ${roleId}`);
      return c.json({ success: true, roleId, role: createdRole });
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
      const rolesRepo = getRolesRepository();

      const role = await rolesRepo.findById(roleId);
      
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }

      // Map updates to SQL schema
      const sqlUpdates: any = {};
      if (updates.name || updates.displayName) {
        sqlUpdates.display_name = updates.name || updates.displayName;
      }
      if (updates.description !== undefined) {
        sqlUpdates.description = updates.description;
      }
      if (updates.isActive !== undefined) {
        sqlUpdates.is_active = updates.isActive;
      }
      
      // Update config if provided
      const currentConfig = typeof role.config === 'string' ? JSON.parse(role.config || '{}') : (role.config || {});
      if (Object.keys(updates).some(k => !['name', 'displayName', 'description', 'isActive'].includes(k))) {
        sqlUpdates.config = {
          ...currentConfig,
          ...updates,
        };
      }

      const updatedRole = await rolesRepo.update(role.id, sqlUpdates);

      console.log(`✅ Role updated: ${roleId}`);
      return c.json({ success: true, role: updatedRole });
    } catch (error) {
      console.error('Error updating role:', error);
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
          capabilities: ['booking', 'tele', 'chat', 'prescription', 'medical_records'],
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
          capabilities: ['booking', 'gallery'],
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
          capabilities: ['booking', 'progress_tracking'],
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
          capabilities: ['booking', 'cctv_access', 'photo_updates'],
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
          capabilities: ['booking', 'gallery', 'portfolio'],
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
          capabilities: ['catalog', 'inventory', 'orders', 'delivery'],
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
          capabilities: ['booking', 'tele', 'chat', 'prescription', 'catalog', 'inventory', 'medical_records', 'emergency'],
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
          capabilities: ['booking', 'reservation_management', 'menu', 'events', 'gallery'],
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
          capabilities: ['booking', 'grief_support', 'memorial_services', 'documents', 'chat'],
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
      const rolesRepo = getRolesRepository();
      const { getRegionRolesRepository } = await import('../../lib/repositories/region-roles.ts');
      const regionRolesRepo = getRegionRolesRepository();

      for (const roleData of initialRoles) {
        const existing = await rolesRepo.findById(roleData.id);
        
        if (existing) {
          console.log(`⏭️ Role already exists: ${roleData.id}`);
          results.push({ id: roleData.id, status: 'exists' });
          continue;
        }

        // Create role in SQL
        const createdRole = await rolesRepo.create({
          name: roleData.id,
          display_name: roleData.name,
          description: roleData.description || '',
          is_system_role: false,
          is_active: roleData.isActive !== false,
          config: {
            icon: roleData.icon || '🔧',
            features: roleData.features || [],
            vendorTypes: roleData.vendorTypes || [],
            serviceStyles: roleData.serviceStyles || ['at_center'],
            pricingControl: roleData.pricingControl || {},
            onboardingFields: roleData.onboardingFields || {},
            documentRequirements: roleData.documentRequirements || [],
            staffManagement: roleData.staffManagement || {},
            multiService: roleData.multiService || {},
            approvalWorkflow: roleData.approvalWorkflow || {},
            capabilities: roleData.capabilities || ['booking'],
            order: roleData.order || 0,
          },
        });

        // Enable role for default 'india' region
        // Note: enabled_by must be a UUID or null, not a string like 'system'
        await regionRolesRepo.enableRole('india', createdRole.id);

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