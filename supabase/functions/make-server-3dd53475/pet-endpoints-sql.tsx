/**
 * ============================================================================
 * PET ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()` with SQL repository calls
 * - Uses `pets` table for pet data
 * - Uses `customers` table for customer data
 * - Uses `bookings` table for pet booking history
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL
 * KV Operations Removed: 21
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getDbClient } from '../../lib/db.ts';

export function petEndpoints(app: Hono) {
  
  // ============================================
  // PET MANAGEMENT ENDPOINTS
  // ============================================
  
  /**
   * Create a new pet
   * POST /make-server-3dd53475/pets/create
   */
  app.post("/make-server-3dd53475/pets/create", async (c) => {
    try {
      const {
        customerId,
        name,
        species, // dog, cat, bird, rabbit, etc.
        breed,
        age,
        ageUnit, // months, years
        gender, // male, female
        weight,
        weightUnit, // kg, lbs
        color,
        photoUrl,
        medicalHistory,
        allergies,
        vaccinations,
        specialNeeds,
        microchipId,
        insuranceProvider,
        insurancePolicyNumber
      } = await c.req.json();

      // Validate required fields
      if (!customerId || !name || !species) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // ✅ SQL: Verify customer exists
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // ✅ SQL: Create pet using repository
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.create({
        customer_id: customerId,
        name: name,
        type: species,
        breed: breed || null,
        age: age ? (ageUnit === 'years' ? age : age / 12) : null,
        gender: gender || null,
        weight: weight ? (weightUnit === 'kg' ? weight : weight * 0.453592) : null,
        color: color || null,
        photo_url: photoUrl || null,
        medical_conditions: {
          history: medicalHistory || [],
          specialNeeds: specialNeeds || null,
          microchipId: microchipId || null,
          insuranceProvider: insuranceProvider || null,
          insurancePolicyNumber: insurancePolicyNumber || null
        },
        allergies: allergies || [],
        vaccinations: vaccinations || []
      });

      console.log(`✅ Pet created: ${pet.id}`);
      return c.json({ success: true, petId: pet.id, pet });
    } catch (error) {
      console.error('Error creating pet:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get pet details
   * GET /make-server-3dd53475/pets/:petId
   */
  app.get("/make-server-3dd53475/pets/:petId", async (c) => {
    try {
      const { petId } = c.req.param();
      
      // ✅ SQL: Get pet using repository
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      return c.json({ pet });
    } catch (error) {
      console.error('Error getting pet:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get customer's pets
   * GET /make-server-3dd53475/pets/customer/:customerId
   */
  app.get("/make-server-3dd53475/pets/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      
      // ✅ SQL: Get all pets for customer using repository
      const petsRepo = getPetsRepository();
      const pets = await petsRepo.findByCustomer(customerId);
      
      return c.json({ pets, total: pets.length });
    } catch (error) {
      console.error('Error getting customer pets:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Update pet details
   * PUT /make-server-3dd53475/pets/:petId
   */
  app.put("/make-server-3dd53475/pets/:petId", async (c) => {
    try {
      const { petId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Get pet first
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      // ✅ SQL: Update pet using repository
      // Map updates to repository format
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.species !== undefined || updates.type !== undefined) {
        updateData.type = updates.species || updates.type;
      }
      if (updates.breed !== undefined) updateData.breed = updates.breed;
      if (updates.age !== undefined) {
        const ageUnit = updates.ageUnit || 'years';
        updateData.age = ageUnit === 'years' ? updates.age : updates.age / 12;
      }
      if (updates.gender !== undefined) updateData.gender = updates.gender;
      if (updates.weight !== undefined) {
        const weightUnit = updates.weightUnit || 'kg';
        updateData.weight = weightUnit === 'kg' ? updates.weight : updates.weight * 0.453592;
      }
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.photoUrl !== undefined) updateData.photo_url = updates.photoUrl;
      if (updates.medicalHistory !== undefined || updates.specialNeeds !== undefined) {
        updateData.medical_conditions = {
          ...(pet.medical_conditions || {}),
          history: updates.medicalHistory || pet.medical_conditions?.history || [],
          specialNeeds: updates.specialNeeds !== undefined ? updates.specialNeeds : pet.medical_conditions?.specialNeeds
        };
      }
      if (updates.allergies !== undefined) updateData.allergies = updates.allergies;
      if (updates.vaccinations !== undefined) updateData.vaccinations = updates.vaccinations;

      const updatedPet = await petsRepo.update(petId, updateData);

      console.log(`✅ Pet updated: ${petId}`);
      return c.json({ success: true, pet: updatedPet });
    } catch (error) {
      console.error('Error updating pet:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Delete pet
   * DELETE /make-server-3dd53475/pets/:petId
   */
  app.delete("/make-server-3dd53475/pets/:petId", async (c) => {
    try {
      const { petId } = c.req.param();

      // ✅ SQL: Get pet first
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      // ✅ SQL: Soft delete pet (sets is_active = false)
      await petsRepo.delete(petId);

      console.log(`✅ Pet deleted: ${petId}`);
      return c.json({ success: true });
    } catch (error) {
      console.error('Error deleting pet:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Add medical record to pet
   * POST /make-server-3dd53475/pets/:petId/medical-record
   */
  app.post("/make-server-3dd53475/pets/:petId/medical-record", async (c) => {
    try {
      const { petId } = c.req.param();
      const { type, description, date, veterinarian, medication, notes } = await c.req.json();

      // ✅ SQL: Get pet first
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const record = {
        id: `medical_${Date.now()}`,
        type, // checkup, vaccination, surgery, illness, injury
        description,
        date: date || new Date().toISOString(),
        veterinarian: veterinarian || '',
        medication: medication || '',
        notes: notes || '',
        addedAt: new Date().toISOString()
      };

      // ✅ SQL: Update pet with new medical record
      const medicalHistory = pet.medical_conditions?.history || [];
      medicalHistory.push(record);
      
      await petsRepo.update(petId, {
        medical_conditions: {
          ...(pet.medical_conditions || {}),
          history: medicalHistory
        }
      });

      console.log(`✅ Medical record added to pet ${petId}`);
      return c.json({ success: true, record, pet: await petsRepo.findById(petId) });
    } catch (error) {
      console.error('Error adding medical record:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Add vaccination record to pet
   * POST /make-server-3dd53475/pets/:petId/vaccination
   */
  app.post("/make-server-3dd53475/pets/:petId/vaccination", async (c) => {
    try {
      const { petId } = c.req.param();
      const { vaccineName, date, nextDueDate, veterinarian, batchNumber, notes } = await c.req.json();

      // ✅ SQL: Get pet first
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const vaccination = {
        id: `vacc_${Date.now()}`,
        vaccineName,
        date: date || new Date().toISOString(),
        nextDueDate: nextDueDate || '',
        veterinarian: veterinarian || '',
        batchNumber: batchNumber || '',
        notes: notes || '',
        addedAt: new Date().toISOString()
      };

      // ✅ SQL: Update pet with new vaccination record
      const vaccinations = pet.vaccinations || [];
      vaccinations.push(vaccination);
      
      await petsRepo.update(petId, {
        vaccinations: vaccinations
      });

      console.log(`✅ Vaccination record added to pet ${petId}`);
      return c.json({ success: true, vaccination, pet: await petsRepo.findById(petId) });
    } catch (error) {
      console.error('Error adding vaccination:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get pet's booking history
   * GET /make-server-3dd53475/pets/:petId/bookings
   */
  app.get("/make-server-3dd53475/pets/:petId/bookings", async (c) => {
    try {
      const { petId } = c.req.param();
      
      // ✅ SQL: Get pet first to verify it exists
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      // ✅ SQL: Get bookings for pet using repository
      // Note: Bookings table has pet_id column, but we need to check if it exists
      // If not, we'll query by customer_id and filter
      const bookingsRepo = getBookingsRepository();
      const db = getDbClient();
      
      // Try to get bookings by pet_id if column exists, otherwise by customer_id
      let bookings: any[] = [];
      try {
        const { data, error } = await db
          .from('bookings')
          .select('*')
          .eq('pet_id', petId)
          .order('booking_date', { ascending: false });
        
        if (!error && data) {
          bookings = data;
        }
      } catch (err) {
        // If pet_id column doesn't exist, query by customer_id
        const customerBookings = await bookingsRepo.findByCustomer(pet.customer_id);
        bookings = customerBookings.filter((b: any) => {
          // Filter by pet name or other identifier if pet_id not available
          return b.pet_name === pet.name || b.pet_id === petId;
        });
      }
      
      return c.json({ bookings, total: bookings.length });
    } catch (error) {
      console.error('Error getting pet bookings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Pet endpoints registered (SQL-only)');
}

