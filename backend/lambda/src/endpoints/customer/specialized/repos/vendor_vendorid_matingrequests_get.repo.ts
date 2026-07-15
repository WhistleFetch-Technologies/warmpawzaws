import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorVendoridMatingrequestsGet0() {
  return await query(`
        SELECT id FROM pets WHERE vendor_id = $1
      `, [vendorId])
}

export async function dbVendorVendoridMatingrequestsGet1(fp, tp, fc, mr) {
  return await query(`
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
      `, [petIds])
}

