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

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { registerAuthEndpoints } from '../endpoints/auth';
import { registerVendorOnboardingEndpoints } from '../endpoints/vendor-onboarding';
import { registerBookingEndpoints } from '../endpoints/bookings';
import { registerPaymentEndpoints } from '../endpoints/payments';
import { registerRoleEndpoints } from '../endpoints/roles';
import { registerVendorDashboardEndpoints } from '../endpoints/vendor-dashboard';
import { registerCustomerEndpoints } from '../endpoints/customer';
import { registerGpsTrackingEndpoints } from '../endpoints/gps-tracking';
import { registerAdminEndpoints } from '../endpoints/admin';
import { registerVideoCallEndpoints } from '../endpoints/video-call';
import { registerPackageSessionEndpoints } from '../endpoints/package-sessions';
import { registerSearchEndpoints } from '../endpoints/search';
import { registerRazorpayEndpoints } from '../endpoints/razorpay';
import { registerWalletEndpoints } from '../endpoints/wallet';
import { registerSpecializedServicesEndpoints } from '../endpoints/specialized-services';
import { registerAdminGovernanceEndpoints } from '../endpoints/admin-governance';
import { registerStaffEndpoints } from '../endpoints/staff';
import { registerServiceDiscoveryEndpoints } from '../endpoints/service-discovery';
import { registerReviewEndpoints } from '../endpoints/reviews';
import { registerNotificationEndpoints } from '../endpoints/notifications';
import { registerVendorScheduleEndpoints } from '../endpoints/vendor-schedule';
import { registerCustomerBookingHistoryEndpoints } from '../endpoints/customer-booking-history';
import { registerPrescriptionEndpoints } from '../endpoints/prescriptions';
import { registerMedicalRecordsEndpoints } from '../endpoints/medical-records';
import { registerEcommerceEndpoints } from '../endpoints/ecommerce';
import { registerAnalyticsEndpoints } from '../endpoints/analytics';
import { registerLoyaltyEndpoints } from '../endpoints/loyalty';
import { registerPackageEndpoints } from '../endpoints/packages';
import { registerPetEndpoints } from '../endpoints/pets';
import { registerVendorServicesEndpoints } from '../endpoints/vendor-services';
import { registerServiceCatalogEndpoints } from '../endpoints/service-catalog';
import { registerSettlementEndpoints } from '../endpoints/settlements';
import { registerRegionEndpoints } from '../endpoints/regions';
import { registerChatEndpoints } from '../endpoints/chat';
import { registerFileUploadEndpoints } from '../endpoints/file-upload';
import { registerSubscriptionEndpoints } from '../endpoints/subscriptions';
import { registerInsuranceEndpoints } from '../endpoints/insurance';
import { registerTrainingProgressEndpoints } from '../endpoints/training-progress';
import { registerPromotionEndpoints } from '../endpoints/promotions';
import { registerEventEndpoints } from '../endpoints/events';
import { registerHealthEndpoints } from '../endpoints/health';
import { registerDonationEndpoints } from '../endpoints/donations';
import { registerReportEndpoints } from '../endpoints/reports';
import { registerAddressEndpoints } from '../endpoints/addresses';
import { registerAdminIntegrationEndpoints } from '../endpoints/admin-integrations';
import { registerLogisticsEndpoints } from '../endpoints/logistics';
import { registerReturnsEndpoints } from '../endpoints/returns';
import { registerOrderManagementEndpoints } from '../endpoints/order-management';
import { registerEnhancedOtpEndpoints } from '../endpoints/otp-enhanced';
import { registerSmsNotificationEndpoints } from '../endpoints/sms-notifications';
import { registerVendorProfileEndpoints } from '../endpoints/vendor-profile';
import { registerCustomerProfileEndpoints } from '../endpoints/customer-profile';
import { registerSystemHealthEndpoints } from '../endpoints/system-health';
import { registerVendorSettingsEndpoints } from '../endpoints/vendor-settings';
import { registerVendorBookingsEndpoints } from '../endpoints/vendor-bookings';
import { registerVendorDashboardEnhancedEndpoints } from '../endpoints/vendor-dashboard-enhanced';
import { registerAppointmentReminderEndpoints } from '../endpoints/appointment-reminders';
import { registerVendorBookingActionsEndpoints } from '../endpoints/vendor-booking-actions';
import { registerNotificationSystemEndpoints } from '../endpoints/notification-system';
import { registerTierSystemEndpoints } from '../endpoints/tier-system';
import { registerTransactionMonitoringEndpoints } from '../endpoints/transaction-monitoring';
import { registerTimeWindowSubscriptionEndpoints } from '../endpoints/time-window-subscription';
import { registerStorageEndpoints } from '../endpoints/storage';
import { registerPushNotificationEndpoints } from '../endpoints/push-notifications';
import { registerCommuteTimeEndpoints } from '../endpoints/commute-time';
import { registerBookingDetailsEnhancedEndpoints } from '../endpoints/booking-details-enhanced';
import { registerRazorpaySettlementEndpoints } from '../endpoints/razorpay-settlements';
import { registerRefundPolicyEngineEndpoints } from '../endpoints/refund-policy-engine';

// Create Hono app
const app = new Hono();

// Configure CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register all endpoints
registerAuthEndpoints(app);
registerVendorOnboardingEndpoints(app);
registerBookingEndpoints(app);
registerPaymentEndpoints(app);
registerRoleEndpoints(app);
registerVendorDashboardEndpoints(app);
registerCustomerEndpoints(app);
registerGpsTrackingEndpoints(app);
registerAdminEndpoints(app);
registerVideoCallEndpoints(app);
registerPackageSessionEndpoints(app);
registerSearchEndpoints(app);
registerRazorpayEndpoints(app);
registerWalletEndpoints(app);
registerSpecializedServicesEndpoints(app);
registerAdminGovernanceEndpoints(app);
registerStaffEndpoints(app);
registerServiceDiscoveryEndpoints(app);
registerReviewEndpoints(app);
registerNotificationEndpoints(app);
registerVendorScheduleEndpoints(app);
registerCustomerBookingHistoryEndpoints(app);
registerPrescriptionEndpoints(app);
registerMedicalRecordsEndpoints(app);
registerEcommerceEndpoints(app);
registerAnalyticsEndpoints(app);
registerLoyaltyEndpoints(app);
registerPackageEndpoints(app);
registerPetEndpoints(app);
registerVendorServicesEndpoints(app);
registerServiceCatalogEndpoints(app);
registerSettlementEndpoints(app);
registerRegionEndpoints(app);
registerChatEndpoints(app);
registerFileUploadEndpoints(app);
registerSubscriptionEndpoints(app);
registerInsuranceEndpoints(app);
registerTrainingProgressEndpoints(app);
registerPromotionEndpoints(app);
registerEventEndpoints(app);
registerHealthEndpoints(app);
registerDonationEndpoints(app);
registerReportEndpoints(app);
registerAddressEndpoints(app);
registerAdminIntegrationEndpoints(app);
registerLogisticsEndpoints(app);
registerReturnsEndpoints(app);
registerOrderManagementEndpoints(app);
registerEnhancedOtpEndpoints(app);
registerSmsNotificationEndpoints(app);
registerVendorProfileEndpoints(app);
registerCustomerProfileEndpoints(app);
registerSystemHealthEndpoints(app);
registerVendorSettingsEndpoints(app);
registerVendorBookingsEndpoints(app);
registerVendorDashboardEnhancedEndpoints(app);
registerAppointmentReminderEndpoints(app);
registerVendorBookingActionsEndpoints(app);
registerNotificationSystemEndpoints(app);
registerTierSystemEndpoints(app);
registerTransactionMonitoringEndpoints(app);
registerTimeWindowSubscriptionEndpoints(app);
registerStorageEndpoints(app);
registerPushNotificationEndpoints(app);
registerCommuteTimeEndpoints(app);
registerBookingDetailsEnhancedEndpoints(app);
registerRazorpaySettlementEndpoints(app);
registerRefundPolicyEngineEndpoints(app);

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
export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  try {
    // Convert API Gateway HTTP API (v2) event to Request
    const domainName = event.requestContext.domainName;
    const rawPath = event.rawPath || event.requestContext.http?.path || '/';
    const queryString = event.rawQueryString ? `?${event.rawQueryString}` : '';
    const url = `https://${domainName}${rawPath}${queryString}`;

    const headers = new Headers();
    if (event.headers) {
      Object.entries(event.headers).forEach(([key, value]) => {
        if (value !== undefined) headers.append(key, value);
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
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      statusCode: response.status,
      body: responseBody,
      headers: responseHeaders,
    };
  } catch (error) {
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

