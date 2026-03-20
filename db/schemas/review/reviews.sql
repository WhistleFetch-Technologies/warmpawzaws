-- ============================================================================
-- REVIEWS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS reviews (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    customer_id UUID,
    booking_id UUID,
    rating INTEGER NOT NULL,
    comment TEXT,
    service_type VARCHAR(100),
    is_verified BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE reviews ADD CONSTRAINT reviews_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE reviews ADD CONSTRAINT reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE reviews ADD CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE reviews ADD CONSTRAINT reviews_rating_check CHECK (rating >= 1 AND rating <= 5);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id);
CREATE INDEX idx_reviews_vendor ON public.reviews USING btree (vendor_id);
CREATE INDEX idx_reviews_customer ON public.reviews USING btree (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_reviews_booking ON public.reviews USING btree (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_reviews_rating ON public.reviews USING btree (rating);
CREATE INDEX idx_reviews_is_approved ON public.reviews USING btree (is_approved) WHERE is_approved = true;
CREATE INDEX idx_reviews_vendor_approved ON public.reviews USING btree (vendor_id, is_approved) WHERE is_approved = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE reviews IS 'Customer reviews and ratings for vendors';
COMMENT ON COLUMN reviews.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN reviews.customer_id IS 'Reference to customers table';
COMMENT ON COLUMN reviews.booking_id IS 'Reference to bookings table';
COMMENT ON COLUMN reviews.rating IS 'Rating (1-5)';
COMMENT ON COLUMN reviews.comment IS 'Review comment';
COMMENT ON COLUMN reviews.service_type IS 'Type of service reviewed';
COMMENT ON COLUMN reviews.is_verified IS 'Whether review is from verified booking';
COMMENT ON COLUMN reviews.is_published IS 'Whether review is published';
COMMENT ON COLUMN reviews.is_approved IS 'Whether review is approved by admin';
COMMENT ON COLUMN reviews.approved_at IS 'When review was approved';
COMMENT ON COLUMN reviews.rejection_reason IS 'Reason for rejection if not approved';
