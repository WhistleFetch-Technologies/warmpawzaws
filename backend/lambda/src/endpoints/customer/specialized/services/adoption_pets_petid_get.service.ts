import type { Context } from 'hono';
import * as adoption_pets_petid_getRepo from '../repos/adoption_pets_petid_get.repo';

export async function executeadoptionPetsPetidGet(c: Context) {
    try {
      const { petId } = c.req.param();

      const petResult = await adoption_pets_petid_getRepo.dbAdoptionPetsPetidGet0(petId)

      if (petResult.rows.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const pet = petResult.rows[0];

      // Get similar pets
      const similarPets = await adoption_pets_petid_getRepo.dbAdoptionPetsPetidGet1(petId, pet).catch(() => ({ rows: [] }));

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