-- ============================================================================
-- Migration: 531_customer_addresses_extra_fields.sql
-- Description: Add flat_no, house_no, floor, street_name, apartment_name to customer_addresses
-- ============================================================================

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS flat_no TEXT,
  ADD COLUMN IF NOT EXISTS house_no TEXT,
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS street_name TEXT,
  ADD COLUMN IF NOT EXISTS apartment_name TEXT;

COMMENT ON COLUMN customer_addresses.flat_no IS 'Flat / unit number';
COMMENT ON COLUMN customer_addresses.house_no IS 'House / building number';
COMMENT ON COLUMN customer_addresses.floor IS 'Floor number or name';
COMMENT ON COLUMN customer_addresses.street_name IS 'Street name';
COMMENT ON COLUMN customer_addresses.apartment_name IS 'Apartment / building / society name';
