/**
 * ============================================================================
 * PETS MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles pet management:
 * - Create/update/delete pets
 * - Get customer pets
 * - Pet profiles
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { presignS3GetUrlIfApplicable } from '../utils/s3-media-presign';
import {
  buildVaccinationStorage,
  extractHealthRecordsForClient,
  extractVaccinationsForClient,
  flatMapFromVaccinationEntries,
  mergeHealthRecordsForStorage,
  sanitizeVaccinationMap,
} from '../utils/pet-health-normalize';
import { findCustomerByPhone } from '../utils/customer-phone-lookup';
import { omitMissingPetsColumns } from '../utils/pets-table-schema';

export function registerPetEndpoints(app: Hono) {
  /**
   * GET /pets/customer/:customerId
   * Get all pets for a customer
   */
  app.get("/pets/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      const pets = await select('pets',
        { customer_id: customerId },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );

      return c.json({
        success: true,
        pets: pets.map((pet: any) => ({
          id: pet.id,
          name: pet.name,
          species: pet.species, // Schema uses 'species', not 'type' or 'pet_type'
          breed: pet.breed,
          age_years: pet.age_years,
          age_months: pet.age_months,
          gender: pet.gender,
          weight_kg: pet.weight_kg,
          profile_photo_url: pet.profile_photo_url,
          medical_history: pet.medical_history || {},
          createdAt: pet.created_at,
        })),
        count: pets.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer pets:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/pets/:petId
   * Get pet details (customer-facing endpoint)
   */
  app.get("/customer/pets/:petId", async (c) => {
    try {
      const { petId } = c.req.param();

      const pets = await select('pets', { id: petId });
      if (pets.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const pet = pets[0];
      const photo =
        (await presignS3GetUrlIfApplicable(pet.profile_photo_url)) || pet.profile_photo_url;

      return c.json({
        success: true,
        pet: {
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          age_years: pet.age_years,
          age_months: pet.age_months,
          gender: pet.gender,
          weight_kg: pet.weight_kg,
          photo,
          profile_photo_url: photo,
          medical_history: pet.medical_history || {},
          createdAt: pet.created_at,
        },
      });
    } catch (error: any) {
      console.error('Error fetching pet:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:phone/pets/:petId
   * Get pet details with phone-based ownership validation
   * ✅ FIX: Added to resolve CUST-PET-001 - Pet not found issue
   */
  app.get("/customer/:phone/pets/:petId", async (c) => {
    try {
      const { phone, petId } = c.req.param();

      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Get pet and verify ownership
      const pets = await select('pets', { id: petId, customer_id: customer.id });
      if (pets.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const pet = pets[0];
      const photo =
        (await presignS3GetUrlIfApplicable(pet.profile_photo_url)) || pet.profile_photo_url;
      const vaccinations = extractVaccinationsForClient(pet);

      // Map to frontend-expected format
      return c.json({
        success: true,
        pet: {
          id: pet.id,
          name: pet.name,
          type: pet.species || 'Dog',
          species: pet.species,
          breed: pet.breed,
          age: pet.age_years?.toString() || pet.age_months?.toString() || '',
          age_years: pet.age_years,
          age_months: pet.age_months,
          gender: pet.gender,
          weight: pet.weight_kg?.toString() || '',
          weight_kg: pet.weight_kg,
          photo,
          profile_photo_url: photo,
          microchipId: pet.microchip_id,
          healthRecords: extractHealthRecordsForClient(pet.medical_history),
          vaccinations,
          medical_history: pet.medical_history || {},
          createdAt: pet.created_at,
        },
      });
    } catch (error: any) {
      console.error('Error fetching pet by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pets/:petId
   * Get pet details
   */
  app.get("/pets/:petId", async (c) => {
    try {
      const { petId } = c.req.param();

      const pets = await select('pets', { id: petId });
      if (pets.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const pet = pets[0];
      const profilePhoto =
        (await presignS3GetUrlIfApplicable(pet.profile_photo_url)) || pet.profile_photo_url;

      // Get medical records count
      const medicalRecords = await query(
        'SELECT COUNT(*) as count FROM medical_records WHERE pet_id = $1',
        [petId]
      );

      // Get prescriptions count
      const prescriptions = await query(
        'SELECT COUNT(*) as count FROM prescriptions WHERE pet_id = $1',
        [petId]
      );

      // Get bookings count
      const bookings = await query(
        'SELECT COUNT(*) as count FROM bookings WHERE customer_id = $1',
        [pet.customer_id]
      );

      return c.json({
        success: true,
        pet: {
          ...pet,
          profile_photo_url: profilePhoto,
          photo: profilePhoto,
          medicalRecordsCount: parseInt(medicalRecords.rows[0]?.count || '0', 10),
          prescriptionsCount: parseInt(prescriptions.rows[0]?.count || '0', 10),
          bookingsCount: parseInt(bookings.rows[0]?.count || '0', 10),
        },
      });
    } catch (error: any) {
      console.error('Error fetching pet:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pets
   * Create a new pet
   * ✅ ENHANCED: Now supports vaccination records, allergies, chronic conditions, behavior notes
   */
  app.post("/pets", async (c) => {
    try {
      const petData = await c.req.json();
      const {
        customerId,
        name,
        petType,
        breed,
        age,
        ageUnit,
        gender,
        size,
        color,
        weight,
        photos,
        photo, // ✅ NEW: Single photo field from EnhancedAddPetModal
        medicalHistory,
        vaccinationStatus,
        spayedNeutered,
        microchipped,
        specialNeeds,
        // ✅ NEW: Enhanced pet fields from EnhancedAddPetModal
        dob,
        microchipId,
        allergies,
        chronicConditions,
        vaccinations,
        behaviorNotes,
        feedingSchedule,
        dietaryRestrictions,
        emergencyContact,
      } = petData;

      if (!customerId || !name || !petType) {
        return c.json({ error: 'customerId, name, and petType are required' }, 400);
      }

      // ✅ PLATFORM RESTRICTION: Only allow Dog and Cat
      const allowedPetTypes = ['Dog', 'Cat', 'dog', 'cat'];
      const petTypeToValidate = petType || petData.type || petData.species;
      if (!allowedPetTypes.includes(petTypeToValidate)) {
        return c.json({ 
          error: 'Invalid pet type. Platform currently supports Dogs and Cats only.',
          allowedTypes: ['Dog', 'Cat']
        }, 400);
      }

      // Schema uses: species, age_years, age_months, weight_kg, profile_photo_url
      // Convert age to years/months if needed
      let age_years = null;
      let age_months = null;
      if (age) {
        if (ageUnit === 'years' || ageUnit === 'year') {
          age_years = parseInt(age, 10);
        } else if (ageUnit === 'months' || ageUnit === 'month') {
          age_months = parseInt(age, 10);
        } else {
          // Default to months if unit not specified
          age_months = parseInt(age, 10);
        }
      }
      
      // ✅ NEW: Calculate age from DOB if provided
      if (dob && !age_years && !age_months) {
        const birthDate = new Date(dob);
        const now = new Date();
        const ageInMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + 
                           (now.getMonth() - birthDate.getMonth());
        age_years = Math.floor(ageInMonths / 12);
        age_months = ageInMonths % 12;
      }

      // ✅ NEW: Build comprehensive medical history JSONB
      const enhancedMedicalHistory = {
        ...medicalHistory,
        dob: dob || null,
        microchipId: microchipId || microchipped || null,
        allergies: allergies || [],
        chronicConditions: chronicConditions || [],
        vaccinations: vaccinations || [],
        behaviorNotes: behaviorNotes || null,
        feedingSchedule: feedingSchedule || null,
        dietaryRestrictions: dietaryRestrictions || [],
        spayedNeutered: spayedNeutered || false,
        specialNeeds: specialNeeds || null,
        emergencyContact: emergencyContact || null,
        vaccinationStatus: vaccinationStatus || 'unknown',
        color: color || null,
        size: size || null,
      };

      const flatFromWizard = flatMapFromVaccinationEntries(vaccinations || []);
      const { vaccination_records, medical_history } = buildVaccinationStorage(
        enhancedMedicalHistory,
        flatFromWizard
      );

      // Determine profile photo URL (prefer single photo over photos array)
      const profilePhotoUrl = photo || (photos && photos.length > 0 ? photos[0] : null);

      const insertPayload = await omitMissingPetsColumns({
        customer_id: customerId,
        name: name,
        species: petType || petData.type || petData.species, // Schema uses 'species', not 'pet_type'
        breed: breed || null,
        age_years: age_years,
        age_months: age_months,
        gender: gender || null,
        weight_kg: weight ? parseFloat(weight) : null, // Schema uses weight_kg
        profile_photo_url: profilePhotoUrl, // Schema uses profile_photo_url
        medical_history,
        vaccination_records,
      });

      const pet = await insert('pets', insertPayload);

      return c.json({
        success: true,
        pet: pet[0],
        message: 'Pet created successfully',
      });
    } catch (error: any) {
      console.error('Error creating pet:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /pets/:petId
   * Update pet
   * ✅ ENHANCED: Now supports vaccination records, allergies, chronic conditions, behavior notes
   */
  app.put("/pets/:petId", async (c) => {
    try {
      const { petId } = c.req.param();
      const petData = await c.req.json();

      // Get existing pet to merge medical history
      const existingPets = await select('pets', { id: petId });
      const existingMedicalHistory = existingPets.length > 0 ? existingPets[0].medical_history || {} : {};

      // ✅ NEW: Build comprehensive medical history JSONB by merging with existing
      const enhancedMedicalHistory = {
        ...existingMedicalHistory,
        ...(petData.medicalHistory || petData.medical_history || {}),
        dob: petData.dob ?? existingMedicalHistory.dob ?? null,
        microchipId: petData.microchipId ?? existingMedicalHistory.microchipId ?? null,
        allergies: petData.allergies ?? existingMedicalHistory.allergies ?? [],
        chronicConditions: petData.chronicConditions ?? existingMedicalHistory.chronicConditions ?? [],
        vaccinations: petData.vaccinations ?? existingMedicalHistory.vaccinations ?? [],
        behaviorNotes: petData.behaviorNotes ?? existingMedicalHistory.behaviorNotes ?? null,
        feedingSchedule: petData.feedingSchedule ?? existingMedicalHistory.feedingSchedule ?? null,
        dietaryRestrictions: petData.dietaryRestrictions ?? existingMedicalHistory.dietaryRestrictions ?? [],
        spayedNeutered: petData.spayedNeutered ?? existingMedicalHistory.spayedNeutered ?? false,
        specialNeeds: petData.specialNeeds ?? existingMedicalHistory.specialNeeds ?? null,
        emergencyContact: petData.emergencyContact ?? existingMedicalHistory.emergencyContact ?? null,
        vaccinationStatus: petData.vaccinationStatus ?? existingMedicalHistory.vaccinationStatus ?? 'unknown',
        color: petData.color ?? existingMedicalHistory.color ?? null,
        size: petData.size ?? existingMedicalHistory.size ?? null,
      };

      // Convert age if provided
      const updateData: any = {
        name: petData.name,
        breed: petData.breed,
        gender: petData.gender,
        weight_kg: petData.weight ? parseFloat(petData.weight) : undefined,
        profile_photo_url: petData.photo || (petData.photos && petData.photos.length > 0 ? petData.photos[0] : undefined),
        medical_history: enhancedMedicalHistory,
      };

      if (petData.age) {
        if (petData.ageUnit === 'years' || petData.ageUnit === 'year') {
          updateData.age_years = parseInt(petData.age, 10);
        } else if (petData.ageUnit === 'months' || petData.ageUnit === 'month') {
          updateData.age_months = parseInt(petData.age, 10);
        }
      }
      
      // ✅ NEW: Calculate age from DOB if provided
      if (petData.dob && !petData.age) {
        const birthDate = new Date(petData.dob);
        const now = new Date();
        const ageInMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + 
                           (now.getMonth() - birthDate.getMonth());
        updateData.age_years = Math.floor(ageInMonths / 12);
        updateData.age_months = ageInMonths % 12;
      }

      if (petData.species || petData.petType || petData.type) {
        const newSpecies = petData.species || petData.petType || petData.type;
        
        // ✅ PLATFORM RESTRICTION: Only allow Dog and Cat
        const allowedPetTypes = ['Dog', 'Cat', 'dog', 'cat'];
        if (!allowedPetTypes.includes(newSpecies)) {
          return c.json({ 
            error: 'Invalid pet type. Platform currently supports Dogs and Cats only.',
            allowedTypes: ['Dog', 'Cat']
          }, 400);
        }
        
        updateData.species = newSpecies;
      }

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const updated = await update('pets', { id: petId }, updateData);

      if (updated.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      return c.json({
        success: true,
        pet: updated[0],
        message: 'Pet updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating pet:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /pets/:petId
   * Delete pet
   */
  app.delete("/pets/:petId", async (c) => {
    try {
      const { petId } = c.req.param();

      // Unlink booking history from this pet (preserves rows; avoids bookings_pet_id_fkey on DELETE)
      await query(
        'UPDATE bookings SET pet_id = NULL, updated_at = NOW() WHERE pet_id = $1',
        [petId]
      );

      await query('DELETE FROM pets WHERE id = $1', [petId]);

      return c.json({
        success: true,
        message: 'Pet deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting pet:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /customer/:phone/pets/:petId
   * Update pet with phone-based ownership validation
   * ✅ FIX: Added to support frontend update calls
   */
  app.put("/customer/:phone/pets/:petId", async (c) => {
    try {
      const { phone, petId } = c.req.param();
      const petData = await c.req.json();

      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Verify pet ownership
      const pets = await select('pets', { id: petId, customer_id: customer.id });
      if (pets.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const existingPet = pets[0];
      const existingMedicalHistory = (existingPet.medical_history || {}) as Record<string, unknown>;

      const incomingHealth =
        petData.healthRecords || petData.medicalHistory || petData.medical_history || {};
      const mergedHealth = mergeHealthRecordsForStorage(existingMedicalHistory, incomingHealth);
      const existingVac = extractVaccinationsForClient(existingPet);
      const incomingVacFromHealth = (incomingHealth as Record<string, unknown>).vaccinationDates as
        | Record<string, string>
        | undefined;
      const mergedVac = sanitizeVaccinationMap({
        ...existingVac,
        ...(incomingVacFromHealth || {}),
        ...(petData.vaccinations != null ? (petData.vaccinations as Record<string, string>) : {}),
      });
      const { vaccination_records, medical_history } = buildVaccinationStorage(
        mergedHealth,
        mergedVac
      );

      const updateData: any = {
        name: petData.name,
        breed: petData.breed,
        gender: petData.gender,
        weight_kg: petData.weight != null && petData.weight !== '' ? parseFloat(String(petData.weight)) : undefined,
        profile_photo_url: petData.photo || petData.photos?.[0] || undefined,
        medical_history,
        vaccination_records,
        microchip_id: petData.microchipId ?? existingPet.microchip_id,
      };

      if (petData.age) {
        if (petData.ageUnit === 'years' || petData.ageUnit === 'year') {
          updateData.age_years = parseInt(petData.age, 10);
        } else if (petData.ageUnit === 'months' || petData.ageUnit === 'month') {
          updateData.age_months = parseInt(petData.age, 10);
        } else {
          // Default: assume years if just a number
          updateData.age_years = parseInt(petData.age, 10);
        }
      }

      if (petData.species || petData.petType || petData.type) {
        const newSpecies = petData.species || petData.petType || petData.type;
        
        // ✅ PLATFORM RESTRICTION: Only allow Dog and Cat
        const allowedPetTypes = ['Dog', 'Cat', 'dog', 'cat'];
        if (!allowedPetTypes.includes(newSpecies)) {
          return c.json({ 
            error: 'Invalid pet type. Platform currently supports Dogs and Cats only.',
            allowedTypes: ['Dog', 'Cat']
          }, 400);
        }
        
        updateData.species = newSpecies;
      }

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const safeUpdateData = await omitMissingPetsColumns(updateData);

      const updated = await update('pets', { id: petId, customer_id: customer.id }, safeUpdateData);

      if (updated.length === 0) {
        return c.json({ error: 'Pet not found or update failed' }, 404);
      }

      const pet = updated[0];
      const vaccinations = extractVaccinationsForClient(pet);
      return c.json({
        success: true,
        pet: {
          id: pet.id,
          name: pet.name,
          type: pet.species,
          species: pet.species,
          breed: pet.breed,
          age: pet.age_years?.toString() || pet.age_months?.toString() || '',
          age_years: pet.age_years,
          age_months: pet.age_months,
          gender: pet.gender,
          weight: pet.weight_kg?.toString() || '',
          photo: pet.profile_photo_url,
          healthRecords: extractHealthRecordsForClient(pet.medical_history),
          vaccinations,
        },
        message: 'Pet updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating pet by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /customer/:phone/pets/:petId
   * Delete pet with phone-based ownership validation
   * ✅ FIX: Added to support frontend delete calls
   */
  app.delete("/customer/:phone/pets/:petId", async (c) => {
    try {
      const { phone, petId } = c.req.param();

      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Verify pet ownership before deletion
      const pets = await select('pets', { id: petId, customer_id: customer.id });
      if (pets.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      // Check for active bookings
      const activeBookings = await query(
        'SELECT COUNT(*) as count FROM bookings WHERE pet_id = $1 AND status IN ($2, $3, $4)',
        [petId, 'confirmed', 'in_progress', 'scheduled']
      );
      const activeCount = parseInt(activeBookings.rows[0]?.count || '0', 10);

      if (activeCount > 0) {
        return c.json({ 
          success: false,
          error: 'Cannot delete pet with active bookings',
          activeBookingsCount: activeCount
        }, 400);
      }

      // Preserve booking rows but remove FK: completed/cancelled history still references pet_id
      await query(
        'UPDATE bookings SET pet_id = NULL, updated_at = NOW() WHERE pet_id = $1 AND customer_id = $2',
        [petId, customer.id]
      );

      await query('DELETE FROM pets WHERE id = $1 AND customer_id = $2', [petId, customer.id]);

      return c.json({
        success: true,
        message: 'Pet deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting pet by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:phone/pets/:petId/bookings
   * Get pet bookings with phone-based ownership validation
   * ✅ FIX: Added to support frontend booking history calls
   */
  app.get("/customer/:phone/pets/:petId/bookings", async (c) => {
    try {
      const { phone, petId } = c.req.param();

      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Verify pet ownership
      const pets = await select('pets', { id: petId, customer_id: customer.id });
      if (pets.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      // Resolve bookings table capabilities once so this endpoint works across schema versions.
      const bookingColumnsResult = await query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'bookings'
           AND column_name = ANY($1::text[])`,
        [['pet_id', 'scheduled_date', 'scheduled_time', 'booking_date', 'booking_time', 'notes']]
      );
      const bookingColumns = new Set<string>(
        (bookingColumnsResult.rows || []).map((r: any) => String(r.column_name))
      );
      const hasPetIdColumn = bookingColumns.has('pet_id');
      const hasNotesColumn = bookingColumns.has('notes');
      const hasScheduledDateColumn = bookingColumns.has('scheduled_date');
      const hasScheduledTimeColumn = bookingColumns.has('scheduled_time');
      const hasBookingDateColumn = bookingColumns.has('booking_date');
      const hasBookingTimeColumn = bookingColumns.has('booking_time');

      // Always scope by customer_id first for correctness + index-friendly filtering.
      const whereClauses: string[] = ['b.customer_id = $1'];
      const params: any[] = [customer.id];
      let paramIndex = 2;
      const legacyNotesNeedle = `petid:${String(petId).toLowerCase()}`;

      if (hasPetIdColumn && hasNotesColumn) {
        whereClauses.push(
          `(b.pet_id::text = $${paramIndex} OR REPLACE(LOWER(COALESCE(b.notes, '')), ' ', '') LIKE '%' || $${paramIndex + 1} || '%')`
        );
        params.push(petId, legacyNotesNeedle);
        paramIndex += 2;
      } else if (hasPetIdColumn) {
        whereClauses.push(`b.pet_id::text = $${paramIndex}`);
        params.push(petId);
        paramIndex += 1;
      } else if (hasNotesColumn) {
        whereClauses.push(`REPLACE(LOWER(COALESCE(b.notes, '')), ' ', '') LIKE '%' || $${paramIndex} || '%'`);
        params.push(legacyNotesNeedle);
        paramIndex += 1;
      } else {
        // No way to relate bookings to a pet in this schema.
        return c.json({ success: true, bookings: [], stats: { total: 0, confirmed: 0, inProgress: 0, completed: 0, cancelled: 0 } });
      }

      const orderDateExpr = hasScheduledDateColumn
        ? 'b.scheduled_date'
        : hasBookingDateColumn
        ? 'b.booking_date'
        : 'b.created_at::date';
      const orderTimeExpr = hasScheduledTimeColumn
        ? 'b.scheduled_time'
        : hasBookingTimeColumn
        ? 'b.booking_time'
        : 'b.created_at::time';

      const bookingsResult = await query(
        `SELECT
          b.*,
          v.business_name as "vendorBusinessName",
          s.name as "joinedServiceName"
        FROM bookings b
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY ${orderDateExpr} DESC, ${orderTimeExpr} DESC`,
        params
      );

      const bookings = bookingsResult.rows || [];

      // Calculate stats
      const stats = {
        total: bookings.length,
        confirmed: bookings.filter((b: any) => b.status === 'confirmed').length,
        inProgress: bookings.filter((b: any) => b.status === 'in_progress').length,
        completed: bookings.filter((b: any) => b.status === 'completed').length,
        cancelled: bookings.filter((b: any) => b.status === 'cancelled').length,
      };

      return c.json({
        success: true,
        bookings: bookings.map((booking: any) => {
          const scheduledDate = booking.scheduled_date ?? booking.booking_date ?? null;
          const scheduledTime = booking.scheduled_time ?? booking.booking_time ?? null;
          const price = booking.total_amount ?? booking.base_price ?? booking.price ?? 0;
          return {
            id: booking.id,
            serviceName: booking.service_name ?? booking.joinedServiceName ?? 'Service',
            vendorName: booking.vendor_name ?? booking.vendorBusinessName ?? '',
            vendorType: booking.vendor_type ?? null,
            scheduledDate,
            scheduledTime,
            status: booking.status,
            price,
            serviceStyle: booking.service_style ?? booking.service_type ?? null,
            createdAt: booking.created_at,
            duration: booking.duration,
            petId: booking.pet_id ?? petId,
          };
        }),
        stats,
      });
    } catch (error: any) {
      console.error('Error fetching pet bookings:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

