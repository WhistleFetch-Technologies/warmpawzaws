import { Hono } from "hono";

export function petEndpoints(app: Hono, kv: any) {
  
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

      // Generate pet ID
      const petId = `pet_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Create pet object
      const pet = {
        id: petId,
        customerId,
        name,
        species,
        breed: breed || '',
        age: age || 0,
        ageUnit: ageUnit || 'months',
        gender: gender || 'unknown',
        weight: weight || 0,
        weightUnit: weightUnit || 'kg',
        color: color || '',
        photoUrl: photoUrl || '',
        
        // Medical info
        medicalHistory: medicalHistory || [],
        allergies: allergies || [],
        vaccinations: vaccinations || [],
        specialNeeds: specialNeeds || '',
        
        // Additional info
        microchipId: microchipId || '',
        insuranceProvider: insuranceProvider || '',
        insurancePolicyNumber: insurancePolicyNumber || '',
        
        // Tracking
        totalBookings: 0,
        lastVisit: null,
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save pet
      await kv.set(`pet:${petId}`, pet);

      // Add to customer's pets
      const customerPetsKey = `customer:${customerId}:pets`;
      const customerPets = await kv.get(customerPetsKey) || [];
      customerPets.push(petId);
      await kv.set(customerPetsKey, customerPets);

      // Update customer record
      const customer = await kv.get(`customer:${customerId}`);
      if (customer) {
        if (!customer.pets) customer.pets = [];
        customer.pets.push(petId);
        await kv.set(`customer:${customerId}`, customer);
      }

      console.log(`✅ Pet created: ${petId}`);
      return c.json({ success: true, petId, pet });
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
      
      const pet = await kv.get(`pet:${petId}`);
      
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
      
      const petIds = await kv.get(`customer:${customerId}:pets`) || [];
      
      const pets = [];
      for (const petId of petIds) {
        const pet = await kv.get(`pet:${petId}`);
        if (pet) {
          pets.push(pet);
        }
      }
      
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

      const pet = await kv.get(`pet:${petId}`);
      
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      // Update fields
      const updatedPet = {
        ...pet,
        ...updates,
        id: petId, // Ensure ID doesn't change
        customerId: pet.customerId, // Ensure customer doesn't change
        updatedAt: new Date().toISOString()
      };

      await kv.set(`pet:${petId}`, updatedPet);

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

      const pet = await kv.get(`pet:${petId}`);
      
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const customerId = pet.customerId;

      // Delete pet
      await kv.del(`pet:${petId}`);

      // Remove from customer's pets list
      const customerPetsKey = `customer:${customerId}:pets`;
      const customerPets = await kv.get(customerPetsKey) || [];
      const updatedPets = customerPets.filter((id: string) => id !== petId);
      await kv.set(customerPetsKey, updatedPets);

      // Update customer record
      const customer = await kv.get(`customer:${customerId}`);
      if (customer && customer.pets) {
        customer.pets = customer.pets.filter((id: string) => id !== petId);
        await kv.set(`customer:${customerId}`, customer);
      }

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

      const pet = await kv.get(`pet:${petId}`);
      
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      if (!pet.medicalHistory) {
        pet.medicalHistory = [];
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

      pet.medicalHistory.push(record);
      pet.updatedAt = new Date().toISOString();

      await kv.set(`pet:${petId}`, pet);

      console.log(`✅ Medical record added to pet ${petId}`);
      return c.json({ success: true, record, pet });
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

      const pet = await kv.get(`pet:${petId}`);
      
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      if (!pet.vaccinations) {
        pet.vaccinations = [];
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

      pet.vaccinations.push(vaccination);
      pet.updatedAt = new Date().toISOString();

      await kv.set(`pet:${petId}`, pet);

      console.log(`✅ Vaccination record added to pet ${petId}`);
      return c.json({ success: true, vaccination, pet });
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
      
      const bookingIds = await kv.get(`pet:${petId}:bookings`) || [];
      
      const bookings = [];
      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking) {
          bookings.push(booking);
        }
      }
      
      return c.json({ bookings, total: bookings.length });
    } catch (error) {
      console.error('Error getting pet bookings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Pet endpoints registered');
}
