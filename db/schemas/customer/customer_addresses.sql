-- ============================================================================
-- CUSTOMER_ADDRESSES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    address_type TEXT DEFAULT 'home'::text,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    landmark TEXT,
    is_default BOOL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    coordinates JSONB,
    flat_no TEXT,
    house_no TEXT,
    floor TEXT,
    street_name TEXT,
    apartment_name TEXT,
    label TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE customer_addresses ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

-- ALTER TABLE customer_addresses ADD CONSTRAINT 2200_20138_10_not_null CHECK (...);
-- ALTER TABLE customer_addresses ADD CONSTRAINT 2200_20138_1_not_null CHECK (...);
-- ALTER TABLE customer_addresses ADD CONSTRAINT 2200_20138_2_not_null CHECK (...);
-- ALTER TABLE customer_addresses ADD CONSTRAINT 2200_20138_4_not_null CHECK (...);
-- ALTER TABLE customer_addresses ADD CONSTRAINT 2200_20138_5_not_null CHECK (...);
-- ALTER TABLE customer_addresses ADD CONSTRAINT 2200_20138_6_not_null CHECK (...);
-- ALTER TABLE customer_addresses ADD CONSTRAINT 2200_20138_8_not_null CHECK (...);
-- ALTER TABLE customer_addresses ADD CONSTRAINT 2200_20138_9_not_null CHECK (...);
-- ALTER TABLE customer_addresses ADD CONSTRAINT customer_addresses_address_type_check CHECK (...);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX customer_addresses_pkey ON public.customer_addresses USING btree (id);
CREATE INDEX idx_customer_addresses_customer ON public.customer_addresses USING btree (customer_id);
CREATE INDEX idx_customer_addresses_default ON public.customer_addresses USING btree (customer_id, is_default) WHERE (is_default = true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE customer_addresses IS 'Customer delivery addresses';
COMMENT ON COLUMN customer_addresses.coordinates IS 'GPS coordinates { lat, lng }';
COMMENT ON COLUMN customer_addresses.flat_no IS 'Flat / unit number';
COMMENT ON COLUMN customer_addresses.house_no IS 'House / building number';
COMMENT ON COLUMN customer_addresses.floor IS 'Floor number or name';
COMMENT ON COLUMN customer_addresses.street_name IS 'Street name';
COMMENT ON COLUMN customer_addresses.apartment_name IS 'Apartment / building / society name';

