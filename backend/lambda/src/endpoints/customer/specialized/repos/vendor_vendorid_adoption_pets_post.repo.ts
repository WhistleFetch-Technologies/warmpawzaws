import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorVendoridAdoptionPetsPost0(vendorId, petData) {
  return await insert('pets', {
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
}

