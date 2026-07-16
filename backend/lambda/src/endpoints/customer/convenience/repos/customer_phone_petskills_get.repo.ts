import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhonePetskillsGet0(customerId) {
  return await query(`
        SELECT id, name FROM pets WHERE customer_id = $1
      `, [customerId]);
}

export async function dbCustomerPhonePetskillsGet1(petIds: string[]) {
  return await query(`
        SELECT 
          psp.*,
          ts.skill_name,
          ts.skill_category,
          p.name as pet_name
        FROM pet_skill_progress psp
        LEFT JOIN training_skills ts ON psp.skill_id = ts.id
        LEFT JOIN pets p ON psp.pet_id = p.id
        WHERE psp.pet_id = ANY($1)
        ORDER BY psp.updated_at DESC
      `, [petIds]);
}

