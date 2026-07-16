import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerMealplanordersGet0(customerId, mp, v, p, mo) {
  return await query(
          `SELECT mo.*,
                  COALESCE(NULLIF(TRIM(mp.name), ''), NULLIF(TRIM(mp.plan_name), '')) AS meal_plan_name,
                  mp.plan_name AS mp_plan_name,
                  mp.price_per_meal AS mp_price_per_meal,
                  mp.thumbnail_url AS mp_thumbnail_url,
                  v.business_name AS vendor_name,
                  p.name AS pet_name
           FROM meal_orders mo
           LEFT JOIN meal_plans mp ON mo.meal_plan_id = mp.id
           LEFT JOIN vendors v ON mo.vendor_id = v.id
           LEFT JOIN pets p ON mo.pet_id = p.id
           WHERE mo.customer_id = $1
           ORDER BY mo.created_at DESC`,
          [customerId]
        );
}

export async function dbCustomerMealplanordersGet1(information_schema) {
  return await query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type' LIMIT 1`
        )
}

export async function dbCustomerMealplanordersGet2(customerId, o, v, mp, mpo, p) {
  return await query(
            `SELECT o.id, o.order_number, o.order_status as status, o.total_amount, o.shipping_address as delivery_address,
                    o.delivery_date as scheduled_delivery_date, o.delivery_time as scheduled_delivery_slot, o.created_at,
                    o.vendor_id, v.business_name as vendor_name,
                    (SELECT mp.name FROM meal_plan_orders mpo LEFT JOIN meal_plans mp ON mpo.meal_plan_id = mp.id WHERE mpo.order_id = o.id LIMIT 1) as meal_plan_name,
                    (SELECT mpo.meal_plan_id FROM meal_plan_orders mpo WHERE mpo.order_id = o.id LIMIT 1) as meal_plan_id,
                    (SELECT p.name FROM meal_plan_orders mpo LEFT JOIN pets p ON p.id = mpo.pet_id WHERE mpo.order_id = o.id LIMIT 1) as pet_name,
                    (SELECT mpo.quantity FROM meal_plan_orders mpo WHERE mpo.order_id = o.id LIMIT 1) as line_quantity
             FROM orders o
             LEFT JOIN vendors v ON o.vendor_id = v.id
             WHERE o.customer_id = $1 AND o.order_type = 'meal_plan_delivery'
             ORDER BY o.created_at DESC`,
            [customerId]
          );
}

