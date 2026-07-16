import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerOrdersOrderidPharmacystatusGet0(orderId: string) {
  return await query(`
        SELECT 
          po.*,
          v.business_name as pharmacy_name,
          v.phone as pharmacy_phone,
          v.address as pharmacy_address,
          dt.delivery_otp as dt_delivery_otp,
          dt.otp_verified as dt_otp_verified,
          dt.delivery_person_name as dt_partner_name,
          dt.delivery_person_phone as dt_partner_phone
        FROM pharmacy_orders po
        LEFT JOIN vendors v ON v.id = po.pharmacy_id
        LEFT JOIN delivery_tracking dt ON dt.pharmacy_order_id = po.id
        WHERE po.id = $1
      `, [orderId]);
}

export async function dbCustomerOrdersOrderidPharmacystatusGet1(orderId) {
  return await query(
          `SELECT * FROM orders WHERE id = $1`,
          [orderId]
        );
}

