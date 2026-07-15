import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbAdoptionPetsPetidGet0(v, p) {
  return await query(`
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
}

export async function dbAdoptionPetsPetidGet1(p, pet) {
  return await query(`
        SELECT p.id, p.name, p.breed, p.age, p.photos, p.adoption_fee
        FROM pets p
        WHERE p.pet_type = $1
        AND p.id != $2
        AND p.status = 'available'
        LIMIT 4
      `, [pet.pet_type, petId])
}

