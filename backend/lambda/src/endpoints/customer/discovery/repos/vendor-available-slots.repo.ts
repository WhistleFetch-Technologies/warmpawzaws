import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorAvailableSlots0(vendorId, text, phone) {
  return await query(
          `SELECT vendor_id::text as vendor_id_text, phone, onboarding_status
           FROM vendor_identity 
           WHERE id::text = $1 
           LIMIT 1`,
          [vendorId]
        );
}

export async function dbVendorAvailableSlots1(linkedVendorId, text) {
  return await query(
            `SELECT * FROM vendors WHERE id::text = $1 LIMIT 1`,
            [linkedVendorId]
          );
}

export async function dbVendorAvailableSlots2(text, vendor) {
  return await query(
          `SELECT COUNT(*) as count FROM vendor_availability_v2 WHERE vendor_id::text = $1`,
          [vendor.id]
        )
}

export async function dbVendorAvailableSlots3(text, vendors, vendor, business_name) {
  return await query(
            `SELECT id::text, business_name, 
                    (SELECT COUNT(*) FROM vendor_availability_v2 WHERE vendor_id::text = vendors.id::text) as availability_count
             FROM vendors 
             WHERE phone = $1
             ORDER BY availability_count DESC, id::text
             LIMIT 10`,
            [vendor.phone]
          )
}

export async function dbVendorAvailableSlots4(availId, text) {
  return await query(
            `SELECT COUNT(*) as count, 
                    array_agg(DISTINCT day_of_week) as days,
                    array_agg(DISTINCT service_styles) as styles
             FROM vendor_availability_v2 
             WHERE vendor_id::text = $1 
               AND (COALESCE(is_available, true) = true)`,
            [availId]
          );
}

export async function dbVendorAvailableSlots5(availId, text, business_name, status, is_active) {
  return await query(
            `SELECT id::text, business_name, status, is_active, is_online 
             FROM vendors 
             WHERE id::text = $1`,
            [availId]
          );
}

export async function dbVendorAvailableSlots6(availId, text, phone) {
  return await query(
              `SELECT id::text, vendor_id::text, phone, onboarding_status 
               FROM vendor_identity 
               WHERE id::text = $1`,
              [availId]
            );
}

export async function dbVendorAvailableSlots7(vendorId, text) {
  return await query(
            `SELECT COUNT(*) as count FROM vendor_availability_v2 WHERE vendor_id::text = $1`,
            [vendorId]
          );
}

export async function dbVendorAvailableSlots8(finalVendorId, text, vendor) {
  return await query(
            `SELECT id::text, vendor_id::text, phone 
             FROM vendor_identity 
             WHERE phone = $1 OR vendor_id::text = $2`,
            [vendor.phone, finalVendorId]
          );
}

export async function dbVendorAvailableSlots9(identityId, text) {
  return await query(
                `SELECT COUNT(*) as count FROM vendor_availability_v2 WHERE vendor_id::text = $1`,
                [identityId]
              );
}

export async function dbVendorAvailableSlots10(availabilityIdsForQuery, text, day_of_week, service_style, service_type, is_available) {
  return await query(
            `SELECT vendor_id, day_of_week,
             COALESCE(service_styles, ARRAY[]::text[]) as service_styles,
             service_style, service_type, is_available, is_enabled
             FROM vendor_availability_v2
             WHERE vendor_id::text = ANY($1::text[])
             ORDER BY day_of_week`,
            [availabilityIdsForQuery]
          );
}

export async function dbVendorAvailableSlots11() {
  return await query(`SELECT policy_type, policy_config FROM scheduling_policies WHERE is_active = true`)
}

export async function dbVendorAvailableSlots12(resolvedVendorId, text) {
  return await query(
        `SELECT COALESCE(is_online, true) AS is_online FROM vendors WHERE id::text = $1 LIMIT 1`,
        [resolvedVendorId]
      );
}

export async function dbVendorAvailableSlots13(resolvedVendorId, date) {
  return await query(
          `SELECT 1 FROM vendor_holidays_enhanced 
           WHERE vendor_id = $1 AND is_active = true
             AND ($2::date >= start_date AND $2::date <= end_date)
           LIMIT 1`,
          [resolvedVendorId, date]
        );
}

export async function dbVendorAvailableSlots14(resolvedVendorId, date) {
  return await query(
            `SELECT 1 FROM vendor_holidays WHERE vendor_id = $1 AND date = $2 LIMIT 1`,
            [resolvedVendorId, date]
          );
}

export async function dbVendorAvailableSlots15(staffQuery, params) {
  return await query(staffQuery, params)
}

export async function dbVendorAvailableSlots16(resolvedVendorId, date) {
  return await query(
            `SELECT booking_time, staff_id FROM bookings 
             WHERE vendor_id = $1 
             AND booking_date = $2 
             AND status NOT IN ('cancelled', 'rejected')`,
            [resolvedVendorId, date]
          );
}

export async function dbVendorAvailableSlots17(availabilityIdsForQuery, text, day_of_week, service_style) {
  return await query(
          `SELECT vendor_id::text, day_of_week, 
                  COALESCE(service_styles, ARRAY[]::text[]) as service_styles,
                  service_style, service_type
           FROM vendor_availability_v2
           WHERE vendor_id::text = ANY($1::text[])
           ORDER BY day_of_week
           LIMIT 10`,
          [availabilityIdsForQuery]
        );
}

export async function dbVendorAvailableSlots18(canonicalVendorId, text, day_of_week, service_type, is_available) {
  return await query(
          `SELECT vendor_id::text, day_of_week, 
                  COALESCE(service_styles, ARRAY[]::text[]) as service_styles,
                  service_type, 
                  is_available,
                  COALESCE(time_window_start, start_time) as start_time,
                  COALESCE(time_window_end, end_time) as end_time
           FROM vendor_availability_v2
           WHERE vendor_id::text = $1
           ORDER BY day_of_week, COALESCE(time_window_start, start_time)`,
          [canonicalVendorId]
        );
}

export async function dbVendorAvailableSlots19(canonicalVendorId, dayOfWeekValues, acceptableStylesForSlot, int, text) {
  return await query(
          `SELECT 
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE day_of_week = ANY($2::int[])) as day_match_count,
            COUNT(*) FILTER (WHERE day_of_week = ANY($2::int[]) AND (
               (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[])
              OR (service_type IS NOT NULL AND service_type::text = ANY($3::text[]))
            )) as day_style_match_count,
            COUNT(*) FILTER (WHERE day_of_week = ANY($2::int[]) AND (
              (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[])
              OR (service_type IS NOT NULL AND service_type::text = ANY($3::text[]))
            ) AND (COALESCE(is_available, true) = true OR is_available IS NULL)) as day_style_enabled_match_count,
            array_agg(DISTINCT day_of_week) as distinct_days,
            array_agg(DISTINCT service_type) FILTER (WHERE service_type IS NOT NULL) as distinct_service_types
           FROM vendor_availability_v2
           WHERE vendor_id::text = $1`,
          [canonicalVendorId, dayOfWeekValues, acceptableStylesForSlot]
        );
}

export async function dbVendorAvailableSlots20(availabilityIdsForQuery, dayOfWeekValues, acceptableStylesForSlot, text, int, va) {
  return await query(
          `SELECT va.id, va.day_of_week, 
                  COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                  COALESCE(va.time_window_end, va.end_time) as time_window_end,
                  va.start_time, va.end_time,
                  va.service_styles, va.service_type,
                  COALESCE(va.is_available, true) as is_available,
                  va.lead_time_by_style,
                  va.buffer_time,
                  va.buffer_time_minutes,
                  va.max_capacity
           FROM vendor_availability_v2 va
           WHERE va.vendor_id::text = ANY($1::text[])
             AND va.day_of_week = ANY($2::int[])
             AND (
               (COALESCE(va.service_styles, ARRAY[]::text[]) && $3::text[])
               OR (va.service_type IS NOT NULL AND va.service_type::text = ANY($3::text[]))
             )
             AND COALESCE(va.is_available, true) = true`,
          [availabilityIdsForQuery, dayOfWeekValues, acceptableStylesForSlot]
        );
}

export async function dbVendorAvailableSlots21(availabilityIdsForQuery, dayOfWeekValues, text, int, va) {
  return await query(
            `SELECT va.id, va.day_of_week, 
                    COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                    COALESCE(va.time_window_end, va.end_time) as time_window_end,
                    va.start_time, va.end_time,
                    va.service_styles, va.service_type,
                    COALESCE(va.is_available, true) as is_available,
                    va.lead_time_by_style,
                    va.buffer_time,
                    va.buffer_time_minutes,
                    va.max_capacity
             FROM vendor_availability_v2 va
             WHERE va.vendor_id::text = ANY($1::text[])
               AND va.day_of_week = ANY($2::int[])
               AND COALESCE(va.is_available, true) = true`,
            [availabilityIdsForQuery, dayOfWeekValues]
          );
}

export async function dbVendorAvailableSlots22(availabilityIdsForQuery, dayOfWeekValues, acceptableStylesForSlot, text, int, va, v) {
  return await query(
                `SELECT va.id, va.day_of_week, 
                      COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                      COALESCE(va.time_window_end, va.end_time) as time_window_end,
                      va.start_time, va.end_time,
                      va.service_styles, va.service_type,
                      COALESCE(va.is_available, true) as is_available,
                      va.lead_time_by_style,
                      va.buffer_time,
                      va.buffer_time_minutes,
                      va.max_capacity,
                      true as is_online, v.status, v.is_active
               FROM vendor_availability_v2 va
               JOIN vendors v ON va.vendor_id = v.id
               WHERE va.vendor_id::text = ANY($1::text[])
                 AND va.day_of_week = ANY($2::int[])
                 AND (
                   (COALESCE(va.service_styles, ARRAY[]::text[]) && $3::text[])
                   OR (va.service_type IS NOT NULL AND va.service_type::text = ANY($3::text[]))
                   OR EXISTS (
                     SELECT 1 FROM unnest(COALESCE(va.service_styles, ARRAY[]::text[])) AS style
                     WHERE style = ANY($3::text[])
                   )
                 )
                 AND COALESCE(va.is_available, true) = true
                 AND v.status = 'approved'
                 AND v.is_active = true
               ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
                [availabilityIdsForQuery, dayOfWeekValues, acceptableStylesForSlot]
              );
}

export async function dbVendorAvailableSlots23(availabilityIdsForQuery, dayOfWeekValues, text, int, va, v) {
  return await query(
                  `SELECT va.id, va.day_of_week, 
                        COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                        COALESCE(va.time_window_end, va.end_time) as time_window_end,
                        va.start_time, va.end_time,
                        va.service_styles, va.service_type,
                        COALESCE(va.is_available, true) as is_available,
                        va.lead_time_by_style,
                        va.buffer_time,
                        va.buffer_time_minutes,
                        va.max_capacity,
                        true as is_online, v.status, v.is_active
                 FROM vendor_availability_v2 va
                 JOIN vendors v ON va.vendor_id = v.id
                 WHERE va.vendor_id::text = ANY($1::text[])
                   AND va.day_of_week = ANY($2::int[])
                   AND (COALESCE(va.is_available, true) = true)
                   AND v.status = 'approved'
                   AND v.is_active = true
                 ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
                  [availabilityIdsForQuery, dayOfWeekValues]
                );
}

export async function dbVendorAvailableSlots24(availabilityIdsForQuery, dayOfWeekValues, text, int, va) {
  return await query(
                    `SELECT va.id, va.day_of_week, 
                          COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                          COALESCE(va.time_window_end, va.end_time) as time_window_end,
                          va.start_time, va.end_time,
                          va.service_styles, va.service_type,
                          COALESCE(va.is_available, true) as is_available,
                          va.lead_time_by_style,
                          va.buffer_time,
                          va.buffer_time_minutes,
                          va.max_capacity
                   FROM vendor_availability_v2 va
                   WHERE va.vendor_id::text = ANY($1::text[])
                     AND va.day_of_week = ANY($2::int[])
                     AND (COALESCE(va.is_available, true) = true)
                   ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
                    [availabilityIdsForQuery, dayOfWeekValues]
                  );
}

export async function dbVendorAvailableSlots25(availabilityIdsForQuery, dayOfWeekValues, text, int, va) {
  return await query(
                      `SELECT va.id, va.day_of_week, 
                            COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                            COALESCE(va.time_window_end, va.end_time) as time_window_end,
                            va.start_time, va.end_time,
                            va.service_styles, va.service_type,
                            COALESCE(va.is_available, true) as is_available,
                            va.lead_time_by_style,
                            va.buffer_time,
                            va.buffer_time_minutes,
                            va.max_capacity
                     FROM vendor_availability_v2 va
                     WHERE va.vendor_id::text = ANY($1::text[])
                       AND va.day_of_week = ANY($2::int[])
                     ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
                      [availabilityIdsForQuery, dayOfWeekValues]
                    );
}

export async function dbVendorAvailableSlots26(availabilityIdsForQuery, text, v) {
  return await query(
            `SELECT v.id::text, v.business_name, v.phone, v.status, v.is_active, v.is_online,
                    (SELECT COUNT(*) FROM vendor_availability_v2 WHERE vendor_id::text = v.id::text) as availability_count
             FROM vendors v
             WHERE v.id::text = ANY($1::text[])
             ORDER BY availability_count DESC
             LIMIT 5`,
            [availabilityIdsForQuery]
          );
}

export async function dbVendorAvailableSlots27(resolvedVendorId, dayOfWeek, date) {
  return await query(
          `SELECT start_time, end_time FROM vendor_breaks
           WHERE vendor_id = $1 AND is_active = true
             AND ((is_recurring = true AND day_of_week = $2) OR break_date = $3::date)`,
          [resolvedVendorId, dayOfWeek, date]
        );
}

export async function dbVendorAvailableSlots28(resolvedVendorId, date, duration_minutes) {
  return await query(
          `SELECT booking_time, 
                  COALESCE(total_duration_minutes, duration_minutes, 30) as duration_minutes
           FROM bookings
           WHERE vendor_id = $1 AND booking_date = $2
             AND status NOT IN ('cancelled', 'rejected', 'no_show')`,
          [resolvedVendorId, date]
        );
}

