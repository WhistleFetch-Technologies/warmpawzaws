/**
 * Schema for public.refunds
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:20:14.456Z
 */

export const refundsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (payment_id IS NOT NULL) CHECK (customer_id IS NOT NULL) CHECK (id IS NOT NULL)',
  payment_id: 'uuid NOT NULL CHECK (payment_id IS NOT NULL)', // REFERENCES payments(id),
  booking_id: 'uuid', // REFERENCES bookings(id),
  customer_id: 'uuid NOT NULL CHECK (customer_id IS NOT NULL)', // REFERENCES customers(id),
  vendor_id: 'uuid', // REFERENCES vendors(id),
  refund_amount: 'numeric(10,2) NOT NULL CHECK (refund_amount IS NOT NULL)',
  refund_reason: 'text NOT NULL CHECK (refund_reason IS NOT NULL)',
  refund_status: 'text NOT NULL DEFAULT 'pending' CHECK (((refund_status = ANY (ARRAY['pending'::text, 'approved'::text, 'processing'::text, 'completed'::text, 'rejected'::text, 'failed'::text])))) CHECK (refund_status IS NOT NULL)',
  razorpay_refund_id: 'text',
  requested_at: 'timestamptz DEFAULT now()',
  processed_at: 'timestamptz',
  completed_at: 'timestamptz',
  rejection_reason: 'text'
};

/**
 * Foreign Keys:
 * - payment_id -> public.payments.id
 * - customer_id -> public.customers.id
 * - vendor_id -> public.vendors.id
 * - booking_id -> public.bookings.id
 */

/**
 * Check Constraints:
 * - 2200_16711_7_not_null: refund_reason IS NOT NULL
 * - refunds_refund_status_check: ((refund_status = ANY (ARRAY['pending'::text, 'approved'::text, 'processing'::text, 'completed'::text, 'rejected'::text, 'failed'::text])))
 * - 2200_16711_6_not_null: refund_amount IS NOT NULL
 * - 2200_16711_2_not_null: payment_id IS NOT NULL
 * - 2200_16711_4_not_null: customer_id IS NOT NULL
 * - 2200_16711_1_not_null: id IS NOT NULL
 * - 2200_16711_8_not_null: refund_status IS NOT NULL
 */

