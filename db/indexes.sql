-- ============================================================================
-- WARMPAWZ ECOSYSTEM - INDEXES FOR PERFORMANCE
-- ============================================================================
-- Comprehensive index strategy for all tables
-- Date: 2024-12-22
-- 
-- Indexes are created for:
-- 1. Foreign keys (for JOIN performance)
-- 2. Frequently queried columns (status, dates, phone, email)
-- 3. Composite indexes for common query patterns
-- 4. Partial indexes for filtered queries
-- 5. Text search indexes (GIN indexes for JSONB and tsvector)
-- ============================================================================

-- ============================================================================
-- CUSTOMERS
-- ============================================================================

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_customers_city ON customers(city) WHERE city IS NOT NULL;
CREATE INDEX idx_customers_state ON customers(state) WHERE state IS NOT NULL;
CREATE INDEX idx_customers_is_active ON customers(is_active) WHERE is_active = true;
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- ============================================================================
-- VENDORS
-- ============================================================================

CREATE INDEX idx_vendors_phone ON vendors(phone);
CREATE INDEX idx_vendors_email ON vendors(email);
CREATE INDEX idx_vendors_status ON vendors(status);
CREATE INDEX idx_vendors_role_id ON vendors(role_id) WHERE role_id IS NOT NULL;
CREATE INDEX idx_vendors_tier ON vendors(tier);
CREATE INDEX idx_vendors_city ON vendors(city);
CREATE INDEX idx_vendors_state ON vendors(state);
CREATE INDEX idx_vendors_pincode ON vendors(pincode);
CREATE INDEX idx_vendors_is_active ON vendors(is_active) WHERE is_active = true;
CREATE INDEX idx_vendors_created_at ON vendors(created_at DESC);
CREATE INDEX idx_vendors_status_created ON vendors(status, created_at DESC);

-- Composite index for vendor search
CREATE INDEX idx_vendors_location ON vendors(city, state, pincode) WHERE is_active = true;

-- Geospatial index for location-based queries
CREATE INDEX idx_vendors_location_geo ON vendors USING GIST (
    ll_to_earth(latitude, longitude)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================================
-- STAFF
-- ============================================================================

CREATE INDEX idx_staff_vendor_id ON staff(vendor_id);
CREATE INDEX idx_staff_phone ON staff(phone);
CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_is_active ON staff(is_active) WHERE is_active = true;
CREATE INDEX idx_staff_vendor_active ON staff(vendor_id, is_active) WHERE is_active = true;

-- ============================================================================
-- STAFF SPECIALIZATIONS & CERTIFICATIONS
-- ============================================================================

CREATE INDEX idx_staff_specializations_staff_id ON staff_specializations(staff_id);
CREATE INDEX idx_staff_certifications_staff_id ON staff_certifications(staff_id);
CREATE INDEX idx_staff_certifications_expiry ON staff_certifications(expiry_date) WHERE expiry_date IS NOT NULL;

-- ============================================================================
-- SERVICES
-- ============================================================================

CREATE INDEX idx_services_vendor_id ON services(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_is_active ON services(is_active) WHERE is_active = true;
CREATE INDEX idx_services_vendor_category ON services(vendor_id, category) WHERE is_active = true;

-- ============================================================================
-- STAFF SERVICES
-- ============================================================================

CREATE INDEX idx_staff_services_staff_id ON staff_services(staff_id);
CREATE INDEX idx_staff_services_service_id ON staff_services(service_id);
CREATE INDEX idx_staff_services_staff_active ON staff_services(staff_id, is_active) WHERE is_active = true;

-- ============================================================================
-- VENDOR SERVICE AREAS
-- ============================================================================

CREATE INDEX idx_vendor_service_areas_vendor_id ON vendor_service_areas(vendor_id);
CREATE INDEX idx_vendor_service_areas_city ON vendor_service_areas(city);
CREATE INDEX idx_vendor_service_areas_pincode ON vendor_service_areas(pincode);

-- ============================================================================
-- BOOKINGS
-- ============================================================================

CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_vendor_id ON bookings(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_bookings_staff_id ON bookings(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX idx_bookings_service_id ON bookings(service_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_bookings_vendor_date ON bookings(vendor_id, booking_date DESC) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_bookings_customer_date ON bookings(customer_id, booking_date DESC);
CREATE INDEX idx_bookings_status_date ON bookings(status, booking_date);
CREATE INDEX idx_bookings_staff_date ON bookings(staff_id, booking_date) WHERE staff_id IS NOT NULL;

-- OTP verification index
CREATE INDEX idx_bookings_otp_expires ON bookings(otp_expires_at) WHERE otp_expires_at > NOW() AND otp_verified = false;

-- Package bookings
CREATE INDEX idx_bookings_is_package ON bookings(is_package) WHERE is_package = true;
CREATE INDEX idx_bookings_package_id ON bookings(package_id) WHERE package_id IS NOT NULL;

-- ============================================================================
-- EMERGENCY BOOKING QUEUE
-- ============================================================================

CREATE INDEX idx_emergency_queue_priority ON emergency_booking_queue(priority DESC, queued_at);
CREATE INDEX idx_emergency_queue_vendor ON emergency_booking_queue(assigned_vendor_id) WHERE assigned_vendor_id IS NOT NULL;
CREATE INDEX idx_emergency_queue_status ON emergency_booking_queue(queued_at) WHERE assigned_vendor_id IS NULL;

-- ============================================================================
-- PENDING RESCHEDULES
-- ============================================================================

CREATE INDEX idx_pending_reschedules_booking_id ON pending_reschedules(booking_id);
CREATE INDEX idx_pending_reschedules_status ON pending_reschedules(status) WHERE status = 'pending';
CREATE INDEX idx_pending_reschedules_date ON pending_reschedules(requested_date, requested_time);

-- ============================================================================
-- PAYMENTS
-- ============================================================================

CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_vendor_id ON payments(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_payments_booking_id ON payments(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_payments_order_id ON payments(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_payment_method ON payments(payment_method);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_payments_razorpay_order_id ON payments(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX idx_payments_razorpay_payment_id ON payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- Composite indexes
CREATE INDEX idx_payments_customer_status ON payments(customer_id, payment_status, created_at DESC);
CREATE INDEX idx_payments_vendor_status ON payments(vendor_id, payment_status, created_at DESC) WHERE vendor_id IS NOT NULL;

-- ============================================================================
-- PAYMENT HISTORY
-- ============================================================================

CREATE INDEX idx_payment_history_customer_id ON payment_history(customer_id);
CREATE INDEX idx_payment_history_vendor_id ON payment_history(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_payment_history_payment_date ON payment_history(payment_date DESC);
CREATE INDEX idx_payment_history_customer_date ON payment_history(customer_id, payment_date DESC);

-- ============================================================================
-- REFUNDS
-- ============================================================================

CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX idx_refunds_customer_id ON refunds(customer_id);
CREATE INDEX idx_refunds_vendor_id ON refunds(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_refunds_status ON refunds(refund_status);
CREATE INDEX idx_refunds_requested_at ON refunds(requested_at DESC);
CREATE INDEX idx_refunds_razorpay_refund_id ON refunds(razorpay_refund_id) WHERE razorpay_refund_id IS NOT NULL;

-- ============================================================================
-- REFUND RULES & TIERS
-- ============================================================================

CREATE INDEX idx_refund_rules_type ON refund_rules(rule_type);
CREATE INDEX idx_refund_rules_active ON refund_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_refund_tiers_active ON refund_tiers(is_active) WHERE is_active = true;

-- ============================================================================
-- PAYOUTS
-- ============================================================================

CREATE INDEX idx_payouts_vendor_id ON payouts(vendor_id);
CREATE INDEX idx_payouts_status ON payouts(payout_status);
CREATE INDEX idx_payouts_created_at ON payouts(created_at DESC);
CREATE INDEX idx_payouts_settlement_id ON payouts(settlement_id) WHERE settlement_id IS NOT NULL;
CREATE INDEX idx_payouts_razorpay_payout_id ON payouts(razorpay_payout_id) WHERE razorpay_payout_id IS NOT NULL;

-- Composite index for vendor payout history
CREATE INDEX idx_payouts_vendor_status ON payouts(vendor_id, payout_status, created_at DESC);

-- ============================================================================
-- PENDING PAYOUTS
-- ============================================================================

CREATE INDEX idx_pending_payouts_vendor_id ON pending_payouts(vendor_id);
CREATE INDEX idx_pending_payouts_priority ON pending_payouts(priority DESC, queued_at);
CREATE INDEX idx_pending_payouts_queued ON pending_payouts(queued_at) WHERE priority >= 5;

-- ============================================================================
-- SETTLEMENTS
-- ============================================================================

CREATE INDEX idx_settlements_vendor_id ON settlements(vendor_id);
CREATE INDEX idx_settlements_status ON settlements(settlement_status);
CREATE INDEX idx_settlements_period ON settlements(settlement_period_start, settlement_period_end);
CREATE INDEX idx_settlements_vendor_period ON settlements(vendor_id, settlement_period_start DESC);

-- ============================================================================
-- SETTLEMENT SCHEDULES
-- ============================================================================

CREATE INDEX idx_settlement_schedules_vendor_id ON settlement_schedules(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_settlement_schedules_active ON settlement_schedules(is_active) WHERE is_active = true;
CREATE INDEX idx_settlement_schedules_type ON settlement_schedules(schedule_type);

-- ============================================================================
-- ORDERS
-- ============================================================================

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_vendor_id ON orders(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_payment_id ON orders(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_customer_status ON orders(customer_id, order_status, created_at DESC);

-- ============================================================================
-- ORDER ITEMS
-- ============================================================================

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_order_items_service_id ON order_items(service_id) WHERE service_id IS NOT NULL;

-- ============================================================================
-- WALLET
-- ============================================================================

CREATE INDEX idx_customer_wallets_customer_id ON customer_wallets(customer_id);
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX idx_wallet_transactions_reference ON wallet_transactions(reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- ============================================================================
-- BANKING
-- ============================================================================

CREATE INDEX idx_vendor_bank_details_vendor_id ON vendor_bank_details(vendor_id);
CREATE INDEX idx_vendor_bank_details_verified ON vendor_bank_details(is_verified) WHERE is_verified = true;
CREATE INDEX idx_bank_verifications_vendor_id ON bank_verifications(vendor_id);
CREATE INDEX idx_bank_verifications_status ON bank_verifications(verification_status);
CREATE INDEX idx_bank_verifications_pending ON bank_verifications(verification_status) WHERE verification_status = 'pending';

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

CREATE INDEX idx_vendor_documents_vendor_id ON vendor_documents(vendor_id);
CREATE INDEX idx_vendor_documents_type ON vendor_documents(document_type);
CREATE INDEX idx_vendor_documents_verified ON vendor_documents(is_verified) WHERE is_verified = true;

-- ============================================================================
-- ROLES & PERMISSIONS
-- ============================================================================

CREATE INDEX idx_roles_active ON roles(is_active) WHERE is_active = true;
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_resource ON role_permissions(resource, action);

-- ============================================================================
-- PLATFORM SETTINGS
-- ============================================================================

CREATE INDEX idx_platform_settings_key ON platform_settings(setting_key);
CREATE INDEX idx_platform_settings_public ON platform_settings(is_public) WHERE is_public = true;
CREATE INDEX idx_platform_revenue_date ON platform_revenue(revenue_date DESC);

-- ============================================================================
-- GST & TAX
-- ============================================================================

CREATE INDEX idx_gst_configs_active ON gst_configs(is_active) WHERE is_active = true;
CREATE INDEX idx_hsn_codes_code ON hsn_codes(hsn_code);
CREATE INDEX idx_hsn_codes_active ON hsn_codes(is_active) WHERE is_active = true;
CREATE INDEX idx_tax_categories_active ON tax_categories(is_active) WHERE is_active = true;

-- ============================================================================
-- CANCELLATION POLICIES
-- ============================================================================

CREATE INDEX idx_cancellation_policies_active ON cancellation_policies(is_active) WHERE is_active = true;

-- ============================================================================
-- ADMIN SETTINGS
-- ============================================================================

CREATE INDEX idx_admin_settings_category ON admin_settings(setting_category, setting_key);
CREATE INDEX idx_admin_settings_active ON admin_settings(is_active) WHERE is_active = true;
CREATE INDEX idx_payment_gateway_settings_active ON payment_gateway_settings(is_active) WHERE is_active = true;
CREATE INDEX idx_payout_rules_active ON payout_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_booking_rules_type ON booking_rules(rule_type);
CREATE INDEX idx_booking_rules_active ON booking_rules(is_active) WHERE is_active = true;

-- ============================================================================
-- PROMOTIONS & COUPONS
-- ============================================================================

CREATE INDEX idx_promotions_active ON promotions(is_active) WHERE is_active = true;
CREATE INDEX idx_promotions_dates ON promotions(start_date, end_date) WHERE is_active = true;
CREATE INDEX idx_promotions_type ON promotions(promotion_type);
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active) WHERE is_active = true;
CREATE INDEX idx_coupons_dates ON coupons(start_date, end_date) WHERE is_active = true;

-- ============================================================================
-- REGIONS
-- ============================================================================

CREATE INDEX idx_regions_code ON regions(code);
CREATE INDEX idx_regions_active ON regions(is_active) WHERE is_active = true;

-- ============================================================================
-- SEARCH & ANALYTICS
-- ============================================================================

-- GIN index for full-text search
CREATE INDEX idx_search_index_vector ON search_index USING GIN(search_vector);
CREATE INDEX idx_search_index_entity ON search_index(entity_type, entity_id);
CREATE INDEX idx_search_index_text ON search_index USING GIN(search_text gin_trgm_ops);

CREATE INDEX idx_search_history_customer_id ON search_history(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_search_history_created_at ON search_history(created_at DESC);
CREATE INDEX idx_search_analytics_date ON search_analytics(search_date DESC);
CREATE INDEX idx_search_analytics_zero_results ON search_analytics(zero_results) WHERE zero_results = true;
CREATE INDEX idx_popular_searches_count ON popular_searches(search_count DESC);
CREATE INDEX idx_popular_searches_updated ON popular_searches(last_searched_at DESC);

-- ============================================================================
-- STATISTICS
-- ============================================================================

CREATE INDEX idx_vendor_stats_vendor_id ON vendor_stats(vendor_id);
CREATE INDEX idx_vendor_stats_date ON vendor_stats(stat_date DESC);
CREATE INDEX idx_vendor_stats_vendor_date ON vendor_stats(vendor_id, stat_date DESC);
CREATE INDEX idx_item_stats_item ON item_stats(item_id, item_type);
CREATE INDEX idx_item_stats_date ON item_stats(stat_date DESC);
CREATE INDEX idx_performance_metrics_name ON performance_metrics(metric_name, recorded_at DESC);
CREATE INDEX idx_performance_metrics_type ON performance_metrics(metric_type, recorded_at DESC);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE INDEX idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX idx_notifications_unread ON notifications(recipient_type, recipient_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notification_templates_type ON notification_templates(template_type);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_reminder_queue_scheduled ON reminder_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_reminder_queue_booking_id ON reminder_queue(booking_id) WHERE booking_id IS NOT NULL;

-- ============================================================================
-- OTP TOKENS
-- ============================================================================

CREATE INDEX idx_otp_tokens_phone ON otp_tokens(phone);
CREATE INDEX idx_otp_tokens_email ON otp_tokens(email) WHERE email IS NOT NULL;
CREATE INDEX idx_otp_tokens_purpose ON otp_tokens(purpose);
CREATE INDEX idx_otp_tokens_expires ON otp_tokens(expires_at) WHERE expires_at > NOW() AND is_used = false;
CREATE INDEX idx_otp_tokens_phone_purpose ON otp_tokens(phone, purpose, expires_at) WHERE expires_at > NOW() AND is_used = false;

-- ============================================================================
-- PETS
-- ============================================================================

CREATE INDEX idx_pets_customer_id ON pets(customer_id);
CREATE INDEX idx_pets_species ON pets(species);
CREATE INDEX idx_pets_breed ON pets(breed) WHERE breed IS NOT NULL;

-- ============================================================================
-- E-COMMERCE
-- ============================================================================

CREATE INDEX idx_ecommerce_categories_parent ON ecommerce_categories(parent_category_id) WHERE parent_category_id IS NOT NULL;
CREATE INDEX idx_ecommerce_categories_active ON ecommerce_categories(is_active) WHERE is_active = true;
CREATE INDEX idx_products_vendor_id ON products(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_products_category_id ON products(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

-- ============================================================================
-- CACHE
-- ============================================================================

CREATE INDEX idx_cache_tokens_key ON cache_tokens(cache_key);
CREATE INDEX idx_cache_tokens_expires ON cache_tokens(expires_at) WHERE expires_at > NOW();
CREATE INDEX idx_cache_stats_date ON cache_stats(stat_date DESC);

-- ============================================================================
-- HEALTH CHECKS
-- ============================================================================

CREATE INDEX idx_health_checks_type ON health_checks(check_type, checked_at DESC);
CREATE INDEX idx_health_checks_status ON health_checks(status, checked_at DESC);

-- ============================================================================
-- FEATURED VENDORS
-- ============================================================================

CREATE INDEX idx_featured_vendors_active ON featured_vendors(is_active) WHERE is_active = true;
CREATE INDEX idx_featured_vendors_dates ON featured_vendors(start_date, end_date) WHERE is_active = true;
CREATE INDEX idx_featured_vendors_order ON featured_vendors(display_order) WHERE is_active = true;

-- ============================================================================
-- LOYALTY & REWARDS
-- ============================================================================

CREATE INDEX idx_loyalty_rules_active ON loyalty_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_customer_loyalty_points_customer_id ON customer_loyalty_points(customer_id);
CREATE INDEX idx_loyalty_transactions_customer_id ON loyalty_transactions(customer_id);
CREATE INDEX idx_loyalty_transactions_type ON loyalty_transactions(transaction_type);
CREATE INDEX idx_loyalty_transactions_expires ON loyalty_transactions(expires_at) WHERE expires_at IS NOT NULL AND expires_at > NOW();
CREATE INDEX idx_loyalty_transactions_reference ON loyalty_transactions(reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- ============================================================================
-- REFERRALS
-- ============================================================================

CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred_id ON referrals(referred_id) WHERE referred_id IS NOT NULL;
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_expires ON referrals(expires_at) WHERE expires_at > NOW() AND status = 'pending';

-- ============================================================================
-- SCHEDULE & AVAILABILITY
-- ============================================================================

CREATE INDEX idx_staff_schedules_staff_id ON staff_schedules(staff_id);
CREATE INDEX idx_staff_schedules_day ON staff_schedules(staff_id, day_of_week) WHERE is_available = true;
CREATE INDEX idx_staff_availability_staff_id ON staff_availability(staff_id);
CREATE INDEX idx_staff_availability_date ON staff_availability(staff_id, date) WHERE is_available = true;
CREATE INDEX idx_staff_availability_date_range ON staff_availability(date, start_time, end_time) WHERE is_available = true;

-- ============================================================================
-- SUBSCRIPTION TIERS
-- ============================================================================

CREATE INDEX idx_subscription_tiers_level ON subscription_tiers(tier_level);
CREATE INDEX idx_subscription_tiers_active ON subscription_tiers(is_active) WHERE is_active = true;

-- ============================================================================
-- INTEGRATIONS
-- ============================================================================

CREATE INDEX idx_platform_integrations_name ON platform_integrations(integration_name);
CREATE INDEX idx_platform_integrations_active ON platform_integrations(is_active) WHERE is_active = true;

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Vendor dashboard queries
CREATE INDEX idx_vendors_dashboard ON vendors(status, tier, created_at DESC) WHERE is_active = true;

-- Customer booking history
CREATE INDEX idx_customer_bookings_history ON bookings(customer_id, booking_date DESC, status);

-- Vendor earnings query
CREATE INDEX idx_vendor_earnings ON payments(vendor_id, payment_status, created_at DESC) WHERE payment_status = 'completed';

-- Staff availability lookup
CREATE INDEX idx_staff_availability_lookup ON staff_availability(staff_id, date, start_time, end_time) WHERE is_available = true;

-- Active services by vendor
CREATE INDEX idx_vendor_active_services ON services(vendor_id, category, is_active) WHERE is_active = true;

-- ============================================================================
-- PARTIAL INDEXES FOR FILTERED QUERIES
-- ============================================================================

-- Active bookings only
CREATE INDEX idx_bookings_active ON bookings(booking_date, booking_time) WHERE status IN ('pending', 'confirmed', 'in_progress');

-- Pending payments
CREATE INDEX idx_payments_pending ON payments(created_at) WHERE payment_status = 'pending';

-- Upcoming bookings
CREATE INDEX idx_bookings_upcoming ON bookings(booking_date, booking_time) WHERE booking_date >= CURRENT_DATE AND status IN ('pending', 'confirmed');

-- Expired OTPs cleanup
CREATE INDEX idx_otp_tokens_expired ON otp_tokens(created_at) WHERE expires_at < NOW() OR is_used = true;

-- ============================================================================
-- END OF INDEXES
-- ============================================================================

