import { Hono } from "npm:hono";
import { normalizePhone, createVendorId, phonesMatch } from "./phone-utils.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * SOLO PROVIDER ENDPOINTS
 * 
 * Handles solo provider functionality:
 * - Solo provider onboarding (simplified, no GST/shop license required)
 * - Auto-creation of virtual center + staff with same phone
 * - Service sync (center → staff)
 * - Service area configuration (privacy protection)
 * - Auto-assignment of bookings
 * - Smart login routing
 * - Upgrade to multi-staff
 */

export function soloProviderEndpoints(app: Hono, kv: any) {

  /**
   * POST /make-server-3dd53475/vendor/onboard-solo
   * Onboard a solo provider with simplified requirements
   * 
   * FLOW:
   * 1. Validate required fields (PAN, bank account - skip GST/shop license)
   * 2. Create vendor record with isSoloProvider=true
   * 3. Auto-create center with same phone (service area, not address)
   * 4. Auto-create staff with same phone
   * 5. Link all three entities
   * 6. Create phone index for quick lookup
   */
  app.post("/make-server-3dd53475/vendor/onboard-solo", async (c) => {
    try {
      const body = await c.req.json();
      const {
        roleId,
        phone,
        email,
        ownerName,
        businessName,
        panNumber,
        bankAccount,
        serviceArea,
        operatingHours,
        certifications,
        experience,
        specializations,
        bio,
        profilePhoto,
        roleName // ✅ Accept roleName from request
      } = body;

      console.log(`🚀 Solo provider onboarding started:`);
      console.log(`   Name: ${ownerName}`);
      console.log(`   Phone: ${phone}`);
      console.log(`   Role: ${roleId}`);

      // Validate required fields
      if (!phone || !ownerName || !roleId || !panNumber || !bankAccount) {
        return c.json({
          error: 'missing_required_fields',
          message: 'Phone, name, role, PAN, and bank account are required'
        }, 400);
      }

      // Check for duplicate phone
      const cleanPhone = normalizePhone(phone);
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      const existingVendor = allVendors.find((v: any) => {
        if (!v || !v.phone) return false;
        return phonesMatch(normalizePhone(v.phone), cleanPhone);
      });

      if (existingVendor) {
        console.error(`❌ DUPLICATE PHONE: ${existingVendor.id}`);
        return c.json({
          error: 'duplicate_phone',
          message: 'This phone number is already registered'
        }, 409);
      }

      // Get role configuration (OPTIONAL - fallback to roleName from request)
      let role = await kv.get(`role:config:${roleId}`);
      if (!role) {
        console.warn(`⚠️ Role config not found for ${roleId}, using defaults`);
        role = {
          id: roleId,
          name: roleName || roleId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          serviceCategory: 'general_services',
          vendorTypes: ['service_provider']
        };
      }

      // Generate IDs
      const vendorId = createVendorId(cleanPhone);
      const centerId = `center_auto_${vendorId}`;
      const staffId = `staff_auto_${vendorId}`;

      console.log(`📝 Creating vendor: ${vendorId}`);
      console.log(`📝 Auto-creating center: ${centerId}`);
      console.log(`📝 Auto-creating staff: ${staffId}`);

      // Step 1: Create vendor record
      const vendor = {
        id: vendorId,
        phone: cleanPhone,
        email,
        ownerName,
        businessName: businessName || `${ownerName} - ${role.name}`,
        roleId,
        roleName: role.name,
        serviceCategory: role.serviceCategory || 'general_services',
        vendorType: role.vendorTypes?.[0] || 'service_provider',
        
        // SOLO PROVIDER FLAGS
        isSoloProvider: true,
        centerId,
        autoLinkedStaffId: staffId,
        
        // Service area (privacy - no fixed address)
        serviceArea: serviceArea || {
          type: 'RADIUS',
          displayText: 'Serves local area',
          center: { lat: 0, lng: 0 },
          radiusKm: 10
        },
        
        // Documents (minimal for solo)
        panNumber,
        bankAccount,
        certifications: certifications || [],
        
        // Professional info
        experience: experience || 0,
        specializations: specializations || [],
        bio: bio || '',
        profilePhoto: profilePhoto || null,
        
        // Operating hours
        operatingHours: operatingHours || {},
        
        // Status
        status: 'pending', // Still needs admin approval
        setupCompleted: false,
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`vendor:${vendorId}`, vendor);
      console.log(`✅ Vendor created`);

      // Step 2: Auto-create center (virtual, uses same phone)
      const center = {
        id: centerId,
        vendorId,
        name: businessName || `${ownerName} - ${role.name}`,
        phone: cleanPhone, // SAME PHONE
        email,
        
        // SOLO PROVIDER FLAGS
        isSoloProvider: true,
        isVirtualCenter: true, // Flag as auto-created
        
        // NO fixed address - use service area
        serviceArea: serviceArea || {
          type: 'RADIUS',
          displayText: 'Serves local area',
          center: { lat: 0, lng: 0 },
          radiusKm: 10
        },
        
        // Services (empty, will be added later)
        services: [],
        
        // Operating hours
        operatingHours: operatingHours || {},
        
        // Stats
        rating: 0,
        totalBookings: 0,
        totalReviews: 0,
        
        // Status
        status: 'pending',
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`center:${centerId}`, center);
      console.log(`✅ Virtual center created`);

      // Step 3: Auto-create staff (virtual, uses same phone)
      const staff = {
        id: staffId,
        vendorId,
        centerId,
        name: ownerName,
        phone: cleanPhone, // SAME PHONE
        email,
        role: role.name,
        
        // SOLO PROVIDER FLAGS
        isSoloProvider: true,
        isAutoCreated: true, // Flag as auto-created
        isOwner: true,
        linkedVendorId: vendorId,
        
        // GPS tracking (enabled by default for solo)
        gpsTrackingEnabled: true,
        
        // Availability
        availability: 'available',
        
        // Services (empty, will sync from center)
        services: [],
        
        // Professional info
        certifications: certifications || [],
        experience: experience || 0,
        specializations: specializations || [],
        bio: bio || '',
        profilePhoto: profilePhoto || null,
        
        // Stats
        rating: 0,
        totalBookings: 0,
        totalReviews: 0,
        
        // Status
        status: 'pending',
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`staff:${staffId}`, staff);
      console.log(`✅ Virtual staff created`);

      // Step 4: Create phone index (for quick lookup during login)
      await kv.set(`vendor:phone:${cleanPhone}`, {
        vendorId,
        centerId,
        staffId,
        isSoloProvider: true,
        ownerName,
        roleName: role.name,
        createdAt: new Date().toISOString()
      });
      console.log(`✅ Phone index created`);

      // Step 5: Link vendor → center and vendor → staff
      await kv.set(`vendor:${vendorId}:center`, centerId);
      await kv.set(`vendor:${vendorId}:staff`, [staffId]);
      console.log(`✅ Entity links created`);

      console.log(`🎉 Solo provider onboarded successfully!`);
      console.log(`   Vendor: ${vendorId}`);
      console.log(`   Center: ${centerId}`);
      console.log(`   Staff: ${staffId}`);
      console.log(`   Phone: ${cleanPhone} (shared across all)`);

      return sendSuccess(c, {
        vendorId,
        centerId,
        staffId,
        isSoloProvider: true,
        message: 'Solo provider application submitted successfully. Awaiting admin approval.',
        phone: cleanPhone
      });

    } catch (error) {
      console.error('❌ Solo provider onboarding error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/vendor/phone/:phone
   * Lookup vendor by phone number (phone index)
   * Used for quick solo provider login
   */
  app.get("/make-server-3dd53475/vendor/phone/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const cleanPhone = normalizePhone(phone);

      console.log(`🔍 Phone lookup: ${cleanPhone}`);

      const phoneIndex = await kv.get(`vendor:phone:${cleanPhone}`);
      
      if (!phoneIndex) {
        return c.json({
          error: 'phone_not_found',
          message: 'No vendor found with this phone number'
        }, 404);
      }

      return sendSuccess(c, {
        ...phoneIndex,
        phone: cleanPhone
      });

    } catch (error) {
      console.error('❌ Phone lookup error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/vendor/solo-login
   * Solo provider login by phone
   * Returns session with vendor, center, and staff IDs
   */
  app.post("/make-server-3dd53475/vendor/solo-login", async (c) => {
    try {
      const { phone } = await c.req.json();
      
      if (!phone) {
        return c.json({
          error: 'missing_phone',
          message: 'Phone number is required'
        }, 400);
      }

      const cleanPhone = normalizePhone(phone);
      console.log(`🔐 Solo provider login: ${cleanPhone}`);

      // Lookup phone index
      const phoneIndex = await kv.get(`vendor:phone:${cleanPhone}`);
      
      if (!phoneIndex) {
        return c.json({
          error: 'phone_not_found',
          message: 'No vendor found with this phone number'
        }, 404);
      }

      // Get vendor to verify solo provider status
      const vendor = await kv.get(`vendor:${phoneIndex.vendorId}`);
      
      if (!vendor) {
        return c.json({
          error: 'vendor_not_found',
          message: 'Vendor record not found'
        }, 404);
      }

      if (!vendor.isSoloProvider) {
        return c.json({
          error: 'not_solo_provider',
          message: 'This phone number is not registered as a solo provider. Please use the standard vendor login.'
        }, 400);
      }

      // Create session
      const session = {
        vendorId: phoneIndex.vendorId,
        centerId: phoneIndex.centerId,
        staffId: phoneIndex.staffId,
        isSoloProvider: true,
        ownerName: phoneIndex.ownerName,
        roleName: phoneIndex.roleName,
        phone: cleanPhone,
        defaultMode: 'CENTER', // Start in center mode
        loginAt: new Date().toISOString()
      };

      console.log(`✅ Solo provider logged in successfully`);
      console.log(`   Vendor: ${session.vendorId}`);
      console.log(`   Center: ${session.centerId}`);
      console.log(`   Staff: ${session.staffId}`);

      return sendSuccess(c, {
        session,
        message: 'Logged in successfully'
      });

    } catch (error) {
      console.error('❌ Solo provider login error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/center/:centerId/service-area
   * Configure service area for solo provider (privacy protection)
   */
  app.post("/make-server-3dd53475/center/:centerId/service-area", async (c) => {
    try {
      const { centerId } = c.req.param();
      const { serviceArea } = await c.req.json();

      console.log(`📍 Updating service area for center: ${centerId}`);

      const center = await kv.get(`center:${centerId}`);
      if (!center) {
        return c.json({ error: 'Center not found' }, 404);
      }

      if (!center.isSoloProvider) {
        return c.json({ 
          error: 'not_solo_provider',
          message: 'Service area is only for solo providers. Use address for multi-staff centers.'
        }, 400);
      }

      // Update service area
      center.serviceArea = serviceArea;
      center.updatedAt = new Date().toISOString();

      await kv.set(`center:${centerId}`, center);

      console.log(`✅ Service area updated:`, serviceArea);

      return sendSuccess(c, {
        centerId,
        serviceArea,
        message: 'Service area updated successfully'
      });

    } catch (error) {
      console.error('❌ Service area update error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/center/:centerId/services
   * Add a new service to center catalog
   */
  app.post("/make-server-3dd53475/center/:centerId/services", async (c) => {
    try {
      const { centerId } = c.req.param();
      const { name, description, price, duration, category } = await c.req.json();

      console.log(`➕ Adding service to center: ${centerId}`);

      const center = await kv.get(`center:${centerId}`);
      if (!center) {
        return c.json({ error: 'Center not found' }, 404);
      }

      const newService = {
        id: `service_${Date.now()}`,
        name,
        description,
        price,
        duration,
        category,
        createdAt: new Date().toISOString()
      };

      center.services = center.services || [];
      center.services.push(newService);
      center.updatedAt = new Date().toISOString();

      await kv.set(`center:${centerId}`, center);

      // Auto-sync to staff if solo provider
      let autoSynced = false;
      if (center.isSoloProvider) {
        const staffRecords = await kv.get(`vendor:${center.vendorId}:staff`);
        if (staffRecords && staffRecords.length > 0) {
          const staffId = staffRecords[0];
          const staff = await kv.get(`staff:${staffId}`);
          if (staff) {
            staff.services = center.services;
            staff.updatedAt = new Date().toISOString();
            await kv.set(`staff:${staffId}`, staff);
            autoSynced = true;
            console.log(`✅ Auto-synced service to staff: ${staffId}`);
          }
        }
      }

      console.log(`✅ Service added: ${newService.id}`);

      return sendSuccess(c, {
        service: newService,
        autoSynced,
        message: 'Service added successfully'
      });

    } catch (error) {
      console.error('❌ Add service error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/center/:centerId/services/:serviceId
   * Update an existing service
   */
  app.put("/make-server-3dd53475/center/:centerId/services/:serviceId", async (c) => {
    try {
      const { centerId, serviceId } = c.req.param();
      const { name, description, price, duration, category } = await c.req.json();

      console.log(`✏️ Updating service: ${serviceId} in center: ${centerId}`);

      const center = await kv.get(`center:${centerId}`);
      if (!center) {
        return c.json({ error: 'Center not found' }, 404);
      }

      const serviceIndex = center.services?.findIndex((s: any) => s.id === serviceId);
      if (serviceIndex === -1 || serviceIndex === undefined) {
        return c.json({ error: 'Service not found' }, 404);
      }

      center.services[serviceIndex] = {
        ...center.services[serviceIndex],
        name,
        description,
        price,
        duration,
        category,
        updatedAt: new Date().toISOString()
      };
      center.updatedAt = new Date().toISOString();

      await kv.set(`center:${centerId}`, center);

      // Auto-sync to staff if solo provider
      let autoSynced = false;
      if (center.isSoloProvider) {
        const staffRecords = await kv.get(`vendor:${center.vendorId}:staff`);
        if (staffRecords && staffRecords.length > 0) {
          const staffId = staffRecords[0];
          const staff = await kv.get(`staff:${staffId}`);
          if (staff) {
            staff.services = center.services;
            staff.updatedAt = new Date().toISOString();
            await kv.set(`staff:${staffId}`, staff);
            autoSynced = true;
            console.log(`✅ Auto-synced updated service to staff: ${staffId}`);
          }
        }
      }

      console.log(`✅ Service updated: ${serviceId}`);

      return sendSuccess(c, {
        service: center.services[serviceIndex],
        autoSynced,
        message: 'Service updated successfully'
      });

    } catch (error) {
      console.error('❌ Update service error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/center/:centerId/services/:serviceId
   * Delete a service
   */
  app.delete("/make-server-3dd53475/center/:centerId/services/:serviceId", async (c) => {
    try {
      const { centerId, serviceId } = c.req.param();

      console.log(`🗑️ Deleting service: ${serviceId} from center: ${centerId}`);

      const center = await kv.get(`center:${centerId}`);
      if (!center) {
        return c.json({ error: 'Center not found' }, 404);
      }

      center.services = center.services?.filter((s: any) => s.id !== serviceId) || [];
      center.updatedAt = new Date().toISOString();

      await kv.set(`center:${centerId}`, center);

      // Auto-sync to staff if solo provider
      if (center.isSoloProvider) {
        const staffRecords = await kv.get(`vendor:${center.vendorId}:staff`);
        if (staffRecords && staffRecords.length > 0) {
          const staffId = staffRecords[0];
          const staff = await kv.get(`staff:${staffId}`);
          if (staff) {
            staff.services = center.services;
            staff.updatedAt = new Date().toISOString();
            await kv.set(`staff:${staffId}`, staff);
            console.log(`✅ Auto-synced service deletion to staff: ${staffId}`);
          }
        }
      }

      console.log(`✅ Service deleted: ${serviceId}`);

      return sendSuccess(c, {
        message: 'Service deleted successfully'
      });

    } catch (error) {
      console.error('❌ Delete service error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/center/:centerId/services/sync-to-staff
   * Manually trigger service sync from center to staff (for solo providers)
   */
  app.post("/make-server-3dd53475/center/:centerId/services/sync-to-staff", async (c) => {
    try {
      const { centerId } = c.req.param();

      console.log(`🔄 Syncing services to staff for center: ${centerId}`);

      const center = await kv.get(`center:${centerId}`);
      if (!center) {
        return c.json({ error: 'Center not found' }, 404);
      }

      if (!center.isSoloProvider) {
        return c.json({
          error: 'not_solo_provider',
          message: 'Service sync is automatic only for solo providers'
        }, 400);
      }

      // Get staff
      const staffRecords = await kv.get(`vendor:${center.vendorId}:staff`);
      if (!staffRecords || staffRecords.length === 0) {
        return c.json({ error: 'No staff found for this center' }, 404);
      }

      const staffId = staffRecords[0];
      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      // Sync services
      staff.services = center.services || [];
      staff.updatedAt = new Date().toISOString();

      await kv.set(`staff:${staffId}`, staff);

      console.log(`✅ Services synced to staff: ${staffId}`);
      console.log(`   Total services: ${staff.services.length}`);

      return sendSuccess(c, {
        staffId,
        servicesCount: staff.services.length,
        message: 'Services synced successfully'
      });

    } catch (error) {
      console.error('❌ Service sync error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/vendor/:vendorId/solo-info
   * Get solo provider info (vendor, center, staff)
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/solo-info", async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`🔍 Fetching solo provider info: ${vendorId}`);

      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      if (!vendor.isSoloProvider) {
        return c.json({
          error: 'not_solo_provider',
          message: 'This vendor is not a solo provider'
        }, 400);
      }

      // Get center
      const center = await kv.get(`center:${vendor.centerId}`);
      
      // Get staff
      const staffRecords = await kv.get(`vendor:${vendorId}:staff`);
      const staffId = staffRecords?.[0];
      const staff = staffId ? await kv.get(`staff:${staffId}`) : null;

      return sendSuccess(c, {
        vendor,
        center,
        staff,
        isSoloProvider: true
      });

    } catch (error) {
      console.error('❌ Error fetching solo info:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/vendor/:vendorId/upgrade-to-multistaff
   * Admin endpoint to upgrade solo provider to multi-staff
   * 
   * REQUIRES:
   * - GST certificate
   * - Shop license
   * - Business registration
   * - Physical address
   */
  app.post("/make-server-3dd53475/admin/vendor/:vendorId/upgrade-to-multistaff", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const {
        gstNumber,
        shopLicense,
        businessRegistration,
        physicalAddress,
        shopPhotos
      } = await c.req.json();

      console.log(`📈 Upgrading vendor to multi-staff: ${vendorId}`);

      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      if (!vendor.isSoloProvider) {
        return c.json({
          error: 'already_multistaff',
          message: 'Vendor is already multi-staff'
        }, 400);
      }

      // Validate required documents
      if (!gstNumber || !shopLicense || !physicalAddress) {
        return c.json({
          error: 'missing_documents',
          message: 'GST, shop license, and physical address are required for multi-staff upgrade'
        }, 400);
      }

      // Update vendor
      vendor.isSoloProvider = false;
      vendor.gstNumber = gstNumber;
      vendor.shopLicense = shopLicense;
      vendor.businessRegistration = businessRegistration;
      vendor.physicalAddress = physicalAddress;
      vendor.shopPhotos = shopPhotos || [];
      vendor.upgradedToMultiStaffAt = new Date().toISOString();
      vendor.updatedAt = new Date().toISOString();

      await kv.set(`vendor:${vendorId}`, vendor);

      // Update center (replace service area with physical address)
      const center = await kv.get(`center:${vendor.centerId}`);
      if (center) {
        center.isSoloProvider = false;
        center.isVirtualCenter = false;
        center.address = physicalAddress;
        delete center.serviceArea; // Remove service area
        center.updatedAt = new Date().toISOString();
        await kv.set(`center:${vendor.centerId}`, center);
      }

      // Update staff (keep existing solo staff as first employee)
      const staffId = vendor.autoLinkedStaffId;
      if (staffId) {
        const staff = await kv.get(`staff:${staffId}`);
        if (staff) {
          staff.isSoloProvider = false;
          staff.isAutoCreated = false; // Now a real staff member
          staff.updatedAt = new Date().toISOString();
          await kv.set(`staff:${staffId}`, staff);
        }
      }

      console.log(`✅ Vendor upgraded to multi-staff successfully`);

      return sendSuccess(c, {
        vendorId,
        message: 'Vendor upgraded to multi-staff successfully. You can now add more staff members.',
        upgradedAt: vendor.upgradedToMultiStaffAt
      });

    } catch (error) {
      console.error('❌ Upgrade error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Helper: Auto-sync services when added to center (called from service endpoints)
   */
  async function autoSyncServiceToStaff(centerId: string, services: any[]) {
    try {
      const center = await kv.get(`center:${centerId}`);
      if (!center || !center.isSoloProvider) {
        return; // Not a solo provider, skip sync
      }

      const staffRecords = await kv.get(`vendor:${center.vendorId}:staff`);
      if (!staffRecords || staffRecords.length === 0) {
        return;
      }

      const staffId = staffRecords[0];
      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) {
        return;
      }

      // Sync services
      staff.services = services;
      staff.updatedAt = new Date().toISOString();
      await kv.set(`staff:${staffId}`, staff);

      console.log(`✅ Auto-synced services to staff: ${staffId}`);
    } catch (error) {
      console.error('❌ Auto-sync error:', error);
    }
  }

  // Export helper for use in other endpoints
  (app as any).autoSyncServiceToStaff = autoSyncServiceToStaff;

  // ===============================
  // GET ENDPOINTS FOR TESTING
  // ===============================

  // Get center by ID
  app.get('/make-server-3dd53475/center/:centerId', async (c) => {
    try {
      const { centerId } = c.req.param();
      
      console.log(`📍 Fetching center: ${centerId}`);
      
      const center = await kv.get(`center:${centerId}`);
      
      if (!center) {
        return c.json({ error: 'Center not found' }, 404);
      }
      
      return c.json({ 
        success: true,
        center 
      });
    } catch (error: any) {
      console.error('❌ Get center error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // Get staff by center and staff ID
  app.get('/make-server-3dd53475/center/:centerId/staff/:staffId', async (c) => {
    try {
      const { centerId, staffId } = c.req.param();
      
      console.log(`👤 Fetching staff: ${staffId} from center: ${centerId}`);
      
      const staff = await kv.get(`staff:${staffId}`);
      
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      // Verify staff belongs to this center
      if (staff.centerId !== centerId) {
        return c.json({ error: 'Staff does not belong to this center' }, 403);
      }
      
      return c.json({ 
        success: true,
        staff 
      });
    } catch (error: any) {
      console.error('❌ Get staff error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Solo provider endpoints registered');
}