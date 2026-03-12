/**
 * Schema for public.prescriptions
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:17:42.028Z
 */

export const prescriptionsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (booking_id IS NOT NULL) CHECK (vendor_id IS NOT NULL) CHECK (id IS NOT NULL) CHECK (customer_id IS NOT NULL) CHECK (pet_id IS NOT NULL)',
  booking_id: 'uuid NOT NULL CHECK (booking_id IS NOT NULL)', // REFERENCES bookings(id),
  pet_id: 'uuid NOT NULL CHECK (pet_id IS NOT NULL)', // REFERENCES pets(id),
  customer_id: 'uuid NOT NULL CHECK (customer_id IS NOT NULL)', // REFERENCES customers(id),
  vendor_id: 'uuid NOT NULL CHECK (vendor_id IS NOT NULL)', // REFERENCES vendors(id),
  staff_id: 'uuid', // REFERENCES staff(id),
  diagnosis: 'text',
  observations: 'text',
  medications: 'jsonb NOT NULL CHECK (medications IS NOT NULL)',
  products_used: 'jsonb',
  tests_recommended: 'jsonb',
  general_notes: 'text',
  recommendations: 'text',
  next_follow_up_date: 'date',
  follow_up_reason: 'text',
  vitals: 'jsonb',
  attachments: 'jsonb',
  status: 'text NOT NULL DEFAULT 'draft' CHECK (status IS NOT NULL) CHECK (((status = ANY (ARRAY['draft'::text, 'finalized'::text, 'immutable'::text]))))',
  is_immutable: 'boolean DEFAULT false',
  finalized_at: 'timestamptz',
  finalized_by: 'uuid', // REFERENCES staff(id),
  digital_signature: 'text',
  signature_timestamp: 'timestamptz',
  created_at: 'timestamptz NOT NULL DEFAULT now() CHECK (created_at IS NOT NULL)',
  updated_at: 'timestamptz DEFAULT now()',
  version: 'integer DEFAULT 1',
  previous_version_id: 'uuid', // REFERENCES prescriptions(id),
  created_by: 'uuid',
  created_by_role: 'text DEFAULT 'vendor'',
  is_active: 'boolean DEFAULT true',
  medication_name: 'text',
  prescription_date: 'date NOT NULL DEFAULT CURRENT_DATE CHECK (prescription_date IS NOT NULL)'
};

/**
 * Foreign Keys:
 * - booking_id -> public.bookings.id
 * - pet_id -> public.pets.id
 * - customer_id -> public.customers.id
 * - vendor_id -> public.vendors.id
 * - staff_id -> public.staff.id
 * - finalized_by -> public.staff.id
 * - previous_version_id -> public.prescriptions.id
 */

/**
 * Indexes:
 * - idx_prescriptions_booking_id: CREATE INDEX idx_prescriptions_booking_id ON public.prescriptions USING btree (booking_id)
 * - idx_prescriptions_created_at: CREATE INDEX idx_prescriptions_created_at ON public.prescriptions USING btree (created_at DESC)
 * - idx_prescriptions_customer_id: CREATE INDEX idx_prescriptions_customer_id ON public.prescriptions USING btree (customer_id)
 * - idx_prescriptions_pet_id: CREATE INDEX idx_prescriptions_pet_id ON public.prescriptions USING btree (pet_id)
 * - idx_prescriptions_prescription_date: CREATE INDEX idx_prescriptions_prescription_date ON public.prescriptions USING btree (prescription_date DESC)
 * - idx_prescriptions_status: CREATE INDEX idx_prescriptions_status ON public.prescriptions USING btree (status)
 * - idx_prescriptions_vendor_id: CREATE INDEX idx_prescriptions_vendor_id ON public.prescriptions USING btree (vendor_id)
 */

/**
 * Check Constraints:
 * - 2200_18657_2_not_null: booking_id IS NOT NULL
 * - 2200_18657_32_not_null: prescription_date IS NOT NULL
 * - 2200_18657_9_not_null: medications IS NOT NULL
 * - 2200_18657_5_not_null: vendor_id IS NOT NULL
 * - 2200_18657_1_not_null: id IS NOT NULL
 * - 2200_18657_18_not_null: status IS NOT NULL
 * - 2200_18657_4_not_null: customer_id IS NOT NULL
 * - 2200_18657_3_not_null: pet_id IS NOT NULL
 * - 2200_18657_24_not_null: created_at IS NOT NULL
 * - prescriptions_status_check: ((status = ANY (ARRAY['draft'::text, 'finalized'::text, 'immutable'::text])))
 */

