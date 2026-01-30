-- ============================================================================
-- Migration: 423_fix_customer_addresses_coordinates.sql
-- Description: Add missing coordinates column to customer_addresses table
-- Date: 2026-01-27
-- ============================================================================

-- Add coordinates column if not exists
ALTER TABLE customer_addresses 
ADD COLUMN IF NOT EXISTS coordinates JSONB;

COMMENT ON COLUMN customer_addresses.coordinates IS 'GPS coordinates { lat, lng }';
