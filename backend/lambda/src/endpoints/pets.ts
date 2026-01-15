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
 * Migrated from: supabase/functions/make-server-customer/customer-pets-sql.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

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
          profile_photo_url: pet.profile_photo_url,
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
        medicalHistory,
        vaccinationStatus,
        spayedNeutered,
        microchipped,
        specialNeeds,
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

      const pet = await insert('pets', {
        customer_id: customerId,
        name: name,
        species: petType || petData.type || petData.species, // Schema uses 'species', not 'pet_type'
        breed: breed || null,
        age_years: age_years,
        age_months: age_months,
        gender: gender || null,
        weight_kg: weight ? parseFloat(weight) : null, // Schema uses weight_kg
        profile_photo_url: photos && photos.length > 0 ? photos[0] : null, // Schema uses profile_photo_url, not photos array
        medical_history: medicalHistory || {}, // JSONB field
      });

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
   */
  app.put("/pets/:petId", async (c) => {
    try {
      const { petId } = c.req.param();
      const petData = await c.req.json();

      // Convert age if provided
      const updateData: any = {
        name: petData.name,
        breed: petData.breed,
        gender: petData.gender,
        weight_kg: petData.weight ? parseFloat(petData.weight) : undefined,
        profile_photo_url: petData.photos && petData.photos.length > 0 ? petData.photos[0] : undefined,
        medical_history: petData.medicalHistory || petData.medical_history || {},
      };

      if (petData.age) {
        if (petData.ageUnit === 'years' || petData.ageUnit === 'year') {
          updateData.age_years = parseInt(petData.age, 10);
        } else if (petData.ageUnit === 'months' || petData.ageUnit === 'month') {
          updateData.age_months = parseInt(petData.age, 10);
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
}

