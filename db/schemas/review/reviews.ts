/**
 * Schema for public.reviews
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:21:31.325Z
 */

export const reviewsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (vendor_id IS NOT NULL) CHECK (id IS NOT NULL)',
  vendor_id: 'uuid NOT NULL CHECK (vendor_id IS NOT NULL)', // REFERENCES vendors(id),
  customer_id: 'uuid', // REFERENCES customers(id),
  booking_id: 'uuid', // REFERENCES bookings(id),
  rating: 'integer NOT NULL CHECK ((((rating >= 1) AND (rating <= 5)))) CHECK (rating IS NOT NULL)',
  comment: 'text',
  service_type: 'character varying(100)',
  is_verified: 'boolean DEFAULT false',
  is_published: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()',
  is_approved: 'boolean DEFAULT false',
  approved_at: 'timestamptz',
  rejection_reason: 'text'
};

/**
 * Foreign Keys:
 * - vendor_id -> public.vendors.id
 * - customer_id -> public.customers.id
 * - booking_id -> public.bookings.id
 */

/**
 * Indexes:
 * - idx_reviews_booking: CREATE INDEX idx_reviews_booking ON public.reviews USING btree (booking_id)
 * - idx_reviews_customer: CREATE INDEX idx_reviews_customer ON public.reviews USING btree (customer_id)
 * - idx_reviews_is_approved: CREATE INDEX idx_reviews_is_approved ON public.reviews USING btree (is_approved) WHERE (is_approved = true)
 * - idx_reviews_rating: CREATE INDEX idx_reviews_rating ON public.reviews USING btree (rating)
 * - idx_reviews_vendor: CREATE INDEX idx_reviews_vendor ON public.reviews USING btree (vendor_id)
 * - idx_reviews_vendor_approved: CREATE INDEX idx_reviews_vendor_approved ON public.reviews USING btree (vendor_id, is_approved) WHERE (is_approved = true)
 */

/**
 * Check Constraints:
 * - 2200_28384_2_not_null: vendor_id IS NOT NULL
 * - reviews_rating_check: (((rating >= 1) AND (rating <= 5)))
 * - 2200_28384_5_not_null: rating IS NOT NULL
 * - 2200_28384_1_not_null: id IS NOT NULL
 */

