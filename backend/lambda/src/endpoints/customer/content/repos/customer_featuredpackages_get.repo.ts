import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerFeaturedpackagesGet0(name, description, discount_type, discount_value, min_order_amount, applicable_services) {
  return await query(
        `SELECT 
          id,
          name,
          description,
          discount_type,
          discount_value,
          min_order_amount,
          applicable_services,
          metadata
        FROM promotions
        WHERE is_active = true
        AND is_spotlight = true
        AND published = true
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
        ORDER BY priority ASC, created_at DESC
        LIMIT $1`,
        [limit]
      )
}

