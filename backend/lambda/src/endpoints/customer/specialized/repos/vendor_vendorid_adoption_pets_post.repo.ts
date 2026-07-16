import { query } from '../../../../database/rds-connection';
import { randomUUID } from 'crypto';

export async function dbVendorVendoridAdoptionPetsPost0(vendorId: string, petData: Record<string, any>) {
  const photos = Array.isArray(petData.photos)
    ? petData.photos.map(String)
    : petData.photos
      ? [String(petData.photos)]
      : [];
  const listingId = randomUUID();

  return await query(
    `INSERT INTO adoption_listings (
       id, listing_id, vendor_id, pet_name, pet_type, breed, age, age_unit, gender, size,
       description, photos, status, adoption_fee, vaccination_status,
       spayed_neutered, medical_history, location_city
     ) VALUES (
       $1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10,
       $11, $12::text[], 'available', $13, $14,
       $15, $16, $17
     ) RETURNING *`,
    [
      listingId,
      listingId,
      vendorId,
      petData.name || 'Pet',
      petData.species || petData.petType || 'dog',
      petData.breed || null,
      petData.age || 1,
      petData.ageUnit || 'years',
      petData.gender || null,
      petData.size || null,
      petData.description || null,
      photos,
      petData.adoptionFee || petData.adoption_fee || 0,
      petData.vaccinationStatus || null,
      Boolean(petData.isNeutered || petData.spayedNeutered || false),
      petData.healthNotes || null,
      petData.city || null,
    ]
  ).then((r) => r.rows);
}
