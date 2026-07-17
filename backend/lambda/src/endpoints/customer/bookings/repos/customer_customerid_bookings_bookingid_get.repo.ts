import { query } from '../../../../database/rds-connection';
import {
  SQL_PACKAGE_PURCHASE_JOIN,
  SQL_PACKAGE_PURCHASE_SELECT,
} from '../../../../utils/customer-booking-package-fields';
import { SQL_BOOKING_SERVICE_LATERAL } from './module-helpers.repo';

export async function dbCustomerCustomeridBookingsBookingidGet0(bookingId: string, customerId: string) {
  return await query(
    `SELECT b.*,
            ${SQL_PACKAGE_PURCHASE_SELECT.trim()},
            v.business_name as vendor_name,
            v.owner_name as vendor_owner,
            v.phone as vendor_phone,
            v.email as vendor_email,
            v.address as vendor_address,
            v.city as vendor_city,
            v.state as vendor_state,
            v.pincode as vendor_pincode,
            COALESCE(br_svc.br_name, s.name) AS service_name,
            COALESCE(br_svc.br_description, s.description) AS service_description,
            COALESCE(br_svc.br_category, s.category) AS service_category,
            COALESCE(br_svc.br_duration, s.duration_minutes, b.duration_minutes, b.total_duration_minutes) AS service_duration,
            st.name as staff_name,
            st.phone as staff_phone,
            p.id as pet_id_from_table,
            p.name as pet_name_from_table,
            p.species as pet_species_from_table,
            p.breed as pet_breed_from_table,
            p.age_years as pet_age_from_table,
            p.weight_kg as pet_weight_from_table,
            p.profile_photo_url as pet_photo_from_table
     FROM bookings b
     LEFT JOIN vendors v ON b.vendor_id = v.id
     ${SQL_BOOKING_SERVICE_LATERAL}
     ${SQL_PACKAGE_PURCHASE_JOIN}
     LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN staff st ON b.staff_id = st.id
     LEFT JOIN LATERAL (
       SELECT id, name, species, breed, age_years, weight_kg, profile_photo_url
       FROM pets
       WHERE (
         (b.notes IS NOT NULL AND b.notes LIKE '%Pet ID:%' AND id::text = SUBSTRING(b.notes FROM 'Pet ID:\\s*([a-f0-9-]+)'))
       )
       LIMIT 1
     ) p ON true
     WHERE b.id = $1 AND b.customer_id = $2`,
    [bookingId, customerId]
  );
}

export async function dbCustomerCustomeridBookingsBookingidGet1(bookingId: string) {
  return await query('SELECT * FROM prescriptions WHERE booking_id = $1', [bookingId]);
}

export async function dbCustomerCustomeridBookingsBookingidGet2(bookingId: string, customerId: string) {
  return await query(
    'SELECT * FROM reviews WHERE booking_id = $1 AND customer_id = $2',
    [bookingId, customerId]
  );
}
