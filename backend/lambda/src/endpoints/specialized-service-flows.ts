/**
 * ============================================================================
 * SPECIALIZED SERVICE FLOWS - 360 DEGREE CUSTOMER-VENDOR MATCHING
 * ============================================================================
 * 
 * Complete end-to-end flows for specialized pet services:
 * - Adoption: Pet catalog, adoption requests, applications
 * - Breeder: Puppy listings, purchase inquiries, reservations
 * - Peer to Peer: Pet matching, match requests, messaging
 * - Pet Holidays: Package builder, bookings, itinerary
 * - Relocation: Quote calculator, booking, tracking
 * 
 * Date: 2026-01-19
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';

export function registerSpecializedServiceFlows(app: Hono) {
  // ============================================
  // ADOPTION FLOW ENDPOINTS
  // ============================================

  /**
   * GET /adoption/pets
   * Get available pets for adoption with filters
   */
  app.get("/adoption/pets", async (c) => {
    try {
      const city = c.req.query('city');
      const petType = c.req.query('petType') || c.req.query('type');
      const breed = c.req.query('breed');
      const gender = c.req.query('gender');
      const ageMin = c.req.query('ageMin');
      const ageMax = c.req.query('ageMax');
      const size = c.req.query('size');
      const vendorId = c.req.query('vendorId');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let petQuery = `
        SELECT 
          p.*,
          v.business_name as vendor_name,
          v.city as vendor_city,
          v.phone as vendor_phone,
          v.address as vendor_address,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) as vendor_rating
        FROM pets p
        INNER JOIN vendors v ON p.vendor_id = v.id
        WHERE p.listing_type IN ('adoption', 'rehoming')
        AND p.status = 'available'
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (vendorId) {
        petQuery += ` AND p.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (city) {
        petQuery += ` AND (v.city ILIKE $${paramIndex} OR p.location_city ILIKE $${paramIndex})`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      if (petType) {
        petQuery += ` AND LOWER(p.pet_type) = LOWER($${paramIndex})`;
        params.push(petType);
        paramIndex++;
      }

      if (breed) {
        petQuery += ` AND p.breed ILIKE $${paramIndex}`;
        params.push(`%${breed}%`);
        paramIndex++;
      }

      if (gender) {
        petQuery += ` AND LOWER(p.gender) = LOWER($${paramIndex})`;
        params.push(gender);
        paramIndex++;
      }

      if (size) {
        petQuery += ` AND LOWER(p.size) = LOWER($${paramIndex})`;
        params.push(size);
        paramIndex++;
      }

      petQuery += ` ORDER BY p.featured DESC NULLS LAST, p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const pets = await query(petQuery, params).catch(() => ({ rows: [] }));

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total FROM pets p
        INNER JOIN vendors v ON p.vendor_id = v.id
        WHERE p.listing_type IN ('adoption', 'rehoming')
        AND p.status = 'available'
        AND v.status = 'approved'
        AND v.is_active = true
      `;
      const totalResult = await query(countQuery, []).catch(() => ({ rows: [{ total: pets.rows.length }] }));

      return c.json({
        success: true,
        pets: pets.rows.map((pet: any) => ({
          id: pet.id,
          name: pet.name,
          petType: pet.pet_type,
          breed: pet.breed,
          age: pet.age,
          ageUnit: pet.age_unit,
          gender: pet.gender,
          size: pet.size,
          color: pet.color,
          description: pet.description,
          photos: typeof pet.photos === 'string' ? JSON.parse(pet.photos) : pet.photos || [],
          adoptionFee: pet.adoption_fee || 0,
          vaccinated: pet.vaccination_status === 'complete',
          spayedNeutered: pet.spayed_neutered,
          microchipped: pet.microchipped,
          specialNeeds: pet.special_needs,
          vendor: {
            id: pet.vendor_id,
            name: pet.vendor_name,
            city: pet.vendor_city,
            phone: pet.vendor_phone,
            rating: parseFloat(pet.vendor_rating || '0').toFixed(1),
          },
          location: pet.location_city || pet.vendor_city,
          listingType: pet.listing_type,
          featured: pet.featured,
        })),
        pagination: {
          limit,
          offset,
          total: parseInt(totalResult.rows[0]?.total || '0', 10),
        },
      });
    } catch (error: any) {
      console.error('Error fetching adoption pets:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /adoption/pets/:petId
   * Get single pet details for adoption
   */
  app.get("/adoption/pets/:petId", async (c) => {
    try {
      const { petId } = c.req.param();

      const petResult = await query(`
        SELECT 
          p.*,
          v.id as vendor_id,
          v.business_name as vendor_name,
          v.city as vendor_city,
          v.phone as vendor_phone,
          v.email as vendor_email,
          v.address as vendor_address,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) as vendor_rating,
          COALESCE((SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id), 0) as vendor_review_count
        FROM pets p
        INNER JOIN vendors v ON p.vendor_id = v.id
        WHERE p.id = $1
      `, [petId]);

      if (petResult.rows.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const pet = petResult.rows[0];

      // Get similar pets
      const similarPets = await query(`
        SELECT p.id, p.name, p.breed, p.age, p.photos, p.adoption_fee
        FROM pets p
        WHERE p.pet_type = $1
        AND p.id != $2
        AND p.status = 'available'
        LIMIT 4
      `, [pet.pet_type, petId]).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        pet: {
          id: pet.id,
          name: pet.name,
          petType: pet.pet_type,
          breed: pet.breed,
          age: pet.age,
          ageUnit: pet.age_unit,
          gender: pet.gender,
          size: pet.size,
          color: pet.color,
          description: pet.description,
          photos: typeof pet.photos === 'string' ? JSON.parse(pet.photos) : pet.photos || [],
          adoptionFee: pet.adoption_fee || 0,
          vaccinated: pet.vaccination_status === 'complete',
          vaccinationDetails: pet.medical_history,
          spayedNeutered: pet.spayed_neutered,
          microchipped: pet.microchipped,
          specialNeeds: pet.special_needs,
          temperament: pet.temperament,
          goodWith: pet.good_with || [],
          trainingLevel: pet.training_level,
        },
        vendor: {
          id: pet.vendor_id,
          name: pet.vendor_name,
          city: pet.vendor_city,
          phone: pet.vendor_phone,
          email: pet.vendor_email,
          address: pet.vendor_address,
          rating: parseFloat(pet.vendor_rating || '0').toFixed(1),
          reviewCount: parseInt(pet.vendor_review_count || '0', 10),
        },
        similarPets: similarPets.rows,
      });
    } catch (error: any) {
      console.error('Error fetching pet details:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /adoption/questionnaire
   * Submit adoption questionnaire/application
   */
  app.post("/adoption/questionnaire", async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerPhone,
        customerId,
        petId,
        vendorId,
        experience,
        livingSituation,
        otherPets,
        timeCommitment,
        reason,
        additionalInfo,
      } = body;

      if (!customerPhone && !customerId) {
        return c.json({ error: 'Customer phone or ID is required' }, 400);
      }

      // Get customer ID from phone if not provided
      let resolvedCustomerId = customerId;
      if (!resolvedCustomerId && customerPhone) {
        const customers = await query(`SELECT id FROM customers WHERE phone = $1`, [customerPhone]);
        if (customers.rows.length > 0) {
          resolvedCustomerId = customers.rows[0].id;
        }
      }

      // Get pet and vendor info
      let resolvedVendorId = vendorId;
      if (petId && !resolvedVendorId) {
        const pets = await query(`SELECT vendor_id FROM pets WHERE id = $1`, [petId]);
        if (pets.rows.length > 0) {
          resolvedVendorId = pets.rows[0].vendor_id;
        }
      }

      // Create adoption application
      const application = await insert('adoption_applications', {
        customer_id: resolvedCustomerId,
        customer_phone: customerPhone,
        pet_id: petId,
        vendor_id: resolvedVendorId,
        experience: experience,
        living_situation: livingSituation,
        other_pets: otherPets,
        time_commitment: timeCommitment,
        reason: reason,
        additional_info: additionalInfo,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      }).catch(async () => {
        // Table might not exist, create it
        await query(`
          CREATE TABLE IF NOT EXISTS adoption_applications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID,
            customer_phone VARCHAR(20),
            pet_id UUID,
            vendor_id UUID,
            experience VARCHAR(50),
            living_situation VARCHAR(50),
            other_pets VARCHAR(50),
            time_commitment VARCHAR(50),
            reason TEXT,
            additional_info TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            submitted_at TIMESTAMP DEFAULT NOW(),
            reviewed_at TIMESTAMP,
            reviewer_notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        return insert('adoption_applications', {
          customer_id: resolvedCustomerId,
          customer_phone: customerPhone,
          pet_id: petId,
          vendor_id: resolvedVendorId,
          experience: experience,
          living_situation: livingSituation,
          other_pets: otherPets,
          time_commitment: timeCommitment,
          reason: reason,
          additional_info: additionalInfo,
          status: 'pending',
        });
      });

      return c.json({
        success: true,
        applicationId: application[0]?.id,
        message: 'Adoption application submitted successfully',
      });
    } catch (error: any) {
      console.error('Error submitting adoption application:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /adoption/request
   * Create adoption request for a specific pet
   */
  app.post("/adoption/request", async (c) => {
    try {
      const body = await c.req.json();
      const { customerId, customerPhone, petId, message, visitDate, visitTime } = body;

      if (!petId) {
        return c.json({ error: 'Pet ID is required' }, 400);
      }

      // Get pet details
      const pets = await query(`SELECT id, vendor_id, name FROM pets WHERE id = $1`, [petId]);
      if (pets.rows.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const pet = pets.rows[0];

      // Create booking for adoption visit
      const booking = await insert('bookings', {
        customer_id: customerId,
        customer_phone: customerPhone,
        vendor_id: pet.vendor_id,
        pet_id: petId,
        service_type: 'adoption_visit',
        booking_date: visitDate || new Date().toISOString().split('T')[0],
        booking_time: visitTime || '10:00',
        status: 'pending',
        notes: message || `Adoption inquiry for ${pet.name}`,
        total_amount: 0, // Adoption visits are typically free
      });

      return c.json({
        success: true,
        booking: booking[0],
        message: 'Adoption request submitted. The shelter will contact you shortly.',
      });
    } catch (error: any) {
      console.error('Error creating adoption request:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // BREEDER FLOW ENDPOINTS
  // ============================================

  /**
   * GET /breeder/puppies
   * Get available puppies from certified breeders
   */
  app.get("/breeder/puppies", async (c) => {
    try {
      const breed = c.req.query('breed');
      const petType = c.req.query('petType') || 'dog';
      const vendorId = c.req.query('vendorId');
      const city = c.req.query('city');
      const priceMin = c.req.query('priceMin');
      const priceMax = c.req.query('priceMax');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let puppyQuery = `
        SELECT 
          p.*,
          v.business_name as breeder_name,
          v.city as breeder_city,
          v.phone as breeder_phone,
          v.is_certified,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) as breeder_rating,
          COALESCE((SELECT COUNT(*) FROM pets WHERE vendor_id = v.id AND status = 'sold'), 0) as puppies_sold
        FROM pets p
        INNER JOIN vendors v ON p.vendor_id = v.id
        INNER JOIN roles r ON v.role_id = r.id
        WHERE p.listing_type = 'breeding'
        AND p.status = 'available'
        AND v.status = 'approved'
        AND v.is_active = true
        AND r.name IN ('breeder', 'pet_breeder')
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (vendorId) {
        puppyQuery += ` AND p.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (breed) {
        puppyQuery += ` AND p.breed ILIKE $${paramIndex}`;
        params.push(`%${breed}%`);
        paramIndex++;
      }

      if (petType) {
        puppyQuery += ` AND LOWER(p.pet_type) = LOWER($${paramIndex})`;
        params.push(petType);
        paramIndex++;
      }

      if (city) {
        puppyQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      if (priceMin) {
        puppyQuery += ` AND p.price >= $${paramIndex}`;
        params.push(parseFloat(priceMin));
        paramIndex++;
      }

      if (priceMax) {
        puppyQuery += ` AND p.price <= $${paramIndex}`;
        params.push(parseFloat(priceMax));
        paramIndex++;
      }

      puppyQuery += ` ORDER BY p.featured DESC NULLS LAST, v.is_certified DESC NULLS LAST, p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const puppies = await query(puppyQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        puppies: puppies.rows.map((puppy: any) => ({
          id: puppy.id,
          name: puppy.name,
          petType: puppy.pet_type,
          breed: puppy.breed,
          age: puppy.age,
          ageUnit: puppy.age_unit || 'weeks',
          gender: puppy.gender,
          color: puppy.color,
          price: puppy.price || puppy.adoption_fee,
          photos: typeof puppy.photos === 'string' ? JSON.parse(puppy.photos) : puppy.photos || [],
          vaccinated: puppy.vaccination_status === 'complete',
          pedigree: puppy.pedigree,
          kciRegistered: puppy.kci_registered,
          breeder: {
            id: puppy.vendor_id,
            name: puppy.breeder_name,
            city: puppy.breeder_city,
            phone: puppy.breeder_phone,
            isCertified: puppy.is_certified,
            rating: parseFloat(puppy.breeder_rating || '0').toFixed(1),
            puppiesSold: parseInt(puppy.puppies_sold || '0', 10),
          },
        })),
        total: puppies.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching breeder puppies:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /breeder/inquiry
   * Create purchase inquiry for a puppy
   */
  app.post("/breeder/inquiry", async (c) => {
    try {
      const body = await c.req.json();
      const { customerId, customerPhone, customerName, puppyId, message, visitDate } = body;

      if (!puppyId) {
        return c.json({ error: 'Puppy ID is required' }, 400);
      }

      // Get puppy details
      const puppies = await query(`SELECT id, vendor_id, name, price FROM pets WHERE id = $1`, [puppyId]);
      if (puppies.rows.length === 0) {
        return c.json({ error: 'Puppy not found' }, 404);
      }

      const puppy = puppies.rows[0];

      // Create inquiry/booking
      const inquiry = await insert('bookings', {
        customer_id: customerId,
        customer_phone: customerPhone,
        customer_name: customerName,
        vendor_id: puppy.vendor_id,
        pet_id: puppyId,
        service_type: 'breeder_inquiry',
        booking_date: visitDate || new Date().toISOString().split('T')[0],
        status: 'inquiry',
        notes: message || `Purchase inquiry for ${puppy.name}`,
        total_amount: puppy.price || 0,
      });

      return c.json({
        success: true,
        inquiry: inquiry[0],
        message: 'Inquiry submitted. The breeder will contact you shortly.',
      });
    } catch (error: any) {
      console.error('Error creating breeder inquiry:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /breeder/reserve
   * Reserve a puppy with deposit
   */
  app.post("/breeder/reserve", async (c) => {
    try {
      const body = await c.req.json();
      const { customerId, puppyId, depositAmount } = body;

      if (!puppyId || !customerId) {
        return c.json({ error: 'Puppy ID and Customer ID are required' }, 400);
      }

      // Get puppy details
      const puppies = await query(`SELECT id, vendor_id, name, price, status FROM pets WHERE id = $1`, [puppyId]);
      if (puppies.rows.length === 0) {
        return c.json({ error: 'Puppy not found' }, 404);
      }

      const puppy = puppies.rows[0];

      if (puppy.status !== 'available') {
        return c.json({ error: 'This puppy is no longer available' }, 400);
      }

      // Update puppy status to reserved
      await update('pets', { id: puppyId }, { status: 'reserved', reserved_by: customerId });

      // Create reservation booking
      const reservation = await insert('bookings', {
        customer_id: customerId,
        vendor_id: puppy.vendor_id,
        pet_id: puppyId,
        service_type: 'puppy_reservation',
        booking_date: new Date().toISOString().split('T')[0],
        status: 'reserved',
        total_amount: puppy.price,
        deposit_amount: depositAmount || puppy.price * 0.2, // 20% default deposit
        payment_status: 'deposit_pending',
      });

      return c.json({
        success: true,
        reservation: reservation[0],
        message: `Puppy ${puppy.name} reserved! Please complete the deposit payment.`,
      });
    } catch (error: any) {
      console.error('Error reserving puppy:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // PEER TO PEER FLOW ENDPOINTS
  // ============================================

  /**
   * GET /customer/pet-matching
   * Get pets available for mating/matching
   */
  app.get("/customer/pet-matching", async (c) => {
    try {
      const breed = c.req.query('breed');
      const petType = c.req.query('petType') || c.req.query('type');
      const gender = c.req.query('gender');
      const city = c.req.query('city');
      const customerId = c.req.query('customerId');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // Get pets that are available for mating
      let matchQuery = `
        SELECT 
          p.id,
          p.name as pet_name,
          p.pet_type,
          p.breed,
          p.age,
          p.gender,
          p.photos,
          p.description,
          c.id as owner_id,
          c.full_name as owner_name,
          c.city as owner_city,
          p.metadata as pet_metadata
        FROM pets p
        INNER JOIN customers c ON p.customer_id = c.id
        WHERE p.mating_available = true
        AND p.status = 'active'
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Exclude current customer's pets
      if (customerId) {
        matchQuery += ` AND c.id != $${paramIndex}`;
        params.push(customerId);
        paramIndex++;
      }

      if (breed) {
        matchQuery += ` AND p.breed ILIKE $${paramIndex}`;
        params.push(`%${breed}%`);
        paramIndex++;
      }

      if (petType) {
        matchQuery += ` AND LOWER(p.pet_type) = LOWER($${paramIndex})`;
        params.push(petType);
        paramIndex++;
      }

      if (gender) {
        matchQuery += ` AND LOWER(p.gender) = LOWER($${paramIndex})`;
        params.push(gender);
        paramIndex++;
      }

      if (city) {
        matchQuery += ` AND c.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      matchQuery += ` ORDER BY p.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const profiles = await query(matchQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        profiles: profiles.rows.map((profile: any) => ({
          id: profile.id,
          petName: profile.pet_name,
          petType: profile.pet_type,
          breed: profile.breed,
          age: profile.age,
          gender: profile.gender,
          photos: typeof profile.photos === 'string' ? JSON.parse(profile.photos) : profile.photos || [],
          description: profile.description,
          ownerId: profile.owner_id,
          ownerName: profile.owner_name,
          location: profile.owner_city,
          emoji: profile.pet_type?.toLowerCase() === 'dog' ? '🐕' : profile.pet_type?.toLowerCase() === 'cat' ? '🐱' : '🐾',
        })),
        total: profiles.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching pet matching profiles:', error);
      return c.json({ success: true, profiles: [], total: 0 });
    }
  });

  /**
   * POST /customer/pet-matching/request
   * Send a match request to another pet owner
   */
  app.post("/customer/pet-matching/request", async (c) => {
    try {
      const body = await c.req.json();
      const { fromPetId, toPetId, fromCustomerId, message } = body;

      if (!fromPetId || !toPetId) {
        return c.json({ error: 'Both pet IDs are required' }, 400);
      }

      // Get target pet owner
      const targetPet = await query(`SELECT customer_id FROM pets WHERE id = $1`, [toPetId]);
      if (targetPet.rows.length === 0) {
        return c.json({ error: 'Target pet not found' }, 404);
      }

      const toCustomerId = targetPet.rows[0].customer_id;

      // Create match request
      const matchRequest = await insert('mating_requests', {
        from_pet_id: fromPetId,
        to_pet_id: toPetId,
        from_customer_id: fromCustomerId,
        to_customer_id: toCustomerId,
        message: message,
        status: 'pending',
      }).catch(async () => {
        // Create table if not exists
        await query(`
          CREATE TABLE IF NOT EXISTS mating_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            from_pet_id UUID NOT NULL,
            to_pet_id UUID NOT NULL,
            from_customer_id UUID,
            to_customer_id UUID,
            message TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            accepted_at TIMESTAMP,
            declined_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        return insert('mating_requests', {
          from_pet_id: fromPetId,
          to_pet_id: toPetId,
          from_customer_id: fromCustomerId,
          to_customer_id: toCustomerId,
          message: message,
          status: 'pending',
        });
      });

      return c.json({
        success: true,
        request: matchRequest[0],
        message: 'Match request sent successfully!',
      });
    } catch (error: any) {
      console.error('Error creating match request:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/pet-matching/requests
   * Get match requests for a customer
   */
  app.get("/customer/pet-matching/requests", async (c) => {
    try {
      const customerId = c.req.query('customerId');
      const type = c.req.query('type') || 'received'; // 'received' or 'sent'

      if (!customerId) {
        return c.json({ error: 'Customer ID is required' }, 400);
      }

      let requestsQuery;
      if (type === 'sent') {
        requestsQuery = `
          SELECT 
            mr.*,
            fp.name as from_pet_name,
            fp.breed as from_pet_breed,
            tp.name as to_pet_name,
            tp.breed as to_pet_breed,
            tc.full_name as to_owner_name
          FROM mating_requests mr
          LEFT JOIN pets fp ON mr.from_pet_id = fp.id
          LEFT JOIN pets tp ON mr.to_pet_id = tp.id
          LEFT JOIN customers tc ON mr.to_customer_id = tc.id
          WHERE mr.from_customer_id = $1
          ORDER BY mr.created_at DESC
        `;
      } else {
        requestsQuery = `
          SELECT 
            mr.*,
            fp.name as from_pet_name,
            fp.breed as from_pet_breed,
            tp.name as to_pet_name,
            tp.breed as to_pet_breed,
            fc.full_name as from_owner_name
          FROM mating_requests mr
          LEFT JOIN pets fp ON mr.from_pet_id = fp.id
          LEFT JOIN pets tp ON mr.to_pet_id = tp.id
          LEFT JOIN customers fc ON mr.from_customer_id = fc.id
          WHERE mr.to_customer_id = $1
          ORDER BY mr.created_at DESC
        `;
      }

      const requests = await query(requestsQuery, [customerId]).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        requests: requests.rows,
        total: requests.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching match requests:', error);
      return c.json({ success: true, requests: [], total: 0 });
    }
  });

  /**
   * PUT /customer/pet-matching/requests/:requestId
   * Accept or decline a match request
   */
  app.put("/customer/pet-matching/requests/:requestId", async (c) => {
    try {
      const { requestId } = c.req.param();
      const body = await c.req.json();
      const { action } = body; // 'accept' or 'decline'

      if (!['accept', 'decline'].includes(action)) {
        return c.json({ error: 'Action must be accept or decline' }, 400);
      }

      const updateData: any = {
        status: action === 'accept' ? 'accepted' : 'declined',
        updated_at: new Date().toISOString(),
      };

      if (action === 'accept') {
        updateData.accepted_at = new Date().toISOString();
      } else {
        updateData.declined_at = new Date().toISOString();
      }

      const updated = await update('mating_requests', { id: requestId }, updateData);

      return c.json({
        success: true,
        request: updated[0],
        message: action === 'accept' ? 'Match request accepted!' : 'Match request declined',
      });
    } catch (error: any) {
      console.error('Error updating match request:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // PET HOLIDAY FLOW ENDPOINTS
  // ============================================

  /**
   * GET /holidays/packages
   * Get available holiday packages with enhanced filtering
   */
  app.get("/customer/holiday-packages", async (c) => {
    try {
      const destination = c.req.query('destination');
      const durationMin = c.req.query('durationMin');
      const durationMax = c.req.query('durationMax');
      const priceMax = c.req.query('priceMax');
      const tourType = c.req.query('tourType');
      const petType = c.req.query('petType');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let packageQuery = `
        SELECT 
          hp.*,
          v.business_name as vendor_name,
          v.city as vendor_city,
          v.phone as vendor_phone,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) as vendor_rating,
          COALESCE((SELECT COUNT(*) FROM bookings WHERE package_id = hp.id AND status = 'completed'), 0) as bookings_count
        FROM holiday_packages hp
        INNER JOIN vendors v ON hp.vendor_id = v.id
        WHERE hp.is_active = true
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (destination) {
        packageQuery += ` AND hp.destination ILIKE $${paramIndex}`;
        params.push(`%${destination}%`);
        paramIndex++;
      }

      if (durationMin) {
        packageQuery += ` AND hp.duration_days >= $${paramIndex}`;
        params.push(parseInt(durationMin, 10));
        paramIndex++;
      }

      if (durationMax) {
        packageQuery += ` AND hp.duration_days <= $${paramIndex}`;
        params.push(parseInt(durationMax, 10));
        paramIndex++;
      }

      if (priceMax) {
        packageQuery += ` AND hp.price <= $${paramIndex}`;
        params.push(parseFloat(priceMax));
        paramIndex++;
      }

      if (tourType) {
        packageQuery += ` AND hp.tour_type = $${paramIndex}`;
        params.push(tourType);
        paramIndex++;
      }

      packageQuery += ` ORDER BY hp.featured DESC NULLS LAST, vendor_rating DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const packages = await query(packageQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        packages: packages.rows.map((pkg: any) => ({
          id: pkg.id,
          title: pkg.title || pkg.name,
          destination: pkg.destination,
          durationDays: pkg.duration_days,
          price: pkg.price,
          groupSize: pkg.group_size,
          tourType: pkg.tour_type,
          description: pkg.description,
          images: typeof pkg.images === 'string' ? JSON.parse(pkg.images) : pkg.images || [],
          inclusions: typeof pkg.inclusions === 'string' ? JSON.parse(pkg.inclusions) : pkg.inclusions || [],
          exclusions: typeof pkg.exclusions === 'string' ? JSON.parse(pkg.exclusions) : pkg.exclusions || [],
          itinerary: typeof pkg.itinerary === 'string' ? JSON.parse(pkg.itinerary) : pkg.itinerary || [],
          petTypesAllowed: pkg.pet_types_allowed || ['dog', 'cat'],
          nextDeparture: pkg.next_departure,
          vendor: {
            id: pkg.vendor_id,
            name: pkg.vendor_name,
            city: pkg.vendor_city,
            rating: parseFloat(pkg.vendor_rating || '0').toFixed(1),
          },
          bookingsCount: parseInt(pkg.bookings_count || '0', 10),
          featured: pkg.featured,
        })),
        total: packages.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching holiday packages:', error);
      return c.json({ success: true, packages: [], total: 0 });
    }
  });

  /**
   * POST /holidays/build-package
   * Build custom holiday package
   */
  app.post("/holidays/build-package", async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        destination,
        startDate,
        endDate,
        numberOfPets,
        petTypes,
        accommodationType,
        activities,
        specialRequests,
      } = body;

      // Calculate duration
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate estimated price based on selections
      let basePrice = 5000; // Base per pet per day
      if (accommodationType === 'premium') basePrice = 8000;
      if (accommodationType === 'luxury') basePrice = 12000;

      const activityCost = (activities?.length || 0) * 1500;
      const estimatedPrice = (basePrice * durationDays * (numberOfPets || 1)) + activityCost;

      // Save custom package request
      const customPackage = await insert('holiday_custom_requests', {
        customer_id: customerId,
        destination: destination,
        start_date: startDate,
        end_date: endDate,
        duration_days: durationDays,
        number_of_pets: numberOfPets || 1,
        pet_types: JSON.stringify(petTypes || ['dog']),
        accommodation_type: accommodationType || 'standard',
        activities: JSON.stringify(activities || []),
        special_requests: specialRequests,
        estimated_price: estimatedPrice,
        status: 'pending_quote',
      }).catch(async () => {
        // Create table if not exists
        await query(`
          CREATE TABLE IF NOT EXISTS holiday_custom_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID,
            destination VARCHAR(255),
            start_date DATE,
            end_date DATE,
            duration_days INTEGER,
            number_of_pets INTEGER DEFAULT 1,
            pet_types JSONB,
            accommodation_type VARCHAR(50),
            activities JSONB,
            special_requests TEXT,
            estimated_price DECIMAL(10,2),
            final_price DECIMAL(10,2),
            status VARCHAR(50) DEFAULT 'pending_quote',
            vendor_id UUID,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        return insert('holiday_custom_requests', {
          customer_id: customerId,
          destination: destination,
          start_date: startDate,
          end_date: endDate,
          duration_days: durationDays,
          number_of_pets: numberOfPets || 1,
          pet_types: JSON.stringify(petTypes || ['dog']),
          accommodation_type: accommodationType || 'standard',
          activities: JSON.stringify(activities || []),
          special_requests: specialRequests,
          estimated_price: estimatedPrice,
          status: 'pending_quote',
        });
      });

      return c.json({
        success: true,
        customPackage: {
          ...customPackage[0],
          estimatedPrice,
          durationDays,
        },
        message: 'Custom package request submitted. We will send you quotes shortly.',
      });
    } catch (error: any) {
      console.error('Error building custom package:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // RELOCATION FLOW ENDPOINTS
  // ============================================

  /**
   * GET /relocation/services
   * Get available relocation services
   */
  app.get("/relocation/services", async (c) => {
    try {
      const origin = c.req.query('origin');
      const destination = c.req.query('destination');
      const transportType = c.req.query('transportType');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let serviceQuery = `
        SELECT 
          v.*,
          r.name as role_name,
          r.display_name as role_display_name,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) as vendor_rating,
          COALESCE((SELECT COUNT(*) FROM bookings WHERE vendor_id = v.id AND service_type = 'pet_relocation' AND status = 'completed'), 0) as relocations_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE r.name IN ('pet_relocation', 'pet_transport', 'relocation')
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (origin) {
        serviceQuery += ` AND (v.city ILIKE $${paramIndex} OR v.service_areas ILIKE $${paramIndex})`;
        params.push(`%${origin}%`);
        paramIndex++;
      }

      serviceQuery += ` ORDER BY vendor_rating DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const services = await query(serviceQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        services: services.rows.map((service: any) => ({
          id: service.id,
          name: service.business_name,
          city: service.city,
          phone: service.phone,
          email: service.email,
          rating: parseFloat(service.vendor_rating || '0').toFixed(1),
          relocationsCount: parseInt(service.relocations_count || '0', 10),
          transportTypes: ['air', 'road'], // Could be stored in metadata
          serviceAreas: service.service_areas || 'Pan India',
        })),
        total: services.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching relocation services:', error);
      return c.json({ success: true, services: [], total: 0 });
    }
  });

  /**
   * POST /relocation/quote
   * Calculate relocation quote
   */
  app.post("/relocation/quote", async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        customerPhone,
        origin,
        destination,
        transportType,
        petType,
        petSize,
        petWeight,
        numberOfPets,
        preferredDate,
        specialRequirements,
        cageRequired,
        insuranceRequired,
      } = body;

      if (!origin || !destination) {
        return c.json({ error: 'Origin and destination are required' }, 400);
      }

      // Calculate base price based on transport type and distance (simplified)
      let basePrice = 5000;
      if (transportType === 'air') {
        basePrice = 15000;
      } else if (transportType === 'road') {
        basePrice = 8000;
      }

      // Size adjustment
      let sizeMultiplier = 1;
      if (petSize === 'medium') sizeMultiplier = 1.3;
      if (petSize === 'large') sizeMultiplier = 1.6;
      if (petSize === 'extra_large') sizeMultiplier = 2;

      // Calculate additional costs
      const cageCost = cageRequired ? 2000 : 0;
      const insuranceCost = insuranceRequired ? 1500 : 0;
      const handlingFee = 500;

      const subtotal = basePrice * sizeMultiplier * (numberOfPets || 1);
      const totalQuote = subtotal + cageCost + insuranceCost + handlingFee;

      // Save quote
      const quote = await insert('relocation_quotes', {
        customer_id: customerId,
        customer_phone: customerPhone,
        origin: origin,
        destination: destination,
        transport_type: transportType || 'road',
        pet_type: petType,
        pet_size: petSize,
        pet_weight: petWeight,
        number_of_pets: numberOfPets || 1,
        preferred_date: preferredDate,
        special_requirements: specialRequirements,
        cage_required: cageRequired,
        insurance_required: insuranceRequired,
        base_price: subtotal,
        cage_cost: cageCost,
        insurance_cost: insuranceCost,
        handling_fee: handlingFee,
        total_quote: totalQuote,
        status: 'pending',
        valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      }).catch(async () => {
        // Create table if not exists
        await query(`
          CREATE TABLE IF NOT EXISTS relocation_quotes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID,
            customer_phone VARCHAR(20),
            origin VARCHAR(255),
            destination VARCHAR(255),
            transport_type VARCHAR(50),
            pet_type VARCHAR(50),
            pet_size VARCHAR(50),
            pet_weight DECIMAL(10,2),
            number_of_pets INTEGER DEFAULT 1,
            preferred_date DATE,
            special_requirements TEXT,
            cage_required BOOLEAN DEFAULT false,
            insurance_required BOOLEAN DEFAULT false,
            base_price DECIMAL(10,2),
            cage_cost DECIMAL(10,2),
            insurance_cost DECIMAL(10,2),
            handling_fee DECIMAL(10,2),
            total_quote DECIMAL(10,2),
            status VARCHAR(50) DEFAULT 'pending',
            valid_until TIMESTAMP,
            vendor_id UUID,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        return insert('relocation_quotes', {
          customer_id: customerId,
          customer_phone: customerPhone,
          origin: origin,
          destination: destination,
          transport_type: transportType || 'road',
          total_quote: totalQuote,
          status: 'pending',
        });
      });

      return c.json({
        success: true,
        quote: {
          id: quote[0]?.id,
          origin,
          destination,
          transportType: transportType || 'road',
          breakdown: {
            basePrice: subtotal,
            cageCost,
            insuranceCost,
            handlingFee,
          },
          totalQuote,
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        message: 'Quote generated successfully',
      });
    } catch (error: any) {
      console.error('Error generating relocation quote:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /relocation/book
   * Book relocation service based on quote
   */
  app.post("/relocation/book", async (c) => {
    try {
      const body = await c.req.json();
      const { quoteId, customerId, vendorId, paymentMethod } = body;

      if (!quoteId) {
        return c.json({ error: 'Quote ID is required' }, 400);
      }

      // Get quote details
      const quotes = await query(`SELECT * FROM relocation_quotes WHERE id = $1`, [quoteId]).catch(() => ({ rows: [] }));
      if (quotes.rows.length === 0) {
        return c.json({ error: 'Quote not found' }, 404);
      }

      const quote = quotes.rows[0];

      // Check if quote is still valid
      if (new Date(quote.valid_until) < new Date()) {
        return c.json({ error: 'Quote has expired. Please request a new quote.' }, 400);
      }

      // Create booking
      const booking = await insert('bookings', {
        customer_id: customerId || quote.customer_id,
        vendor_id: vendorId,
        service_type: 'pet_relocation',
        booking_date: quote.preferred_date || new Date().toISOString().split('T')[0],
        total_amount: quote.total_quote,
        status: 'pending',
        payment_method: paymentMethod || 'online',
        metadata: JSON.stringify({
          quoteId: quoteId,
          origin: quote.origin,
          destination: quote.destination,
          transportType: quote.transport_type,
          petType: quote.pet_type,
          petSize: quote.pet_size,
          numberOfPets: quote.number_of_pets,
          cageRequired: quote.cage_required,
          insuranceRequired: quote.insurance_required,
        }),
      });

      // Update quote status
      await update('relocation_quotes', { id: quoteId }, { status: 'booked', vendor_id: vendorId });

      return c.json({
        success: true,
        booking: booking[0],
        message: 'Relocation booked successfully!',
      });
    } catch (error: any) {
      console.error('Error booking relocation:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // VENDOR ENDPOINTS FOR ALL SPECIALIZED SERVICES
  // ============================================

  /**
   * GET /vendor/:vendorId/adoption/pets
   * Get pets available for adoption at a shelter/NGO
   */
  app.get("/vendor/:vendorId/adoption/pets", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');

      let petsQuery = `
        SELECT p.*
        FROM pets p
        WHERE p.vendor_id = $1 AND p.is_for_adoption = true
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (status) {
        petsQuery += ` AND p.adoption_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      petsQuery += ` ORDER BY p.created_at DESC`;

      const pets = await query(petsQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        pets: pets.rows,
        total: pets.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching adoption pets:', error);
      return c.json({ success: true, pets: [], total: 0 });
    }
  });

  /**
   * POST /vendor/:vendorId/adoption/pets
   * Add a pet for adoption at a shelter/NGO
   */
  app.post("/vendor/:vendorId/adoption/pets", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const petData = await c.req.json();

      const pet = await insert('pets', {
        vendor_id: vendorId,
        name: petData.name,
        species: petData.species || 'dog',
        breed: petData.breed,
        age_years: petData.age || 1,
        gender: petData.gender,
        description: petData.description,
        photos: petData.photos || [],
        is_for_adoption: true,
        adoption_status: 'available',
        health_notes: petData.healthNotes,
        vaccination_status: petData.vaccinationStatus,
        is_neutered: petData.isNeutered || false,
      });

      return c.json({
        success: true,
        pet: pet[0],
        message: 'Pet added for adoption',
      });
    } catch (error: any) {
      console.error('Error adding adoption pet:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/adoption/pets/:petId
   * Update a pet for adoption
   */
  app.put("/vendor/:vendorId/adoption/pets/:petId", async (c) => {
    try {
      const { vendorId, petId } = c.req.param();
      const petData = await c.req.json();

      const updated = await update('pets', 
        { id: petId },
        {
          name: petData.name,
          species: petData.species,
          breed: petData.breed,
          age_years: petData.age,
          gender: petData.gender,
          description: petData.description,
          photos: petData.photos,
          adoption_status: petData.adoptionStatus || petData.adoption_status,
          health_notes: petData.healthNotes,
          vaccination_status: petData.vaccinationStatus,
          is_neutered: petData.isNeutered,
          updated_at: new Date().toISOString(),
        }
      );

      return c.json({
        success: true,
        pet: updated[0],
        message: 'Pet updated',
      });
    } catch (error: any) {
      console.error('Error updating adoption pet:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/adoption-applications
   * Get adoption applications for a vendor (shelter/NGO)
   */
  app.get("/vendor/:vendorId/adoption-applications", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');

      let applicationsQuery = `
        SELECT 
          aa.*,
          p.name as pet_name,
          p.breed as pet_breed,
          p.photos as pet_photos,
          c.full_name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email
        FROM adoption_applications aa
        LEFT JOIN pets p ON aa.pet_id = p.id
        LEFT JOIN customers c ON aa.customer_id = c.id
        WHERE aa.vendor_id = $1
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (status) {
        applicationsQuery += ` AND aa.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      applicationsQuery += ` ORDER BY aa.submitted_at DESC`;

      const applications = await query(applicationsQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        applications: applications.rows,
        total: applications.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching adoption applications:', error);
      return c.json({ success: true, applications: [], total: 0 });
    }
  });

  /**
   * PUT /vendor/:vendorId/adoption-applications/:applicationId
   * Update adoption application status (approve/reject)
   */
  app.put("/vendor/:vendorId/adoption-applications/:applicationId", async (c) => {
    try {
      const { vendorId, applicationId } = c.req.param();
      const body = await c.req.json();
      const { status, reviewerNotes } = body;

      if (!['approved', 'rejected', 'pending', 'under_review'].includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }

      const updated = await update('adoption_applications',
        { id: applicationId, vendor_id: vendorId },
        {
          status: status,
          reviewer_notes: reviewerNotes,
          reviewed_at: new Date().toISOString(),
        }
      );

      // If approved, update pet status
      if (status === 'approved' && updated[0]?.pet_id) {
        await update('pets', { id: updated[0].pet_id }, { status: 'adoption_pending' });
      }

      return c.json({
        success: true,
        application: updated[0],
        message: `Application ${status} successfully`,
      });
    } catch (error: any) {
      console.error('Error updating adoption application:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/relocation-quotes
   * Get relocation quote requests for a vendor
   */
  app.get("/vendor/:vendorId/relocation-quotes", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');

      // For relocation vendors, get all pending quotes in their service area
      let quotesQuery = `
        SELECT 
          rq.*,
          c.full_name as customer_name,
          c.phone as customer_phone
        FROM relocation_quotes rq
        LEFT JOIN customers c ON rq.customer_id = c.id
        WHERE rq.status = 'pending'
        OR rq.vendor_id = $1
        ORDER BY rq.created_at DESC
      `;

      const quotes = await query(quotesQuery, [vendorId]).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        quotes: quotes.rows,
        total: quotes.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching relocation quotes:', error);
      return c.json({ success: true, quotes: [], total: 0 });
    }
  });

  /**
   * POST /vendor/:vendorId/relocation-quotes/:quoteId/respond
   * Vendor responds to a relocation quote request
   */
  app.post("/vendor/:vendorId/relocation-quotes/:quoteId/respond", async (c) => {
    try {
      const { vendorId, quoteId } = c.req.param();
      const body = await c.req.json();
      const { finalPrice, notes, estimatedPickupDate, estimatedDeliveryDate } = body;

      const updated = await update('relocation_quotes',
        { id: quoteId },
        {
          vendor_id: vendorId,
          total_quote: finalPrice,
          status: 'quoted',
          updated_at: new Date().toISOString(),
        }
      );

      return c.json({
        success: true,
        quote: updated[0],
        message: 'Quote response submitted successfully',
      });
    } catch (error: any) {
      console.error('Error responding to relocation quote:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holiday-custom-requests
   * Get custom holiday package requests for a vendor
   */
  app.get("/vendor/:vendorId/holiday-custom-requests", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const requests = await query(`
        SELECT 
          hcr.*,
          c.full_name as customer_name,
          c.phone as customer_phone
        FROM holiday_custom_requests hcr
        LEFT JOIN customers c ON hcr.customer_id = c.id
        WHERE hcr.status = 'pending_quote'
        OR hcr.vendor_id = $1
        ORDER BY hcr.created_at DESC
      `, [vendorId]).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        requests: requests.rows,
        total: requests.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching holiday custom requests:', error);
      return c.json({ success: true, requests: [], total: 0 });
    }
  });

  /**
   * GET /vendor/:vendorId/mating-requests
   * Get mating requests involving vendor's breeders
   */
  app.get("/vendor/:vendorId/mating-requests", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get pets owned by this vendor (breeder)
      const vendorPets = await query(`
        SELECT id FROM pets WHERE vendor_id = $1
      `, [vendorId]).catch(() => ({ rows: [] }));

      if (vendorPets.rows.length === 0) {
        return c.json({ success: true, requests: [], total: 0 });
      }

      const petIds = vendorPets.rows.map((p: any) => p.id);

      const requests = await query(`
        SELECT 
          mr.*,
          fp.name as from_pet_name,
          fp.breed as from_pet_breed,
          tp.name as to_pet_name,
          tp.breed as to_pet_breed,
          fc.full_name as from_owner_name,
          fc.phone as from_owner_phone
        FROM mating_requests mr
        LEFT JOIN pets fp ON mr.from_pet_id = fp.id
        LEFT JOIN pets tp ON mr.to_pet_id = tp.id
        LEFT JOIN customers fc ON mr.from_customer_id = fc.id
        WHERE mr.to_pet_id = ANY($1)
        ORDER BY mr.created_at DESC
      `, [petIds]).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        requests: requests.rows,
        total: requests.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching mating requests:', error);
      return c.json({ success: true, requests: [], total: 0 });
    }
  });
}
