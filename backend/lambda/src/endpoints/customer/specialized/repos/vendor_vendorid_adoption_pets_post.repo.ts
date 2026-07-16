import { insert } from '../../../../database/rds-connection';

export async function dbVendorVendoridAdoptionPetsPost0(vendorId: string, petData: Record<string, any>) {
  return await insert('adoption_listings', {
    vendor_id: vendorId,
    pet_name: petData.name,
    pet_type: petData.species || petData.petType || 'dog',
    breed: petData.breed || null,
    age: petData.age || 1,
    age_unit: petData.ageUnit || 'years',
    gender: petData.gender || null,
    size: petData.size || null,
    description: petData.description || null,
    photos: petData.photos || [],
    status: 'available',
    adoption_fee: petData.adoptionFee || petData.adoption_fee || 0,
    vaccination_status: petData.vaccinationStatus || null,
    spayed_neutered: petData.isNeutered || petData.spayedNeutered || false,
    medical_history: petData.healthNotes || null,
    location_city: petData.city || null,
  });
}
