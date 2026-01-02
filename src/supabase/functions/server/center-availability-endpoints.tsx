// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import {
  getVendorsRepository,
  getDbClient
} from '../../../supabase/lib/repositories/index';

/**
 * CENTER AVAILABILITY MANAGEMENT
 * Production-ready endpoints for center operating hours and services
 * 
 * Features:
 * - Daily operating hours
 * - 24×7 Emergency toggle
 * - Ambulance service with pricing
 * - Home sample collection
 * - Pharmacy hours
 * - Diagnostics availability
 */

export function registerCenterAvailabilityEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // =============================================
  // GET CENTER AVAILABILITY SETTINGS
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/center-availability`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`[CENTER] Fetching availability for vendor: ${vendorId}`);

      // ✅ SQL: Get vendor info from vendors table
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Get center availability settings from vendor_center_settings table
      const db = getDbClient();
      const { data: settings } = await db
        .from('vendor_center_settings')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();

      const availability = settings?.settings || {
        // Default settings
        operatingHours: {
          monday: { open: '09:00', close: '21:00', isOpen: true },
          tuesday: { open: '09:00', close: '21:00', isOpen: true },
          wednesday: { open: '09:00', close: '21:00', isOpen: true },
          thursday: { open: '09:00', close: '21:00', isOpen: true },
          friday: { open: '09:00', close: '21:00', isOpen: true },
          saturday: { open: '09:00', close: '21:00', isOpen: true },
          sunday: { open: '10:00', close: '18:00', isOpen: false }
        },
        emergencyServices: {
          enabled: false,
          is24x7: false,
          afterHoursContact: ''
        },
        ambulanceService: {
          enabled: false,
          pricePerKm: 50,
          minCharge: 200,
          maxRadius: 25,
          contactNumber: ''
        },
        homeSampleCollection: {
          enabled: false,
          pricePerVisit: 150,
          maxRadius: 15,
          availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        },
        pharmacy: {
          enabled: false,
          operatingHours: {
            monday: { open: '09:00', close: '22:00', isOpen: true },
            tuesday: { open: '09:00', close: '22:00', isOpen: true },
            wednesday: { open: '09:00', close: '22:00', isOpen: true },
            thursday: { open: '09:00', close: '22:00', isOpen: true },
            friday: { open: '09:00', close: '22:00', isOpen: true },
            saturday: { open: '09:00', close: '22:00', isOpen: true },
            sunday: { open: '10:00', close: '20:00', isOpen: false }
          },
          deliveryAvailable: false,
          deliveryRadius: 10
        },
        diagnostics: {
          enabled: false,
          services: [], // ['blood_test', 'xray', 'ultrasound', 'ecg']
          reportDeliveryTime: '24 hours',
          homeCollectionAvailable: false
        }
      };

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name || vendor.businessName,
          roleId: vendor.role_id || vendor.roleId
        },
        availability
      });

    } catch (error) {
      console.error('[CENTER] Error:', error);
      return c.json({ error: 'Failed to fetch center availability' }, 500);
    }
  });

  // =============================================
  // UPDATE CENTER AVAILABILITY SETTINGS
  // =============================================
  app.put(`${BASE}/vendor/:vendorId/center-availability`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();

      console.log(`[CENTER] Updating availability for vendor: ${vendorId}`);

      // ✅ SQL: Get current settings from vendor_center_settings table
      const db = getDbClient();
      const { data: existing } = await db
        .from('vendor_center_settings')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();

      // Merge with updates
      const updatedSettings = {
        ...(existing?.settings || {}),
        ...body,
        updatedAt: new Date().toISOString()
      };

      // ✅ SQL: Save to vendor_center_settings table
      await db
        .from('vendor_center_settings')
        .upsert({
          vendor_id: vendorId,
          settings: updatedSettings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'vendor_id'
        });

      // ✅ SQL: Also update vendor's quick-access operating hours for customer display
      if (body.operatingHours) {
        const vendorsRepo = getVendorsRepository();
        const vendor = await vendorsRepo.findById(vendorId);
        if (vendor) {
          // Generate human-readable operating hours string
          const hours = body.operatingHours;
          const weekdayHours = hours.monday?.isOpen 
            ? `${hours.monday.open}-${hours.monday.close}` 
            : 'Closed';
          const sundayHours = hours.sunday?.isOpen 
            ? `${hours.sunday.open}-${hours.sunday.close}` 
            : 'Closed';

          await vendorsRepo.update(vendorId, {
            operating_hours: `Mon-Sat: ${weekdayHours}, Sun: ${sundayHours}`
          });
        }
      }

      console.log(`✅ [CENTER] Updated availability for vendor: ${vendorId}`);

      return c.json({
        success: true,
        availability: updatedSettings,
        message: 'Center availability updated successfully'
      });

    } catch (error) {
      console.error('[CENTER] Error:', error);
      return c.json({ error: 'Failed to update center availability' }, 500);
    }
  });

  // =============================================
  // CHECK IF CENTER IS OPEN NOW
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/is-open`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get availability from vendor_center_settings table
      const db = getDbClient();
      const { data: settings } = await db
        .from('vendor_center_settings')
        .select('settings')
        .eq('vendor_id', vendorId)
        .single();

      const availability = settings?.settings;
      
      if (!availability) {
        return c.json({
          success: true,
          isOpen: true, // Default to open if no settings
          message: 'No availability settings configured'
        });
      }

      // Check if 24x7 emergency is enabled
      if (availability.emergencyServices?.is24x7) {
        return c.json({
          success: true,
          isOpen: true,
          is24x7: true,
          message: '24×7 Emergency Services Available'
        });
      }

      // Get current day and time
      const now = new Date();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[now.getDay()];
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const todayHours = availability.operatingHours?.[currentDay];

      if (!todayHours || !todayHours.isOpen) {
        return c.json({
          success: true,
          isOpen: false,
          message: 'Closed today'
        });
      }

      const isOpen = currentTime >= todayHours.open && currentTime <= todayHours.close;

      return c.json({
        success: true,
        isOpen,
        currentDay,
        todayHours,
        message: isOpen ? 'Open now' : 'Closed now'
      });

    } catch (error) {
      console.error('[CENTER] Error:', error);
      return c.json({ error: 'Failed to check center status' }, 500);
    }
  });

  // =============================================
  // GET PHARMACY STATUS
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/pharmacy-status`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get availability from vendor_center_settings table
      const db = getDbClient();
      const { data: settings } = await db
        .from('vendor_center_settings')
        .select('settings')
        .eq('vendor_id', vendorId)
        .single();

      const availability = settings?.settings;
      
      if (!availability?.pharmacy?.enabled) {
        return c.json({
          success: true,
          enabled: false,
          message: 'Pharmacy not available'
        });
      }

      // Check if pharmacy is open now
      const now = new Date();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[now.getDay()];
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const pharmacyHours = availability.pharmacy.operatingHours?.[currentDay];

      if (!pharmacyHours || !pharmacyHours.isOpen) {
        return c.json({
          success: true,
          enabled: true,
          isOpen: false,
          message: 'Pharmacy closed today'
        });
      }

      const isOpen = currentTime >= pharmacyHours.open && currentTime <= pharmacyHours.close;

      return c.json({
        success: true,
        enabled: true,
        isOpen,
        pharmacyHours,
        deliveryAvailable: availability.pharmacy.deliveryAvailable,
        deliveryRadius: availability.pharmacy.deliveryRadius,
        message: isOpen ? 'Pharmacy open now' : 'Pharmacy closed'
      });

    } catch (error) {
      console.error('[PHARMACY] Error:', error);
      return c.json({ error: 'Failed to check pharmacy status' }, 500);
    }
  });

  // =============================================
  // CALCULATE AMBULANCE COST
  // =============================================
  app.post(`${BASE}/vendor/:vendorId/ambulance-quote`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();

      if (!body.distance) {
        return c.json({ error: 'Distance is required' }, 400);
      }

      // ✅ SQL: Get availability from vendor_center_settings table
      const db = getDbClient();
      const { data: settings } = await db
        .from('vendor_center_settings')
        .select('settings')
        .eq('vendor_id', vendorId)
        .single();

      const availability = settings?.settings;
      
      if (!availability?.ambulanceService?.enabled) {
        return c.json({ error: 'Ambulance service not available' }, 400);
      }

      const { pricePerKm, minCharge, maxRadius } = availability.ambulanceService;

      if (body.distance > maxRadius) {
        return c.json({
          success: false,
          error: `Distance exceeds maximum service radius of ${maxRadius}km`
        });
      }

      const calculatedCost = body.distance * pricePerKm;
      const finalCost = Math.max(calculatedCost, minCharge);

      return c.json({
        success: true,
        distance: body.distance,
        pricePerKm,
        minCharge,
        calculatedCost: finalCost,
        breakdown: {
          baseCharge: minCharge,
          distanceCharge: calculatedCost,
          total: finalCost
        },
        contactNumber: availability.ambulanceService.contactNumber
      });

    } catch (error) {
      console.error('[AMBULANCE] Error:', error);
      return c.json({ error: 'Failed to calculate ambulance cost' }, 500);
    }
  });

  // =============================================
  // CHECK HOME SAMPLE COLLECTION AVAILABILITY
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/home-collection-available`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const day = c.req.query('day'); // optional, defaults to today

      // ✅ SQL: Get availability from vendor_center_settings table
      const db = getDbClient();
      const { data: settings } = await db
        .from('vendor_center_settings')
        .select('settings')
        .eq('vendor_id', vendorId)
        .single();

      const availability = settings?.settings;
      
      if (!availability?.homeSampleCollection?.enabled) {
        return c.json({
          success: true,
          available: false,
          message: 'Home sample collection not available'
        });
      }

      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = day || dayNames[new Date().getDay()];

      const isAvailable = availability.homeSampleCollection.availableDays.includes(targetDay);

      return c.json({
        success: true,
        available: isAvailable,
        pricePerVisit: availability.homeSampleCollection.pricePerVisit,
        maxRadius: availability.homeSampleCollection.maxRadius,
        availableDays: availability.homeSampleCollection.availableDays,
        message: isAvailable 
          ? 'Home collection available' 
          : `Home collection not available on ${targetDay}`
      });

    } catch (error) {
      console.error('[HOME COLLECTION] Error:', error);
      return c.json({ error: 'Failed to check home collection availability' }, 500);
    }
  });
}
