/**
 * Schema for public.prescription_submissions
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:17:29.682Z
 */

export const prescription_submissionsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (submission_id IS NOT NULL) CHECK (customer_id IS NOT NULL) CHECK (id IS NOT NULL) CHECK (pharmacy_vendor_id IS NOT NULL)',
  submission_id: 'text NOT NULL UNIQUE CHECK (submission_id IS NOT NULL)',
  customer_id: 'uuid NOT NULL CHECK (customer_id IS NOT NULL)', // REFERENCES customers(id),
  pharmacy_vendor_id: 'uuid NOT NULL CHECK (pharmacy_vendor_id IS NOT NULL)', // REFERENCES vendors(id),
  prescription_url: 'text NOT NULL CHECK (prescription_url IS NOT NULL)',
  prescription_type: 'text NOT NULL CHECK (prescription_type IS NOT NULL) CHECK (((prescription_type = ANY (ARRAY['image'::text, 'pdf'::text]))))',
  notes: 'text',
  pet_id: 'uuid', // REFERENCES pets(id),
  pet_name: 'text',
  customer_name: 'text NOT NULL CHECK (customer_name IS NOT NULL)',
  customer_phone: 'text NOT NULL CHECK (customer_phone IS NOT NULL)',
  customer_email: 'text',
  pharmacy_name: 'text NOT NULL CHECK (pharmacy_name IS NOT NULL)',
  status: 'text NOT NULL DEFAULT 'pending_verification' CHECK (status IS NOT NULL) CHECK (((status = ANY (ARRAY['pending_verification'::text, 'verified'::text, 'rejected'::text]))))',
  verification_notes: 'text',
  verified_by: 'uuid', // REFERENCES staff(id),
  verified_at: 'timestamptz',
  medicines: 'jsonb DEFAULT '[]'',
  expires_at: 'timestamptz NOT NULL CHECK (expires_at IS NOT NULL)',
  submitted_at: 'timestamptz NOT NULL DEFAULT now() CHECK (submitted_at IS NOT NULL)',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Foreign Keys:
 * - customer_id -> public.customers.id
 * - pharmacy_vendor_id -> public.vendors.id
 * - pet_id -> public.pets.id
 * - verified_by -> public.staff.id
 */

/**
 * Indexes:
 * - idx_prescription_submissions_customer: CREATE INDEX idx_prescription_submissions_customer ON public.prescription_submissions USING btree (customer_id)
 * - idx_prescription_submissions_pharmacy: CREATE INDEX idx_prescription_submissions_pharmacy ON public.prescription_submissions USING btree (pharmacy_vendor_id)
 * - idx_prescription_submissions_status: CREATE INDEX idx_prescription_submissions_status ON public.prescription_submissions USING btree (status)
 * - idx_prescription_submissions_submission_id: CREATE INDEX idx_prescription_submissions_submission_id ON public.prescription_submissions USING btree (submission_id)
 * - idx_prescription_submissions_submitted_at: CREATE INDEX idx_prescription_submissions_submitted_at ON public.prescription_submissions USING btree (submitted_at DESC)
 * - prescription_submissions_submission_id_key: CREATE UNIQUE INDEX prescription_submissions_submission_id_key ON public.prescription_submissions USING btree (submission_id)
 */

/**
 * Check Constraints:
 * - 2200_19537_2_not_null: submission_id IS NOT NULL
 * - 2200_19537_14_not_null: status IS NOT NULL
 * - 2200_19537_19_not_null: expires_at IS NOT NULL
 * - 2200_19537_3_not_null: customer_id IS NOT NULL
 * - 2200_19537_1_not_null: id IS NOT NULL
 * - prescription_submissions_status_check: ((status = ANY (ARRAY['pending_verification'::text, 'verified'::text, 'rejected'::text])))
 * - 2200_19537_13_not_null: pharmacy_name IS NOT NULL
 * - 2200_19537_11_not_null: customer_phone IS NOT NULL
 * - 2200_19537_6_not_null: prescription_type IS NOT NULL
 * - 2200_19537_20_not_null: submitted_at IS NOT NULL
 * - prescription_submissions_prescription_type_check: ((prescription_type = ANY (ARRAY['image'::text, 'pdf'::text])))
 * - 2200_19537_5_not_null: prescription_url IS NOT NULL
 * - 2200_19537_4_not_null: pharmacy_vendor_id IS NOT NULL
 * - 2200_19537_10_not_null: customer_name IS NOT NULL
 */

