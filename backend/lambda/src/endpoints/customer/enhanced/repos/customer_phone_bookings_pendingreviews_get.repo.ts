import { query } from '../../../../database/rds-connection';

export async function dbCustomerPhoneBookingsPendingreviewsGet1(
  customerId: string,
  reviewEligibleDays: number
) {
  return await query(
    `SELECT b.id, b.booking_date, b.completed_at,
            COALESCE(v.business_name, s.name) as vendor_name,
            COALESCE(v.profile_photo, s.photo) as vendor_photo,
            COALESCE(vs.service_name, sv.name) as service_name,
            p.name as pet_name
     FROM bookings b
     LEFT JOIN vendors v ON b.vendor_id = v.id
     LEFT JOIN staff s ON b.staff_id = s.id
     LEFT JOIN vendor_services vs ON b.service_id = vs.id
     LEFT JOIN services sv ON b.service_id = sv.id
     LEFT JOIN pets p ON b.pet_id = p.id
     WHERE b.customer_id = $1
       AND b.status = 'completed'
       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)
       AND b.completed_at > NOW() - ($2::text || ' days')::interval
       AND (b.review_skipped_at IS NULL)
     ORDER BY b.completed_at DESC
     LIMIT 5`,
    [customerId, reviewEligibleDays]
  );
}
