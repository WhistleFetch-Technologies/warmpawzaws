/**
 * CAPABILITY-SPECIFIC ENDPOINTS
 * 
 * Backend endpoints for vendor capability components:
 * - Cafe Pax Management
 * - Boarding Occupancy Tracking
 * - Boarding Nightly Pricing
 * - Multi-Doctor Management
 * - Table Management (Additional)
 */

// ✅ MIGRATED TO SQL: All KV operations removed
import { Hono } from "npm:hono";
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getBoardingRoomsRepository } from '../../lib/repositories/boarding-rooms.ts';
import { getPricingRulesRepository } from '../../lib/repositories/pricing-rules.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getCafeTablesRepository } from '../../lib/repositories/cafe-tables.ts';

const BASE = '/make-server-3dd53475';

export function registerCapabilityEndpoints(app: Hono) {

  // ==========================================
  // CAFE PAX (GUEST) MANAGEMENT
  // ==========================================

  /**
   * GET /vendor/cafe/:vendorId/pax-config
   * Get pax configuration for a cafe vendor
   * ✅ MIGRATED TO SQL: Uses vendors.business_hours JSONB
   */
  app.get(`${BASE}/vendor/cafe/:vendorId/pax-config`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Resolve vendor ID and get vendor
      const { getVendorsRepository } = await import('../../lib/repositories/vendors.ts');
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Get pax config from business_hours JSONB
      const { getDbClient } = await import('../../lib/db.ts');
      const client = getDbClient();
      const { data: vendorData } = await client
        .from('vendors')
        .select('business_hours')
        .eq('id', resolvedVendorId)
        .single();

      const businessHours = (vendorData as any)?.business_hours || {};
      const config = businessHours.paxConfig || {
        maxGuestsPerTable: 8,
        maxPetsPerTable: 4,
        maxGuestsPerBooking: 20,
        maxPetsPerBooking: 10,
        requirePetCount: true,
        requireGuestCount: true,
        allowPetOnlyBookings: false,
        petSizeRestrictions: {
          small: true,
          medium: true,
          large: true,
          extraLarge: false
        },
        guestToPetRatio: 2
      };

      return c.json({ success: true, config });
    } catch (error) {
      console.error('[PAX CONFIG GET] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /vendor/cafe/:vendorId/pax-config
   * Update pax configuration for a cafe vendor
   * ✅ MIGRATED TO SQL: Uses vendors.business_hours JSONB
   */
  app.put(`${BASE}/vendor/cafe/:vendorId/pax-config`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const config = await c.req.json();

      // ✅ SQL: Resolve vendor ID
      const { getVendorsRepository } = await import('../../lib/repositories/vendors.ts');
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Validate config
      if (config.maxGuestsPerTable < 1 || config.maxPetsPerTable < 1) {
        return c.json({ error: 'Invalid capacity limits' }, 400);
      }

      // ✅ SQL: Get existing business_hours
      const { getDbClient } = await import('../../lib/db.ts');
      const client = getDbClient();
      const { data: existingVendor } = await client
        .from('vendors')
        .select('business_hours')
        .eq('id', resolvedVendorId)
        .single();

      if (!existingVendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const existingBusinessHours = (existingVendor as any).business_hours || {};
      
      // ✅ SQL: Update business_hours JSONB with pax config
      const updatedBusinessHours = {
        ...existingBusinessHours,
        paxConfig: {
          ...config,
          updatedAt: new Date().toISOString()
        }
      };

      await client
        .from('vendors')
        .update({
          business_hours: updatedBusinessHours,
          updated_at: new Date().toISOString()
        })
        .eq('id', resolvedVendorId);

      console.log(`✅ [PAX CONFIG] Updated pax config for vendor: ${resolvedVendorId}`);

      return c.json({ success: true, config });
    } catch (error) {
      console.error('[PAX CONFIG PUT] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================
  // BOARDING OCCUPANCY TRACKING
  // ==========================================

  /**
   * GET /vendor/:vendorId/boarding/occupancy
   * Get occupancy data for a specific date
   */
  app.get(`${BASE}/vendor/:vendorId/boarding/occupancy`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const date = c.req.query('date') || new Date().toISOString().split('T')[0];

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Get rooms
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const rooms = await boardingRoomsRepo.findByVendor(resolvedVendorId, { is_active: true });

      // ✅ SQL: Get bookings for the date
      const bookingsRepo = getBookingsRepository();
      const allBookings = await bookingsRepo.findByVendorAndDate(resolvedVendorId, date);
      
      const bookings = [];
      for (const booking of allBookings) {
        if (booking.service_type === 'at_vendor' && // Boarding is at_vendor
            booking.status !== 'cancelled') {
          const packageDetails = (booking.package_details as any) || {};
          const checkIn = packageDetails.checkinDate || packageDetails.checkInDate;
          const checkOut = packageDetails.checkoutDate || packageDetails.checkOutDate;
          
          if (checkIn && checkOut) {
            const checkInDate = new Date(checkIn).toISOString().split('T')[0];
            const checkOutDate = new Date(checkOut).toISOString().split('T')[0];
            const targetDate = new Date(date).toISOString().split('T')[0];
            
            if (targetDate >= checkInDate && targetDate <= checkOutDate) {
              bookings.push({
                id: booking.id,
                bookingId: booking.id,
                roomId: packageDetails.roomId,
                roomName: packageDetails.roomName || 'Unknown',
                customerName: (booking as any).customer_name,
                petName: (booking as any).pet_name,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                status: booking.status,
                guestCount: packageDetails.guestCount || 1,
                petCount: packageDetails.petCount || 1
              });
            }
          }
        }
      }

      // Calculate occupancy per room
      const occupancy = rooms.map((room) => {
        const roomBookings = bookings.filter((b: any) => b.roomId === room.id);
        const occupiedUnits = roomBookings.length;
        const totalUnits = room.total_units || 1;
        const availableUnits = Math.max(0, totalUnits - occupiedUnits);
        const reservedUnits = roomBookings.filter((b: any) => b.status === 'confirmed').length;
        const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

        return {
          roomId: room.id,
          roomName: room.name,
          totalUnits,
          occupiedUnits,
          availableUnits,
          reservedUnits,
          occupancyRate,
          currentBookings: roomBookings
        };
      });

      return c.json({ success: true, occupancy, date });
    } catch (error) {
      console.error('[OCCUPANCY GET] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================
  // BOARDING NIGHTLY PRICING
  // ==========================================

  /**
   * GET /vendor/:vendorId/boarding/pricing
   * Get all pricing rules for a vendor
   */
  app.get(`${BASE}/vendor/:vendorId/boarding/pricing`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Get pricing rules
      const pricingRulesRepo = getPricingRulesRepository();
      const pricingRules = await pricingRulesRepo.findByVendor(resolvedVendorId, { is_active: true });

      return c.json({ success: true, pricingRules });
    } catch (error) {
      console.error('[PRICING GET] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/boarding/pricing
   * Create a new pricing rule
   */
  app.post(`${BASE}/vendor/:vendorId/boarding/pricing`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const pricingData = await c.req.json();

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Validate required fields
      if (!pricingData.roomId || !pricingData.baseNightPrice) {
        return c.json({ error: 'Missing required fields: roomId, baseNightPrice' }, 400);
      }

      // ✅ SQL: Verify room exists
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const room = await boardingRoomsRepo.findById(pricingData.roomId);
      if (!room || room.vendor_id !== resolvedVendorId) {
        return c.json({ error: 'Room not found' }, 404);
      }

      // ✅ SQL: Create pricing rule
      const pricingRulesRepo = getPricingRulesRepository();
      const pricingRule = await pricingRulesRepo.create({
        vendor_id: resolvedVendorId,
        room_id: pricingData.roomId,
        room_name: room.name,
        base_night_price: Number(pricingData.baseNightPrice),
        size_based_pricing: pricingData.sizeBasedPricing || {
          small: Number(pricingData.baseNightPrice),
          medium: Number(pricingData.baseNightPrice),
          large: Number(pricingData.baseNightPrice),
          extraLarge: Number(pricingData.baseNightPrice)
        },
        seasonal_pricing: pricingData.seasonalPricing || [],
        special_offers: pricingData.specialOffers || [],
        is_active: pricingData.isActive !== false,
      });

      return c.json({ success: true, pricingRule });
    } catch (error) {
      console.error('[PRICING POST] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/boarding/pricing/:ruleId
   * Update a pricing rule
   */
  app.put(`${BASE}/vendor/:vendorId/boarding/pricing/:ruleId`, async (c) => {
    try {
      const { vendorId, ruleId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Update pricing rule
      const pricingRulesRepo = getPricingRulesRepository();
      const updateData: any = {};
      if (updates.baseNightPrice !== undefined) updateData.base_night_price = updates.baseNightPrice;
      if (updates.sizeBasedPricing !== undefined) updateData.size_based_pricing = updates.sizeBasedPricing;
      if (updates.seasonalPricing !== undefined) updateData.seasonal_pricing = updates.seasonalPricing;
      if (updates.specialOffers !== undefined) updateData.special_offers = updates.specialOffers;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      
      const updated = await pricingRulesRepo.update(ruleId, updateData);

      return c.json({ success: true, pricingRule: pricingRules[ruleIndex] });
    } catch (error) {
      console.error('[PRICING PUT] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/boarding/pricing/:ruleId
   * Delete a pricing rule
   */
  app.delete(`${BASE}/vendor/:vendorId/boarding/pricing/:ruleId`, async (c) => {
    try {
      const { vendorId, ruleId } = c.req.param();

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Delete pricing rule (soft delete)
      const pricingRulesRepo = getPricingRulesRepository();
      await pricingRulesRepo.delete(ruleId);

      return c.json({ success: true, message: 'Pricing rule deleted' });
    } catch (error) {
      console.error('[PRICING DELETE] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================
  // MULTI-DOCTOR MANAGEMENT
  // ==========================================

  /**
   * GET /vendor/:vendorId/clinic/doctors
   * Get all doctors for a clinic
   */
  app.get(`${BASE}/vendor/:vendorId/clinic/doctors`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Get doctors (staff with role='doctor') for this clinic
      const staffRepo = getStaffRepository();
      const allStaff = await staffRepo.findByVendor(resolvedVendorId);
      const doctors = allStaff.filter(s => s.role === 'doctor' && s.isActive);

      return c.json({ success: true, doctors, total: doctors.length });
    } catch (error) {
      console.error('[DOCTORS GET] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/clinic/doctors
   * Add a doctor to a clinic
   */
  app.post(`${BASE}/vendor/:vendorId/clinic/doctors`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const doctorData = await c.req.json();

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Validate required fields
      if (!doctorData.name || !doctorData.phone) {
        return c.json({ error: 'Missing required fields: name, phone' }, 400);
      }

      // ✅ SQL: Create doctor (staff with role='doctor')
      const staffRepo = getStaffRepository();
      const doctor = await staffRepo.create({
        vendor_id: resolvedVendorId,
        full_name: doctorData.name,
        phone: doctorData.phone,
        email: doctorData.email || '',
        role: 'doctor',
        specialization: Array.isArray(doctorData.specialization) 
          ? doctorData.specialization.join(',') 
          : doctorData.specialization || '',
        experience_years: doctorData.experience || 0,
        photo: doctorData.profilePhoto || '',
        is_active: true,
      });

      return c.json({ success: true, doctor });
    } catch (error) {
      console.error('[DOCTORS POST] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/clinic/doctors/:doctorId
   * Update a doctor's information
   */
  app.put(`${BASE}/vendor/:vendorId/clinic/doctors/:doctorId`, async (c) => {
    try {
      const { vendorId, doctorId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Verify doctor exists and belongs to clinic
      const staffRepo = getStaffRepository();
      const doctor = await staffRepo.findById(doctorId);
      if (!doctor || doctor.role !== 'doctor') {
        return c.json({ error: 'Doctor not found' }, 404);
      }

      if (doctor.vendorId !== resolvedVendorId) {
        return c.json({ error: 'Doctor does not belong to this clinic' }, 403);
      }

      // ✅ SQL: Update doctor
      const updateData: any = {};
      if (updates.name !== undefined) updateData.full_name = updates.name;
      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.specialization !== undefined) updateData.specialization = Array.isArray(updates.specialization) ? updates.specialization.join(',') : updates.specialization;
      if (updates.experience !== undefined) updateData.experience_years = updates.experience;
      if (updates.profilePhoto !== undefined) updateData.photo = updates.profilePhoto;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      
      const updatedDoctor = await staffRepo.update(doctorId, updateData);

      return c.json({ success: true, doctor: updatedDoctor });
    } catch (error) {
      console.error('[DOCTORS PUT] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/clinic/doctors/:doctorId
   * Remove a doctor from a clinic
   */
  app.delete(`${BASE}/vendor/:vendorId/clinic/doctors/:doctorId`, async (c) => {
    try {
      const { vendorId, doctorId } = c.req.param();

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Verify doctor exists and belongs to clinic
      const staffRepo = getStaffRepository();
      const doctor = await staffRepo.findById(doctorId);
      if (!doctor || doctor.role !== 'doctor') {
        return c.json({ error: 'Doctor not found' }, 404);
      }

      if (doctor.vendorId !== resolvedVendorId) {
        return c.json({ error: 'Doctor does not belong to this clinic' }, 403);
      }

      // ✅ SQL: Mark doctor as inactive (soft delete)
      await staffRepo.update(doctorId, { is_active: false });

      return c.json({ success: true, message: 'Doctor removed from clinic' });
    } catch (error) {
      console.error('[DOCTORS DELETE] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================
  // TABLE MANAGEMENT (ADDITIONAL)
  // ==========================================

  /**
   * PUT /vendor/cafe/:vendorId/tables/:tableId
   * Update a table configuration
   */
  app.put(`${BASE}/vendor/cafe/:vendorId/tables/:tableId`, async (c) => {
    try {
      const { vendorId, tableId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Get table
      const cafeTablesRepo = getCafeTablesRepository();
      const table = await cafeTablesRepo.findById(tableId);
      if (!table) {
        return c.json({ error: 'Table not found' }, 404);
      }

      if (table.vendor_id !== resolvedVendorId) {
        return c.json({ error: 'Table does not belong to this vendor' }, 403);
      }

      // ✅ SQL: Update table
      const updatedTable = await cafeTablesRepo.update(tableId, updates);

      return c.json({ success: true, table: updatedTable });
    } catch (error) {
      console.error('[TABLE PUT] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /vendor/cafe/:vendorId/tables/:tableId/status
   * Update table status
   */
  app.put(`${BASE}/vendor/cafe/:vendorId/tables/:tableId/status`, async (c) => {
    try {
      const { vendorId, tableId } = c.req.param();
      const { status } = await c.req.json();

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      if (!resolvedVendorId) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Get table
      const cafeTablesRepo = getCafeTablesRepository();
      const table = await cafeTablesRepo.findById(tableId);
      if (!table) {
        return c.json({ error: 'Table not found' }, 404);
      }

      if (table.vendor_id !== resolvedVendorId) {
        return c.json({ error: 'Table does not belong to this vendor' }, 403);
      }

      // Validate status
      const validStatuses = ['available', 'occupied', 'reserved', 'maintenance'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
      }

      // ✅ SQL: Update status
      const updatedTable = await cafeTablesRepo.update(tableId, { status });

      return c.json({ success: true, table: updatedTable });
    } catch (error) {
      console.error('[TABLE STATUS PUT] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

