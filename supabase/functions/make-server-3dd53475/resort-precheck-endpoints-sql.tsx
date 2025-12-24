/**
 * ============================================================================
 * RESORT/BOARDING PRE-CHECK ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Complete pre-check system for resort and boarding bookings
 * 
 * Features:
 * - Pre-check health form
 * - Pet health information collection
 * - Vaccination verification
 * - Special requirements handling
 * - Emergency contact management
 * - Room configuration by vendor
 * - Availability management
 * - Medical clearance tracking
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2025-01-27
 * Migration: Phase 6 - Complete KV to SQL Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getResortPreCheckRepository } from "../../lib/repositories/resort-precheck.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getDbClient } from "../../lib/db.ts";

export function resortPreCheckEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const preCheckRepo = getResortPreCheckRepository();
  const bookingsRepo = getBookingsRepository();

  /**
   * POST /resort/pre-check
   * Submit pre-check form
   */
  app.post(`${BASE_PATH}/resort/pre-check`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        bookingId,
        customerId,
        petId,
        petName,
        vendorId,
        healthInfo,
        vaccinations,
        emergencyContacts,
        specialRequirements,
        veterinarian,
        authorization
      } = body;

      if (!bookingId || !customerId || !petId || !vendorId) {
        return sendError(c, 'Missing required fields', 400);
      }

      // Verify required vaccinations
      if (!vaccinations?.rabies?.lastDose || !vaccinations?.dhpp?.lastDose) {
        return sendError(c, 'Rabies and DHPP vaccinations are mandatory', 400);
      }

      // Verify authorization
      if (!authorization?.medicalTreatment || !authorization?.liability) {
        return sendError(c, 'Medical treatment and liability authorization required', 400);
      }

      const preCheckId = `PRECHECK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // ✅ SQL: Create pre-check form
      const preCheckForm = await preCheckRepo.createPreCheckForm({
        pre_check_id: preCheckId,
        booking_id: bookingId,
        customer_id: customerId,
        pet_id: petId,
        pet_name: petName || '',
        vendor_id: vendorId,
        health_info: healthInfo || {
          currentMedications: [],
          allergies: [],
          chronicConditions: [],
          recentIllness: { hasRecent: false },
          surgeryHistory: [],
          behavioralIssues: [],
          specialDiet: { required: false }
        },
        vaccinations: vaccinations || {},
        emergency_contacts: emergencyContacts || [],
        special_requirements: specialRequirements || {
          playAreaAccess: true,
          groupPlayAllowed: true,
          exerciseRequirements: 'moderate',
          groomingNeeded: false,
          medicationAdministration: false,
          cameraAccess: true,
          updateFrequency: 'daily'
        },
        veterinarian: veterinarian || {
          name: '',
          clinicName: '',
          phone: '',
          allowContact: false
        },
        authorization: {
          ...authorization,
          agreedAt: new Date().toISOString()
        },
        status: 'submitted'
      });

      // ✅ SQL: Update booking with pre-check status
      const client = getDbClient();
      const { error: updateError } = await client
        .from('bookings')
        .update({
          pre_check_id: preCheckId,
          pre_check_status: 'submitted',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Error updating booking with pre-check status:', updateError);
        // Don't fail the request if booking update fails, pre-check is already created
      }

      console.log(`✅ Pre-check submitted: ${preCheckId}`);

      return sendSuccess(c, {
        preCheck: {
          preCheckId,
          status: 'submitted',
          message: 'Pre-check submitted successfully. Will be reviewed shortly.'
        }
      }, 'Pre-check form submitted successfully');

    } catch (error) {
      console.error('❌ Error submitting pre-check:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /resort/pre-check/:preCheckId
   * Get pre-check form details
   */
  app.get(`${BASE_PATH}/resort/pre-check/:preCheckId`, async (c) => {
    try {
      const { preCheckId } = c.req.param();

      // ✅ SQL: Get pre-check form
      const preCheck = await preCheckRepo.getPreCheckFormByPreCheckId(preCheckId);
      
      if (!preCheck) {
        return sendError(c, 'Pre-check form not found', 404);
      }

      // Transform to match original interface
      const preCheckResponse = {
        preCheckId: preCheck.pre_check_id,
        bookingId: preCheck.booking_id,
        customerId: preCheck.customer_id,
        petId: preCheck.pet_id,
        petName: preCheck.pet_name,
        vendorId: preCheck.vendor_id,
        healthInfo: preCheck.health_info,
        vaccinations: preCheck.vaccinations,
        emergencyContacts: preCheck.emergency_contacts,
        specialRequirements: preCheck.special_requirements,
        veterinarian: preCheck.veterinarian,
        authorization: preCheck.authorization,
        status: preCheck.status,
        reviewNotes: preCheck.review_notes,
        reviewedBy: preCheck.reviewed_by,
        reviewedAt: preCheck.reviewed_at,
        createdAt: preCheck.created_at,
        updatedAt: preCheck.updated_at
      };

      return sendSuccess(c, { preCheck: preCheckResponse });

    } catch (error) {
      console.error('❌ Error fetching pre-check:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /resort/pre-check/:preCheckId/review
   * Review pre-check form (vendor/admin)
   */
  app.post(`${BASE_PATH}/resort/pre-check/:preCheckId/review`, async (c) => {
    try {
      const { preCheckId } = c.req.param();
      const body = await c.req.json();
      const { status, reviewNotes, reviewedBy } = body;

      const validStatuses = ['approved', 'rejected', 'clarification_needed'];
      
      if (!status || !validStatuses.includes(status)) {
        return sendError(c, 'Invalid status', 400);
      }

      // ✅ SQL: Get pre-check form
      const preCheck = await preCheckRepo.getPreCheckFormByPreCheckId(preCheckId);
      
      if (!preCheck) {
        return sendError(c, 'Pre-check form not found', 404);
      }

      // ✅ SQL: Update pre-check form
      const updatedPreCheck = await preCheckRepo.updatePreCheckForm(preCheckId, {
        status: status as any,
        review_notes: reviewNotes,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString()
      });

      // ✅ SQL: Update booking
      const client = getDbClient();
      const { error: updateError } = await client
        .from('bookings')
        .update({
          pre_check_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', preCheck.booking_id);

      if (updateError) {
        console.error('Error updating booking pre-check status:', updateError);
        // Don't fail if booking update fails
      }

      console.log(`✅ Pre-check ${preCheckId} reviewed: ${status}`);

      return sendSuccess(c, {
        preCheckId,
        status,
        reviewedAt: updatedPreCheck.reviewed_at
      }, 'Pre-check reviewed successfully');

    } catch (error) {
      console.error('❌ Error reviewing pre-check:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /resort/room-configuration
   * Create/Update room configuration (vendor)
   */
  app.post(`${BASE_PATH}/resort/room-configuration`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        roomType,
        roomSize,
        totalRooms,
        features,
        pricing,
        amenities,
        petSizeLimit,
        maxOccupancy,
        photos,
        configId
      } = body;

      if (!vendorId || !roomType || !totalRooms || !pricing) {
        return sendError(c, 'Missing required fields', 400);
      }

      const id = configId || `CONFIG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      if (configId) {
        // ✅ SQL: Update existing configuration
        const existing = await preCheckRepo.getRoomConfigurationByConfigId(configId);
        if (!existing) {
          return sendError(c, 'Room configuration not found', 404);
        }

        const updatedConfig = await preCheckRepo.updateRoomConfiguration(configId, {
          room_type: roomType,
          room_size: roomSize,
          total_rooms: totalRooms,
          available_rooms: totalRooms, // Reset available rooms to total
          features: features || [],
          pricing: pricing,
          amenities: amenities || {
            airConditioning: false,
            heating: false,
            bedding: 'standard',
            toys: true,
            playArea: true,
            cctv: false,
            musicTherapy: false
          },
          pet_size_limit: petSizeLimit || 'any',
          max_occupancy: maxOccupancy || 1,
          photos: photos || [],
          is_active: true
        });

        console.log(`✅ Room configuration updated: ${configId}`);
        return sendSuccess(c, { config: updatedConfig }, 'Room configuration updated successfully');
      } else {
        // ✅ SQL: Create new configuration
        const newConfig = await preCheckRepo.createRoomConfiguration({
          config_id: id,
          vendor_id: vendorId,
          room_type: roomType,
          room_size: roomSize || 'medium',
          total_rooms: totalRooms,
          available_rooms: totalRooms,
          features: features || [],
          pricing: pricing,
          amenities: amenities || {
            airConditioning: false,
            heating: false,
            bedding: 'standard',
            toys: true,
            playArea: true,
            cctv: false,
            musicTherapy: false
          },
          pet_size_limit: petSizeLimit || 'any',
          max_occupancy: maxOccupancy || 1,
          photos: photos || [],
          is_active: true
        });

        console.log(`✅ Room configuration created: ${id}`);
        return sendSuccess(c, { config: newConfig }, 'Room configuration created successfully');
      }

    } catch (error) {
      console.error('❌ Error managing room configuration:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /resort/room-configuration/:vendorId
   * Get vendor's room configurations
   */
  app.get(`${BASE_PATH}/resort/room-configuration/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get room configurations
      const configs = await preCheckRepo.getRoomConfigurationsByVendor(vendorId, true);

      // Transform to match original interface
      const configsResponse = configs.map(config => ({
        configId: config.config_id,
        vendorId: config.vendor_id,
        roomType: config.room_type,
        roomSize: config.room_size,
        totalRooms: config.total_rooms,
        availableRooms: config.available_rooms,
        features: config.features,
        pricing: config.pricing,
        amenities: config.amenities,
        petSizeLimit: config.pet_size_limit,
        maxOccupancy: config.max_occupancy,
        photos: config.photos,
        isActive: config.is_active,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      }));

      return sendSuccess(c, {
        vendorId,
        count: configsResponse.length,
        configurations: configsResponse
      });

    } catch (error) {
      console.error('❌ Error fetching configurations:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /resort/availability/:vendorId
   * Check availability
   */
  app.get(`${BASE_PATH}/resort/availability/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const checkInDate = c.req.query('checkInDate');
      const checkOutDate = c.req.query('checkOutDate');
      const roomType = c.req.query('roomType');

      if (!checkInDate || !checkOutDate) {
        return sendError(c, 'Missing checkInDate or checkOutDate', 400);
      }

      // ✅ SQL: Get room configurations
      let configs = await preCheckRepo.getRoomConfigurationsByVendor(vendorId, true);

      if (roomType) {
        configs = configs.filter((c: any) => c.room_type === roomType);
      }

      // ✅ SQL: Get bookings for date range
      const client = getDbClient();
      const { data: bookings, error: bookingsError } = await client
        .from('bookings')
        .select('id, vendor_id, booking_date, notes, status')
        .eq('vendor_id', vendorId)
        .neq('status', 'cancelled')
        .gte('booking_date', checkInDate)
        .lte('booking_date', checkOutDate);

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        // Continue with empty bookings array
      }

      // Check availability for each room type
      const availability = [];

      for (const config of configs) {
        // Count overlapping bookings for this room type
        // Note: Since bookings table doesn't have roomType directly,
        // we might need to check notes or use a separate junction table
        // For now, we'll estimate based on all bookings
        const bookedCount = bookings?.length || 0;
        const availableCount = Math.max(0, config.total_rooms - bookedCount);

        availability.push({
          roomType: config.room_type,
          roomSize: config.room_size,
          totalRooms: config.total_rooms,
          bookedCount,
          availableCount,
          isAvailable: availableCount > 0,
          pricing: config.pricing,
          features: config.features,
          amenities: config.amenities
        });
      }

      return sendSuccess(c, {
        vendorId,
        checkInDate,
        checkOutDate,
        availability
      });

    } catch (error) {
      console.error('❌ Error checking availability:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /resort/booking/special-requirements
   * Add special requirements to booking
   */
  app.post(`${BASE_PATH}/resort/booking/special-requirements`, async (c) => {
    try {
      const body = await c.req.json();
      const { bookingId, requirements } = body;

      if (!bookingId || !requirements) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // ✅ SQL: Update booking with special requirements
      const client = getDbClient();
      const { error: updateError } = await client
        .from('bookings')
        .update({
          special_requirements: requirements,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) {
        throw updateError;
      }

      console.log(`✅ Special requirements added to booking: ${bookingId}`);

      return sendSuccess(c, {
        bookingId,
        requirements
      }, 'Special requirements added successfully');

    } catch (error) {
      console.error('❌ Error adding requirements:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /resort/vendor/:vendorId/pre-checks
   * Get all pre-checks for vendor
   */
  app.get(`${BASE_PATH}/resort/vendor/:vendorId/pre-checks`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status') || undefined;

      // ✅ SQL: Get pre-checks for vendor
      const preChecks = await preCheckRepo.getPreCheckFormsByVendor(vendorId, status);

      // Transform to match original interface
      const preChecksResponse = preChecks.map(preCheck => ({
        preCheckId: preCheck.pre_check_id,
        bookingId: preCheck.booking_id,
        customerId: preCheck.customer_id,
        petId: preCheck.pet_id,
        petName: preCheck.pet_name,
        vendorId: preCheck.vendor_id,
        healthInfo: preCheck.health_info,
        vaccinations: preCheck.vaccinations,
        emergencyContacts: preCheck.emergency_contacts,
        specialRequirements: preCheck.special_requirements,
        veterinarian: preCheck.veterinarian,
        authorization: preCheck.authorization,
        status: preCheck.status,
        reviewNotes: preCheck.review_notes,
        reviewedBy: preCheck.reviewed_by,
        reviewedAt: preCheck.reviewed_at,
        createdAt: preCheck.created_at,
        updatedAt: preCheck.updated_at
      }));

      return sendSuccess(c, {
        vendorId,
        count: preChecksResponse.length,
        preChecks: preChecksResponse
      });

    } catch (error) {
      console.error('❌ Error fetching vendor pre-checks:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Resort Pre-Check Endpoints (SQL) registered');
}

