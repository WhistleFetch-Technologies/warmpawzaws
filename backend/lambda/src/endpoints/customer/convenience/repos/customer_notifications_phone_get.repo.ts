import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerNotificationsPhoneGet0() {
  return await query(
        `SELECT * FROM notifications
         WHERE recipient_id = $1 AND recipient_type = 'customer'
         ORDER BY created_at DESC
         LIMIT $2`,
        [customerId, limit]
      );
}

export async function dbCustomerNotificationsPhoneGet1() {
  return await query(
        `SELECT COUNT(*) as count FROM notifications
         WHERE recipient_id = $1 AND recipient_type = 'customer' AND is_read = false`,
        [customerId]
      );
}

