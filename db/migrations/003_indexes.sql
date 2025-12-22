-- ============================================================================
-- MIGRATION 003: Performance Indexes
-- ============================================================================
-- Date: 2024-12-22
-- Purpose: Create all performance indexes
-- 
-- IMPORTANT: This migration is idempotent and safe to re-run
-- All indexes use IF NOT EXISTS
-- ============================================================================

-- Note: We'll use CREATE INDEX IF NOT EXISTS for PostgreSQL 9.5+
-- For older versions, we'll check existence first

-- ============================================================================
-- CUSTOMERS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_city ON customers(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_state ON customers(state) WHERE state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- ============================================================================
-- VENDORS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vendors_phone ON vendors(phone);
CREATE INDEX IF NOT EXISTS idx_vendors_email ON vendors(email);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_role_id ON vendors(role_id) WHERE role_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_tier ON vendors(tier);
CREATE INDEX IF NOT EXISTS idx_vendors_city ON vendors(city);
CREATE INDEX IF NOT EXISTS idx_vendors_state ON vendors(state);
CREATE INDEX IF NOT EXISTS idx_vendors_pincode ON vendors(pincode);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vendors_created_at ON vendors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendors_status_created ON vendors(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendors_location ON vendors(city, state, pincode) WHERE is_active = true;

-- ============================================================================
-- STAFF
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_staff_vendor_id ON staff(vendor_id);
CREATE INDEX IF NOT EXISTS idx_staff_phone ON staff(phone);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_is_active ON staff(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_staff_vendor_active ON staff(vendor_id, is_active) WHERE is_active = true;

-- ============================================================================
-- BOOKINGS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_vendor_id ON bookings(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_staff_id ON bookings(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_vendor_date ON bookings(vendor_id, booking_date DESC) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_customer_date ON bookings(customer_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status_date ON bookings(status, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_staff_date ON bookings(staff_id, booking_date) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_otp_expires ON bookings(otp_expires_at) WHERE otp_expires_at > NOW() AND otp_verified = false;
CREATE INDEX IF NOT EXISTS idx_bookings_active ON bookings(booking_date, booking_time) WHERE status IN ('pending', 'confirmed', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_bookings_upcoming ON bookings(booking_date, booking_time) WHERE booking_date >= CURRENT_DATE AND status IN ('pending', 'confirmed');

-- ============================================================================
-- PAYMENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_vendor_id ON payments(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_customer_status ON payments(customer_id, payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_vendor_status ON payments(vendor_id, payment_status, created_at DESC) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(created_at) WHERE payment_status = 'pending';

-- ============================================================================
-- REFUNDS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_customer_id ON refunds(customer_id);
CREATE INDEX IF NOT EXISTS idx_refunds_vendor_id ON refunds(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(refund_status);
CREATE INDEX IF NOT EXISTS idx_refunds_requested_at ON refunds(requested_at DESC);

-- ============================================================================
-- PAYOUTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payouts_vendor_id ON payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(payout_status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_vendor_status ON payouts(vendor_id, payout_status, created_at DESC);

-- ============================================================================
-- ORDERS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, order_status, created_at DESC);

-- ============================================================================
-- SEARCH & ANALYTICS
-- ============================================================================

-- GIN index for full-text search (requires extension)
CREATE INDEX IF NOT EXISTS idx_search_index_vector ON search_index USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_search_index_entity ON search_index(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_search_history_customer_id ON search_history(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_date ON search_analytics(search_date DESC);

-- ============================================================================
-- OTP TOKENS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone ON otp_tokens(phone);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires ON otp_tokens(expires_at) WHERE expires_at > NOW() AND is_used = false;
CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone_purpose ON otp_tokens(phone, purpose, expires_at) WHERE expires_at > NOW() AND is_used = false;
CREATE INDEX IF NOT EXISTS idx_otp_tokens_expired ON otp_tokens(created_at) WHERE expires_at < NOW() OR is_used = true;

-- ============================================================================
-- CACHE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cache_tokens_key ON cache_tokens(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_tokens_expires ON cache_tokens(expires_at) WHERE expires_at > NOW();

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_type, recipient_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- STATISTICS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vendor_stats_vendor_id ON vendor_stats(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_stats_date ON vendor_stats(stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_stats_vendor_date ON vendor_stats(vendor_id, stat_date DESC);

-- ============================================================================
-- LOYALTY
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_points_customer_id ON customer_loyalty_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_id ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_expires ON loyalty_transactions(expires_at) WHERE expires_at IS NOT NULL AND expires_at > NOW();

-- ============================================================================
-- SCHEDULE & AVAILABILITY
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_availability_staff_id ON staff_availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_availability_date ON staff_availability(staff_id, date) WHERE is_available = true;

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vendors_dashboard ON vendors(status, tier, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_customer_bookings_history ON bookings(customer_id, booking_date DESC, status);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings ON payments(vendor_id, payment_status, created_at DESC) WHERE payment_status = 'completed';
CREATE INDEX IF NOT EXISTS idx_staff_availability_lookup ON staff_availability(staff_id, date, start_time, end_time) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_vendor_active_services ON services(vendor_id, category, is_active) WHERE is_active = true;

-- ============================================================================
-- END OF MIGRATION 003
-- ============================================================================

