"use strict";
/**
 * ============================================================================
 * MAIN LAMBDA HANDLER
 * ============================================================================
 *
 * Entry point for all API Gateway requests
 * Routes requests to appropriate endpoint handlers
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const auth_1 = require("../endpoints/auth");
const vendor_onboarding_1 = require("../endpoints/vendor-onboarding");
const bookings_1 = require("../endpoints/bookings");
const payments_1 = require("../endpoints/payments");
const roles_1 = require("../endpoints/roles");
const vendor_dashboard_1 = require("../endpoints/vendor-dashboard");
const customer_1 = require("../endpoints/customer");
const gps_tracking_1 = require("../endpoints/gps-tracking");
const admin_1 = require("../endpoints/admin");
const video_call_1 = require("../endpoints/video-call");
const package_sessions_1 = require("../endpoints/package-sessions");
const search_1 = require("../endpoints/search");
const razorpay_1 = require("../endpoints/razorpay");
const wallet_1 = require("../endpoints/wallet");
const specialized_services_1 = require("../endpoints/specialized-services");
const admin_governance_1 = require("../endpoints/admin-governance");
const staff_1 = require("../endpoints/staff");
const service_discovery_1 = require("../endpoints/service-discovery");
const reviews_1 = require("../endpoints/reviews");
const notifications_1 = require("../endpoints/notifications");
const vendor_schedule_1 = require("../endpoints/vendor-schedule");
const customer_booking_history_1 = require("../endpoints/customer-booking-history");
const prescriptions_1 = require("../endpoints/prescriptions");
const medical_records_1 = require("../endpoints/medical-records");
const ecommerce_1 = require("../endpoints/ecommerce");
const analytics_1 = require("../endpoints/analytics");
const loyalty_1 = require("../endpoints/loyalty");
const packages_1 = require("../endpoints/packages");
const pets_1 = require("../endpoints/pets");
const vendor_services_1 = require("../endpoints/vendor-services");
const service_catalog_1 = require("../endpoints/service-catalog");
const settlements_1 = require("../endpoints/settlements");
const regions_1 = require("../endpoints/regions");
const chat_1 = require("../endpoints/chat");
const file_upload_1 = require("../endpoints/file-upload");
const subscriptions_1 = require("../endpoints/subscriptions");
const insurance_1 = require("../endpoints/insurance");
const training_progress_1 = require("../endpoints/training-progress");
const promotions_1 = require("../endpoints/promotions");
const events_1 = require("../endpoints/events");
const health_1 = require("../endpoints/health");
const donations_1 = require("../endpoints/donations");
const reports_1 = require("../endpoints/reports");
const addresses_1 = require("../endpoints/addresses");
const admin_integrations_1 = require("../endpoints/admin-integrations");
const logistics_1 = require("../endpoints/logistics");
const returns_1 = require("../endpoints/returns");
const order_management_1 = require("../endpoints/order-management");
const otp_enhanced_1 = require("../endpoints/otp-enhanced");
const sms_notifications_1 = require("../endpoints/sms-notifications");
const vendor_profile_1 = require("../endpoints/vendor-profile");
const customer_profile_1 = require("../endpoints/customer-profile");
const system_health_1 = require("../endpoints/system-health");
const vendor_settings_1 = require("../endpoints/vendor-settings");
const vendor_bookings_1 = require("../endpoints/vendor-bookings");
const vendor_dashboard_enhanced_1 = require("../endpoints/vendor-dashboard-enhanced");
const appointment_reminders_1 = require("../endpoints/appointment-reminders");
const vendor_booking_actions_1 = require("../endpoints/vendor-booking-actions");
const notification_system_1 = require("../endpoints/notification-system");
const tier_system_1 = require("../endpoints/tier-system");
const transaction_monitoring_1 = require("../endpoints/transaction-monitoring");
const time_window_subscription_1 = require("../endpoints/time-window-subscription");
const storage_1 = require("../endpoints/storage");
const push_notifications_1 = require("../endpoints/push-notifications");
const commute_time_1 = require("../endpoints/commute-time");
const booking_details_enhanced_1 = require("../endpoints/booking-details-enhanced");
const razorpay_settlements_1 = require("../endpoints/razorpay-settlements");
const refund_policy_engine_1 = require("../endpoints/refund-policy-engine");
const admin_governance_enhanced_1 = require("../endpoints/admin-governance-enhanced");
const admin_advanced_1 = require("../endpoints/admin-advanced");
const vendor_setup_1 = require("../endpoints/vendor-setup");
const customer_appointments_1 = require("../endpoints/customer-appointments");
const customer_orders_1 = require("../endpoints/customer-orders");
const vendor_analytics_1 = require("../endpoints/vendor-analytics");
const pet_cafe_1 = require("../endpoints/pet-cafe");
const vendor_radar_1 = require("../endpoints/vendor-radar");
const pet_resort_1 = require("../endpoints/pet-resort");
const pet_holidays_1 = require("../endpoints/pet-holidays");
// Create Hono app
const app = new hono_1.Hono();
// Configure CORS
app.use('*', (0, cors_1.cors)({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
// Health check
app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Register all endpoints
(0, auth_1.registerAuthEndpoints)(app);
(0, vendor_onboarding_1.registerVendorOnboardingEndpoints)(app);
(0, bookings_1.registerBookingEndpoints)(app);
(0, payments_1.registerPaymentEndpoints)(app);
(0, roles_1.registerRoleEndpoints)(app);
(0, vendor_dashboard_1.registerVendorDashboardEndpoints)(app);
(0, customer_1.registerCustomerEndpoints)(app);
(0, gps_tracking_1.registerGpsTrackingEndpoints)(app);
(0, admin_1.registerAdminEndpoints)(app);
(0, video_call_1.registerVideoCallEndpoints)(app);
(0, package_sessions_1.registerPackageSessionEndpoints)(app);
(0, search_1.registerSearchEndpoints)(app);
(0, razorpay_1.registerRazorpayEndpoints)(app);
(0, wallet_1.registerWalletEndpoints)(app);
(0, specialized_services_1.registerSpecializedServicesEndpoints)(app);
(0, admin_governance_1.registerAdminGovernanceEndpoints)(app);
(0, staff_1.registerStaffEndpoints)(app);
(0, service_discovery_1.registerServiceDiscoveryEndpoints)(app);
(0, reviews_1.registerReviewEndpoints)(app);
(0, notifications_1.registerNotificationEndpoints)(app);
(0, vendor_schedule_1.registerVendorScheduleEndpoints)(app);
(0, customer_booking_history_1.registerCustomerBookingHistoryEndpoints)(app);
(0, prescriptions_1.registerPrescriptionEndpoints)(app);
(0, medical_records_1.registerMedicalRecordsEndpoints)(app);
(0, ecommerce_1.registerEcommerceEndpoints)(app);
(0, analytics_1.registerAnalyticsEndpoints)(app);
(0, loyalty_1.registerLoyaltyEndpoints)(app);
(0, packages_1.registerPackageEndpoints)(app);
(0, pets_1.registerPetEndpoints)(app);
(0, vendor_services_1.registerVendorServicesEndpoints)(app);
(0, service_catalog_1.registerServiceCatalogEndpoints)(app);
(0, settlements_1.registerSettlementEndpoints)(app);
(0, regions_1.registerRegionEndpoints)(app);
(0, chat_1.registerChatEndpoints)(app);
(0, file_upload_1.registerFileUploadEndpoints)(app);
(0, subscriptions_1.registerSubscriptionEndpoints)(app);
(0, insurance_1.registerInsuranceEndpoints)(app);
(0, training_progress_1.registerTrainingProgressEndpoints)(app);
(0, promotions_1.registerPromotionEndpoints)(app);
(0, events_1.registerEventEndpoints)(app);
(0, health_1.registerHealthEndpoints)(app);
(0, donations_1.registerDonationEndpoints)(app);
(0, reports_1.registerReportEndpoints)(app);
(0, addresses_1.registerAddressEndpoints)(app);
(0, admin_integrations_1.registerAdminIntegrationEndpoints)(app);
(0, logistics_1.registerLogisticsEndpoints)(app);
(0, returns_1.registerReturnsEndpoints)(app);
(0, order_management_1.registerOrderManagementEndpoints)(app);
(0, otp_enhanced_1.registerEnhancedOtpEndpoints)(app);
(0, sms_notifications_1.registerSmsNotificationEndpoints)(app);
(0, vendor_profile_1.registerVendorProfileEndpoints)(app);
(0, customer_profile_1.registerCustomerProfileEndpoints)(app);
(0, system_health_1.registerSystemHealthEndpoints)(app);
(0, vendor_settings_1.registerVendorSettingsEndpoints)(app);
(0, vendor_bookings_1.registerVendorBookingsEndpoints)(app);
(0, vendor_dashboard_enhanced_1.registerVendorDashboardEnhancedEndpoints)(app);
(0, appointment_reminders_1.registerAppointmentReminderEndpoints)(app);
(0, vendor_booking_actions_1.registerVendorBookingActionsEndpoints)(app);
(0, notification_system_1.registerNotificationSystemEndpoints)(app);
(0, tier_system_1.registerTierSystemEndpoints)(app);
(0, transaction_monitoring_1.registerTransactionMonitoringEndpoints)(app);
(0, time_window_subscription_1.registerTimeWindowSubscriptionEndpoints)(app);
(0, storage_1.registerStorageEndpoints)(app);
(0, push_notifications_1.registerPushNotificationEndpoints)(app);
(0, commute_time_1.registerCommuteTimeEndpoints)(app);
(0, booking_details_enhanced_1.registerBookingDetailsEnhancedEndpoints)(app);
(0, razorpay_settlements_1.registerRazorpaySettlementEndpoints)(app);
(0, refund_policy_engine_1.registerRefundPolicyEngineEndpoints)(app);
(0, admin_governance_enhanced_1.registerAdminGovernanceEnhancedEndpoints)(app);
(0, admin_advanced_1.registerAdminAdvancedEndpoints)(app);
(0, vendor_setup_1.registerVendorSetupEndpoints)(app);
(0, customer_appointments_1.registerCustomerAppointmentsEndpoints)(app);
(0, customer_orders_1.registerCustomerOrdersEndpoints)(app);
(0, vendor_analytics_1.registerVendorAnalyticsEndpoints)(app);
(0, pet_cafe_1.registerPetCafeEndpoints)(app);
(0, vendor_radar_1.registerVendorRadarEndpoints)(app);
(0, pet_resort_1.registerPetResortEndpoints)(app);
(0, pet_holidays_1.registerPetHolidaysEndpoints)(app);
// 404 handler
app.notFound((c) => {
    return c.json({ error: 'Not Found' }, 404);
});
// Error handler
app.onError((err, c) => {
    console.error('Handler error:', err);
    return c.json({ error: 'Internal Server Error' }, 500);
});
/**
 * Main Lambda handler
 */
const handler = async (event, context) => {
    try {
        // Convert API Gateway HTTP API (v2) event to Request
        const domainName = event.requestContext.domainName;
        const rawPath = event.rawPath || event.requestContext.http?.path || '/';
        const queryString = event.rawQueryString ? `?${event.rawQueryString}` : '';
        const url = `https://${domainName}${rawPath}${queryString}`;
        const headers = new Headers();
        if (event.headers) {
            Object.entries(event.headers).forEach(([key, value]) => {
                if (value !== undefined)
                    headers.append(key, value);
            });
        }
        const requestBody = event.isBase64Encoded && event.body
            ? Buffer.from(event.body, 'base64').toString()
            : event.body || undefined;
        const request = new Request(url, {
            method: event.requestContext.http?.method || 'GET',
            headers,
            body: requestBody,
        });
        // Handle request with Hono
        const response = await app.fetch(request);
        // Convert Response to API Gateway format
        const responseBody = await response.text();
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });
        return {
            statusCode: response.status,
            body: responseBody,
            headers: responseHeaders,
        };
    }
    catch (error) {
        console.error('Lambda handler error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
            headers: {
                'Content-Type': 'application/json',
                // CORS headers must be present even in error responses
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            },
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=index.js.map