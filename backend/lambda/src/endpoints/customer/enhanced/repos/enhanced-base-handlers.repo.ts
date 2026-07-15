import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbEnhancedBaseHandlers0() {
  return await select('customers', { id: customerId });
}

export async function dbEnhancedBaseHandlers1() {
  return await select('customers', { phone: cleanPhone });
}

export async function dbEnhancedBaseHandlers2() {
  return await update('customers', { id: customerId }, updateData);
}

export async function dbEnhancedBaseHandlers3() {
  return await select('customers', { id: customerId });
}

export async function dbEnhancedBaseHandlers4() {
  return await select('pets', { customer_id: customerId });
}

export async function dbEnhancedBaseHandlers5() {
  return await insert('pets', petData);
}

export async function dbEnhancedBaseHandlers6() {
  return await select('customers', { id: customerId });
}

export async function dbEnhancedBaseHandlers7() {
  return await query(
          `SELECT COUNT(*) as count FROM bookings 
           WHERE customer_id = $1 AND status NOT IN ('cancelled', 'completed', 'no_show')`,
          [customerId]
        );
}

export async function dbEnhancedBaseHandlers8() {
  return await query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE customer_id = $1 AND order_status NOT IN ('cancelled', 'delivered', 'refunded')`,
          [customerId]
        );
}

export async function dbEnhancedBaseHandlers9() {
  return await update('customers', { id: customerId }, {
          is_active: false,
          updated_at: new Date(),
        });
}

export async function dbEnhancedBaseHandlers10() {
  return await update('customers', { id: customerId }, {
          is_active: false,
          updated_at: new Date(),
        });
}

