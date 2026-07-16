import { query } from '../../../../database/rds-connection';

export async function dbAdoptionPetsPetidGet0(petId: string) {
  return await query(
    `
        SELECT 
          al.id,
          al.pet_name as name,
          al.pet_type,
          al.breed,
          al.age,
          al.age_unit,
          al.gender,
          al.size,
          al.color,
          al.description,
          al.photos,
          al.adoption_fee,
          al.vaccination_status,
          al.medical_history,
          al.spayed_neutered,
          al.microchipped,
          al.special_needs,
          al.status,
          al.location_city,
          v.id as vendor_id,
          v.business_name as vendor_name,
          v.city as vendor_city,
          v.phone as vendor_phone,
          v.email as vendor_email,
          v.address as vendor_address,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) as vendor_rating,
          COALESCE((SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id), 0) as vendor_review_count
        FROM adoption_listings al
        INNER JOIN vendors v ON al.vendor_id = v.id
        WHERE al.id = $1
      `,
    [petId]
  );
}

export async function dbAdoptionPetsPetidGet1(petId: string, pet: { pet_type?: string }) {
  return await query(
    `
        SELECT al.id, al.pet_name as name, al.breed, al.age, al.photos, al.adoption_fee
        FROM adoption_listings al
        WHERE LOWER(TRIM(COALESCE(al.pet_type, ''))) = LOWER(TRIM(COALESCE($1, '')))
        AND al.id != $2
        AND LOWER(TRIM(COALESCE(al.status, ''))) IN ('available', 'active', 'published')
        LIMIT 4
      `,
    [pet.pet_type || '', petId]
  );
}
