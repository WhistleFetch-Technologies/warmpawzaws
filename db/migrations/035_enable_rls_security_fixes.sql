-- ============================================================================
-- Migration: Enable RLS on Public Tables and Fix Security Definer View
-- ============================================================================
-- Purpose: Address Supabase security advisor warnings by:
--   1. Enabling RLS on all public tables that don't have it
--   2. Fixing the security definer view issue
--   3. Creating basic RLS policies for service role access
--
-- Note: This migration enables RLS but creates permissive policies for
-- service role. You should review and tighten these policies based on
-- your application's security requirements.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Fix Security Definer View
-- ============================================================================
-- Recreate vendor_role_config_view without SECURITY DEFINER
DROP VIEW IF EXISTS public.vendor_role_config_view CASCADE;

CREATE VIEW public.vendor_role_config_view AS
SELECT 
    v.id AS vendor_id,
    v.vendor_id AS legacy_vendor_id,
    v.phone,
    v.business_name,
    v.full_name,
    v.role_id,
    vr.name AS role_name,
    vr.capabilities AS role_config,
    v.service_styles,
    COALESCE(
        v.service_styles,
        CASE
            WHEN vr.capabilities IS NOT NULL AND vr.capabilities ? 'serviceStyles' 
            THEN ARRAY(SELECT jsonb_array_elements_text(vr.capabilities->'serviceStyles'))
            ELSE
                CASE
                    WHEN vr.name::text = ANY(ARRAY['pet_boarding', 'pet_kennel', 'pet_resort', 'pet_clinic']::text[])
                    THEN ARRAY['at_center']
                    WHEN vr.name::text = ANY(ARRAY['pet_walking', 'pet_sitter']::text[])
                    THEN ARRAY['at_home']
                    ELSE ARRAY['at_center', 'at_home', 'tele']
                END
        END
    ) AS resolved_service_styles,
    v.metadata,
    v.status,
    v.is_active,
    v.created_at,
    v.updated_at
FROM vendors v
LEFT JOIN vendor_roles vr ON vr.id::text = v.role_id::text;

-- Grant appropriate permissions
GRANT SELECT ON public.vendor_role_config_view TO authenticated;
GRANT SELECT ON public.vendor_role_config_view TO anon;

-- ============================================================================
-- Enable RLS on All Public Tables
-- ============================================================================
-- Note: spatial_ref_sys is a PostGIS system table - we'll skip it or handle specially

-- Core application tables
ALTER TABLE IF EXISTS public.problem_grid_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.package_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cancellation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendor_policies ENABLE ROW LEVEL SECURITY;

-- E-commerce tables
ALTER TABLE IF EXISTS public.shopping_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ecommerce_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ecommerce_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.policy_acceptances ENABLE ROW LEVEL SECURITY;

-- AI and chat tables
ALTER TABLE IF EXISTS public.ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_activity ENABLE ROW LEVEL SECURITY;

-- Dating and mating tables
ALTER TABLE IF EXISTS public.dating_profiles_pet ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dating_profiles_owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dating_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dating_meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dating_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dating_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mating_appointments ENABLE ROW LEVEL SECURITY;

-- Platform and subscription tables
ALTER TABLE IF EXISTS public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.region_roles ENABLE ROW LEVEL SECURITY;

-- Customer and wallet tables
ALTER TABLE IF EXISTS public.customer_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Loyalty and referral tables
ALTER TABLE IF EXISTS public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.loyalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Payment and financial tables
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gst_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promotions ENABLE ROW LEVEL SECURITY;

-- Telemedicine and GPS tables
ALTER TABLE IF EXISTS public.tele_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tele_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gps_tracking_sessions ENABLE ROW LEVEL SECURITY;

-- Booking and lifecycle tables
ALTER TABLE IF EXISTS public.booking_status_history ENABLE ROW LEVEL SECURITY;

-- Advertising tables
ALTER TABLE IF EXISTS public.advertising_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ad_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ad_budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ad_performance_analytics ENABLE ROW LEVEL SECURITY;

-- Healthcare and specialized service tables
ALTER TABLE IF EXISTS public.ambulance_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ambulance_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.diagnostic_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.boarding_facilities ENABLE ROW LEVEL SECURITY;

-- Access and admin tables
ALTER TABLE IF EXISTS public.access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Create Basic RLS Policies for Service Role Access
-- ============================================================================
-- These policies allow service role (used by Edge Functions) to access all data
-- You should review and customize these based on your security requirements

-- Helper function to create service role policies
DO $$
DECLARE
    table_name text;
    tables_to_policy text[] := ARRAY[
        'problem_grid_mappings', 'search_index', 'sessions', 'service_packages',
        'package_enrollments', 'cancellation_policies', 'support_tickets',
        'vendor_policies', 'shopping_carts', 'customer_addresses', 'wishlists',
        'payment_cards', 'ecommerce_categories', 'products', 'orders',
        'order_items', 'invoices', 'return_requests', 'ecommerce_policies',
        'product_policies', 'policy_acceptances', 'ai_chat_history',
        'chat_messages', 'chat_files', 'chat_activity', 'dating_profiles_pet',
        'dating_profiles_owner', 'dating_matches', 'dating_meetups',
        'dating_chat_messages', 'dating_analytics', 'mating_appointments',
        'platform_settings', 'user_subscriptions', 'subscription_tiers',
        'region_roles', 'customer_notification_settings', 'customer_wallets',
        'wallet_transactions', 'referrals', 'loyalty_rules',
        'customer_loyalty_points', 'loyalty_transactions', 'payments',
        'settlements', 'gst_configurations', 'promotions', 'tele_sessions',
        'tele_queues', 'gps_tracking_sessions', 'booking_status_history',
        'advertising_campaigns', 'ad_impressions', 'ad_clicks',
        'ad_budget_transactions', 'ad_performance_analytics',
        'ambulance_vehicles', 'ambulance_drivers', 'diagnostic_tests',
        'meal_plans', 'boarding_facilities', 'access_tokens', 'admin_profiles'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_policy
    LOOP
        -- Drop existing policies if they exist
        EXECUTE format('DROP POLICY IF EXISTS service_role_all_access ON public.%I', table_name);
        
        -- Create policy for service role (used by Edge Functions)
        EXECUTE format('
            CREATE POLICY service_role_all_access ON public.%I
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true)
        ', table_name);
        
        -- Create policy for authenticated users (basic read access)
        -- You should customize these based on your requirements
        EXECUTE format('DROP POLICY IF EXISTS authenticated_read ON public.%I', table_name);
        EXECUTE format('
            CREATE POLICY authenticated_read ON public.%I
            FOR SELECT
            TO authenticated
            USING (true)
        ', table_name);
    END LOOP;
END $$;

-- Note: spatial_ref_sys is a PostGIS system table
-- It's typically read-only and doesn't need RLS for most use cases
-- If you need to enable RLS on it, uncomment the following:
-- ALTER TABLE IF EXISTS public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY service_role_all_access ON public.spatial_ref_sys
--     FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- All tables now have RLS enabled with basic policies for service_role
-- Review and customize the policies based on your application's security needs
-- ============================================================================

