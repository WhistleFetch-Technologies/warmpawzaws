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

import { Hono } from "hono";
import * as kv from "./kv_store";

const BASE = '/make-server-3dd53475';

export function registerCapabilityEndpoints(app: Hono) {

  // ==========================================
  // CAFE PAX (GUEST) MANAGEMENT
  // ==========================================

  /**
   * GET /vendor/cafe/:vendorId/pax-config
   * Get pax configuration for a cafe vendor
   */
  app.get(`${BASE}/vendor/cafe/:vendorId/pax-config`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get pax config
      const config = await kv.get(`vendor:${vendorId}:pax_config`) || {
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
   */
  app.put(`${BASE}/vendor/cafe/:vendorId/pax-config`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const config = await c.req.json();

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Validate config
      if (config.maxGuestsPerTable < 1 || config.maxPetsPerTable < 1) {
        return c.json({ error: 'Invalid capacity limits' }, 400);
      }

      // Save config
      await kv.set(`vendor:${vendorId}:pax_config`, {
        ...config,
        updatedAt: new Date().toISOString()
      });

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

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get rooms
      const rooms = await kv.get(`vendor:${vendorId}:boarding_rooms`) || [];

      // Get bookings for the date
      const vendorBookingsKey = `vendor:${vendorId}:bookings`;
      const bookingIds = await kv.get(vendorBookingsKey) || [];
      
      const bookings = [];
      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking && 
            booking.serviceType === 'boarding' &&
            booking.status !== 'cancelled' &&
            booking.metadata?.checkinDate &&
            booking.metadata?.checkoutDate) {
          const checkIn = new Date(booking.metadata.checkinDate).toISOString().split('T')[0];
          const checkOut = new Date(booking.metadata.checkoutDate).toISOString().split('T')[0];
          const targetDate = new Date(date).toISOString().split('T')[0];
          
          if (targetDate >= checkIn && targetDate <= checkOut) {
            bookings.push({
              id: booking.id,
              bookingId: booking.bookingId,
              roomId: booking.metadata?.roomId,
              roomName: booking.metadata?.roomName || 'Unknown',
              customerName: booking.customerName,
              petName: booking.petName,
              checkInDate: booking.metadata.checkinDate,
              checkOutDate: booking.metadata.checkoutDate,
              status: booking.status,
              guestCount: booking.metadata?.guestCount || 1,
              petCount: booking.metadata?.petCount || 1
            });
          }
        }
      }

      // Calculate occupancy per room
      const occupancy = rooms.map((room: any) => {
        const roomBookings = bookings.filter((b: any) => b.roomId === room.id);
        const occupiedUnits = roomBookings.length;
        const totalUnits = room.totalInventory || 1;
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

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get pricing rules
      const pricingRules = await kv.get(`vendor:${vendorId}:boarding_pricing`) || [];

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

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Validate required fields
      if (!pricingData.roomId || !pricingData.baseNightPrice) {
        return c.json({ error: 'Missing required fields: roomId, baseNightPrice' }, 400);
      }

      // Verify room exists
      const rooms = await kv.get(`vendor:${vendorId}:boarding_rooms`) || [];
      const room = rooms.find((r: any) => r.id === pricingData.roomId);
      if (!room) {
        return c.json({ error: 'Room not found' }, 404);
      }

      const ruleId = `pricing_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const pricingRule = {
        id: ruleId,
        vendorId,
        roomId: pricingData.roomId,
        roomName: room.name,
        baseNightPrice: Number(pricingData.baseNightPrice),
        sizeBasedPricing: pricingData.sizeBasedPricing || {
          small: Number(pricingData.baseNightPrice),
          medium: Number(pricingData.baseNightPrice),
          large: Number(pricingData.baseNightPrice),
          extraLarge: Number(pricingData.baseNightPrice)
        },
        seasonalPricing: pricingData.seasonalPricing || [],
        specialOffers: pricingData.specialOffers || [],
        isActive: pricingData.isActive !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Get existing rules
      const pricingRules = await kv.get(`vendor:${vendorId}:boarding_pricing`) || [];
      pricingRules.push(pricingRule);
      await kv.set(`vendor:${vendorId}:boarding_pricing`, pricingRules);

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

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get existing rules
      const pricingRules = await kv.get(`vendor:${vendorId}:boarding_pricing`) || [];
      const ruleIndex = pricingRules.findIndex((r: any) => r.id === ruleId);

      if (ruleIndex === -1) {
        return c.json({ error: 'Pricing rule not found' }, 404);
      }

      // Update rule
      pricingRules[ruleIndex] = {
        ...pricingRules[ruleIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`vendor:${vendorId}:boarding_pricing`, pricingRules);

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

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get existing rules
      const pricingRules = await kv.get(`vendor:${vendorId}:boarding_pricing`) || [];
      const filteredRules = pricingRules.filter((r: any) => r.id !== ruleId);

      await kv.set(`vendor:${vendorId}:boarding_pricing`, filteredRules);

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

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get doctors associated with this clinic
      const doctorIds = vendor.doctors || [];
      const doctors = [];

      for (const doctorId of doctorIds) {
        const doctor = await kv.get(`doctor:${doctorId}`);
        if (doctor) {
          doctors.push(doctor);
        }
      }

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

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Validate required fields
      if (!doctorData.name || !doctorData.phone) {
        return c.json({ error: 'Missing required fields: name, phone' }, 400);
      }

      const doctorId = `doctor_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const doctor = {
        id: doctorId,
        clinicId: vendorId,
        name: doctorData.name,
        phone: doctorData.phone,
        email: doctorData.email || '',
        specialization: doctorData.specialization || [],
        experience: doctorData.experience || 0,
        qualifications: doctorData.qualifications || [],
        about: doctorData.about || '',
        consultationFee: doctorData.consultationFee || 0,
        profilePhoto: doctorData.profilePhoto || '',
        isActive: true,
        totalAppointments: 0,
        completedAppointments: 0,
        rating: 0,
        totalReviews: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save doctor
      await kv.set(`doctor:${doctorId}`, doctor);

      // Add to clinic's doctor list
      if (!vendor.doctors) {
        vendor.doctors = [];
      }
      vendor.doctors.push(doctorId);
      vendor.totalDoctors = vendor.doctors.length;
      vendor.updatedAt = new Date().toISOString();
      await kv.set(`vendor:${vendorId}`, vendor);

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

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Verify doctor exists and belongs to clinic
      const doctor = await kv.get(`doctor:${doctorId}`);
      if (!doctor) {
        return c.json({ error: 'Doctor not found' }, 404);
      }

      if (doctor.clinicId !== vendorId) {
        return c.json({ error: 'Doctor does not belong to this clinic' }, 403);
      }

      // Update doctor
      const updatedDoctor = {
        ...doctor,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`doctor:${doctorId}`, updatedDoctor);

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

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Verify doctor exists
      const doctor = await kv.get(`doctor:${doctorId}`);
      if (!doctor) {
        return c.json({ error: 'Doctor not found' }, 404);
      }

      // Remove from clinic's doctor list
      if (vendor.doctors) {
        vendor.doctors = vendor.doctors.filter((id: string) => id !== doctorId);
        vendor.totalDoctors = vendor.doctors.length;
        vendor.updatedAt = new Date().toISOString();
        await kv.set(`vendor:${vendorId}`, vendor);
      }

      // Mark doctor as inactive (soft delete)
      doctor.isActive = false;
      doctor.clinicId = null;
      doctor.updatedAt = new Date().toISOString();
      await kv.set(`doctor:${doctorId}`, doctor);

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

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get table
      const table = await kv.get(`cafe:table:${tableId}`);
      if (!table) {
        return c.json({ error: 'Table not found' }, 404);
      }

      if (table.vendorId !== vendorId) {
        return c.json({ error: 'Table does not belong to this vendor' }, 403);
      }

      // Update table
      const updatedTable = {
        ...table,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`cafe:table:${tableId}`, updatedTable);

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

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get table
      const table = await kv.get(`cafe:table:${tableId}`);
      if (!table) {
        return c.json({ error: 'Table not found' }, 404);
      }

      if (table.vendorId !== vendorId) {
        return c.json({ error: 'Table does not belong to this vendor' }, 403);
      }

      // Validate status
      const validStatuses = ['available', 'occupied', 'reserved', 'maintenance'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
      }

      // Update status
      table.status = status;
      table.updatedAt = new Date().toISOString();
      await kv.set(`cafe:table:${tableId}`, table);

      return c.json({ success: true, table });
    } catch (error) {
      console.error('[TABLE STATUS PUT] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

