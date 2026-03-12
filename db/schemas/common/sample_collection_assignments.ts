/**
 * Schema for public.sample_collection_assignments
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:22:22.273Z
 */

export const sample_collection_assignmentsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (staff_id IS NOT NULL) CHECK (assignment_id IS NOT NULL) CHECK (vendor_id IS NOT NULL) CHECK (id IS NOT NULL) CHECK (customer_id IS NOT NULL) CHECK (booking_id IS NOT NULL)',
  assignment_id: 'text NOT NULL UNIQUE CHECK (assignment_id IS NOT NULL)',
  booking_id: 'uuid NOT NULL CHECK (booking_id IS NOT NULL)', // REFERENCES bookings(id),
  diagnostic_booking_id: 'uuid', // REFERENCES diagnostic_bookings(id),
  vendor_id: 'uuid NOT NULL CHECK (vendor_id IS NOT NULL)', // REFERENCES vendors(id),
  staff_id: 'uuid NOT NULL CHECK (staff_id IS NOT NULL)', // REFERENCES staff(id),
  customer_id: 'uuid NOT NULL CHECK (customer_id IS NOT NULL)', // REFERENCES customers(id),
  customer_name: 'text NOT NULL CHECK (customer_name IS NOT NULL)',
  customer_phone: 'text NOT NULL CHECK (customer_phone IS NOT NULL)',
  customer_address: 'jsonb NOT NULL CHECK (customer_address IS NOT NULL)',
  pet_id: 'uuid', // REFERENCES pets(id),
  pet_name: 'text',
  diagnostic_tests: 'jsonb DEFAULT '[]'',
  scheduled_date: 'date NOT NULL CHECK (scheduled_datetime IS NOT NULL) CHECK (scheduled_date IS NOT NULL)',
  scheduled_time: 'time NOT NULL CHECK (scheduled_time IS NOT NULL)',
  scheduled_datetime: 'timestamptz NOT NULL CHECK (scheduled_datetime IS NOT NULL)',
  estimated_duration: 'integer DEFAULT 30',
  status: 'text NOT NULL DEFAULT 'assigned' CHECK (status IS NOT NULL) CHECK (((status = ANY (ARRAY['assigned'::text, 'in_transit'::text, 'arrived'::text, 'collecting'::text, 'collected'::text, 'returning'::text, 'completed'::text, 'cancelled'::text]))))',
  collection_otp: 'text',
  otp_verified: 'boolean DEFAULT false',
  departure_time: 'timestamptz',
  arrival_time: 'timestamptz',
  collection_start_time: 'timestamptz',
  collection_completed_time: 'timestamptz',
  return_time: 'timestamptz',
  completion_time: 'timestamptz',
  current_location: 'jsonb',
  route: 'jsonb DEFAULT '[]'',
  notes: 'text',
  cancellation_reason: 'text',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Foreign Keys:
 * - booking_id -> public.bookings.id
 * - diagnostic_booking_id -> public.diagnostic_bookings.id
 * - vendor_id -> public.vendors.id
 * - staff_id -> public.staff.id
 * - customer_id -> public.customers.id
 * - pet_id -> public.pets.id
 */

/**
 * Indexes:
 * - idx_sample_collection_assignments_assignment_id: CREATE INDEX idx_sample_collection_assignments_assignment_id ON public.sample_collection_assignments USING btree (assignment_id)
 * - idx_sample_collection_assignments_booking: CREATE INDEX idx_sample_collection_assignments_booking ON public.sample_collection_assignments USING btree (booking_id)
 * - idx_sample_collection_assignments_customer: CREATE INDEX idx_sample_collection_assignments_customer ON public.sample_collection_assignments USING btree (customer_id)
 * - idx_sample_collection_assignments_diagnostic: CREATE INDEX idx_sample_collection_assignments_diagnostic ON public.sample_collection_assignments USING btree (diagnostic_booking_id)
 * - idx_sample_collection_assignments_scheduled: CREATE INDEX idx_sample_collection_assignments_scheduled ON public.sample_collection_assignments USING btree (scheduled_date, scheduled_time)
 * - idx_sample_collection_assignments_staff: CREATE INDEX idx_sample_collection_assignments_staff ON public.sample_collection_assignments USING btree (staff_id)
 * - idx_sample_collection_assignments_status: CREATE INDEX idx_sample_collection_assignments_status ON public.sample_collection_assignments USING btree (status)
 * - idx_sample_collection_assignments_vendor: CREATE INDEX idx_sample_collection_assignments_vendor ON public.sample_collection_assignments USING btree (vendor_id)
 * - sample_collection_assignments_assignment_id_key: CREATE UNIQUE INDEX sample_collection_assignments_assignment_id_key ON public.sample_collection_assignments USING btree (assignment_id)
 */

/**
 * Check Constraints:
 * - 2200_19622_6_not_null: staff_id IS NOT NULL
 * - 2200_19622_16_not_null: scheduled_datetime IS NOT NULL
 * - 2200_19622_2_not_null: assignment_id IS NOT NULL
 * - 2200_19622_14_not_null: scheduled_date IS NOT NULL
 * - 2200_19622_9_not_null: customer_phone IS NOT NULL
 * - 2200_19622_18_not_null: status IS NOT NULL
 * - 2200_19622_5_not_null: vendor_id IS NOT NULL
 * - sample_collection_assignments_status_check: ((status = ANY (ARRAY['assigned'::text, 'in_transit'::text, 'arrived'::text, 'collecting'::text, 'collected'::text, 'returning'::text, 'completed'::text, 'cancelled'::text])))
 * - 2200_19622_1_not_null: id IS NOT NULL
 * - 2200_19622_7_not_null: customer_id IS NOT NULL
 * - 2200_19622_10_not_null: customer_address IS NOT NULL
 * - 2200_19622_3_not_null: booking_id IS NOT NULL
 * - 2200_19622_15_not_null: scheduled_time IS NOT NULL
 * - 2200_19622_8_not_null: customer_name IS NOT NULL
 */

