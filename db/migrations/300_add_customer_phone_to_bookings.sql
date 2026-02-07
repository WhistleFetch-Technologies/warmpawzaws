-- ============================================================================
-- MIGRATION 300: Add customer_phone column to bookings table
-- ============================================================================
-- Date: 2025-01-XX
-- Purpose: Add customer_phone column to bookings table for direct phone access
--          This enables faster queries without joining customers table
--          and supports backward compatibility with existing code
-- Migration: API Error Fixes - Customer Phone Support
-- ============================================================================

-- Add customer_phone column to bookings table
DO $$ BEGIN
    -- Add customer_phone column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE bookings ADD COLUMN customer_phone VARCHAR(20);
        
        COMMENT ON COLUMN bookings.customer_phone IS 
            'Customer phone number - denormalized from customers table for performance. 
             Should be kept in sync with customers.phone via triggers or application logic.';
    END IF;
END $$;

-- Populate customer_phone for existing bookings
DO $$ 
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update existing bookings with customer phone from customers table
    UPDATE bookings b
    SET customer_phone = c.phone
    FROM customers c
    WHERE b.customer_id = c.id
      AND b.customer_phone IS NULL
      AND c.phone IS NOT NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % bookings with customer phone numbers', updated_count;
END $$;

-- Create index for performance on customer_phone lookups
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone 
ON bookings(customer_phone) 
WHERE customer_phone IS NOT NULL;

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone_status 
ON bookings(customer_phone, status) 
WHERE customer_phone IS NOT NULL;

-- Create function to automatically sync customer_phone when customer_id changes
CREATE OR REPLACE FUNCTION sync_booking_customer_phone()
RETURNS TRIGGER AS $$
BEGIN
    -- If customer_id is set and customer_phone is NULL, fetch from customers table
    IF NEW.customer_id IS NOT NULL AND NEW.customer_phone IS NULL THEN
        SELECT phone INTO NEW.customer_phone
        FROM customers
        WHERE id = NEW.customer_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-sync customer_phone on INSERT
DROP TRIGGER IF EXISTS trigger_sync_booking_customer_phone_insert ON bookings;
CREATE TRIGGER trigger_sync_booking_customer_phone_insert
    BEFORE INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION sync_booking_customer_phone();

-- Create trigger to auto-sync customer_phone on UPDATE (if customer_id changes)
DROP TRIGGER IF EXISTS trigger_sync_booking_customer_phone_update ON bookings;
CREATE TRIGGER trigger_sync_booking_customer_phone_update
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    WHEN (NEW.customer_id IS DISTINCT FROM OLD.customer_id)
    EXECUTE FUNCTION sync_booking_customer_phone();

-- Create function to update customer_phone when customer phone changes
CREATE OR REPLACE FUNCTION update_bookings_customer_phone()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all bookings for this customer if phone changed
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN
        UPDATE bookings
        SET customer_phone = NEW.phone
        WHERE customer_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update bookings when customer phone changes
DROP TRIGGER IF EXISTS trigger_update_bookings_customer_phone ON customers;
CREATE TRIGGER trigger_update_bookings_customer_phone
    AFTER UPDATE OF phone ON customers
    FOR EACH ROW
    WHEN (NEW.phone IS DISTINCT FROM OLD.phone)
    EXECUTE FUNCTION update_bookings_customer_phone();

-- Verification queries
DO $$ 
DECLARE
    total_bookings INTEGER;
    bookings_with_phone INTEGER;
    bookings_without_phone INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_bookings FROM bookings;
    SELECT COUNT(*) INTO bookings_with_phone FROM bookings WHERE customer_phone IS NOT NULL;
    SELECT COUNT(*) INTO bookings_without_phone FROM bookings WHERE customer_phone IS NULL;
    
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '  Total bookings: %', total_bookings;
    RAISE NOTICE '  Bookings with phone: %', bookings_with_phone;
    RAISE NOTICE '  Bookings without phone: %', bookings_without_phone;
END $$;
