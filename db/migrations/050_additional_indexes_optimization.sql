-- ============================================================================
-- MIGRATION 050: Additional Indexes for Performance Optimization
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Add missing indexes for common query patterns and AWS RDS optimization
-- ============================================================================

-- ============================================================================
-- BOOKING QUERIES - Additional Composite Indexes
-- ============================================================================

-- Booking by vendor, status, and date (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_bookings_vendor_status_date 
ON bookings(vendor_id, status, booking_date DESC) 
WHERE vendor_id IS NOT NULL;

-- Booking by customer, status, and date (common history query)
CREATE INDEX IF NOT EXISTS idx_bookings_customer_status_date 
ON bookings(customer_id, status, booking_date DESC);

-- Booking by staff, status, and date (staff dashboard query)
CREATE INDEX IF NOT EXISTS idx_bookings_staff_status_date 
ON bookings(staff_id, status, booking_date DESC) 
WHERE staff_id IS NOT NULL;

-- Booking by service type and date (analytics query)
CREATE INDEX IF NOT EXISTS idx_bookings_service_type_date 
ON bookings(service_type, booking_date DESC);

-- Booking payment status and date (settlement queries)
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status_date 
ON bookings(payment_status, booking_date DESC) 
WHERE payment_status IN ('paid', 'pending');

-- ============================================================================
-- VENDOR QUERIES - Additional Indexes
-- ============================================================================

-- Vendor by status, tier, and active (dashboard query)
CREATE INDEX IF NOT EXISTS idx_vendors_status_tier_active 
ON vendors(status, tier, is_active) 
WHERE is_active = true;

-- Vendor by role and status (role-based queries)
CREATE INDEX IF NOT EXISTS idx_vendors_role_status 
ON vendors(role_id, status) 
WHERE role_id IS NOT NULL;

-- Vendor by city and status (location-based queries)
CREATE INDEX IF NOT EXISTS idx_vendors_city_status 
ON vendors(city, status) 
WHERE city IS NOT NULL;

-- ============================================================================
-- STAFF QUERIES - Additional Indexes
-- ============================================================================

-- Staff by vendor and availability (staff discovery)
CREATE INDEX IF NOT EXISTS idx_staff_vendor_available 
ON staff(vendor_id, is_active, is_available) 
WHERE is_active = true;

-- Staff by role and availability (role-based staff discovery)
CREATE INDEX IF NOT EXISTS idx_staff_role_available 
ON staff(role, is_active, is_available) 
WHERE is_active = true;

-- ============================================================================
-- SERVICE QUERIES - Additional Indexes
-- ============================================================================

-- Vendor services by publish status and enabled (service discovery)
CREATE INDEX IF NOT EXISTS idx_vendor_services_published 
ON vendor_services(vendor_id, publish_status, is_enabled) 
WHERE publish_status = 'published' AND is_enabled = true;

-- Services by category and active (catalog queries)
CREATE INDEX IF NOT EXISTS idx_services_catalog_active 
ON services(category_id, is_active) 
WHERE is_active = true;

-- ============================================================================
-- PAYMENT QUERIES - Additional Indexes
-- ============================================================================

-- Payments by vendor and status (earnings queries)
CREATE INDEX IF NOT EXISTS idx_payments_vendor_status_date 
ON payments(vendor_id, payment_status, created_at DESC) 
WHERE vendor_id IS NOT NULL;

-- Payments by customer and status (customer payment history)
CREATE INDEX IF NOT EXISTS idx_payments_customer_status_date 
ON payments(customer_id, payment_status, created_at DESC) 
WHERE customer_id IS NOT NULL;

-- ============================================================================
-- SETTLEMENT QUERIES - Additional Indexes
-- ============================================================================

-- Settlements by vendor and status (vendor dashboard)
CREATE INDEX IF NOT EXISTS idx_settlements_vendor_status_date 
ON settlements(vendor_id, settlement_status, created_at DESC) 
WHERE vendor_id IS NOT NULL;

-- Settlements by status and date (admin queries)
CREATE INDEX IF NOT EXISTS idx_settlements_status_date 
ON settlements(settlement_status, created_at DESC);

-- ============================================================================
-- NOTIFICATION QUERIES - Additional Indexes
-- ============================================================================

-- Notifications by recipient and read status (unread count)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
ON notifications(recipient_type, recipient_id, is_read, created_at DESC) 
WHERE is_read = false;

-- Notifications by type and date (analytics)
CREATE INDEX IF NOT EXISTS idx_notifications_type_date 
ON notifications(notification_type, created_at DESC);

-- ============================================================================
-- SEARCH QUERIES - Additional Indexes
-- ============================================================================

-- Search index by entity type and active (search queries)
CREATE INDEX IF NOT EXISTS idx_search_index_entity_active 
ON search_index(entity_type, entity_id) 
WHERE is_active = true;

-- Search history by customer and date (personalization)
CREATE INDEX IF NOT EXISTS idx_search_history_customer_date 
ON search_history(customer_id, created_at DESC) 
WHERE customer_id IS NOT NULL;

-- ============================================================================
-- GPS TRACKING QUERIES - Additional Indexes
-- ============================================================================

-- GPS tracking by booking and status (tracking queries)
CREATE INDEX IF NOT EXISTS idx_gps_tracking_booking_status 
ON gps_tracking_sessions(booking_id, status) 
WHERE status = 'in_progress';

-- GPS tracking points by booking and timestamp (route queries)
CREATE INDEX IF NOT EXISTS idx_gps_points_booking_timestamp 
ON gps_tracking_points(booking_id, timestamp DESC);

-- ============================================================================
-- PACKAGE QUERIES - Additional Indexes
-- ============================================================================

-- Package sessions by booking and status (package progress)
CREATE INDEX IF NOT EXISTS idx_package_sessions_booking_status 
ON package_sessions(booking_id, status);

-- Package purchases by customer and status (customer packages)
CREATE INDEX IF NOT EXISTS idx_package_purchases_customer_status 
ON package_purchases(customer_id, status);

-- ============================================================================
-- ANALYTICS QUERIES - Additional Indexes
-- ============================================================================

-- Analytics by date and type (reporting queries)
CREATE INDEX IF NOT EXISTS idx_analytics_date_type 
ON analytics(date, analytics_type);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_bookings_vendor_status_date IS 'Optimizes vendor dashboard booking queries';
COMMENT ON INDEX idx_bookings_customer_status_date IS 'Optimizes customer booking history queries';
COMMENT ON INDEX idx_vendors_status_tier_active IS 'Optimizes vendor listing and dashboard queries';
COMMENT ON INDEX idx_staff_vendor_available IS 'Optimizes staff discovery queries';
COMMENT ON INDEX idx_vendor_services_published IS 'Optimizes service discovery queries';
COMMENT ON INDEX idx_payments_vendor_status_date IS 'Optimizes vendor earnings queries';
COMMENT ON INDEX idx_settlements_vendor_status_date IS 'Optimizes vendor settlement queries';
COMMENT ON INDEX idx_notifications_recipient_unread IS 'Optimizes unread notification count queries';
COMMENT ON INDEX idx_gps_tracking_booking_status IS 'Optimizes GPS tracking status queries';

