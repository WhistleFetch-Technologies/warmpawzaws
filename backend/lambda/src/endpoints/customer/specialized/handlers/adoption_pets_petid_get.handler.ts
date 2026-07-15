import type { Context } from 'hono';
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
import { select, insert, update, query } from '../../../../database/rds-connection';
import { isValidUUID } from '../../../../types/entities';

export async function adoptionPetsPetidGetHandler(c: Context) {
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
}
