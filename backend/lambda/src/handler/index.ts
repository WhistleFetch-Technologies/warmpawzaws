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
// Enhanced handlers (Phase 2-5)
import { registerAuthEndpointsEnhanced } from '../endpoints/auth-enhanced';
import { registerVendorOnboardingEndpointsEnhanced } from '../endpoints/vendor-onboarding-enhanced';
import { registerBookingEndpointsEnhanced } from '../endpoints/bookings-enhanced';
import { registerPaymentEndpointsEnhanced } from '../endpoints/payments-enhanced';
import { registerCustomerEndpointsEnhanced } from '../endpoints/customer-enhanced';

// Legacy handlers (to be migrated gradually)
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
import { registerVendorProductsEndpoints } from '../endpoints/vendor-products';
import { registerVendorOrdersEndpoints } from '../endpoints/vendor-orders';
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
import { registerCustomerPasswordEndpoints } from '../endpoints/customer-password';
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
import { registerAdminGovernanceEnhancedEndpoints } from '../endpoints/admin-governance-enhanced';
import { registerAdminAdvancedEndpoints } from '../endpoints/admin-advanced';
import { registerVendorSetupEndpoints } from '../endpoints/vendor-setup';
import { registerCustomerAppointmentsEndpoints } from '../endpoints/customer-appointments';
import { registerCustomerOrdersEndpoints } from '../endpoints/customer-orders';
import { registerVendorAnalyticsEndpoints } from '../endpoints/vendor-analytics';
import { registerPetCafeEndpoints } from '../endpoints/pet-cafe';
import { registerVendorRadarEndpoints } from '../endpoints/vendor-radar';
import { registerPetResortEndpoints } from '../endpoints/pet-resort';
import { registerPetHolidaysEndpoints } from '../endpoints/pet-holidays';
import { registerTaxManagementEndpoints } from '../endpoints/tax-management';
import { registerLogisticsManagementEndpoints } from '../endpoints/logistics-management';
import { registerPaymentGatewayManagementEndpoints } from '../endpoints/payment-gateway-management';
import { registerLoyaltyActionRulesManagementEndpoints } from '../endpoints/loyalty-action-rules-management';
import { registerCommunityEndpoints } from '../endpoints/community';
import { registerReferralEndpoints } from '../endpoints/referrals';
import { registerRewardsEndpoints } from '../endpoints/rewards';
import { registerAdminSellersEndpoints } from '../endpoints/admin-sellers';
import { registerAIChatbotEndpoints } from '../endpoints/ai-chatbot';
import { registerSupportCrmEndpoints } from '../endpoints/support-crm';
import { registerLocationSharingEndpoints } from '../endpoints/location-sharing';
import { registerVendorSecurityEndpoints } from '../endpoints/vendor-security';
import { registerVendorDistancePricingEndpoints } from '../endpoints/vendor-distance-pricing';

// Create Hono app
const app = new Hono();

// Configure CORS - Match API Gateway CORS settings
const allowedOrigins = [
  'https://dfof7mguaa0a5.cloudfront.net',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://dev.admin.warmpawz.com',
  'https://dev.vendor.warmpawz.com',
  'https://dev.customer.warmpawz.com',
];

app.use('*', cors({
  origin: (origin) => {
    // Allow requests from allowed origins or if no origin (same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      return origin || allowedOrigins[0];
    }
    return allowedOrigins[0]; // Default to CloudFront
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-key'],
  allowCredentials: true,
  maxAge: 86400,
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register all endpoints
// Register enhanced handlers (Phase 2-5)
registerAuthEndpointsEnhanced(app);
registerVendorOnboardingEndpointsEnhanced(app);
registerBookingEndpointsEnhanced(app);
registerPaymentEndpointsEnhanced(app);
registerRoleEndpoints(app);
registerVendorDashboardEndpoints(app);
registerCustomerEndpointsEnhanced(app);
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
registerVendorProductsEndpoints(app);
registerVendorOrdersEndpoints(app);
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
registerCustomerPasswordEndpoints(app);
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
registerAdminGovernanceEnhancedEndpoints(app);
registerAdminAdvancedEndpoints(app);
registerVendorSetupEndpoints(app);
registerCustomerAppointmentsEndpoints(app);
registerCustomerOrdersEndpoints(app);
registerVendorAnalyticsEndpoints(app);
registerPetCafeEndpoints(app);
registerVendorRadarEndpoints(app);
registerPetResortEndpoints(app);
registerPetHolidaysEndpoints(app);
registerTaxManagementEndpoints(app);
registerLogisticsManagementEndpoints(app);
registerPaymentGatewayManagementEndpoints(app);
registerLoyaltyActionRulesManagementEndpoints(app);
registerCommunityEndpoints(app);
registerReferralEndpoints(app);
registerRewardsEndpoints(app);
registerAdminSellersEndpoints(app);
registerAIChatbotEndpoints(app);
registerSupportCrmEndpoints(app);
registerLocationSharingEndpoints(app);
registerVendorSecurityEndpoints(app);
registerVendorDistancePricingEndpoints(app);

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
    // UAT Mode: Check if request has UAT header and bypass authorizer validation
    // This allows UAT tokens to pass through even though they're not valid Cognito JWTs
    const uatMode = event.headers?.['x-uat-mode'] === 'true' || 
                    event.headers?.['X-UAT-Mode'] === 'true';
    const uatToken = event.headers?.['x-uat-token'] || 
                     event.headers?.['X-UAT-Token'];
    
    // If UAT mode is enabled, inject a mock authorizer context to bypass Cognito validation
    if (uatMode && uatToken && uatToken.startsWith('uat-token-')) {
      // Inject mock authorizer claims for UAT mode
      if (!event.requestContext.authorizer) {
        (event.requestContext as any).authorizer = {};
      }
      if (!event.requestContext.authorizer.claims) {
        (event.requestContext.authorizer as any).claims = {
          sub: 'uat-admin-user',
          'cognito:username': 'admin@warmpawz.com',
          email: 'admin@warmpawz.com',
          'custom:user_type': 'admin',
        };
      }
      console.log('🔧 [UAT Mode] Bypassing Cognito authorizer validation');
    }
    
    // Handle OPTIONS (CORS preflight) requests early - before processing
    const httpMethod = event.requestContext?.http?.method || 'GET';
    if (httpMethod === 'OPTIONS') {
      const origin = event.headers?.origin || 
                     event.headers?.Origin || 
                     event.multiValueHeaders?.origin?.[0] ||
                     event.multiValueHeaders?.Origin?.[0] ||
                     'https://dfof7mguaa0a5.cloudfront.net';
      
      const allowedOrigins = [
        'https://dfof7mguaa0a5.cloudfront.net',
        'http://localhost:3000',
        'http://localhost:3001',
        'https://dev.admin.warmpawz.com',
        'https://dev.vendor.warmpawz.com',
        'https://dev.customer.warmpawz.com',
      ];
      
      const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
      
      return {
        statusCode: 204, // 204 No Content is standard for successful preflight
        body: '',
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
          'Access-Control-Allow-Headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      };
    }

    // Convert API Gateway HTTP API (v2) event to Request
    // domainName is only present when using custom domains
    // For default endpoints, construct from apiId or use relative URL
    const rawPath = event.rawPath || event.requestContext?.http?.path || '/';
    const queryString = event.rawQueryString ? `?${event.rawQueryString}` : '';
    
    // Try to get domainName from requestContext (custom domain) or construct from apiId
    let domainName = event.requestContext?.domainName;
    if (!domainName) {
      // For default API Gateway endpoints, construct from apiId and region
      const apiId = event.requestContext?.apiId;
      if (apiId) {
        const region = process.env.AWS_REGION || 'ap-south-1';
        domainName = `${apiId}.execute-api.${region}.amazonaws.com`;
      } else {
        // Fallback: use a placeholder if apiId is also missing (shouldn't happen)
        domainName = 'api.warmpawz.com';
      }
    }
    
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
      method: httpMethod,
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

    // Ensure CORS headers are present in all responses
    const origin = event.headers?.origin || 
                   event.headers?.Origin || 
                   event.multiValueHeaders?.origin?.[0] ||
                   event.multiValueHeaders?.Origin?.[0];
    
    const allowedOrigins = [
      'https://dfof7mguaa0a5.cloudfront.net',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://dev.admin.warmpawz.com',
      'https://dev.vendor.warmpawz.com',
      'https://dev.customer.warmpawz.com',
    ];
    
    const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    
    // Merge CORS headers with response headers
    return {
      statusCode: response.status,
      body: responseBody,
      headers: {
        ...responseHeaders,
        'Access-Control-Allow-Origin': responseHeaders['access-control-allow-origin'] || allowedOrigin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
        'Access-Control-Allow-Headers': 'authorization,content-type,x-api-key',
      },
    };
  } catch (error) {
    console.error('Lambda handler error:', error);
    
    // Ensure CORS headers in error responses too
    const origin = event.headers?.origin || 
                   event.headers?.Origin || 
                   'https://dfof7mguaa0a5.cloudfront.net';
    
    const allowedOrigins = [
      'https://dfof7mguaa0a5.cloudfront.net',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://dev.admin.warmpawz.com',
      'https://dev.vendor.warmpawz.com',
      'https://dev.customer.warmpawz.com',
    ];
    
    const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
        'Access-Control-Allow-Headers': 'authorization,content-type,x-api-key',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }
};

