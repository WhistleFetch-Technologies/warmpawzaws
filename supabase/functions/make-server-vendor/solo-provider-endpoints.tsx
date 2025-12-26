/**
 * ============================================================================
 * SOLO PROVIDER ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Solo provider functionality:
 * - Solo provider onboarding (simplified, no GST/shop license required)
 * - Auto-creation of virtual center + staff with same phone
 * - Service sync (center → staff)
 * - Service area configuration (privacy protection)
 * - Auto-assignment of bookings
 * - Smart login routing
 * - Upgrade to multi-staff
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All vendor operations use VendorsRepository
 * - All staff operations use StaffRepository
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { normalizePhone, createVendorId, phonesMatch } from "./phone-utils.tsx";
import { sendSuccess, sendError } from "../_shared/response-utils.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getDbClient } from "../../lib/db.ts";

export function soloProviderEndpoints(app: Hono) {

  /**
   * POST /make-server-3dd53475/vendor/onboard-solo
   * Onboard a solo provider with simplified requirements
   * 
   * REFACTORED: Uses SQL repositories instead of KV
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
        roleName
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

      // ✅ SQL: Check for duplicate phone
      const cleanPhone = normalizePhone(phone);
      const existingVendor = await getVendorsRepository().findByPhone(cleanPhone);

      if (existingVendor) {
        console.error(`❌ DUPLICATE PHONE: ${existingVendor.id}`);
        return c.json({
          error: 'duplicate_phone',
          message: 'This phone number is already registered'
        }, 409);
      }

      // ✅ SQL: Get role configuration from platform_settings
      const client = getDbClient();
      const { data: roleSetting } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `role:config:${roleId}`)
        .maybeSingle();
      
      const role = roleSetting?.setting_value || {
        id: roleId,
        name: roleName || roleId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        serviceCategory: 'general_services',
        vendorTypes: ['service_provider']
      };

      // Generate IDs
      const vendorId = createVendorId(cleanPhone);
      const centerId = `center_auto_${vendorId}`;
      const staffId = `staff_auto_${vendorId}`;

      console.log(`📝 Creating vendor: ${vendorId}`);
      console.log(`📝 Auto-creating center: ${centerId}`);
      console.log(`📝 Auto-creating staff: ${staffId}`);

      // ✅ SQL: Step 1: Create vendor record
      const vendor = await getVendorsRepository().create({
        role_id: roleId,
        business_name: businessName || `${ownerName} - ${role.name}`,
        owner_name: ownerName,
        email,
        phone: cleanPhone,
        category: role.serviceCategory || 'general_services',
        service_style: 'at_home',
        status: 'pending',
        is_active: false,
        pan_number: panNumber,
        // Store solo provider specific data in JSONB fields
        solo_provider_data: {
          isSoloProvider: true,
          centerId,
          autoLinkedStaffId: staffId,
          serviceArea: serviceArea || {
            type: 'RADIUS',
            displayText: 'Serves local area',
            center: { lat: 0, lng: 0 },
            radiusKm: 10
          },
          certifications: certifications || [],
          experience: experience || 0,
          specializations: specializations || [],
          bio: bio || '',
          profilePhoto: profilePhoto || null,
          operatingHours: operatingHours || {},
        },
      });

      console.log(`✅ Vendor created`);

      // ✅ SQL: Step 2: Auto-create staff (virtual, uses same phone)
      const staff = await getStaffRepository().create({
        vendor_id: vendorId,
        full_name: ownerName,
        phone: cleanPhone,
        email,
        role_type: roleId,
        specialization: specializations?.[0] || '',
        experience_years: experience || 0,
        is_active: true,
        solo_provider_data: {
          isSoloProvider: true,
          centerId,
          isVirtualStaff: true,
          serviceArea: serviceArea || {
            type: 'RADIUS',
            displayText: 'Serves local area',
            center: { lat: 0, lng: 0 },
            radiusKm: 10
          },
          operatingHours: operatingHours || {},
        },
      });

      console.log(`✅ Virtual staff created`);

      // ✅ SQL: Store center reference in platform_settings (or create centers table)
      await client
        .from('platform_settings')
        .upsert({
          setting_key: `center:${centerId}`,
          setting_value: {
            id: centerId,
            vendor_id: vendorId,
            name: businessName || `${ownerName} - ${role.name}`,
            phone: cleanPhone,
            email,
            isSoloProvider: true,
            isVirtualCenter: true,
            serviceArea: serviceArea || {
              type: 'RADIUS',
              displayText: 'Serves local area',
              center: { lat: 0, lng: 0 },
              radiusKm: 10
            },
            services: [],
            operatingHours: operatingHours || {},
            rating: 0,
            totalBookings: 0,
            totalReviews: 0,
            status: 'pending',
            isActive: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString(),
        });

      console.log(`✅ Virtual center created`);

      // ✅ SQL: Add to pending approvals
      const { data: pendingList } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'vendor:pending_approvals')
        .maybeSingle();
      
      const pendingVendors = pendingList?.setting_value || [];
      if (!pendingVendors.includes(vendorId)) {
        pendingVendors.push(vendorId);
        await client
          .from('platform_settings')
          .upsert({
            setting_key: 'vendor:pending_approvals',
            setting_value: pendingVendors,
            updated_at: new Date().toISOString(),
          });
      }

      console.log(`🎉 Solo provider onboarding complete!`);
      console.log(`   Vendor ID: ${vendorId}`);
      console.log(`   Center ID: ${centerId}`);
      console.log(`   Staff ID: ${staff.id}`);

      return sendSuccess(c, {
        vendorId,
        centerId,
        staffId: staff.id,
        message: 'Solo provider onboarding completed. Awaiting admin approval.'
      });

    } catch (error) {
      console.error('❌ Error onboarding solo provider:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/vendor/solo/:vendorId
   * Get solo provider details
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/solo/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(vendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // ✅ SQL: Get staff
      const staffList = await getStaffRepository().findByVendor(vendorId);
      const staff = staffList[0];

      // ✅ SQL: Get center from platform_settings
      const client = getDbClient();
      const { data: centerSetting } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `center:center_auto_${vendorId}`)
        .maybeSingle();
      
      const center = centerSetting?.setting_value;

      return sendSuccess(c, {
        vendor,
        center,
        staff,
        isSoloProvider: true
      });

    } catch (error) {
      console.error('❌ Error fetching solo provider:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/vendor/solo/:vendorId/upgrade
   * Upgrade solo provider to multi-staff
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.put("/make-server-3dd53475/vendor/solo/:vendorId/upgrade", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { businessName, address, city, state, pincode } = await c.req.json();

      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(vendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // ✅ SQL: Update vendor to remove solo provider flags
      const updatedVendor = await getVendorsRepository().update(vendorId, {
        business_name: businessName || vendor.business_name,
        address: address || vendor.address,
        city: city || vendor.city,
        state: state || vendor.state,
        pincode: pincode || vendor.pincode,
        // Remove solo provider flags
        solo_provider_data: null,
      });

      console.log(`✅ Solo provider upgraded to multi-staff: ${vendorId}`);

      return sendSuccess(c, {
        vendor: updatedVendor,
        message: 'Solo provider upgraded successfully. You can now add more staff members.'
      });

    } catch (error) {
      console.error('❌ Error upgrading solo provider:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/center/:centerId/service-area
   * Configure service area for any vendor (works for all vendor roles)
   * Supports both radius-based and specific areas from Google Maps
   */
  app.post("/make-server-3dd53475/center/:centerId/service-area", async (c) => {
    try {
      const { centerId } = c.req.param();
      const { serviceArea } = await c.req.json();

      console.log(`📍 Updating service area for center: ${centerId}`);

      // ✅ SQL: Get center from platform_settings
      const client = getDbClient();
      const { data: centerSetting } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `center:${centerId}`)
        .maybeSingle();
      
      if (!centerSetting) {
        return sendError(c, 'Center not found', 404);
      }

      const center = centerSetting.setting_value;
      
      // Update service area
      center.serviceArea = serviceArea;
      center.updatedAt = new Date().toISOString();

      // ✅ SQL: Save updated center
      await client
        .from('platform_settings')
        .upsert({
          setting_key: `center:${centerId}`,
          setting_value: center,
          updated_at: new Date().toISOString(),
        });

      // ✅ SQL: Also update vendor's solo_provider_data if it exists
      if (center.vendor_id) {
        const vendor = await getVendorsRepository().findById(center.vendor_id);
        if (vendor?.solo_provider_data) {
          await getVendorsRepository().update(center.vendor_id, {
            solo_provider_data: {
              ...vendor.solo_provider_data,
              serviceArea: serviceArea
            }
          });
        }
      }

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
   * GET /make-server-3dd53475/center/:centerId/service-area
   * Get service area configuration for a center
   */
  app.get("/make-server-3dd53475/center/:centerId/service-area", async (c) => {
    try {
      const { centerId } = c.req.param();

      // ✅ SQL: Get center from platform_settings
      const client = getDbClient();
      const { data: centerSetting } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `center:${centerId}`)
        .maybeSingle();
      
      if (!centerSetting) {
        return sendError(c, 'Center not found', 404);
      }

      const center = centerSetting.setting_value;
      const serviceArea = center.serviceArea || null;

      return sendSuccess(c, {
        centerId,
        serviceArea,
      });

    } catch (error) {
      console.error('❌ Service area fetch error:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Solo provider endpoints registered (SQL-only)');
}

