import type { Context } from 'hono';
import * as adoption_pets_getRepo from '../repos/adoption_pets_get.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executeadoptionPetsGet(c: Context) {
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
        petQuery += ` AND p.vendor_id = ${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (city) {
        petQuery += ` AND (v.city ILIKE ${paramIndex} OR p.location_city ILIKE ${paramIndex})`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      if (petType) {
        petQuery += ` AND LOWER(p.pet_type) = LOWER(${paramIndex})`;
        params.push(petType);
        paramIndex++;
      }

      if (breed) {
        petQuery += ` AND p.breed ILIKE ${paramIndex}`;
        params.push(`%${breed}%`);
        paramIndex++;
      }

      if (gender) {
        petQuery += ` AND LOWER(p.gender) = LOWER(${paramIndex})`;
        params.push(gender);
        paramIndex++;
      }

      if (size) {
        petQuery += ` AND LOWER(p.size) = LOWER(${paramIndex})`;
        params.push(size);
        paramIndex++;
      }

      petQuery += ` ORDER BY p.featured DESC NULLS LAST, p.created_at DESC LIMIT ${paramIndex} OFFSET ${paramIndex + 1}`;
      params.push(limit, offset);

      const pets = await adoption_pets_getRepo.dbAdoptionPetsGet0(petQuery, params).catch(() => ({ rows: [] }));

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total FROM pets p
        INNER JOIN vendors v ON p.vendor_id = v.id
        WHERE p.listing_type IN ('adoption', 'rehoming')
        AND p.status = 'available'
        AND v.status = 'approved'
        AND v.is_active = true
      `;
      const totalResult = await adoption_pets_getRepo.dbAdoptionPetsGet1(countQuery).catch(() => ({ rows: [{ total: pets.rows.length }] }));

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
}