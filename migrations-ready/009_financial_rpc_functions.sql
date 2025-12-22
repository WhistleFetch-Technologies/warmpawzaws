-- ============================================================================
-- MIGRATION 009: Financial RPC Functions
-- Copy this entire file and paste into Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- MIGRATION 009: Financial RPC Functions
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Database functions for financial operations
-- ============================================================================

-- Function: Update vendor earnings
CREATE OR REPLACE FUNCTION update_vendor_earnings(
  p_vendor_id UUID,
  p_amount NUMERIC,
  p_commission NUMERIC
)
RETURNS VOID AS $$
BEGIN
  -- Update vendor pending payout and total earnings
  UPDATE vendors
  SET 
    pending_payout = COALESCE(pending_payout, 0) + p_amount,
    total_earnings = COALESCE(total_earnings, 0) + p_amount,
    updated_at = NOW()
  WHERE id = p_vendor_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Reverse vendor earnings (for refunds)
CREATE OR REPLACE FUNCTION reverse_vendor_earnings(
  p_vendor_id UUID,
  p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE vendors
  SET 
    pending_payout = GREATEST(COALESCE(pending_payout, 0) - p_amount, 0),
    total_earnings = GREATEST(COALESCE(total_earnings, 0) - p_amount, 0),
    updated_at = NOW()
  WHERE id = p_vendor_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Reverse platform commission (for refunds)
CREATE OR REPLACE FUNCTION reverse_platform_commission(
  p_month DATE,
  p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO platform_revenue_monthly (
    revenue_month,
    commission_revenue,
    refund_reversals,
    updated_at
  )
  VALUES (
    p_month,
    -p_amount,
    -p_amount,
    NOW()
  )
  ON CONFLICT (revenue_month) DO UPDATE
  SET 
    commission_revenue = platform_revenue_monthly.commission_revenue - p_amount,
    refund_reversals = platform_revenue_monthly.refund_reversals - p_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Check coupon usage (prevent double application)
CREATE OR REPLACE FUNCTION check_coupon_usage(
  p_coupon_id UUID,
  p_order_id UUID DEFAULT NULL,
  p_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM coupon_usage
    WHERE coupon_id = p_coupon_id AND order_id = p_order_id;
    
    RETURN v_count = 0;
  ELSIF p_booking_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM coupon_usage
    WHERE coupon_id = p_coupon_id AND booking_id = p_booking_id;
    
    RETURN v_count = 0;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function: Get vendor tier commission rate
CREATE OR REPLACE FUNCTION get_vendor_commission_rate(p_vendor_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_commission_rate NUMERIC;
BEGIN
  SELECT vt.commission_rate INTO v_commission_rate
  FROM vendors v
  LEFT JOIN vendor_tiers vt ON v.current_tier_id = vt.id
  WHERE v.id = p_vendor_id
    AND (vt.is_active = true OR vt.id IS NULL);
  
  -- Default to 15% if no tier found
  RETURN COALESCE(v_commission_rate, 15.00);
END;
$$ LANGUAGE plpgsql;

-- Function: Create settlement with idempotency
CREATE OR REPLACE FUNCTION create_settlement(
  p_vendor_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_payment_ids UUID[],
  p_total_amount NUMERIC,
  p_commission_amount NUMERIC,
  p_net_amount NUMERIC
)
RETURNS UUID AS $$
DECLARE
  v_settlement_key TEXT;
  v_settlement_id UUID;
  v_existing_id UUID;
BEGIN
  -- Create unique settlement key for idempotency
  v_settlement_key := p_vendor_id::TEXT || ':' || p_period_start::TEXT || ':' || p_period_end::TEXT;
  
  -- Check if settlement already exists
  SELECT id INTO v_existing_id
  FROM settlements
  WHERE settlement_key = v_settlement_key;
  
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id; -- Return existing settlement
  END IF;
  
  -- Create new settlement
  INSERT INTO settlements (
    vendor_id,
    settlement_period_start,
    settlement_period_end,
    payment_ids,
    total_amount,
    commission_amount,
    net_amount,
    settlement_status,
    settlement_key
  )
  VALUES (
    p_vendor_id,
    p_period_start,
    p_period_end,
    p_payment_ids,
    p_total_amount,
    p_commission_amount,
    p_net_amount,
    'pending',
    v_settlement_key
  )
  RETURNING id INTO v_settlement_id;
  
  -- Create settlement booking mappings for idempotency
  INSERT INTO settlement_booking_mappings (settlement_id, booking_id, payment_id)
  SELECT 
    v_settlement_id,
    b.id,
    p.id
  FROM payments p
  LEFT JOIN bookings b ON p.booking_id = b.id
  WHERE p.id = ANY(p_payment_ids)
  ON CONFLICT (booking_id) DO NOTHING; -- Prevent double settlement
  
  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql;

