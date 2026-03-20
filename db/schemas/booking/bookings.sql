-- ============================================================================
-- BOOKINGS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    vendor_id UUID,
    staff_id UUID,
    service_id UUID NOT NULL,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    service_type TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    base_price NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    loyalty_points_used INTEGER DEFAULT 0,
    coupon_code TEXT,
    promotion_id UUID,
    is_package BOOLEAN DEFAULT false,
    package_id UUID,
    package_details JSONB,
    payment_status TEXT DEFAULT 'pending',
    payment_id UUID,
    otp_code TEXT,
    otp_verified BOOLEAN DEFAULT false,
    otp_expires_at TIMESTAMPTZ,
    notes TEXT,
    cancellation_reason TEXT,
    rescheduled_from_booking_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE bookings ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE bookings ADD CONSTRAINT bookings_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE bookings ADD CONSTRAINT bookings_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE bookings ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES vendor_services(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE bookings ADD CONSTRAINT bookings_rescheduled_from_booking_id_fkey FOREIGN KEY (rescheduled_from_booking_id) REFERENCES bookings(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled', 'partially_completed', 'dispatched', 'arrived', 'active', 'paused', 'renewal_pending', 'expired'));
ALTER TABLE bookings ADD CONSTRAINT bookings_service_type_check CHECK (service_type IN ('at_vendor', 'at_center', 'at_home', 'tele'));
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded', 'failed'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX bookings_pkey ON public.bookings USING btree (id);
CREATE INDEX idx_bookings_customer_id ON public.bookings USING btree (customer_id);
CREATE INDEX idx_bookings_vendor_id ON public.bookings USING btree (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_bookings_staff_id ON public.bookings USING btree (staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX idx_bookings_service_id ON public.bookings USING btree (service_id);
CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);
CREATE INDEX idx_bookings_booking_date ON public.bookings USING btree (booking_date);
CREATE INDEX idx_bookings_payment_status ON public.bookings USING btree (payment_status);
CREATE INDEX idx_bookings_created_at ON public.bookings USING btree (created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE bookings IS 'Bookings - maps from booking:{id} KV keys';
COMMENT ON COLUMN bookings.customer_id IS 'Reference to customers table';
COMMENT ON COLUMN bookings.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN bookings.staff_id IS 'Reference to staff table';
COMMENT ON COLUMN bookings.service_id IS 'Reference to vendor_services table';
COMMENT ON COLUMN bookings.booking_date IS 'From booking form date picker';
COMMENT ON COLUMN bookings.booking_time IS 'From booking form time picker';
COMMENT ON COLUMN bookings.status IS 'Booking status: pending, confirmed, in_progress, completed, cancelled, no_show, rescheduled';
COMMENT ON COLUMN bookings.service_type IS 'Service type: at_vendor, at_center, at_home, tele';
COMMENT ON COLUMN bookings.payment_status IS 'Payment status: pending, partial, paid, refunded, failed';
