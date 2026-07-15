import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPetmatchingRequestPost0(uuid) {
  return await query(
        `SELECT id FROM pets WHERE id = $1 AND customer_id = $2::uuid`,
        [fromPetId, fromCustomerId]
      );
}

export async function dbCustomerPetmatchingRequestPost1() {
  return await query(`SELECT customer_id FROM pets WHERE id = $1`, [toPetId]);
}

export async function dbCustomerPetmatchingRequestPost2(fromPetId, toPetId, fromCustomerId, toCustomerId, message) {
  return await insert('mating_requests', {
        from_pet_id: fromPetId,
        to_pet_id: toPetId,
        from_customer_id: fromCustomerId,
        to_customer_id: toCustomerId,
        message: message,
        status: 'pending',
      })
}

export async function dbCustomerPetmatchingRequestPost3() {
  return await query(`
          CREATE TABLE IF NOT EXISTS mating_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            from_pet_id UUID NOT NULL,
            to_pet_id UUID NOT NULL,
            from_customer_id UUID,
            to_customer_id UUID,
            message TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            accepted_at TIMESTAMP,
            declined_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
}

