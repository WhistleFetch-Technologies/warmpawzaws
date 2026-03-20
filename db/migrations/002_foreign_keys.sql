-- ============================================================================
-- MIGRATION 002: Foreign Key Constraints
-- ============================================================================
-- Date: 2024-12-22
-- Purpose: Add foreign key constraints for referential integrity
-- 
-- IMPORTANT: This migration is idempotent and safe to re-run
-- Uses IF NOT EXISTS pattern for constraint creation
-- ============================================================================

-- Note: PostgreSQL doesn't support IF NOT EXISTS for constraints directly
-- We'll use DO blocks to check and add constraints conditionally

DO $$
BEGIN
    -- Staff foreign keys
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'staff_vendor_id_fkey'
    ) THEN
        ALTER TABLE staff ADD CONSTRAINT staff_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
    END IF;

    -- Staff specializations
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'staff_specializations_staff_id_fkey'
    ) THEN
        ALTER TABLE staff_specializations ADD CONSTRAINT staff_specializations_staff_id_fkey 
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
    END IF;

    -- Staff certifications
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'staff_certifications_staff_id_fkey'
    ) THEN
        ALTER TABLE staff_certifications ADD CONSTRAINT staff_certifications_staff_id_fkey 
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
    END IF;

    -- Services
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'services_vendor_id_fkey'
    ) THEN
        ALTER TABLE services ADD CONSTRAINT services_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
    END IF;

    -- Service categories
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'service_categories_parent_fkey'
    ) THEN
        ALTER TABLE service_categories ADD CONSTRAINT service_categories_parent_fkey 
            FOREIGN KEY (parent_category_id) REFERENCES service_categories(id);
    END IF;

    -- Staff services
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'staff_services_staff_id_fkey'
    ) THEN
        ALTER TABLE staff_services ADD CONSTRAINT staff_services_staff_id_fkey 
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'staff_services_service_id_fkey'
    ) THEN
        ALTER TABLE staff_services ADD CONSTRAINT staff_services_service_id_fkey 
            FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;
    END IF;

    -- Vendor service areas
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vendor_service_areas_vendor_id_fkey'
    ) THEN
        ALTER TABLE vendor_service_areas ADD CONSTRAINT vendor_service_areas_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
    END IF;

    -- Bookings
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bookings_customer_id_fkey'
    ) THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bookings_vendor_id_fkey'
    ) THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bookings_staff_id_fkey'
    ) THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_staff_id_fkey 
            FOREIGN KEY (staff_id) REFERENCES staff(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bookings_service_id_fkey'
    ) THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_service_id_fkey 
            FOREIGN KEY (service_id) REFERENCES services(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bookings_rescheduled_from_fkey'
    ) THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_rescheduled_from_fkey 
            FOREIGN KEY (rescheduled_from_booking_id) REFERENCES bookings(id);
    END IF;

    -- Emergency booking queue
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'emergency_booking_queue_booking_id_fkey'
    ) THEN
        ALTER TABLE emergency_booking_queue ADD CONSTRAINT emergency_booking_queue_booking_id_fkey 
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'emergency_booking_queue_vendor_id_fkey'
    ) THEN
        ALTER TABLE emergency_booking_queue ADD CONSTRAINT emergency_booking_queue_vendor_id_fkey 
            FOREIGN KEY (assigned_vendor_id) REFERENCES vendors(id);
    END IF;

    -- Pending reschedules
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pending_reschedules_booking_id_fkey'
    ) THEN
        ALTER TABLE pending_reschedules ADD CONSTRAINT pending_reschedules_booking_id_fkey 
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
    END IF;

    -- Payments
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_customer_id_fkey'
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT payments_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_vendor_id_fkey'
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT payments_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_booking_id_fkey'
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT payments_booking_id_fkey 
            FOREIGN KEY (booking_id) REFERENCES bookings(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_order_id_fkey'
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT payments_order_id_fkey 
            FOREIGN KEY (order_id) REFERENCES orders(id);
    END IF;

    -- Payment history
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_history_payment_id_fkey'
    ) THEN
        ALTER TABLE payment_history ADD CONSTRAINT payment_history_payment_id_fkey 
            FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_history_customer_id_fkey'
    ) THEN
        ALTER TABLE payment_history ADD CONSTRAINT payment_history_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_history_vendor_id_fkey'
    ) THEN
        ALTER TABLE payment_history ADD CONSTRAINT payment_history_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    -- Refunds
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'refunds_payment_id_fkey'
    ) THEN
        ALTER TABLE refunds ADD CONSTRAINT refunds_payment_id_fkey 
            FOREIGN KEY (payment_id) REFERENCES payments(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'refunds_customer_id_fkey'
    ) THEN
        ALTER TABLE refunds ADD CONSTRAINT refunds_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'refunds_vendor_id_fkey'
    ) THEN
        ALTER TABLE refunds ADD CONSTRAINT refunds_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'refunds_booking_id_fkey'
    ) THEN
        ALTER TABLE refunds ADD CONSTRAINT refunds_booking_id_fkey 
            FOREIGN KEY (booking_id) REFERENCES bookings(id);
    END IF;

    -- Payouts
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payouts_vendor_id_fkey'
    ) THEN
        ALTER TABLE payouts ADD CONSTRAINT payouts_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payouts_settlement_id_fkey'
    ) THEN
        ALTER TABLE payouts ADD CONSTRAINT payouts_settlement_id_fkey 
            FOREIGN KEY (settlement_id) REFERENCES settlements(id);
    END IF;

    -- Pending payouts
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pending_payouts_payout_id_fkey'
    ) THEN
        ALTER TABLE pending_payouts ADD CONSTRAINT pending_payouts_payout_id_fkey 
            FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pending_payouts_vendor_id_fkey'
    ) THEN
        ALTER TABLE pending_payouts ADD CONSTRAINT pending_payouts_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    -- Settlements
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'settlements_vendor_id_fkey'
    ) THEN
        ALTER TABLE settlements ADD CONSTRAINT settlements_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'settlements_payout_id_fkey'
    ) THEN
        ALTER TABLE settlements ADD CONSTRAINT settlements_payout_id_fkey 
            FOREIGN KEY (payout_id) REFERENCES payouts(id);
    END IF;

    -- Settlement schedules
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'settlement_schedules_vendor_id_fkey'
    ) THEN
        ALTER TABLE settlement_schedules ADD CONSTRAINT settlement_schedules_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    -- Orders
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_customer_id_fkey'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_vendor_id_fkey'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT orders_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_id_fkey'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT orders_payment_id_fkey 
            FOREIGN KEY (payment_id) REFERENCES payments(id);
    END IF;

    -- Order items
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_id_fkey'
    ) THEN
        ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey 
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_items_service_id_fkey'
    ) THEN
        ALTER TABLE order_items ADD CONSTRAINT order_items_service_id_fkey 
            FOREIGN KEY (service_id) REFERENCES services(id);
    END IF;

    -- Wallet
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customer_wallets_customer_id_fkey'
    ) THEN
        ALTER TABLE customer_wallets ADD CONSTRAINT customer_wallets_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transactions_wallet_id_fkey'
    ) THEN
        ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_wallet_id_fkey 
            FOREIGN KEY (wallet_id) REFERENCES customer_wallets(id);
    END IF;

    -- Banking
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bank_details_vendor_id_fkey'
    ) THEN
        ALTER TABLE vendor_bank_details ADD CONSTRAINT vendor_bank_details_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_verifications_vendor_id_fkey'
    ) THEN
        ALTER TABLE bank_verifications ADD CONSTRAINT bank_verifications_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_verifications_bank_detail_id_fkey'
    ) THEN
        ALTER TABLE bank_verifications ADD CONSTRAINT bank_verifications_bank_detail_id_fkey 
            FOREIGN KEY (bank_detail_id) REFERENCES vendor_bank_details(id);
    END IF;

    -- Documents
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vendor_documents_vendor_id_fkey'
    ) THEN
        ALTER TABLE vendor_documents ADD CONSTRAINT vendor_documents_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
    END IF;

    -- Roles
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_role_id_fkey'
    ) THEN
        ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_fkey 
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
    END IF;

    -- E-commerce categories
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ecommerce_categories_parent_fkey'
    ) THEN
        ALTER TABLE ecommerce_categories ADD CONSTRAINT ecommerce_categories_parent_fkey 
            FOREIGN KEY (parent_category_id) REFERENCES ecommerce_categories(id);
    END IF;

    -- Products
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_vendor_id_fkey'
    ) THEN
        ALTER TABLE products ADD CONSTRAINT products_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey'
    ) THEN
        ALTER TABLE products ADD CONSTRAINT products_category_id_fkey 
            FOREIGN KEY (category_id) REFERENCES ecommerce_categories(id);
    END IF;

    -- Search history
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'search_history_customer_id_fkey'
    ) THEN
        ALTER TABLE search_history ADD CONSTRAINT search_history_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;

    -- Pets
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pets_customer_id_fkey'
    ) THEN
        ALTER TABLE pets ADD CONSTRAINT pets_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
    END IF;

    -- Featured vendors
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'featured_vendors_vendor_id_fkey'
    ) THEN
        ALTER TABLE featured_vendors ADD CONSTRAINT featured_vendors_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    -- Loyalty
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customer_loyalty_points_customer_id_fkey'
    ) THEN
        ALTER TABLE customer_loyalty_points ADD CONSTRAINT customer_loyalty_points_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_transactions_customer_id_fkey'
    ) THEN
        ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;

    -- Referrals
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referrer_id_fkey'
    ) THEN
        ALTER TABLE referrals ADD CONSTRAINT referrals_referrer_id_fkey 
            FOREIGN KEY (referrer_id) REFERENCES customers(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referred_id_fkey'
    ) THEN
        ALTER TABLE referrals ADD CONSTRAINT referrals_referred_id_fkey 
            FOREIGN KEY (referred_id) REFERENCES customers(id);
    END IF;

    -- Schedules
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'staff_schedules_staff_id_fkey'
    ) THEN
        ALTER TABLE staff_schedules ADD CONSTRAINT staff_schedules_staff_id_fkey 
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'staff_availability_staff_id_fkey'
    ) THEN
        ALTER TABLE staff_availability ADD CONSTRAINT staff_availability_staff_id_fkey 
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
    END IF;

    -- Reminders
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reminder_queue_booking_id_fkey'
    ) THEN
        ALTER TABLE reminder_queue ADD CONSTRAINT reminder_queue_booking_id_fkey 
            FOREIGN KEY (booking_id) REFERENCES bookings(id);
    END IF;

END $$;

-- ============================================================================
-- END OF MIGRATION 002
-- ============================================================================

