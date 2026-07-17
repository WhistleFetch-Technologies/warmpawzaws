import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhoneActivewalksGet0(customerId: string) {
  return await query(
          `
          SELECT 
            wls.booking_id,
            wls.started_at,
            p.name AS pet_name,
            v.business_name AS walker_name,
            (COALESCE(wr.total_distance_meters, 0)::numeric / 1000.0) AS distance_km,
            wr.waypoints
          FROM walker_live_sessions wls
          LEFT JOIN bookings b ON wls.booking_id = b.id
          LEFT JOIN pets p ON b.pet_id = p.id
          LEFT JOIN vendors v ON wls.walker_id = v.id
          LEFT JOIN walk_routes wr ON wls.booking_id = wr.booking_id
          WHERE wls.customer_id = $1
          AND wls.is_active = true
        `,
          [customerId]
        );
}

export async function dbCustomerPhoneActivewalksGet1(customerId: string) {
  return await query(
          `
          SELECT 
            ps.booking_id,
            ps.scheduled_start_time AS scheduled_start_time,
            ps.actual_start_time,
            ps.status,
            ps.location,
            p.name AS pet_name,
            s.name AS walker_name
          FROM package_sessions ps
          LEFT JOIN bookings b ON ps.booking_id = b.id
          LEFT JOIN pets p ON ps.pet_id = p.id
          LEFT JOIN staff s ON ps.staff_id = s.id
          WHERE ps.package_purchase_id IN (
            SELECT id FROM package_purchases WHERE customer_id = $1
          )
          AND ps.status = 'in_progress'
        `,
          [customerId]
        );
}

export async function dbCustomerPhoneActivewalksGet2(customerId: string) {
  return await query(
          `
          SELECT 
            b.id AS booking_id,
            COALESCE(g.started_at, b.created_at) AS started_at,
            p.name AS pet_name,
            v.business_name AS walker_name,
            COALESCE(g.distance_km, g.distance_remaining_km, 0)::numeric AS distance_km,
            g.current_latitude,
            g.current_longitude
          FROM bookings b
          INNER JOIN gps_tracking_sessions g ON g.booking_id = b.id
          LEFT JOIN pets p ON b.pet_id = p.id
          LEFT JOIN vendors v ON b.vendor_id = v.id
          WHERE b.customer_id = $1
          AND b.status = 'in_progress'
          AND g.status IS NOT NULL
          AND LOWER(g.status::text) NOT IN ('completed', 'cancelled')
          AND (
            LOWER(COALESCE(b.service_name, '')) LIKE '%walk%'
            OR LOWER(COALESCE(b.service_type, '')) LIKE '%walk%'
            OR LOWER(COALESCE(b.service_name, '')) LIKE '%stroll%'
          )
        `,
          [customerId]
        );
}

