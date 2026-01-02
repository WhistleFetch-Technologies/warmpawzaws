import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 🏨 RESORT/BOARDING PRE-CHECK ENDPOINTS
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
 */

interface PreCheckForm {
  preCheckId: string;
  bookingId: string;
  customerId: string;
  petId: string;
  petName: string;
  vendorId: string;
  
  // Health Information
  healthInfo: {
    currentMedications: Array<{
      medicationName: string;
      dosage: string;
      frequency: string;
      instructions: string;
    }>;
    allergies: string[];
    chronicConditions: string[];
    recentIllness: {
      hasRecent: boolean;
      description?: string;
      treatedBy?: string;
      date?: string;
    };
    surgeryHistory: Array<{
      surgeryType: string;
      date: string;
      notes?: string;
    }>;
    behavioralIssues: string[];
    specialDiet: {
      required: boolean;
      details?: string;
      restrictions?: string[];
    };
  };

  // Vaccination Records
  vaccinations: {
    rabies: {
      lastDose: string;
      nextDue: string;
      certificateUrl?: string;
      verified: boolean;
    };
    dhpp: {
      lastDose: string;
      nextDue: string;
      certificateUrl?: string;
      verified: boolean;
    };
    bordetella: {
      lastDose: string;
      nextDue: string;
      certificateUrl?: string;
      verified: boolean;
    };
    otherVaccinations?: Array<{
      name: string;
      lastDose: string;
      nextDue?: string;
      certificateUrl?: string;
    }>;
  };

  // Emergency Contacts
  emergencyContacts: Array<{
    contactId: string;
    name: string;
    relationship: string;
    phone: string;
    alternatePhone?: string;
    isVeterinarian: boolean;
  }>;

  // Special Requirements
  specialRequirements: {
    roomPreference?: 'indoor' | 'outdoor' | 'climate_controlled' | 'garden_view';
    playAreaAccess: boolean;
    groupPlayAllowed: boolean;
    exerciseRequirements: string;
    groomingNeeded: boolean;
    medicationAdministration: boolean;
    cameraAccess: boolean;
    updateFrequency: 'daily' | 'twice_daily' | 'on_request';
    specialInstructions?: string;
  };

  // Veterinarian Information
  veterinarian: {
    name: string;
    clinicName: string;
    phone: string;
    email?: string;
    address?: string;
    allowContact: boolean;
  };

  // Authorization
  authorization: {
    medicalTreatment: boolean;
    emergencyVetVisit: boolean;
    photos: boolean;
    liability: boolean;
    signatureUrl?: string;
    agreedAt: string;
  };

  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'clarification_needed';
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface RoomConfiguration {
  configId: string;
  vendorId: string;
  roomType: 'standard' | 'deluxe' | 'suite' | 'outdoor' | 'climate_controlled';
  roomSize: 'small' | 'medium' | 'large' | 'extra_large';
  totalRooms: number;
  availableRooms: number;
  features: string[];
  pricing: {
    dailyRate: number;
    weeklyRate: number;
    monthlyRate: number;
    peakSeasonSurcharge?: number;
  };
  amenities: {
    airConditioning: boolean;
    heating: boolean;
    bedding: string;
    toys: boolean;
    playArea: boolean;
    cctv: boolean;
    musicTherapy: boolean;
  };
  petSizeLimit: 'small' | 'medium' | 'large' | 'any';
  maxOccupancy: number;
  photos: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AvailabilityCalendar {
  availabilityId: string;
  vendorId: string;
  roomType: string;
  date: string;
  totalCapacity: number;
  bookedCount: number;
  availableCount: number;
  blockedSlots: Array<{
    reason: string;
    count: number;
    notes?: string;
    }>;
  pricing: {
    baseRate: number;
    surcharge: number;
    totalRate: number;
  };
  updatedAt: string;
}

export function resortPreCheckEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

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
      if (!vaccinations.rabies.lastDose || !vaccinations.dhpp.lastDose) {
        return sendError(c, 'Rabies and DHPP vaccinations are mandatory', 400);
      }

      // Verify authorization
      if (!authorization.medicalTreatment || !authorization.liability) {
        return sendError(c, 'Medical treatment and liability authorization required', 400);
      }

      const preCheckId = `PRECHECK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const preCheck: PreCheckForm = {
        preCheckId,
        bookingId,
        customerId,
        petId,
        petName: petName || '',
        vendorId,
        healthInfo: healthInfo || {
          currentMedications: [],
          allergies: [],
          chronicConditions: [],
          recentIllness: { hasRecent: false },
          surgeryHistory: [],
          behavioralIssues: [],
          specialDiet: { required: false }
        },
        vaccinations,
        emergencyContacts: emergencyContacts || [],
        specialRequirements: specialRequirements || {
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
        status: 'submitted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`resort:precheck:${preCheckId}`, preCheck);

      // Update booking with pre-check status
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        booking.preCheckId = preCheckId;
        booking.preCheckStatus = 'submitted';
        await kv.set(`booking:${bookingId}`, booking);
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

      const preCheck = await kv.get(`resort:precheck:${preCheckId}`);
      
      if (!preCheck) {
        return sendError(c, 'Pre-check form not found', 404);
      }

      return sendSuccess(c, { preCheck });

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

      const preCheck = await kv.get(`resort:precheck:${preCheckId}`);
      
      if (!preCheck) {
        return sendError(c, 'Pre-check form not found', 404);
      }

      preCheck.status = status;
      preCheck.reviewNotes = reviewNotes;
      preCheck.reviewedBy = reviewedBy;
      preCheck.reviewedAt = new Date().toISOString();
      preCheck.updatedAt = new Date().toISOString();

      await kv.set(`resort:precheck:${preCheckId}`, preCheck);

      // Update booking
      const booking = await kv.get(`booking:${preCheck.bookingId}`);
      if (booking) {
        booking.preCheckStatus = status;
        await kv.set(`booking:${preCheck.bookingId}`, booking);
      }

      console.log(`✅ Pre-check ${preCheckId} reviewed: ${status}`);

      return sendSuccess(c, {
        preCheckId,
        status,
        reviewedAt: preCheck.reviewedAt
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

      const config: RoomConfiguration = {
        configId: id,
        vendorId,
        roomType,
        roomSize: roomSize || 'medium',
        totalRooms,
        availableRooms: totalRooms,
        features: features || [],
        pricing,
        amenities: amenities || {
          airConditioning: false,
          heating: false,
          bedding: 'standard',
          toys: true,
          playArea: true,
          cctv: false,
          musicTherapy: false
        },
        petSizeLimit: petSizeLimit || 'any',
        maxOccupancy: maxOccupancy || 1,
        photos: photos || [],
        isActive: true,
        createdAt: configId ? (await kv.get(`resort:room:${configId}`))?.createdAt || new Date().toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`resort:room:${id}`, config);

      console.log(`✅ Room configuration ${configId ? 'updated' : 'created'}: ${id}`);

      return sendSuccess(c, { config }, `Room configuration ${configId ? 'updated' : 'created'} successfully`);

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

      const allConfigs = await kv.getByPrefix('resort:room:') || [];
      
      const configs = allConfigs
        .map((item: any) => item.value || item)
        .filter((config: any) => config.vendorId === vendorId && config.isActive);

      return sendSuccess(c, {
        vendorId,
        count: configs.length,
        configurations: configs
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

      // Get room configurations
      const allConfigs = await kv.getByPrefix('resort:room:') || [];
      
      let configs = allConfigs
        .map((item: any) => item.value || item)
        .filter((config: any) => config.vendorId === vendorId && config.isActive);

      if (roomType) {
        configs = configs.filter((c: any) => c.roomType === roomType);
      }

      // Check availability for each room type
      const availability = [];

      for (const config of configs) {
        // Get bookings for date range
        const allBookings = await kv.getByPrefix('booking:') || [];
        
        const overlappingBookings = allBookings
          .map((item: any) => item.value || item)
          .filter((booking: any) => 
            booking.vendorId === vendorId &&
            booking.roomType === config.roomType &&
            booking.status !== 'cancelled' &&
            // Check for date overlap
            !(new Date(booking.checkOutDate) < new Date(checkInDate) ||
              new Date(booking.checkInDate) > new Date(checkOutDate))
          );

        const bookedCount = overlappingBookings.length;
        const availableCount = Math.max(0, config.totalRooms - bookedCount);

        availability.push({
          roomType: config.roomType,
          roomSize: config.roomSize,
          totalRooms: config.totalRooms,
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

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      booking.specialRequirements = requirements;
      booking.updatedAt = new Date().toISOString();

      await kv.set(`booking:${bookingId}`, booking);

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
      const status = c.req.query('status');

      const allPreChecks = await kv.getByPrefix('resort:precheck:') || [];
      
      let preChecks = allPreChecks
        .map((item: any) => item.value || item)
        .filter((preCheck: any) => preCheck.vendorId === vendorId);

      if (status) {
        preChecks = preChecks.filter((p: any) => p.status === status);
      }

      preChecks.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return sendSuccess(c, {
        vendorId,
        count: preChecks.length,
        preChecks
      });

    } catch (error) {
      console.error('❌ Error fetching vendor pre-checks:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Resort Pre-Check Endpoints registered');
}
