import { update } from '../../../../database/rds-connection';

export async function dbVendorVendoridAdoptionPetsPetidPut0(petId: string, petData: Record<string, unknown>) {
  return await update('pets', { id: petId }, {
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
  });
}
