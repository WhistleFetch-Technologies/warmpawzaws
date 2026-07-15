import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhoneBookingsUpcomingcallsGet0(customerId, time, b, v, s, sv, p) {
  return await query(
          `SELECT b.id, b.booking_date, b.booking_time, b.status,
                  (b.booking_date + b.booking_time::time) as scheduled_at,
                  COALESCE(v.business_name, s.name) as vendor_name,
                  COALESCE(v.profile_photo, s.photo) as vendor_photo,
                  sv.service_name as service_name,
                  p.name as pet_name,
                  b.video_call_meeting_id
           FROM bookings b
           LEFT JOIN vendors v ON b.vendor_id = v.id
           LEFT JOIN staff s ON b.staff_id = s.id
           LEFT JOIN vendor_services sv ON b.service_id = sv.id
           LEFT JOIN pets p ON b.pet_id = p.id
           WHERE b.customer_id = $1
             ${statusFilter}
             AND (b.service_style = 'tele' OR b.service_type = 'tele' OR b.service_type = 'online')
             ${timeFilter}
           ORDER BY (b.booking_date + b.booking_time::time) ASC
           LIMIT 10`,
          [customerId, String(minutes)]
        );
}

