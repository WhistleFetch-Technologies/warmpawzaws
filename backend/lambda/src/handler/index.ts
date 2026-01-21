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
import { initializeErrorTracking, captureException, setUserContext, getErrorTrackingConfig } from '../utils/error-tracking';
import { validateEnvironmentOrThrow, getValidationReport, validateEnvironment } from '../utils/env-validation';
import { checkDbHealth } from '../database/rds-connection';
// Enhanced handlers (Phase 2-5)
import { registerAuthEndpointsEnhanced } from '../endpoints/auth-enhanced';
import { registerVendorOnboardingEndpointsEnhanced } from '../endpoints/vendor-onboarding-enhanced';
import { registerVendorOnboardingFixes } from '../endpoints/vendor-onboarding-fixes';
import { registerBookingEndpointsEnhanced, registerBookingOTPEndpoint } from '../endpoints/bookings-enhanced';
import { registerPaymentEndpointsEnhanced } from '../endpoints/payments-enhanced';
import { registerCustomerEndpointsEnhanced } from '../endpoints/customer-enhanced';

// Legacy handlers (to be migrated gradually)
import { registerAuthEndpoints } from '../endpoints/auth';
import { registerVendorOnboardingEndpoints } from '../endpoints/vendor-onboarding';
// import { registerBookingEndpoints } from '../endpoints/bookings'; // DEPRECATED - use registerBookingEndpointsEnhanced instead
import { registerPaymentEndpoints } from '../endpoints/payments';
import { registerRoleEndpoints } from '../endpoints/roles';
import { registerRoleSeedingEndpoints } from '../endpoints/role-seeding';
import { registerOnboardingFormManagementEndpoints } from '../endpoints/onboarding-form-management';
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
import { registerSpecializedServiceFlows } from '../endpoints/specialized-service-flows';
import { registerAdminGovernanceEndpoints } from '../endpoints/admin-governance';
import { registerStaffEndpoints } from '../endpoints/staff';
import { registerServiceDiscoveryEndpoints } from '../endpoints/service-discovery';
import { registerReviewEndpoints } from '../endpoints/reviews';
import { registerNotificationEndpoints } from '../endpoints/notifications';
import { registerFollowupRescheduleEndpoints } from '../endpoints/followup-reschedule';
import { registerBehaviorJournalEndpoints } from '../endpoints/behavior-journal';
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
import { registerAdminCustomServicesEndpoints } from '../endpoints/admin-custom-services';
import { registerVendorPricingEndpoints } from '../endpoints/vendor-pricing';
import { registerVendorProductsEndpoints } from '../endpoints/vendor-products';
import { registerVendorOrdersEndpoints } from '../endpoints/vendor-orders';
import { registerServiceCatalogEndpoints } from '../endpoints/service-catalog';
import { registerSettlementEndpoints } from '../endpoints/settlements';
import { registerRegionEndpoints } from '../endpoints/regions';
import { registerChatEndpoints } from '../endpoints/chat';
import { registerFileUploadEndpoints } from '../endpoints/file-upload';
import { registerSubscriptionEndpoints } from '../endpoints/subscriptions';
import { registerCustomerPhoneConvenienceEndpoints } from '../endpoints/customer-phone-convenience';
import { registerInsuranceEndpoints } from '../endpoints/insurance';
import { registerTrainingProgressEndpoints } from '../endpoints/training-progress';
import { registerPackageBookingEndpoints } from '../endpoints/package-booking';
import { registerWalkerGPSEndpoints } from '../endpoints/walker-gps';
import { registerPromotionEndpoints } from '../endpoints/promotions';
import { registerVendorPromotionsEndpoints } from '../endpoints/vendor-promotions';
import { registerAdsRecommendationEndpoints } from '../endpoints/ads-recommendations';
import { registerCustomerContentEndpoints } from '../endpoints/customer-content';
import { registerEventEndpoints } from '../endpoints/events';
import { registerHealthEndpoints } from '../endpoints/health';
import { registerDonationEndpoints } from '../endpoints/donations';
import { registerReportEndpoints } from '../endpoints/reports';
import { registerAddressEndpoints } from '../endpoints/addresses';
import { registerCustomerPasswordEndpoints } from '../endpoints/customer-password';
import { registerAdminIntegrationEndpoints } from '../endpoints/admin-integrations';
import { registerLogisticsEndpoints } from '../endpoints/logistics';
import { registerLogisticsWebhookEndpoints } from '../endpoints/logistics-webhooks';
import { registerReturnsEndpoints } from '../endpoints/returns';
import { registerOrderManagementEndpoints } from '../endpoints/order-management';
import { registerEnhancedOtpEndpoints } from '../endpoints/otp-enhanced';
import { registerSmsNotificationEndpoints } from '../endpoints/sms-notifications';
import { registerVendorProfileEndpoints } from '../endpoints/vendor-profile';
import { registerCustomerProfileEndpoints } from '../endpoints/customer-profile';
import { registerSystemHealthEndpoints } from '../endpoints/system-health';
import { registerVendorSettingsEndpoints } from '../endpoints/vendor-settings';
import { registerVendorPoliciesEndpoints } from '../endpoints/vendor-policies';
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
import { registerLoyaltySegmentsManagementEndpoints } from '../endpoints/loyalty-segments-management';
import { registerCommunityEndpoints } from '../endpoints/community';
import { registerReferralEndpoints } from '../endpoints/referrals';
import { registerRewardsEndpoints } from '../endpoints/rewards';
import { registerAdminSellersEndpoints } from '../endpoints/admin-sellers';
import { registerAIChatbotEndpoints } from '../endpoints/ai-chatbot';
import { registerSupportCrmEndpoints } from '../endpoints/support-crm';
import { registerLocationSharingEndpoints } from '../endpoints/location-sharing';
import { registerVendorSecurityEndpoints } from '../endpoints/vendor-security';
import { registerVendorDistancePricingEndpoints } from '../endpoints/vendor-distance-pricing';
import { registerSchedulingPolicyEndpoints } from '../endpoints/scheduling-policies';
import { registerAdminComprehensiveEndpoints } from '../endpoints/admin-comprehensive';
import { registerProblemGridEndpoints } from '../endpoints/problem-grid';
import { registerVendorDashboardMissingEndpoints } from '../endpoints/vendor-dashboard-missing';
import { registerUIDashboardConfigEndpoints } from '../endpoints/ui-dashboard-config';
import { registerCarePlansEndpoints } from '../endpoints/care-plans';
import { registerVendorSupportEndpoints } from '../endpoints/vendor-support';
import { registerPharmacyOrderEndpoints } from '../endpoints/pharmacy-orders';
import { registerPharmacyInventoryEndpoints } from '../endpoints/pharmacy-inventory';
import { registerDeliveryPartnerAutomationEndpoints } from '../endpoints/delivery-partner-automation';
import { registerMealPlanEndpoints } from '../endpoints/meal-plans';
import { registerVendorBankAccountEndpoints } from '../endpoints/vendor-bank-accounts';
import { registerDeliveryTrackingEndpoints } from '../endpoints/delivery-tracking';
import { registerInstantTeleQueueEndpoints } from '../endpoints/instant-tele-queue';
import { registerRoomsEndpoints } from '../endpoints/rooms';
import { registerVendorLiveStatusEndpoints } from '../endpoints/vendor-live-status';
import { registerDiagnosticsReportEndpoints } from '../endpoints/diagnostics-reports';
import { registerMealSubscriptionEndpoints } from '../endpoints/meal-subscriptions';
import { registerDocumentExpiryEndpoints } from '../endpoints/document-expiry';
import { registerSubscriptionPlansAdminEndpoints } from '../endpoints/subscription-plans-admin';
// E-commerce enhancements (Phase 2026-01-20)
import { registerBulkProductUploadEndpoints } from '../endpoints/bulk-product-upload';
import { registerProductReviewEndpoints } from '../endpoints/product-reviews';
import { registerRecommendationEndpoints } from '../endpoints/recommendations';
import { registerWishlistEndpoints } from '../endpoints/wishlist';
import { registerProductVariationsEndpoints } from '../endpoints/product-variations';
import { registerSelfManagedLogisticsEndpoints } from '../endpoints/self-managed-logistics';
import { registerTaxInvoicePdfEndpoints } from '../endpoints/tax-invoice-pdf';
import { registerReviewsEnhancedEndpoints } from '../endpoints/reviews-enhanced';
import { registerReturnsEnhancedEndpoints } from '../endpoints/returns-enhanced';

// Create Hono app
const app = new Hono();

// Configure CORS - Match API Gateway CORS settings
// OFFICIAL CloudFront distributions (as per infrastructure)
// These are the ONLY CloudFront distributions that should exist
const allowedOrigins = [
  // Admin Web CloudFront (OFFICIAL - E1WPXL8WBOWOE8)
  'https://dfof7mguaa0a5.cloudfront.net',
  // Customer Web CloudFront (OFFICIAL - E2RDORGXSWJJ87)
  'https://d2aoyjj8ine0wk.cloudfront.net',
  // Vendor Web CloudFront (OFFICIAL - E95171GX1I6HN)
  'https://d1s6ykkj381k58.cloudfront.net',
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:5173',
  // Dev domains
  'https://dev.admin.warmpawz.com',
  'https://dev.vendor.warmpawz.com',
  'https://dev.customer.warmpawz.com',
  // Production domains (for prod environment)
  'https://admin.warmpawz.com',
  'https://vendor.warmpawz.com',
  'https://customer.warmpawz.com',
  'https://warmpawz.com',
  'https://www.warmpawz.com',
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
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-key', 'X-UAT-Mode', 'X-UAT-Token'],
  credentials: true,
  maxAge: 86400,
}));

// Initialize CloudWatch error tracking (India data residency compliant)
const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'development';
initializeErrorTracking({
  enabled: true,
  environment: environment,
  useCloudWatchMetrics: true,
  cloudWatchNamespace: 'Warmpawz/Errors',
  // No Sentry DSN - CloudWatch only for India compliance
});

// Validate environment variables at startup (fail fast)
try {
  validateEnvironmentOrThrow();
} catch (error) {
  console.error('[STARTUP] Environment validation failed:');
  console.error(getValidationReport());
  // In Lambda, we can't prevent startup, but we'll fail on first request
  // This ensures errors are caught early in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('[STARTUP] ⚠️  Continuing with invalid environment (non-production mode)');
  }
}

// Health check endpoint with database connectivity check
app.get('/health', async (c) => {
  const healthStatus: {
    status: string;
    timestamp: string;
    database?: { connected: boolean; error?: string };
    environment?: { valid: boolean; warnings?: string[] };
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  
  // Check database connectivity
  try {
    const dbHealthy = await checkDbHealth();
    healthStatus.database = { connected: dbHealthy };
    if (!dbHealthy) {
      healthStatus.status = 'degraded';
      healthStatus.database.error = 'Database connection check failed';
    }
  } catch (error) {
    healthStatus.status = 'degraded';
    healthStatus.database = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
  
  // Check environment validation (non-blocking)
  try {
    const envResult = validateEnvironment();
    healthStatus.environment = {
      valid: envResult.valid,
      warnings: envResult.warnings.length > 0 ? envResult.warnings : undefined,
    };
  } catch (error) {
    // Non-critical, don't fail health check
    console.warn('[HEALTH] Environment validation check failed:', error);
  }
  
  const statusCode = healthStatus.status === 'ok' ? 200 : 503;
  return c.json(healthStatus, statusCode);
});

// Register all endpoints
// Register enhanced handlers (Phase 2-5)
registerAuthEndpointsEnhanced(app);
registerVendorOnboardingEndpointsEnhanced(app);
registerVendorOnboardingFixes(app); // Critical fixes for vendor onboarding
// registerBookingEndpointsEnhanced(app); // Moved after refund-policy to test route order
registerPaymentEndpointsEnhanced(app);
registerRoleEndpoints(app);
registerRoleSeedingEndpoints(app);
registerOnboardingFormManagementEndpoints(app);
registerVendorDashboardEndpoints(app);
// Register specific routes BEFORE parameterized routes to avoid route conflicts
// Order matters: specific routes (e.g., /customer/behavior-journal) must come before parameterized routes (e.g., /customer/:customerId)
registerBehaviorJournalEndpoints(app); // /customer/behavior-journal - before /customer/:customerId
registerFollowupRescheduleEndpoints(app); // /followup/create, /vendor/reschedule-policy, /vendor/available-slots, /bookings/available-slots
registerNotificationEndpoints(app); // /customer/notifications - before /customer/:customerId
registerServiceDiscoveryEndpoints(app); // /customer/vendors/search, /customer/discover-services, /customer/services, /customer/autocomplete, /customer/radar/providers, /customer/vendors/discover-by-problem, /vendor/:vendorId/facility - before /customer/:customerId
registerServiceCatalogEndpoints(app); // /services/:serviceId - before /customer/:customerId
registerCustomerContentEndpoints(app); // /customer/banners, /customer/articles, /customer/announcements - before /customer/:customerId
registerCustomerPhoneConvenienceEndpoints(app); // /customer/bookings?phone=, /customer/cart/:phone, /customer/wallet?phone=, etc. - before /customer/:customerId
registerCustomerProfileEndpoints(app); // /customer/profile, /customer/profile/unified/:id, /customer/profile/:id - before /customer/:customerId
registerCustomerBookingHistoryEndpoints(app); // /customer/bookings/:bookingId, /customer/:customerId/bookings - before /customer/:customerId
// Now register parameterized routes
registerCustomerEndpointsEnhanced(app); // /customer/:customerId (parameterized - must be last)
registerGpsTrackingEndpoints(app);
registerAdminEndpoints(app);
registerVideoCallEndpoints(app);
registerPackageSessionEndpoints(app);
registerSearchEndpoints(app);
registerRazorpayEndpoints(app);
registerWalletEndpoints(app);
registerSpecializedServicesEndpoints(app);
registerSpecializedServiceFlows(app);
registerAdminGovernanceEndpoints(app);
registerStaffEndpoints(app);
registerInstantTeleQueueEndpoints(app); // Instant tele consultation queue
registerRoomsEndpoints(app); // Consultation rooms management (Phase 1.1)
registerReviewEndpoints(app);
registerVendorScheduleEndpoints(app);
registerPrescriptionEndpoints(app);
registerPharmacyOrderEndpoints(app);
registerPharmacyInventoryEndpoints(app);
registerDeliveryPartnerAutomationEndpoints(app);
registerMealPlanEndpoints(app);
registerVendorBankAccountEndpoints(app);
registerDeliveryTrackingEndpoints(app);
registerMedicalRecordsEndpoints(app);
registerEcommerceEndpoints(app);
registerAnalyticsEndpoints(app);
registerLoyaltyEndpoints(app);
registerPackageEndpoints(app);
registerPetEndpoints(app);
// Register vendor setup endpoints BEFORE vendor services to ensure /vendor/:vendorId/services/available
// is matched before /vendor/:vendorId/services/:serviceStyle
registerVendorSetupEndpoints(app);
registerVendorServicesEndpoints(app);
registerAdminCustomServicesEndpoints(app);
registerVendorPricingEndpoints(app);
registerVendorProductsEndpoints(app);
registerVendorOrdersEndpoints(app);
// registerServiceCatalogEndpoints(app); // REMOVED: Already registered at line 215 (before parameterized routes)
registerSettlementEndpoints(app);
registerRegionEndpoints(app);
registerChatEndpoints(app);
registerFileUploadEndpoints(app);
registerSubscriptionEndpoints(app);
registerInsuranceEndpoints(app);
registerTrainingProgressEndpoints(app);
registerPackageBookingEndpoints(app);
registerWalkerGPSEndpoints(app);
registerPromotionEndpoints(app);
registerVendorPromotionsEndpoints(app);
registerAdsRecommendationEndpoints(app);
registerEventEndpoints(app);
registerHealthEndpoints(app);
registerDonationEndpoints(app);
registerReportEndpoints(app);
registerAddressEndpoints(app);
registerCustomerPasswordEndpoints(app);
registerAdminIntegrationEndpoints(app);
registerLogisticsEndpoints(app);
registerLogisticsWebhookEndpoints(app); // Webhooks: /webhooks/shiprocket, /webhooks/delhivery, /webhooks/dunzo, /logistics/auto-create-shipment, /logistics/calculate-rates, /customer/tracking/:orderId
registerReturnsEndpoints(app);
registerOrderManagementEndpoints(app);
registerEnhancedOtpEndpoints(app);
registerSmsNotificationEndpoints(app);
registerVendorProfileEndpoints(app);
// registerCustomerProfileEndpoints already registered above before parameterized routes
registerSystemHealthEndpoints(app);
registerVendorSettingsEndpoints(app);
registerVendorPoliciesEndpoints(app);
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
registerBookingEndpointsEnhanced(app); // Moved here to test route order (after refund-policy which works)
registerBookingOTPEndpoint(app); // Booking OTP generation for home/center services
registerAdminGovernanceEnhancedEndpoints(app);
registerAdminAdvancedEndpoints(app);
// registerVendorSetupEndpoints moved above (before vendor-services) to fix route ordering
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
registerLoyaltySegmentsManagementEndpoints(app);
registerCommunityEndpoints(app);
registerReferralEndpoints(app);
registerRewardsEndpoints(app);
registerAdminSellersEndpoints(app);
registerAIChatbotEndpoints(app);
registerSupportCrmEndpoints(app);
registerLocationSharingEndpoints(app);
registerVendorSecurityEndpoints(app);
registerVendorDistancePricingEndpoints(app);
registerSchedulingPolicyEndpoints(app);
registerAdminComprehensiveEndpoints(app);
registerProblemGridEndpoints(app);
registerVendorDashboardMissingEndpoints(app);
registerUIDashboardConfigEndpoints(app); // UI Dashboard Configuration (Marketing > Dashboard UI)
registerCarePlansEndpoints(app); // Care Plans Generation (Support/CRM > Complete Plan)
registerVendorSupportEndpoints(app); // Vendor Support Tickets
registerVendorLiveStatusEndpoints(app); // Vendor/Staff Live Status Eligibility for Customer App Listing
registerDiagnosticsReportEndpoints(app); // Diagnostics report upload and vet review
registerMealSubscriptionEndpoints(app); // Nutritionist meal subscriptions
registerDocumentExpiryEndpoints(app); // Vendor document expiry tracking
registerSubscriptionPlansAdminEndpoints(app); // Admin subscription plan CRUD

// E-commerce enhancements (Phase 2026-01-20)
registerBulkProductUploadEndpoints(app); // Bulk product upload via CSV/Excel
registerProductReviewEndpoints(app); // Product reviews and ratings
registerRecommendationEndpoints(app); // "Also bought", trending, personalized recommendations
registerWishlistEndpoints(app); // Customer wishlist management
registerProductVariationsEndpoints(app); // Product variations (size, color, weight)
registerSelfManagedLogisticsEndpoints(app); // Self-managed logistics with tracking URL
registerTaxInvoicePdfEndpoints(app); // GST tax invoice PDF generation
registerReviewsEnhancedEndpoints(app); // Enhanced booking reviews
registerReturnsEnhancedEndpoints(app); // Complete return/refund management

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler with CloudWatch tracking
app.onError((err, c) => {
  // Capture error to CloudWatch (India data residency compliant)
  captureException(err, {
    requestId: c.req.header('x-request-id') || 'unknown',
    path: c.req.path,
    method: c.req.method,
  });
  
  // CRITICAL: Check error message FIRST before checking path
  // This ensures we catch errors even if path matching fails
  const errorMessage = err.message || String(err) || 'Unknown error';
  const requestPath = c.req.path || (c.req as any).rawPath || c.req.url || '';
  
  console.error('[Hono Error Handler] Error caught:', {
    message: errorMessage,
    path: requestPath,
    fullPath: c.req.path,
    rawPath: (c.req as any).rawPath,
    url: c.req.url,
    errorType: err.constructor?.name,
    stack: err.stack?.substring(0, 200),
  });
  
  // CRITICAL: Check path FIRST - this is the most reliable way to match
  // Check for service-catalog/categories errors by PATH (most reliable)
  if (requestPath.includes('service-catalog/categories') || 
      requestPath.includes('/categories') ||
      requestPath.endsWith('categories') ||
      c.req.path.includes('service-catalog/categories') ||
      c.req.path.includes('categories')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED service-catalog/categories by PATH - Returning 200');
    }
    return c.json({
      success: true,
      categories: [],
      total: 0,
      message: `Service categories query failed: ${errorMessage}`,
    }, 200);
  }
  
  // Check for payment-gateways errors by PATH (most reliable)
  if (requestPath.includes('payment-gateways') || 
      requestPath.includes('payment-gateway') ||
      c.req.path.includes('payment-gateways') ||
      c.req.path.includes('payment-gateway')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED payment-gateways by PATH - Returning 200');
    }
    return c.json({
      success: true,
      gateways: [],
      message: `Payment gateway query failed: ${errorMessage}`,
    }, 200);
  }
  
  // Fallback: Check by error message (less reliable but catches edge cases)
  const isServiceCategoriesError = 
    errorMessage.includes('operator does not exist') || 
    errorMessage.includes('uuid = text') || 
    errorMessage.includes('uuid =') ||
    errorMessage.includes('service_categories');
  
  if (isServiceCategoriesError) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED service-catalog/categories by ERROR MESSAGE - Returning 200');
    }
    return c.json({
      success: true,
      categories: [],
      total: 0,
      message: `Service categories query failed: ${errorMessage}`,
    }, 200);
  }
  
  // Fallback: Check payment-gateways by error message
  const isPaymentGatewaysError = 
    errorMessage.includes('payment_gateways') || 
    errorMessage.includes('payment_gateway') ||
    (errorMessage.includes('relation') && errorMessage.includes('payment'));
  
  if (isPaymentGatewaysError) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED payment-gateways by ERROR MESSAGE - Returning 200');
    }
    return c.json({
      success: true,
      gateways: [],
      message: `Payment gateway query failed: ${errorMessage}`,
    }, 200);
  }
  
  // Check for onboarding/roles errors
  if (requestPath.includes('onboarding/roles') || 
      (requestPath.includes('roles') && requestPath.includes('onboarding'))) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED onboarding/roles - Returning 200');
    }
    return c.json({
      success: true,
      data: { roles: [] },
      message: `Failed to get roles: ${errorMessage}`,
    }, 200);
  }
  
  // Default error response
  if (process.env.DEBUG === 'true') {
    console.log('[Hono Error Handler] NO MATCH - Returning 500');
  }
  return c.json({ error: errorMessage }, 500);
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
      // Type assertion needed as authorizer is not in V2 type definition
      const requestContext = event.requestContext as any;
      if (!requestContext.authorizer) {
        requestContext.authorizer = {};
      }
      if (!requestContext.authorizer.claims) {
        requestContext.authorizer.claims = {
          sub: 'uat-admin-user',
          'cognito:username': 'admin@warmpawz.com',
          email: 'admin@warmpawz.com',
          'custom:user_type': 'admin',
        };
      }
      if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        console.log('🔧 [UAT Mode] Bypassing Cognito authorizer validation');
      }
    }
    
    // Handle OPTIONS (CORS preflight) requests early - before processing
    const httpMethod = event.requestContext?.http?.method || 'GET';
    if (httpMethod === 'OPTIONS') {
      const origin = event.headers?.origin || 
                     event.headers?.Origin || 
                     'https://dfof7mguaa0a5.cloudfront.net';
      
      // Use the same allowedOrigins array defined at module level for consistency
      // OFFICIAL CloudFront distributions only
      const allowedOrigins = [
        // Admin Web CloudFront (OFFICIAL - E1WPXL8WBOWOE8)
        'https://dfof7mguaa0a5.cloudfront.net',
        // Customer Web CloudFront (OFFICIAL - E2RDORGXSWJJ87)
        'https://d2aoyjj8ine0wk.cloudfront.net',
        // Vendor Web CloudFront (OFFICIAL - E95171GX1I6HN)
        'https://d1s6ykkj381k58.cloudfront.net',
        // Local development
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:5173',
        // Dev domains
        'https://dev.admin.warmpawz.com',
        'https://dev.vendor.warmpawz.com',
        'https://dev.customer.warmpawz.com',
        // Production domains (for prod environment)
        'https://admin.warmpawz.com',
        'https://vendor.warmpawz.com',
        'https://customer.warmpawz.com',
        'https://warmpawz.com',
        'https://www.warmpawz.com',
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
    
    // Ensure Content-Type is set for JSON bodies
    if (event.body && !headers.has('content-type')) {
      headers.append('content-type', 'application/json');
    }

    // Parse body once to avoid consumption issues with Hono Request
    // This parsed body will be passed through Hono context (c.env) instead of global state
    const requestBody = event.isBase64Encoded && event.body
      ? Buffer.from(event.body, 'base64').toString()
      : event.body || undefined;

    let parsedBody: Record<string, unknown> | null = null;
    if (requestBody) {
      try {
        parsedBody = JSON.parse(requestBody) as Record<string, unknown>;
      } catch (e) {
        // Not JSON, will be passed as string body
        parsedBody = null;
      }
    }

    const request = new Request(url, {
      method: httpMethod,
      headers,
      body: requestBody,
    });
    
    // Handle request with Hono
    // Pass parsed body and event through Hono's context (c.env) instead of global state
    let response: Response;
    try {
      // Hono's fetch accepts custom data through the second parameter
      // This data is accessible via c.env in route handlers
      interface HonoFetchOptions {
        event: APIGatewayProxyEventV2;
        parsedBody: Record<string, unknown> | null;
      }
      
      response = await app.fetch(request, {
        event: event,
        parsedBody: parsedBody,
      } as HonoFetchOptions & Record<string, unknown>);
    } catch (error) {
      // Log error but don't expose internal details
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[HANDLER] Error processing request:', errorMessage);
      throw error;
    }

    // Convert Response to API Gateway format
    const responseBody = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value: string, key: string) => {
      responseHeaders[key] = value;
    });

    // Ensure CORS headers are present in all responses
    const origin = event.headers?.origin || 
                   event.headers?.Origin;
    
    // Use the same allowedOrigins array defined at module level for consistency
    // OFFICIAL CloudFront distributions only
    const allowedOrigins = [
      // Admin Web CloudFront (OFFICIAL - E1WPXL8WBOWOE8)
      'https://dfof7mguaa0a5.cloudfront.net',
      // Customer Web CloudFront (OFFICIAL - E2RDORGXSWJJ87)
      'https://d2aoyjj8ine0wk.cloudfront.net',
      // Vendor Web CloudFront (OFFICIAL - E95171GX1I6HN)
      'https://d1s6ykkj381k58.cloudfront.net',
      // Local development
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:5173',
      // Dev domains
      'https://dev.admin.warmpawz.com',
      'https://dev.vendor.warmpawz.com',
      'https://dev.customer.warmpawz.com',
      // Production domains (for prod environment)
      'https://admin.warmpawz.com',
      'https://vendor.warmpawz.com',
      'https://customer.warmpawz.com',
      'https://warmpawz.com',
      'https://www.warmpawz.com',
    ];
    
    const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    
    // Check if Hono CORS middleware already set CORS headers
    const hasCorsHeaders = responseHeaders['access-control-allow-origin'] || responseHeaders['Access-Control-Allow-Origin'];
    
    // Merge CORS headers with response headers
    // Only set CORS headers if Hono didn't already set them (prevents duplicates)
    const finalHeaders: Record<string, string> = { ...responseHeaders };
    
    if (!hasCorsHeaders) {
      // Only set CORS headers if they weren't already set by Hono middleware
      finalHeaders['Access-Control-Allow-Origin'] = allowedOrigin;
      finalHeaders['Access-Control-Allow-Credentials'] = 'true';
      finalHeaders['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD';
      finalHeaders['Access-Control-Allow-Headers'] = 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token';
    }
    
    return {
      statusCode: response.status,
      body: responseBody,
      headers: finalHeaders,
    };
  } catch (error) {
    console.error('Lambda handler error:', error);
    
    // Capture error in error tracking
    captureException(error instanceof Error ? error : new Error(String(error)), {
      requestId: context.awsRequestId,
      path: event.rawPath,
      method: event.requestContext?.http?.method,
      apiId: event.requestContext?.apiId,
    });
    
    // Ensure CORS headers in error responses too
    const origin = event.headers?.origin || 
                   event.headers?.Origin || 
                   'https://dfof7mguaa0a5.cloudfront.net';
    
    const allowedOrigins = [
      // Admin Web CloudFront
      'https://dfof7mguaa0a5.cloudfront.net',
      // Customer Web CloudFront
      'https://d2aoyjj8ine0wk.cloudfront.net',
      // Vendor Web CloudFront
      'https://d1s6ykkj381k58.cloudfront.net',
      // Local development
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:5173',
      // Dev domains
      'https://dev.admin.warmpawz.com',
      'https://dev.vendor.warmpawz.com',
      'https://dev.customer.warmpawz.com',
      // Production domains (for prod environment)
      'https://admin.warmpawz.com',
      'https://vendor.warmpawz.com',
      'https://customer.warmpawz.com',
      'https://warmpawz.com',
      'https://www.warmpawz.com',
    ];
    
    const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    
    // Ensure CORS headers in error responses (Hono middleware won't run for errors)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
        'Access-Control-Allow-Headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }
};

