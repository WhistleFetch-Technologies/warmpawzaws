-- Migration 1025: Clean state/city pincode contamination
--
-- Problem: Google Maps address autocomplete sometimes returns state as "Karnataka 560001"
-- (state + pincode concatenated). This was persisted to the customers and customer_addresses
-- tables, causing the service-launch-config API to fail the INDIAN_STATES lookup (stateCode="")
-- and return all services as hidden on the customer home screen.
--
-- This migration strips trailing 6-digit pincodes from the state and city columns in both
-- tables. It is fully idempotent — running it multiple times is safe.

-- 1. Clean customers.state
UPDATE customers
SET state = TRIM(REGEXP_REPLACE(state, '\s*[0-9]{6}\s*$', '', 'g'))
WHERE state ~ '[0-9]{6}';

-- 2. Clean customer_addresses.state
UPDATE customer_addresses
SET state = TRIM(REGEXP_REPLACE(state, '\s*[0-9]{6}\s*$', '', 'g'))
WHERE state ~ '[0-9]{6}';

-- 3. Clean customers.city
UPDATE customers
SET city = TRIM(REGEXP_REPLACE(city, '\s*[0-9]{6}\s*$', '', 'g'))
WHERE city ~ '[0-9]{6}';

-- 4. Clean customer_addresses.city
UPDATE customer_addresses
SET city = TRIM(REGEXP_REPLACE(city, '\s*[0-9]{6}\s*$', '', 'g'))
WHERE city ~ '[0-9]{6}';
