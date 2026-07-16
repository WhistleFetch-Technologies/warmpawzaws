import { query } from '../../../../database/rds-connection';

export async function dbCustomerPhoneBookingsActivetrackingGet1(customerId: string) {
  return await query(
    `SELECT b.id, b.booking_date, b.scheduled_at,
            b.status, b.service_style,
            COALESCE(v.business_name, s.name) as vendor_name,
            COALESCE(v.profile_photo, s.photo) as vendor_photo,
            COALESCE(vs.service_name, sv.name) as service_name,
            p.name as pet_name,
            gts.current_latitude, gts.current_longitude,
            gts.started_at as tracking_started_at
     FROM gps_tracking_sessions gts
     JOIN bookings b ON gts.booking_id = b.id
     LEFT JOIN vendors v ON b.vendor_id = v.id
     LEFT JOIN staff s ON b.staff_id = s.id
     LEFT JOIN vendor_services vs ON b.service_id = vs.id
     LEFT JOIN services sv ON b.service_id = sv.id
     LEFT JOIN pets p ON b.pet_id = p.id
     WHERE gts.customer_id = $1
       AND gts.status IN ('in_transit', 'arrived')
       AND b.status IN ('confirmed', 'in_progress', 'on_the_way')
       AND b.service_style = 'at_home'
       AND b.status NOT IN ('completed', 'cancelled', 'no_show')
     ORDER BY b.scheduled_at ASC
     LIMIT 10`,
    [customerId]
  );
}
