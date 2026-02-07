-- ============================================================================
-- MIGRATION 528: Refund/Payment tiers – add Tele and All to service_location
-- ============================================================================
-- Purpose: Tele/Video Consultation is a service location (not a vendor type).
--          Add 'tele' and 'all' to service_location so policies can apply
--          per service style (At Home, At Center, Tele, or All).
-- ============================================================================

-- vendor_refund_tiers: allow service_location IN ('home','clinic','both','tele','all')
ALTER TABLE vendor_refund_tiers
DROP CONSTRAINT IF EXISTS vendor_refund_tiers_service_location_check;

ALTER TABLE vendor_refund_tiers
ADD CONSTRAINT vendor_refund_tiers_service_location_check
CHECK (service_location IN ('home', 'clinic', 'both', 'tele', 'all'));

COMMENT ON COLUMN vendor_refund_tiers.service_location IS 'Service style: home=At Home, clinic=At Center, tele=Tele/Video Consultation, all=All locations, both=legacy (same as all)';

-- vendor_payment_rules: same for consistency
ALTER TABLE vendor_payment_rules
DROP CONSTRAINT IF EXISTS vendor_payment_rules_service_location_check;

ALTER TABLE vendor_payment_rules
ADD CONSTRAINT vendor_payment_rules_service_location_check
CHECK (service_location IN ('home', 'clinic', 'both', 'tele', 'all'));

COMMENT ON COLUMN vendor_payment_rules.service_location IS 'Service style: home=At Home, clinic=At Center, tele=Tele/Video Consultation, all=All locations, both=legacy';
