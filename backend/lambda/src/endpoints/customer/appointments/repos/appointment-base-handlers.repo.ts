import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbAppointmentBaseHandlers0() {
  return await query(
        `
        SELECT 
          b.id,
          b.id AS booking_id,
          b.booking_date AS appointment_date,
          b.booking_time AS appointment_time,
          b.status,
          b.notes,
          b.created_at,
          b.updated_at,
          b.service_id,
          b.vendor_id,
          b.pet_id,
          b.total_amount,
          COALESCE(vs.service_name, 'Service') AS service_name,
          COALESCE(vs.service_style, b.service_type) AS service_style,
          COALESCE(v.business_name, v.owner_name, '') AS vendor_name,
          v.address AS vendor_address,
          p.name AS pet_name
        FROM bookings b
        LEFT JOIN vendor_services vs ON b.service_id = vs.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN pets p ON b.pet_id = p.id
        WHERE b.customer_id = $1
        ORDER BY b.booking_date DESC, b.booking_time DESC
      `,
        [customerId]
      )
}

export async function dbAppointmentBaseHandlers1() {
  return await query(
        `
        SELECT 
          b.id,
          b.id AS booking_id,
          b.booking_date AS appointment_date,
          b.booking_time AS appointment_time,
          b.status,
          b.notes,
          b.created_at,
          b.updated_at,
          b.service_id,
          b.vendor_id,
          b.pet_id,
          b.customer_id,
          b.total_amount,
          b.payment_status,
          COALESCE(vs.service_name, 'Service') AS service_name,
          vs.custom_description AS service_description,
          COALESCE(vs.service_style, b.service_type) AS service_style,
          vs.duration_minutes AS duration,
          COALESCE(v.business_name, v.owner_name, '') AS vendor_name,
          v.address AS vendor_address,
          v.phone AS vendor_phone,
          p.name AS pet_name,
          p.species,
          p.breed
        FROM bookings b
        LEFT JOIN vendor_services vs ON b.service_id = vs.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN pets p ON b.pet_id = p.id
        WHERE b.id = $1 AND b.customer_id = $2
      `,
        [appointmentId, customerId]
      )
}

export async function dbAppointmentBaseHandlers2() {
  return await query(
        `
        SELECT * FROM prescriptions
        WHERE booking_id = $1
        ORDER BY created_at DESC
      `,
        [bookingId]
      )
}

export async function dbAppointmentBaseHandlers3() {
  return await query(
        `
        SELECT * FROM medical_records
        WHERE booking_id = $1
        ORDER BY created_at DESC
      `,
        [bookingId]
      )
}

export async function dbAppointmentBaseHandlers4() {
  return await query(
        `
        SELECT * FROM appointment_history
        WHERE appointment_id = $1
        ORDER BY created_at DESC
      `,
        [bookingId]
      )
}

export async function dbAppointmentBaseHandlers5() {
  return await query(
        `
        SELECT b.id, b.customer_id, b.status AS booking_status,
               b.booking_date, b.booking_time
        FROM bookings b
        WHERE b.id = $1 AND b.customer_id = $2
      `,
        [appointmentId, customerId]
      )
}

export async function dbAppointmentBaseHandlers6() {
  return await query(
        `
        UPDATE bookings
        SET 
          booking_date = $1::date,
          booking_time = $2::time,
          notes = COALESCE(notes || E'\n', '') || 'Rescheduled: ' || $3,
          updated_at = NOW()
        WHERE id = $4 AND customer_id = $5
        RETURNING *
      `,
        [
          appointment_date,
          appointment_time,
          reason || 'No reason provided',
          appointmentId,
          customerId,
        ]
      )
}

export async function dbAppointmentBaseHandlers7() {
  return await query(
        `
        INSERT INTO appointment_history (
          appointment_id,
          action,
          previous_date,
          previous_time,
          new_date,
          new_time,
          reason,
          created_at
        ) VALUES ($1, 'rescheduled', $2, $3, $4, $5, $6, NOW())
      `,
        [
          appointmentId,
          appointmentResult.rows[0].booking_date,
          appointmentResult.rows[0].booking_time,
          appointment_date,
          appointment_time,
          reason,
        ]
      )
}

export async function dbAppointmentBaseHandlers8() {
  return await query(
        `
        SELECT b.*, b.status AS booking_status, b.id AS booking_id,
               b.booking_date, b.booking_time, b.vendor_id, b.service_id, b.service_type,
               b.payment_status, b.total_amount, b.customer_id
        FROM bookings b
        WHERE b.id = $1 AND b.customer_id = $2
      `,
        [appointmentId, customerId]
      )
}

export async function dbAppointmentBaseHandlers9() {
  return await query(
        `
        UPDATE bookings
        SET 
          status = 'cancelled',
          notes = COALESCE(notes || E'\n', '') || 'Cancelled: ' || $1,
          cancelled_at = NOW(),
          cancelled_by = 'pet_parent',
          cancellation_reason = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
        [reason || 'No reason provided', bookingId]
      )
}

export async function dbAppointmentBaseHandlers10() {
  return await query(
              `SELECT id FROM payments
               WHERE booking_id = $1::uuid
                 AND payment_status IN ('completed', 'partially_refunded')
               ORDER BY CASE WHEN payment_status = 'completed' THEN 0 ELSE 1 END
               LIMIT 1`,
              [bookingId]
            )
}

export async function dbAppointmentBaseHandlers11() {
  return await query(
        `
        INSERT INTO appointment_history (
          appointment_id,
          action,
          reason,
          created_at
        ) VALUES ($1, 'cancelled', $2, NOW())
      `,
        [appointmentId, reason]
      )
}

