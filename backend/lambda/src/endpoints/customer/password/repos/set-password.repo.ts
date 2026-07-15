import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbSetPassword0(uuid) {
  return await query(`SELECT id FROM customers WHERE id = $1::uuid LIMIT 1`, [customerId]);
}

export async function dbSetPassword1(uuid) {
  return await query(
    `SELECT phone FROM customers WHERE id = $1::uuid LIMIT 1`,
    [customerId]
  );
}

