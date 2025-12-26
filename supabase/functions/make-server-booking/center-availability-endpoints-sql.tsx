import { Hono } from "npm:hono";
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';
import { sendSuccess, sendError } from '../_shared/response-utils.ts';

/**
 * CENTER AVAILABILITY MANAGEMENT (SQL)
 * Production-ready endpoints for center operating hours and services
 * 
 * ✅ MIGRATED TO SQL: Uses vendors.business_hours JSONB for availability data
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

      // ✅ SQL: Resolve vendor ID and get vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found', 404);
      }

      const vendor = await vendorsRepo.findById(resolvedVendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // ✅ SQL: Get availability from business_hours JSONB
      const client = getDbClient();
      const { data: vendorData } = await client
        .from('vendors')
        .select('business_hours')
        .eq('id', resolvedVendorId)
        .single();

      const businessHours = (vendorData as any)?.business_hours || {};
      
      // Extract availability data from business_hours JSONB
      const availability = businessHours.centerAvailability || {
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
          afterHoursContact: '',
          ambulance: false,
          ambulanceAvailable247: false,
          consultationAvailable247: false,
          diagnosticsAvailable247: false
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
          services: [],
          reportDeliveryTime: '24 hours',
          homeCollectionAvailable: false
        }
      };

      return sendSuccess(c, {
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          roleId: vendor.role_id
        },
        availability
      });

    } catch (error) {
      console.error('[CENTER] Error:', error);
      return sendError(c, 'Failed to fetch center availability', 500);
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

      // ✅ SQL: Resolve vendor ID
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found', 404);
      }

      // ✅ SQL: Get current business_hours
      const client = getDbClient();
      const { data: existingVendor } = await client
        .from('vendors')
        .select('business_hours, operating_hours')
        .eq('id', resolvedVendorId)
        .single();

      if (!existingVendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      const existingBusinessHours = (existingVendor as any).business_hours || {};
      
      // Merge with updates
      const updatedAvailability = {
        ...(existingBusinessHours.centerAvailability || {}),
        ...body,
        updatedAt: new Date().toISOString()
      };

      // ✅ SQL: Update business_hours JSONB with new availability data
      const updatedBusinessHours = {
        ...existingBusinessHours,
        centerAvailability: updatedAvailability
      };

      // ✅ SQL: Generate human-readable operating hours string if operatingHours provided
      let operatingHoursText = (existingVendor as any).operating_hours || '';
      if (body.operatingHours) {
        const hours = body.operatingHours;
        const openDays = Object.keys(hours).filter(day => hours[day]?.isOpen);
        
        if (openDays.length > 0) {
          const firstDay = hours[openDays[0]];
          const allSame = openDays.every(day => 
            hours[day].open === firstDay.open && hours[day].close === firstDay.close
          );

          if (allSame && openDays.length === 7) {
            operatingHoursText = `Open Daily: ${firstDay.open} - ${firstDay.close}`;
          } else if (allSame && openDays.length === 6 && !hours.sunday?.isOpen) {
            operatingHoursText = `Mon-Sat: ${firstDay.open} - ${firstDay.close}`;
          } else {
            operatingHoursText = openDays.map(day => {
              const h = hours[day];
              return `${day.charAt(0).toUpperCase() + day.slice(1,3)}: ${h.open}-${h.close}`;
            }).join(', ');
          }
        } else {
          operatingHoursText = 'Closed';
        }
      }

      // ✅ SQL: Update vendors table
      await client
        .from('vendors')
        .update({
          business_hours: updatedBusinessHours,
          operating_hours: operatingHoursText,
          updated_at: new Date().toISOString()
        })
        .eq('id', resolvedVendorId);

      console.log(`✅ [CENTER] Updated availability for vendor: ${resolvedVendorId}`);

      return sendSuccess(c, {
        availability: updatedAvailability,
        message: 'Center availability updated successfully'
      });

    } catch (error) {
      console.error('[CENTER] Error:', error);
      return sendError(c, `Failed to update center availability: ${String(error)}`, 500);
    }
  });

  // =============================================
  // CHECK IF CENTER IS OPEN NOW
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/is-open`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get vendor availability
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found', 404);
      }

      const client = getDbClient();
      const { data: vendorData } = await client
        .from('vendors')
        .select('business_hours')
        .eq('id', resolvedVendorId)
        .single();

      const businessHours = (vendorData as any)?.business_hours || {};
      const availability = businessHours.centerAvailability;
      
      if (!availability) {
        return sendSuccess(c, {
          isOpen: true,
          message: 'No availability settings configured'
        });
      }

      // Check if 24x7 emergency is enabled
      if (availability.emergencyServices?.is24x7 || availability.emergencyServices?.consultationAvailable247) {
        return sendSuccess(c, {
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
        return sendSuccess(c, {
          isOpen: false,
          message: 'Closed today'
        });
      }

      const isOpen = currentTime >= todayHours.open && currentTime <= todayHours.close;

      return sendSuccess(c, {
        isOpen,
        currentDay,
        todayHours,
        message: isOpen ? 'Open now' : 'Closed now'
      });

    } catch (error) {
      console.error('[CENTER] Error:', error);
      return sendError(c, 'Failed to check center status', 500);
    }
  });

  // =============================================
  // GET PHARMACY STATUS
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/pharmacy-status`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get vendor availability
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found', 404);
      }

      const client = getDbClient();
      const { data: vendorData } = await client
        .from('vendors')
        .select('business_hours')
        .eq('id', resolvedVendorId)
        .single();

      const businessHours = (vendorData as any)?.business_hours || {};
      const availability = businessHours.centerAvailability;
      
      if (!availability?.pharmacy?.enabled) {
        return sendSuccess(c, {
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
        return sendSuccess(c, {
          enabled: true,
          isOpen: false,
          message: 'Pharmacy closed today'
        });
      }

      const isOpen = currentTime >= pharmacyHours.open && currentTime <= pharmacyHours.close;

      return sendSuccess(c, {
        enabled: true,
        isOpen,
        pharmacyHours,
        deliveryAvailable: availability.pharmacy.deliveryAvailable,
        deliveryRadius: availability.pharmacy.deliveryRadius,
        message: isOpen ? 'Pharmacy open now' : 'Pharmacy closed'
      });

    } catch (error) {
      console.error('[PHARMACY] Error:', error);
      return sendError(c, 'Failed to check pharmacy status', 500);
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
        return sendError(c, 'Distance is required', 400);
      }

      // ✅ SQL: Get vendor availability
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found', 404);
      }

      const client = getDbClient();
      const { data: vendorData } = await client
        .from('vendors')
        .select('business_hours')
        .eq('id', resolvedVendorId)
        .single();

      const businessHours = (vendorData as any)?.business_hours || {};
      const availability = businessHours.centerAvailability;
      
      if (!availability?.ambulanceService?.enabled) {
        return sendError(c, 'Ambulance service not available', 400);
      }

      const { pricePerKm, minCharge, maxRadius } = availability.ambulanceService;

      if (body.distance > maxRadius) {
        return sendError(c, `Distance exceeds maximum service radius of ${maxRadius}km`, 400);
      }

      const calculatedCost = body.distance * pricePerKm;
      const finalCost = Math.max(calculatedCost, minCharge);

      return sendSuccess(c, {
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
      return sendError(c, 'Failed to calculate ambulance cost', 500);
    }
  });

  // =============================================
  // CHECK HOME SAMPLE COLLECTION AVAILABILITY
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/home-collection-available`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const day = c.req.query('day'); // optional, defaults to today

      // ✅ SQL: Get vendor availability
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found', 404);
      }

      const client = getDbClient();
      const { data: vendorData } = await client
        .from('vendors')
        .select('business_hours')
        .eq('id', resolvedVendorId)
        .single();

      const businessHours = (vendorData as any)?.business_hours || {};
      const availability = businessHours.centerAvailability;
      
      if (!availability?.homeSampleCollection?.enabled) {
        return sendSuccess(c, {
          available: false,
          message: 'Home sample collection not available'
        });
      }

      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = day || dayNames[new Date().getDay()];

      const isAvailable = availability.homeSampleCollection.availableDays.includes(targetDay);

      return sendSuccess(c, {
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
      return sendError(c, 'Failed to check home collection availability', 500);
    }
  });
}

