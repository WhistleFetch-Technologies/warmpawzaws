/**
 * Schema for public.reminder_queue
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:20:40.141Z
 */

export const reminder_queueSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  booking_id: 'uuid', // REFERENCES bookings(id),
  reminder_type: 'text NOT NULL CHECK (reminder_type IS NOT NULL)',
  scheduled_at: 'timestamptz NOT NULL CHECK (scheduled_at IS NOT NULL)',
  sent_at: 'timestamptz',
  status: 'text DEFAULT 'pending' CHECK (((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]))))',
  created_at: 'timestamptz DEFAULT now()'
};

/**
 * Foreign Keys:
 * - booking_id -> public.bookings.id
 */

/**
 * Check Constraints:
 * - 2200_17196_3_not_null: reminder_type IS NOT NULL
 * - 2200_17196_4_not_null: scheduled_at IS NOT NULL
 * - reminder_queue_status_check: ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])))
 * - 2200_17196_1_not_null: id IS NOT NULL
 */

