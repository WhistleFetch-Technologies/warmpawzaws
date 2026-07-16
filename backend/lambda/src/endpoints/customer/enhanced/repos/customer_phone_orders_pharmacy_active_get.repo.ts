import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhoneOrdersPharmacyActiveGet0(normalizedPhone) {
  return await select('customers', { phone: normalizedPhone });
}

export async function dbCustomerPhoneOrdersPharmacyActiveGet1(customer: { id: string }) {
  return await query(
          `SELECT 
            po.id,
            po.order_number,
            po.status,
            po.tracking_status,
            po.created_at,
            po.delivery_address,
            po.delivery_latitude,
            po.delivery_longitude,
            po.estimated_delivery_time,
            po.logistics_partner_id,
            v.business_name as pharmacy_name,
            v.profile_photo as pharmacy_photo
          FROM pharmacy_orders po
          LEFT JOIN vendors v ON po.pharmacy_id = v.id
          WHERE po.customer_id = $1
            AND po.status NOT IN ('delivered', 'cancelled', 'refunded')
            AND (po.tracking_status IS NOT NULL OR po.status IN ('preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'))
          ORDER BY po.created_at DESC
          LIMIT 10`,
          [customer.id]
        );
}

