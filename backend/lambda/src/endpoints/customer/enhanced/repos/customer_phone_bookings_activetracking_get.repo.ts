import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhoneBookingsActivetrackingGet0(phone) {
  return await select('customers', { phone: phone.replace(/\D/g, '') });
}

export async function dbCustomerPhoneBookingsActivetrackingGet1(b, v, s, sv, p, gps, customer) {
  return await query(
        `SELECT b.id, b.booking_date, b.scheduled_at,
                b.status, b.service_style,
                COALESCE(v.business_name, s.name) as vendor_name,
                COALESCE(v.profile_photo, s.photo) as vendor_photo,
                sv.name as service_name,
                p.name as pet_name,
                gps.current_latitude, gps.current_longitude,
                gps.tracking_started_at
         FROM bookings b
         LEFT JOIN vendors v ON b.vendor_id = v.id
         LEFT JOIN staff s ON b.staff_id = s.id
         LEFT JOIN services sv ON b.service_id = sv.id
         LEFT JOIN pets p ON b.pet_id = p.id
         LEFT JOIN gps_tracking gps ON b.id = gps.booking_id AND gps.is_active = true
         WHERE b.customer_id = $1
           AND b.status IN ('confirmed', 'in_progress', 'on_the_way')
           AND b.service_style = 'at_home'
           AND gps.is_active = true
         ORDER BY b.scheduled_at ASC
         LIMIT 10`,
        [customer.id]
      );
}

