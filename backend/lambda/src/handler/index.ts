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
import { mapHonoThrownErrorToClientResponse, redactSecretsForLog } from '../utils/safe-hono-error';
import { secureLog, secureLogError } from '../utils/secure-logger';
import { validateEnvironmentOrThrow, getValidationReport, validateEnvironment } from '../utils/env-validation';
import { checkDbHealth } from '../database/rds-connection';
import { requireAuth, requireAdmin, authAuditLog, requireAiChatbotAuth } from '../middleware/auth-middleware';
import { rateLimit, rateLimitAuth, rateLimitOtp, slidingWindowRateLimit } from '../middleware/rate-limit-middleware';
import {
  requestCorrelationMiddleware,
  resolveRequestIdForError,
} from '../middleware/request-correlation-middleware';
import '../types/hono-variables';
// Enhanced handlers (Phase 2-5)
import { registerVendorOnboardingEndpointsEnhanced } from '../endpoints/vendor/endpoints/vendor-onboarding-enhanced';
import { registerVendorOnboardingFixes } from '../endpoints/vendor/endpoints/vendor-onboarding-fixes';
import { registerBookingEndpointsEnhanced, registerBookingOTPEndpoint } from '../endpoints/booking/endpoints/bookings-enhanced.booking';
import { registerPaymentEndpointsEnhanced } from '../endpoints/payments-enhanced';
import { registerTrackingEndpoints } from '../endpoints/tracking';

// Legacy handlers (to be migrated gradually)
// import { registerBookingEndpoints } from '../endpoints/bookings'; // DEPRECATED - use registerBookingEndpointsEnhanced instead
import { registerPaymentEndpoints } from '../endpoints/payments';
import { registerRoleEndpoints } from '../endpoints/roles';
import { registerRoleSeedingEndpoints } from '../endpoints/role-seeding';
import { registerOnboardingFormManagementEndpoints } from '../endpoints/onboarding-form-management';
import { registerVendorDashboardEndpoints } from '../endpoints/vendor/endpoints/vendor-dashboard';
import { registerAdminEndpoints } from '../endpoints/admin/endpoints/admin.controller';
import { registerWarmpawzPayCatalogueAdminRoutes } from '../endpoints/warmpawz-pay/admin/catalogue';
import { registerWarmpawzPayDashboardAdminRoutes } from '../endpoints/warmpawz-pay/admin/dashboard';
import { registerWarmpawzPayPricingAdminRoutes } from '../endpoints/warmpawz-pay/admin/pricing';
import { registerWarmpawzPayConvenienceSettingsRoutes } from '../endpoints/warmpawz-pay/admin/settings';
import { registerWarmpawzPayPaymentsAdminRoutes } from '../endpoints/warmpawz-pay/admin/payments';
import { registerWarmpawzAppointmentsCatalogueAdminRoutes } from '../endpoints/warmpawz-appointments/admin/catalogue';
import { registerWarmpawzAppointmentsPoliciesAdminRoutes } from '../endpoints/warmpawz-appointments/admin/policies';
import { registerWarmpawzAppointmentsDashboardAdmin } from '../endpoints/warmpawz-appointments/admin/dashboard';
import { registerAdminAiCopilotEndpoints } from '../endpoints/admin/endpoints/admin-ai-copilot';
import { registerCommercialAiCopilotEndpoints } from '../endpoints/admin/endpoints/commercial-ai-copilot.endpoints';
import { registerVideoCallEndpoints } from '../endpoints/teleCommunication/endpoints/video-call.teleCommunication';
import { registerPackageSessionEndpoints } from '../endpoints/package-sessions';
import { registerSearchEndpoints } from '../endpoints/search';
import { registerRazorpayEndpoints } from '../endpoints/razorpay/endpoints/razorpay.razorpay';
import { registerWalletEndpoints } from '../endpoints/wallet';
import { registerWalletDiagnosticEndpoints } from '../endpoints/wallet-diagnostic';
import { registerSpecializedServicesEndpoints } from '../endpoints/specialized-services';
import { registerSpecializedServiceFlows } from '../endpoints/customer/customerEndpoint/specialized-service-flows.customer';
// Staff decommissioned: solo providers discovered via discover-services for at_home/tele
// import { registerStaffEndpoints } from '../endpoints/staff';
import { registerReviewEndpoints } from '../endpoints/reviews';
import { registerNotificationEndpoints } from '../endpoints/notification/endpoitns/notifications.notification';
import { registerFollowupRescheduleEndpoints } from '../endpoints/followup-reschedule';
import { registerBehaviorJournalEndpoints } from '../endpoints/behavior-journal';
import { registerVendorScheduleEndpoints } from '../endpoints/vendor/endpoints/vendor-schedule';
import { registerPrescriptionEndpoints } from '../endpoints/prescription/endpoints/prescriptions';
import { registerMedicalRecordsEndpoints } from '../endpoints/medical-records';
import { registerEcommerceEndpoints } from '../endpoints/ecommerce/endpoints/ecommerce';
import { registerEcommerceCategoryRulesEndpoints } from '../endpoints/ecommerce/endpoints/ecommerce-category-rules';
import { registerAnalyticsEndpoints } from '../endpoints/admin/endpoints/analytics.admin';
import { registerProductAnalyticsEndpoints } from '../endpoints/product-analytics';
import { registerLoyaltyEndpoints } from '../endpoints/loyalty&reward/endpoints/loyalty';
import { registerPackageEndpoints } from '../endpoints/packages';
import { registerPetEndpoints } from '../endpoints/pets';
import { registerVendorServicesEndpoints } from '../endpoints/vendor/endpoints/vendorServices.vendor';
import { registerVendorPricingEndpoints } from '../endpoints/vendor/endpoints/vendor-pricing';
import { registerVendorProductsEndpoints } from '../endpoints/vendor/endpoints/vendor-products';
import { registerVendorOrdersEndpoints } from '../endpoints/vendor/endpoints/vendor-orders';
import { registerVendorCommissionAnalyticsEndpoints } from '../endpoints/vendor/endpoints/vendor-commission-analytics';
import { registerServiceCatalogEndpoints } from '../endpoints/service-catalog';
import { registerSettlementEndpoints } from '../endpoints/settlement&payouts/endpoints/settlements';
import { registerRegionEndpoints } from '../endpoints/regions';
import { registerChatEndpoints } from '../endpoints/chat';
import { registerFileUploadEndpoints } from '../endpoints/file-upload';
import { registerSubscriptionEndpoints } from '../endpoints/subscriptions';
import { registerSubscriptionBookingEndpoints } from '../endpoints/subscription-booking';
import { registerInsuranceEndpoints } from '../endpoints/insurance';
import { registerTrainingProgressEndpoints } from '../endpoints/training-progress';
import { registerPackageBookingEndpoints } from '../endpoints/package-booking';
import { registerWalkerGPSEndpoints } from '../endpoints/walker-gps';
import { registerPromotionEndpoints } from '../endpoints/promotions';
import { registerPromoEngineEndpoints } from '../endpoints/promo-engine.endpoints';
import { registerAdsRecommendationEndpoints } from '../endpoints/ads-recommendations';
import { registerEventEndpoints } from '../endpoints/events';
import { registerHealthEndpoints } from '../endpoints/health';
import { registerDonationEndpoints } from '../endpoints/donations';
import { registerReportEndpoints } from '../endpoints/reports';
import { registerAddressEndpoints } from '../endpoints/customer/customerEndpoint/addresses.customer';
import { registerLogisticsEndpoints } from '../endpoints/logistics';
import { registerLogisticsWebhookEndpoints } from '../endpoints/logistics-webhooks';
import { registerReturnsEndpoints } from '../endpoints/returns';
import { registerOrderManagementEndpoints } from '../endpoints/order-management';
import { registerEnhancedOtpEndpoints } from '../endpoints/otp-enhanced';
import { registerSmsNotificationEndpoints } from '../endpoints/sms-notifications';
import { registerVendorProfileEndpoints } from '../endpoints/vendor/endpoints/vendorProfile.vendor';
import { registerVendorProfilePasswordLiterals } from '../endpoints/vendor/vendor-auth-password';
import { registerSystemHealthEndpoints } from '../endpoints/system-health';
import { registerVendorSettingsEndpoints } from '../endpoints/vendor/endpoints/vendor-settings';
import { registerVendorPoliciesEndpoints } from '../endpoints/vendor/endpoints/vendor-policies';
import { registerVendorBookingsEndpoints } from '../endpoints/vendor/endpoints/vendor-bookings';
import { registerVendorWapptAppointmentsEndpoints } from '../endpoints/vendor/endpoints/vendor-wappt-appointments';
import { registerVendorWpayPaymentsEndpoints } from '../endpoints/vendor/endpoints/vendor-wpay-payments';
import { registerVendorWpayBillImageEndpoints } from '../endpoints/vendor/endpoints/vendor-wpay-bill-image';
import { registerVendorDashboardEnhancedEndpoints } from '../endpoints/vendor/endpoints/vendor-dashboard-enhanced';
import { registerAppointmentReminderEndpoints } from '../endpoints/appointment-reminders';
import { registerPetVaccinationReminderEndpoints } from '../endpoints/pet-vaccination-reminders';
import { registerNotificationSystemEndpoints } from '../endpoints/notification-system';
import { registerTierSystemEndpoints } from '../endpoints/tier-system';
import { registerTransactionMonitoringEndpoints } from '../endpoints/transaction-monitoring';
import { registerTimeWindowSubscriptionEndpoints } from '../endpoints/time-window-subscription';
import { registerStorageEndpoints } from '../endpoints/storage';
import { registerPushNotificationEndpoints } from '../endpoints/push-notifications';
import { registerCommuteTimeEndpoints } from '../endpoints/commute-time';
import { registerRazorpaySettlementEndpoints } from '../endpoints/razorpay-settlements';
import { registerRefundPolicyEngineEndpoints } from '../endpoints/refund-policy-engine';
import { registerAdminAdvancedEndpoints } from '../endpoints/admin/endpoints/admin-advanced';
import { registerAdminMealLogisticsEndpoints } from '../endpoints/admin/endpoints/admin-meal-logistics';
import { registerAdminNotificationDeliveryEndpoints } from '../endpoints/admin/endpoints/admin-notification-delivery';
import { registerNotificationCampaignEndpoints } from '../endpoints/admin/endpoints/notification-campaigns';
import { registerAdminVendorDailyAccrualEndpoints } from '../endpoints/admin/endpoints/admin-vendor-daily-accrual';
import { registerAdminVendorBookingEarningsEndpoints } from '../endpoints/admin/endpoints/admin-vendor-booking-earnings';
import { registerDiscoveryRulesAdminEndpoints } from '../endpoints/discovery-rules-admin';
import { registerVendorSetupEndpoints } from '../endpoints/vendor/endpoints/vendor-setup';
import { registerConfigPoliciesEndpoints } from '../endpoints/config-policies';
import { registerPetCafeEndpoints } from '../endpoints/pet-cafe';
import { registerVendorRadarEndpoints } from '../endpoints/vendor/endpoints/vendor-radar';
import { registerPetResortEndpoints } from '../endpoints/pet-resort';
import { registerPetHolidaysEndpoints } from '../endpoints/pet-holidays';
import { registerTaxManagementEndpoints } from '../endpoints/tax-management';
import { registerLogisticsManagementEndpoints } from '../endpoints/logistics-management';
import { registerPaymentGatewayManagementEndpoints } from '../endpoints/payment-gateway-management';

import { registerCommunityEndpoints } from '../endpoints/community';
import { registerReferralEndpoints } from '../endpoints/referrals';
import { registerAdminReferralsEndpoints } from '../endpoints/admin/endpoints/admin-referrals';
import { registerRewardsEndpoints } from '../endpoints/rewards';
import { registerAIChatbotEndpoints } from '../endpoints/aiChatbot/ai-chatbot';
import { registerAIBookingWizardSessionEndpoints } from '../endpoints/aiChatbot/ai-booking-wizard-session';
import { registerSupportCrmEndpoints } from '../endpoints/supportCrm/endpoint/support-crm';
import { registerLocationSharingEndpoints } from '../endpoints/location-sharing';
import { registerVendorSecurityEndpoints } from '../endpoints/vendor/endpoints/vendor-security';
import { registerVendorDistancePricingEndpoints } from '../endpoints/vendor/endpoints/vendor-distance-pricing';
import { registerSchedulingPolicyEndpoints } from '../endpoints/scheduling-policies';
import { registerAdminComprehensiveEndpoints } from '../endpoints/admin/endpoints/admin-comprehensive';
import { registerAdminCustomerEndpoints } from '../endpoints/admin/endpoints/admin-customer-endpoints';
import { registerAdminBookingCancelEndpoints } from '../endpoints/admin/endpoints/admin-booking-cancel-endpoints';
import { registerProblemGridEndpoints } from '../endpoints/problem-grid';
import { registerVendorDashboardMissingEndpoints } from '../endpoints/vendor/endpoints/vendor-dashboard-missing';
import { registerUIDashboardConfigEndpoints } from '../endpoints/ui-dashboard-config';
import { registerServiceLaunchConfigEndpoints } from '../endpoints/service-launch-config';
import { registerCarePlansEndpoints } from '../endpoints/care-plans';
import { registerVendorSupportEndpoints } from '../endpoints/vendor/endpoints/vendor-support';
import { registerPharmacyOrderEndpoints, registerAdditionalPharmacyEndpoints } from '../endpoints/orders/endpoint/pharmacy-orders';
import { registerPharmacyInventoryEndpoints } from '../endpoints/pharmacy-inventory';
import { registerDeliveryPartnerAutomationEndpoints } from '../endpoints/delivery-partner-automation';
import { registerMealPlanEndpoints } from '../endpoints/meal-plans';
import { registerMealCanonicalSubscriptionEndpoints } from '../endpoints/meal-canonical-subscriptions';
import { registerMealDeliveryNotificationEndpoints } from '../endpoints/meal-delivery-notifications';
import { registerMealRefundCaseEndpoints } from '../endpoints/meal-refund-cases';
import { registerAdminRefundHubEndpoints } from '../endpoints/admin-refund-hub';
import { registerAdminShopRefundsEndpoints } from '../endpoints/admin-shop-refunds';
import { registerMealSubscriptionVendorOperationalEndpoints } from '../endpoints/meal-subscription-vendor-endpoints';
import { registerNutritionOrderEndpoints } from '../endpoints/nutrition-orders';
import { registerVendorBankAccountEndpoints } from '../endpoints/vendor/endpoints/vendor-bank-accounts';
import { registerDeliveryTrackingEndpoints } from '../endpoints/delivery-tracking';
import { registerDeliveryOtpEndpoints } from '../endpoints/delivery-otp';
import { registerInstantTeleQueueEndpoints } from '../endpoints/teleCommunication/endpoints/instant-tele-queue.teleconsultation';
import { registerInstantTeleV2Endpoints } from '../endpoints/teleCommunication/endpoints/instant-tele-v2.teleconsultation';
import { registerInstantTeleV3Endpoints } from '../endpoints/teleCommunication/endpoints/instant-tele-v3.teleconsultation';
import { registerRoomsEndpoints } from '../endpoints/rooms';
import { registerVendorLiveStatusEndpoints } from '../endpoints/vendor/endpoints/vendor-live-status';
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
import { registerTrackingWebhookEndpoints } from '../endpoints/tracking-webhooks';
import { registerTaxInvoicePdfEndpoints } from '../endpoints/tax-invoice-pdf';
import { registerPlatformTaxEndpoints } from '../endpoints/platform-tax-documents';
import { registerReviewsEnhancedEndpoints } from '../endpoints/reviews-enhanced';
import { registerReturnsEnhancedEndpoints } from '../endpoints/returns-enhanced';
import { registerFeeConfigEndpoints } from '../endpoints/fee-config';
import { registerCommerceSwitchEndpoints } from '../endpoints/commerce-switch.endpoints';
import { registerKYCVerificationEndpoints } from '../endpoints/kyc-verification';
import { registerSpecializationMasterEndpoints } from '../endpoints/specialization-master';
import platformPoliciesApp from '../endpoints/platform-policies';
import { registerAuthEndpointsEnhanced } from 'src/endpoints/Auth/auth-enhanced';
import { registerServiceDiscoveryEndpoints } from 'src/endpoints/customer/customerEndpoint/service-discovery.customer';
import { registerCustomerProfileEndpoints } from 'src/endpoints/customer/customerEndpoint/customer-profile.customer';
import { registerCustomerPasswordEndpoints } from 'src/endpoints/customer/customerEndpoint/customer-password';
import { registerVendorAnalyticsEndpoints } from 'src/endpoints/vendor/endpoints/vendorAnalytics.vendor';
import { registerCustomerEndpointsEnhanced } from 'src/endpoints/customer/customerEndpoint/customer-enhanced';
import { registerAdminSellersEndpoints } from 'src/endpoints/admin/endpoints/admin-sellers';
import { registerCustomerContentEndpoints } from 'src/endpoints/customer/customerEndpoint/customer-content';
import { registerCustomerDeliveryFeePolicyEndpoints } from '../endpoints/customer-delivery-fee-policy-endpoints';
import { registerCustomerPhoneConvenienceEndpoints } from 'src/endpoints/customer/customerEndpoint/customer-phone-convenience';
import { registerCustomerBookingHistoryEndpoints } from 'src/endpoints/customer/customerEndpoint/customer-booking-history';
import { registerAdminGovernanceEndpoints } from 'src/endpoints/admin/endpoints/admin-governance';
import { registerAdminIntegrationEndpoints } from 'src/endpoints/admin/endpoints/admin-integrations';
import { registerAdminGovernanceEnhancedEndpoints } from 'src/endpoints/admin/endpoints/admin-governance-enhanced';
import { registerCustomerAppointmentsEndpoints } from 'src/endpoints/customer/customerEndpoint/customer-appointments';
import { registerCustomerWarmpawzPayEndpoints } from 'src/endpoints/customer/customerEndpoint/customer-warmpawz-pay';
import { registerCustomerVendorFeedbackEndpoints } from 'src/endpoints/customer/customerEndpoint/customer-vendor-feedback';
import { registerCustomerWarmpawzAppointmentsEndpoints } from 'src/endpoints/customer/customerEndpoint/customer-warmpawz-appointments';
import { registerCustomerOrdersEndpoints } from 'src/endpoints/customer/customerEndpoint/customer-orders';
import { registerAdminCustomServicesEndpoints } from 'src/endpoints/admin/endpoints/admin-custom-services';
import { registerGpsTrackingEndpoints } from 'src/endpoints/gpsTracking/endpoints/gps-tracking';
import { registerVendorBookingActionsEndpoints } from 'src/endpoints/gpsTracking/endpoints/vendor.gpstracking';
import { registerBookingDetailsEnhancedEndpoints } from 'src/endpoints/booking/endpoints/booking-details-enhanced';
import { registerLoyaltySegmentsManagementEndpoints } from 'src/endpoints/loyalty&reward/endpoints/loyalty-segments-management';
import { registerLoyaltyActionRulesManagementEndpoints } from 'src/endpoints/loyalty&reward/endpoints/loyalty-action-rules-management';
import { registerLoyaltyActionSourcesManagementEndpoints } from 'src/endpoints/loyalty&reward/endpoints/loyalty-action-sources-management';
import { registerWalletCheckoutRulesEndpoints } from 'src/endpoints/wallet-checkout-rules-endpoints';
import { actionSourceMiddleware } from '../middleware/action-source-middleware';

// Create Hono app (requestId/correlationId typed via ContextVariableMap augmentation)
const app = new Hono();

/** Local browser dev servers (merged only when not prod/stage — see getAllowedOriginsList).
 * Include 127.0.0.1 — browsers treat it as distinct from localhost for CORS. */
const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:5173',
];

/** Must stay aligned with API Gateway AllowHeaders (infra/modules/api-gateway/main.tf). */
const CORS_ALLOW_HEADERS_BASE =
  'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,x-customer-phone,X-Requested-With,x-request-id,x-correlation-id';

const isStrictCorsOriginPolicy = (): boolean => {
  const e = (process.env.ENVIRONMENT || '').toLowerCase();
  return e === 'prod' || e === 'production' || e === 'stage';
};

/** Env-scoped allowlist: prod/stage use only ALLOWED_ORIGINS; dev merges localhost + ALLOWED_ORIGINS (Terraform). */
const getAllowedOriginsList = (): string[] => {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (isStrictCorsOriginPolicy()) {
    return fromEnv.length > 0 ? [...new Set(fromEnv)] : [];
  }
  const merged = [...new Set([...LOCAL_DEV_ORIGINS, ...fromEnv])];
  return merged.length > 0 ? merged : LOCAL_DEV_ORIGINS;
};

const getDefaultCorsOrigin = (): string => {
  const list = getAllowedOriginsList();
  return list[0] || '';
};

/**
 * Exact allowlist match only (no wildcard). Missing Origin → first allowed origin (non-browser parity).
 * Present but disallowed Origin → '' (omit ACAO on that response).
 */
const getAllowedOrigin = (origin: string | null | undefined): string => {
  const list = getAllowedOriginsList();
  if (!origin || !String(origin).trim()) {
    return getDefaultCorsOrigin();
  }
  const normalizedOrigin = origin.toLowerCase();
  if (list.map((o) => o.toLowerCase()).includes(normalizedOrigin)) {
    return origin;
  }
  return '';
};

function mergeAccessControlRequestHeaders(requestedHeaderLine: string): string {
  const extra = (requestedHeaderLine || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .join(',');
  return extra ? `${CORS_ALLOW_HEADERS_BASE},${extra}` : CORS_ALLOW_HEADERS_BASE;
}

function corsPreflightResponseHeaders(
  allowedOrigin: string,
  requestedHeaderLine: string
): Record<string, string> {
  const h: Record<string, string> = {
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
    'access-control-allow-headers': mergeAccessControlRequestHeaders(requestedHeaderLine),
    'access-control-max-age': '86400',
    'content-length': '0',
  };
  if (allowedOrigin) {
    h['access-control-allow-origin'] = allowedOrigin;
    h['access-control-allow-credentials'] = 'true';
  }
  return h;
}

/** Non-preflight API Gateway responses (errors / header merge): omit ACAO when origin not allowed. */
function apiGwCorsHeadersForResponse(origin: string | undefined): Record<string, string> {
  const allowedOrigin = getAllowedOrigin(origin);
  const h: Record<string, string> = {
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
    'access-control-allow-headers': CORS_ALLOW_HEADERS_BASE,
  };
  if (allowedOrigin) {
    h['access-control-allow-origin'] = allowedOrigin;
    h['access-control-allow-credentials'] = 'true';
  }
  return h;
}

// Explicit OPTIONS handler for all routes - must be before CORS middleware
// This ensures OPTIONS requests return 200 OK immediately
app.options('*', async (c) => {
  try {
    const origin = c.req.header('origin') || c.req.header('Origin') || '';
    console.log('[Hono OPTIONS] OPTIONS request received:', {
      path: c.req.path,
      origin: origin || 'none',
      rawPath: (c.req as any).rawPath || c.req.path,
    });

    const allowedOrigin = getAllowedOrigin(origin);
    const requestedHeaders =
      c.req.header('access-control-request-headers') ||
      c.req.header('Access-Control-Request-Headers') ||
      '';

    console.log('[Hono OPTIONS] Returning 200 OK with CORS headers:', {
      allowedOrigin,
      allowedHeaders: mergeAccessControlRequestHeaders(requestedHeaders).substring(0, 100),
    });

    return new Response(null, {
      status: 200,
      headers: corsPreflightResponseHeaders(allowedOrigin, requestedHeaders),
    });
  } catch (error) {
    secureLogError('[Hono OPTIONS] Error in OPTIONS handler', error, {
      requestId: resolveRequestIdForError(c),
      path: c.req.path,
      method: 'OPTIONS',
    });
    const origin = c.req.header('origin') || c.req.header('Origin') || '';
    const allowedOrigin = getAllowedOrigin(origin);
    return new Response(null, {
      status: 200,
      headers: corsPreflightResponseHeaders(allowedOrigin, ''),
    });
  }
});

app.use('*', cors({
  origin: (origin) => {
    const allowed = getAllowedOriginsList();
    if (!origin) return getDefaultCorsOrigin() || undefined;
    const normalized = origin.toLowerCase();
    if (allowed.map((o) => o.toLowerCase()).includes(normalized)) return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-api-key',
    'X-UAT-Mode',
    'X-UAT-Token',
    'X-Customer-Phone',
    'x-request-id',
    'X-Request-Id',
    'x-correlation-id',
    'X-Correlation-Id',
  ],
  credentials: true,
  maxAge: 86400,
}));

// Batch 4: server-validated correlation / request IDs for CloudWatch + error paths
app.use('*', requestCorrelationMiddleware());

// Action Sources middleware - emits ActionOccurred based on DB-configured triggers
app.use('*', actionSourceMiddleware());

// Authentication audit logging (for security monitoring)
app.use('*', requireAuth());
app.use('*', authAuditLog());

// ✅ TEMPORARY: Migration endpoint (registered BEFORE admin auth middleware).
// Batch 1: fail-closed admin gate — path is /system/* so requireAdmin() would not apply.
app.post('/system/run-pending-migrations', async (c) => {
  const { isAdminRole } = await import('../utils/security-ownership');
  if (!isAdminRole(c)) {
    return c.json({ success: false, error: 'Forbidden', code: 'ADMIN_REQUIRED' }, 403);
  }

  const { query: dbQuery } = require('../database/rds-connection');
  const results: any[] = [];
  try {
    // Migration 558: vendor_referrals table
    try {
      const tableCheck = await dbQuery(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_referrals') as table_exists`);
      if (tableCheck.rows[0]?.table_exists) {
        results.push({ migration: '558_vendor_referrals', status: 'skipped', message: 'Table already exists' });
      } else {
        await dbQuery(`CREATE TABLE IF NOT EXISTS vendor_referrals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), referrer_vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE, referred_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL, referred_phone TEXT NOT NULL, referral_code TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'approved', 'expired')), applied_at TIMESTAMPTZ, approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(referrer_vendor_id, referred_phone))`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referrer_vendor_id ON vendor_referrals(referrer_vendor_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referred_vendor_id ON vendor_referrals(referred_vendor_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referral_code ON vendor_referrals(referral_code)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referred_phone ON vendor_referrals(referred_phone)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_vendor_referrals_status ON vendor_referrals(status)`);
        results.push({ migration: '558_vendor_referrals', status: 'completed', message: 'Table and indexes created' });
      }
    } catch (err: any) { results.push({ migration: '558_vendor_referrals', status: 'error', message: 'Migration step failed' }); }

    // Migration 605: availability_configured + services_configured
    try {
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'availability_configured') THEN ALTER TABLE vendors ADD COLUMN availability_configured BOOLEAN DEFAULT false; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'services_configured') THEN ALTER TABLE vendors ADD COLUMN services_configured BOOLEAN DEFAULT false; END IF; END $$`);
      await dbQuery(`CREATE INDEX IF NOT EXISTS idx_vendors_availability_configured ON vendors(availability_configured) WHERE availability_configured = false`);
      await dbQuery(`CREATE INDEX IF NOT EXISTS idx_vendors_approved_not_availability ON vendors(status, availability_configured) WHERE status = 'approved' AND availability_configured = false`);
      results.push({ migration: '605_availability_configured', status: 'completed', message: 'Columns and indexes created/verified' });
    } catch (err: any) { results.push({ migration: '605_availability_configured', status: 'error', message: 'Migration step failed' }); }

    // Migration 620: customer_referrals — vendor-as-referrer for customer signups
    try {
      await dbQuery(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'customer_referrals'
          ) THEN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'customer_referrals' AND column_name = 'referrer_vendor_id'
            ) THEN
              ALTER TABLE customer_referrals
                ADD COLUMN referrer_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
            END IF;
            ALTER TABLE customer_referrals ALTER COLUMN referrer_customer_id DROP NOT NULL;
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'customer_referrals_referrer_chk'
            ) THEN
              ALTER TABLE customer_referrals
                ADD CONSTRAINT customer_referrals_referrer_chk CHECK (
                  (referrer_customer_id IS NOT NULL AND referrer_vendor_id IS NULL)
                  OR (referrer_customer_id IS NULL AND referrer_vendor_id IS NOT NULL)
                );
            END IF;
          END IF;
        END $$;
      `);
      await dbQuery(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_referrals_vendor_referred_phone
        ON customer_referrals (referrer_vendor_id, referred_phone)
        WHERE referrer_vendor_id IS NOT NULL;
      `);
      results.push({ migration: '620_customer_referrals_vendor_referrer', status: 'completed', message: 'referrer_vendor_id + constraints' });
    } catch (err: any) { results.push({ migration: '620_customer_referrals_vendor_referrer', status: 'error', message: 'Migration step failed' }); }

    // Migration 071: vendor settings columns
    try {
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'service_radius') THEN ALTER TABLE vendors ADD COLUMN service_radius NUMERIC(5, 2); END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'emergency_contact') THEN ALTER TABLE vendors ADD COLUMN emergency_contact JSONB DEFAULT NULL; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'max_dogs_per_walk') THEN ALTER TABLE vendors ADD COLUMN max_dogs_per_walk INTEGER; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'walk_durations') THEN ALTER TABLE vendors ADD COLUMN walk_durations TEXT[] DEFAULT ARRAY[]::TEXT[]; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'other_config') THEN ALTER TABLE vendors ADD COLUMN other_config JSONB DEFAULT '{}'::jsonb; END IF; END $$`);
      await dbQuery(`CREATE INDEX IF NOT EXISTS idx_vendors_service_radius ON vendors(service_radius) WHERE service_radius IS NOT NULL`);
      results.push({ migration: '071_vendor_settings_columns', status: 'completed' });
    } catch (err: any) { results.push({ migration: '071_vendor_settings_columns', status: 'error', message: 'Migration step failed' }); }

    // Migration: setup_completed, profile_photo_url, etc.
    try {
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'setup_completed') THEN ALTER TABLE vendors ADD COLUMN setup_completed BOOLEAN DEFAULT false; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'profile_photo_url') THEN ALTER TABLE vendors ADD COLUMN profile_photo_url TEXT; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'qualifications') THEN ALTER TABLE vendors ADD COLUMN qualifications TEXT; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'service_area') THEN ALTER TABLE vendors ADD COLUMN service_area TEXT; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'description') THEN ALTER TABLE vendors ADD COLUMN description TEXT; END IF; END $$`);
      results.push({ migration: '528_profile_fields', status: 'completed' });
    } catch (err: any) { results.push({ migration: '528_profile_fields', status: 'error', message: 'Migration step failed' }); }

    // Verification (counts only — do not dump column names to clients)
    const verifyResult = await dbQuery(`SELECT COUNT(*)::int AS total FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendors'`);
    const referralsCheck = await dbQuery(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_referrals') as exists`);

    return c.json({
      success: true,
      message: 'All migrations completed',
      results,
      verification: {
        vendor_referrals_table_exists: referralsCheck.rows[0]?.exists || false,
        total_vendor_columns: verifyResult.rows[0]?.total ?? 0
      }
    });
  } catch (error: unknown) {
    secureLogError('[system/run-pending-migrations] failed', error, {
      requestId: resolveRequestIdForError(c),
      path: c.req.path,
    });
    return c.json({ success: false, error: 'Migration execution failed', results }, 500);
  }
});

// Require authentication for admin endpoints
app.use('/admin/*', requireAdmin());

const adminAiCopilotRlMaxRaw = parseInt(process.env.ADMIN_AI_COPILOT_RL_MAX || '20', 10);
const adminAiCopilotRlMax = Number.isFinite(adminAiCopilotRlMaxRaw) ? Math.max(5, adminAiCopilotRlMaxRaw) : 20;
app.use(
  '/admin/ai-copilot/*',
  slidingWindowRateLimit({
    windowMs: 60_000,
    maxRequests: adminAiCopilotRlMax,
    keyPrefix: 'admin-ai-copilot',
  })
);

const commercialAiCopilotRlMaxRaw = parseInt(process.env.COMMERCIAL_AI_COPILOT_RL_MAX || '20', 10);
const commercialAiCopilotRlMax = Number.isFinite(commercialAiCopilotRlMaxRaw)
  ? Math.max(5, commercialAiCopilotRlMaxRaw)
  : 20;
app.use(
  '/admin/commercial-ai-copilot/*',
  slidingWindowRateLimit({
    windowMs: 60_000,
    maxRequests: commercialAiCopilotRlMax,
    keyPrefix: 'commercial-ai-copilot',
  })
);

// OTP-heavy auth routes: higher per-IP ceiling (separate from blanket /auth/* limit).
const otpAuthRateLimit = slidingWindowRateLimit({
  windowMs: 60_000,
  maxRequests: 20,
  keyPrefix: 'otp-auth',
});
app.use('/auth/otp/send', otpAuthRateLimit);
app.use('/auth/send-otp', otpAuthRateLimit);
app.use('/auth/customer/forgot-password/request', otpAuthRateLimit);
app.use('/auth/vendor/forgot-password/request', otpAuthRateLimit);

const authRateLimitMiddleware = rateLimitAuth();
const OTP_AUTH_PATHS = new Set([
  '/auth/otp/send',
  '/auth/send-otp',
  '/auth/customer/forgot-password/request',
  '/auth/vendor/forgot-password/request',
]);
app.use('/auth/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (OTP_AUTH_PATHS.has(path)) return next();
  return authRateLimitMiddleware(c, next);
});
app.use('/otp/*', slidingWindowRateLimit({ windowMs: 60000, maxRequests: 5, keyPrefix: 'otp' }));
app.use('/bookings/generate-otp', slidingWindowRateLimit({ windowMs: 60000, maxRequests: 5, keyPrefix: 'booking-otp' }));
app.use('/payments/*', rateLimit({ windowMs: 60000, maxRequests: 30, keyPrefix: 'payments' }));

const aiChatbotRlMaxRaw = parseInt(process.env.AI_CHATBOT_RL_MAX || '30', 10);
const aiChatbotRlMax = Number.isFinite(aiChatbotRlMaxRaw) ? Math.max(5, aiChatbotRlMaxRaw) : 30;
app.use(
  '/ai-chatbot/*',
  slidingWindowRateLimit({ windowMs: 60_000, maxRequests: aiChatbotRlMax, keyPrefix: 'ai-chatbot' })
);
if (process.env.AI_CHATBOT_REQUIRE_AUTH === 'true') {
  app.use('/ai-chatbot/*', requireAiChatbotAuth());
}

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
// ✅ PRODUCTION FIX: Add timeout to prevent Lambda timeout
app.get('/health', async (c) => {
  const healthStatus: {
    status: string;
    timestamp: string;
    apiGateway?: string;
    database?: { connected: boolean; error?: string };
    environment?: { valid: boolean; warnings?: string[] };
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  
  // Add API Gateway info for production verification
  const event = (c.env as any)?.event as APIGatewayProxyEventV2 | undefined;
  if (event?.requestContext?.apiId) {
    healthStatus.apiGateway = `${event.requestContext.apiId}.execute-api.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com`;
  }
  
  // Check database connectivity with timeout (5 seconds max)
  try {
    const dbHealthPromise = checkDbHealth();
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Database health check timeout')), 5000);
    });
    
    const dbHealthy = await Promise.race([dbHealthPromise, timeoutPromise]) as boolean;
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
// ✅ FIX: Register enhanced dashboard BEFORE legacy so GET /vendor/dashboard/:vendorId returns 200 with empty data (not 404) when vendor not in vendors table
registerVendorDashboardEnhancedEndpoints(app);
registerVendorDashboardEndpoints(app);
// Register specific routes BEFORE parameterized routes to avoid route conflicts
// Order matters: specific routes (e.g., /customer/behavior-journal) must come before parameterized routes (e.g., /customer/:customerId)
registerBehaviorJournalEndpoints(app); // /customer/behavior-journal - before /customer/:customerId
registerFollowupRescheduleEndpoints(app); // /followup/create, /vendor/reschedule-policy, /vendor/available-slots, /bookings/available-slots
registerNotificationEndpoints(app); // /customer/notifications - before /customer/:customerId
registerServiceDiscoveryEndpoints(app); // /customer/vendors/search, /customer/discover-services, /customer/services, /customer/autocomplete, /customer/radar/providers, /customer/vendors/discover-by-problem, /vendor/:vendorId/facility - before /customer/:customerId
registerServiceCatalogEndpoints(app); // /services/:serviceId - before /customer/:customerId
registerCustomerContentEndpoints(app); // /customer/banners, /customer/articles, /customer/announcements - before /customer/:customerId
registerCustomerDeliveryFeePolicyEndpoints(app); // /customer/delivery-fee-policy, /customer/delivery-fee/calculate, /admin/delivery-fee-policy
// ✅ CRITICAL ROUTE ORDERING: Specific routes MUST come before parameterized routes
// /customer/bookings/active is registered in registerCustomerPhoneConvenienceEndpoints
// This ensures "active" is not interpreted as a UUID in /customer/:customerId route
registerCustomerPhoneConvenienceEndpoints(app); // /customer/bookings/active, /customer/bookings?phone=, /customer/cart/:phone, /customer/wallet?phone=, etc. - before /customer/:customerId
registerCustomerPasswordEndpoints(app); // POST /customer/change-password (legacy); literals live in profile module
registerCustomerProfileEndpoints(app); // password-status, set-password, account/* first — then /customer/profile/* — before /customer/:customerId
registerCustomerBookingHistoryEndpoints(app); // /customer/bookings/:bookingId, /customer/:customerId/bookings - before /customer/:customerId
registerAddressEndpoints(app); // /customer/addresses - MUST be before /customer/:customerId to avoid route conflicts
registerRefundPolicyEngineEndpoints(app); // /customer/refund-policy - MUST be before /customer/:customerId
// GET/POST /customer/orders MUST register before /customer/:customerId or "orders" is treated as a customer id → HTTP 404.
registerCustomerOrdersEndpoints(app);
// /customer/warmpawz-appointments/* MUST register before /customer/:customerId
registerCustomerWarmpawzAppointmentsEndpoints(app);
// /customer/appointments MUST register before /customer/:customerId or "appointments" is captured as :customerId → list API never runs.
registerCustomerAppointmentsEndpoints(app);
registerCustomerWarmpawzPayEndpoints(app); // /customer/warmpawz-pay/vendors — before /customer/:customerId
registerCustomerVendorFeedbackEndpoints(app); // /customer/vendor-feedback/* — before /customer/:customerId
registerCustomerWarmpawzAppointmentsEndpoints(app); // /customer/warmpawz-appointments/* — before /customer/:customerId
// Specialized flows under /customer/* (pet-matching, holiday-packages) MUST register before /customer/:customerId
// or paths like /customer/pet-matching are captured as customerId="pet-matching" and return 4xx.
registerSpecializedServiceFlows(app);
// Now register parameterized routes
registerCustomerEndpointsEnhanced(app); // /customer/:customerId (parameterized - must be last)
registerGpsTrackingEndpoints(app);
registerAdminEndpoints(app);
registerWarmpawzPayDashboardAdminRoutes(app);
registerWarmpawzPayPaymentsAdminRoutes(app);
registerWarmpawzPayPricingAdminRoutes(app);
registerWarmpawzPayConvenienceSettingsRoutes(app);
registerWarmpawzPayCatalogueAdminRoutes(app);
registerWarmpawzAppointmentsDashboardAdmin(app);
registerWarmpawzAppointmentsCatalogueAdminRoutes(app);
registerWarmpawzAppointmentsPoliciesAdminRoutes(app);
registerAdminAiCopilotEndpoints(app);
registerCommercialAiCopilotEndpoints(app);
registerAdminCustomerEndpoints(app);
registerAdminBookingCancelEndpoints(app);
registerVideoCallEndpoints(app);
registerPackageSessionEndpoints(app);
registerSearchEndpoints(app);
registerRazorpayEndpoints(app);
registerWalletEndpoints(app);
registerWalletDiagnosticEndpoints(app);
registerSpecializedServicesEndpoints(app);
registerAdminGovernanceEndpoints(app);
// registerStaffEndpoints(app); // Staff decommissioned – solo discovery for at_home/tele
registerInstantTeleQueueEndpoints(app); // Instant tele consultation queue (legacy queue/staff)
registerInstantTeleV2Endpoints(app); // Instant tele V2: vet-only, va2 availability, payment-first, no queue
registerInstantTeleV3Endpoints(app); // Instant tele V3: vendor-accept-first, SSE streams, payment after acceptance
registerRoomsEndpoints(app); // Consultation rooms management (Phase 1.1)
registerReviewEndpoints(app);
registerTrackingEndpoints(app);
registerVendorScheduleEndpoints(app);
registerPrescriptionEndpoints(app);
registerPharmacyOrderEndpoints(app);
registerAdditionalPharmacyEndpoints(app); // ✅ FIX: Register additional pharmacy endpoints (invoice, logistics, tracking)
registerPharmacyInventoryEndpoints(app);
registerDeliveryPartnerAutomationEndpoints(app);
registerMealCanonicalSubscriptionEndpoints(app);
registerMealDeliveryNotificationEndpoints(app);
registerMealRefundCaseEndpoints(app);
registerAdminRefundHubEndpoints(app);
registerAdminShopRefundsEndpoints(app);
registerMealSubscriptionVendorOperationalEndpoints(app);
registerMealPlanEndpoints(app);
registerNutritionOrderEndpoints(app); // ✅ FIX GAP-9.3 & 9.4: Nutrition order tracking
registerVendorBankAccountEndpoints(app);
registerDeliveryTrackingEndpoints(app);
registerDeliveryOtpEndpoints(app); // Delivery OTP verification for pharmacy and meal orders
registerMedicalRecordsEndpoints(app);
registerAdsRecommendationEndpoints(app); // Before ecommerce — /products/similar must register before /products/:productId
registerEcommerceEndpoints(app);
registerEcommerceCategoryRulesEndpoints(app);
registerAnalyticsEndpoints(app);
registerPromoEngineEndpoints(app);
registerProductAnalyticsEndpoints(app);
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
registerVendorCommissionAnalyticsEndpoints(app);
// registerServiceCatalogEndpoints(app); // REMOVED: Already registered at line 215 (before parameterized routes)
registerSettlementEndpoints(app);
registerRegionEndpoints(app);
registerChatEndpoints(app);
registerFileUploadEndpoints(app);
registerSubscriptionEndpoints(app);
registerSubscriptionBookingEndpoints(app); // POST /subscriptions/check-coverage, /subscriptions/create-booking
registerInsuranceEndpoints(app);
registerTrainingProgressEndpoints(app);
registerPackageBookingEndpoints(app);
registerWalkerGPSEndpoints(app);
registerPromotionEndpoints(app);
registerEventEndpoints(app);
registerHealthEndpoints(app);
registerDonationEndpoints(app);
registerReportEndpoints(app);
registerAdminVendorDailyAccrualEndpoints(app);
registerAdminVendorBookingEarningsEndpoints(app);
// registerAddressEndpoints already registered above before parameterized routes
registerAdminIntegrationEndpoints(app);
registerLogisticsEndpoints(app);
registerLogisticsWebhookEndpoints(app); // Webhooks: shiprocket, delhivery, dunzo (not Pidge — Java delivery-service owns POST /webhooks/pidge), auto-create-shipment, …
registerReturnsEndpoints(app);
registerOrderManagementEndpoints(app);
registerEnhancedOtpEndpoints(app);
registerSmsNotificationEndpoints(app);
// Platform legal policies: GET /vendor/policies, /public/policies, admin CRUD.
// Must register BEFORE registerVendorProfileEndpoints — that module ends with GET /vendor/:vendorId,
// which otherwise matches /vendor/policies (vendorId = "policies") and returns no policies[].
app.route('/', platformPoliciesApp);
registerVendorProfilePasswordLiterals(app);
registerVendorProfileEndpoints(app);
// registerCustomerProfileEndpoints already registered above before parameterized routes
registerSystemHealthEndpoints(app);
registerConfigPoliciesEndpoints(app); // /config/policies, /config/logistics-rules (GET /config/fees → fee-config.ts)
registerVendorSettingsEndpoints(app);
registerVendorPoliciesEndpoints(app);
registerVendorBookingsEndpoints(app);
registerVendorWapptAppointmentsEndpoints(app);
registerVendorWpayPaymentsEndpoints(app);
registerVendorWpayBillImageEndpoints(app);
// registerVendorDashboardEnhancedEndpoints already registered above (before legacy dashboard)
registerAppointmentReminderEndpoints(app);
registerPetVaccinationReminderEndpoints(app);
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
registerBookingEndpointsEnhanced(app); // Moved here to test route order (after refund-policy which works)
registerBookingOTPEndpoint(app); // Booking OTP generation for home/center services
registerAdminGovernanceEnhancedEndpoints(app);
registerNotificationCampaignEndpoints(app);
registerAdminNotificationDeliveryEndpoints(app);
registerAdminMealLogisticsEndpoints(app);
registerAdminAdvancedEndpoints(app);
registerDiscoveryRulesAdminEndpoints(app);
// registerVendorSetupEndpoints moved above (before vendor-services) to fix route ordering
// registerCustomerAppointmentsEndpoints registered before /customer/:customerId (see block after registerCustomerOrdersEndpoints)
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
registerLoyaltyActionSourcesManagementEndpoints(app);
registerWalletCheckoutRulesEndpoints(app);
registerCommunityEndpoints(app);
registerReferralEndpoints(app);
registerAdminReferralsEndpoints(app);
registerRewardsEndpoints(app);
registerAdminSellersEndpoints(app);
registerAIChatbotEndpoints(app);
registerAIBookingWizardSessionEndpoints(app);
registerSupportCrmEndpoints(app);
registerLocationSharingEndpoints(app);
registerVendorSecurityEndpoints(app);
registerVendorDistancePricingEndpoints(app);
registerSchedulingPolicyEndpoints(app);
registerAdminComprehensiveEndpoints(app);
registerProblemGridEndpoints(app);
registerVendorDashboardMissingEndpoints(app);
registerUIDashboardConfigEndpoints(app); // UI Dashboard Configuration (Marketing > Dashboard UI) - LEGACY, kept for backward compatibility
registerServiceLaunchConfigEndpoints(app); // Service Launch Config by Geography (Marketing > Dashboard UI) - NEW
registerCommerceSwitchEndpoints(app); // Platform Commerce Switch (active commerce model)
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
registerTrackingWebhookEndpoints(app); // AfterShip webhooks for vendor-managed shipping
registerTaxInvoicePdfEndpoints(app); // GST tax invoice PDF generation
registerPlatformTaxEndpoints(app); // WarmPawz → vendor platform tax documents
registerReviewsEnhancedEndpoints(app); // Enhanced booking reviews
registerReturnsEnhancedEndpoints(app); // Complete return/refund management
registerFeeConfigEndpoints(app); // Platform and convenience fee configuration
registerKYCVerificationEndpoints(app); // KYC verification (Aadhaar OTP, PAN, GST)
registerSpecializationMasterEndpoints(app); // Specialization master (problem grid, vendor specializations)

// 404 handler - CRITICAL: Must include CORS headers
app.notFound((c) => {
  const origin = c.req.header('origin') || c.req.header('Origin') || '';
  const allowedOrigin = getAllowedOrigin(origin);
  const headers: Record<string, string> = {
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
    'access-control-allow-headers': CORS_ALLOW_HEADERS_BASE,
  };
  if (allowedOrigin) {
    headers['access-control-allow-origin'] = allowedOrigin;
    headers['access-control-allow-credentials'] = 'true';
  }
  return c.json({ error: 'Not Found' }, 404, headers);
});

// Error handler with CloudWatch tracking (Stage 1: sanitize all client bodies)
app.onError((err, c) => {
  // Never trust raw inbound x-request-id; prefer validated context or resolveCorrelationId.
  const requestId = resolveRequestIdForError(c);
  const requestPath = c.req.path || (c.req as any).rawPath || c.req.url || '';

  // Single internal diagnostic capture (includes stack for authorized logs)
  const tracked =
    err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error');
  captureException(tracked, {
    requestId,
    path: requestPath,
    method: c.req.method,
    errorType: err?.constructor?.name || 'Error',
    sanitizedLogMessage: redactSecretsForLog(tracked.message || ''),
  });

  if (process.env.DEBUG === 'true') {
    secureLog('error', '[Hono Error Handler] Error caught (sanitized client path)', {
      path: requestPath,
      method: c.req.method,
      requestId,
      errorType: err?.constructor?.name,
      message: redactSecretsForLog(tracked.message || '').substring(0, 200),
    });
  }

  const origin = c.req.header('origin') || c.req.header('Origin') || '';
  const allowedOrigin = getAllowedOrigin(origin);
  const corsHeaders: Record<string, string> = {
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
    'access-control-allow-headers': CORS_ALLOW_HEADERS_BASE,
  };
  if (allowedOrigin) {
    corsHeaders['access-control-allow-origin'] = allowedOrigin;
    corsHeaders['access-control-allow-credentials'] = 'true';
  }
  if (requestId && requestId !== 'unknown') {
    corsHeaders['x-request-id'] = requestId;
  }

  let searchQuery = '';
  try {
    searchQuery = (c.req as any).query?.('q') || '';
  } catch {
    searchQuery = '';
  }

  const mapped = mapHonoThrownErrorToClientResponse(err, requestPath, {
    method: c.req.method,
    searchQuery,
  });

  // Status cast: Hono ContentfulStatusCode accepts our mapped statuses
  return c.json(mapped.body, mapped.status as any, corsHeaders);
});

/**
 * Main Lambda handler
 */
const CORS_PREFLIGHT_200 = (origin: string): APIGatewayProxyResultV2 => ({
  statusCode: 200,
  body: '',
  headers: {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
    'access-control-allow-headers': CORS_ALLOW_HEADERS_BASE,
    'access-control-allow-credentials': 'true',
    'access-control-max-age': '86400',
    'content-length': '0',
  },
});

/**
 * When API Gateway / CloudFront maps `/prefix/*` to this Lambda, `rawPath` still includes the prefix.
 * Hono routes are registered without that prefix — set `API_HTTP_PATH_PREFIX` (e.g. `/uat` or `/api`) to strip it.
 */
/**
 * Returns true when the Lambda response payload should be **base64-encoded** in
 * the API Gateway response (set `isBase64Encoded: true`). Stringifying these
 * bytes via `response.text()` corrupts the file (e.g. XLSX → "File could not
 * open" in Google Sheets, mangled PDFs, broken images).
 *
 * Detection is conservative — anything with a binary-leaning content type *or*
 * a `Content-Disposition: attachment` header is treated as binary.
 */
function isBinaryHttpContentType(
  contentTypeLower: string,
  contentDispositionLower: string
): boolean {
  if (contentDispositionLower.includes('attachment')) return true;
  if (!contentTypeLower) return false;
  // Fast path: explicit text/JSON/XML/form types are never binary.
  if (
    contentTypeLower.startsWith('text/') ||
    contentTypeLower.startsWith('application/json') ||
    contentTypeLower.startsWith('application/xml') ||
    contentTypeLower.startsWith('application/javascript') ||
    contentTypeLower.startsWith('application/x-www-form-urlencoded') ||
    contentTypeLower.startsWith('application/ld+json') ||
    contentTypeLower.endsWith('+json') ||
    contentTypeLower.endsWith('+xml')
  ) {
    return false;
  }
  // Common binary families.
  if (
    contentTypeLower.startsWith('image/') ||
    contentTypeLower.startsWith('video/') ||
    contentTypeLower.startsWith('audio/') ||
    contentTypeLower.startsWith('font/') ||
    contentTypeLower.startsWith('multipart/') ||
    contentTypeLower.startsWith('application/octet-stream') ||
    contentTypeLower.startsWith('application/pdf') ||
    contentTypeLower.startsWith('application/zip') ||
    contentTypeLower.startsWith('application/x-zip') ||
    contentTypeLower.startsWith('application/gzip') ||
    contentTypeLower.startsWith('application/x-gzip') ||
    contentTypeLower.startsWith('application/x-tar') ||
    contentTypeLower.startsWith('application/x-7z-compressed') ||
    contentTypeLower.startsWith('application/vnd.ms-') ||
    contentTypeLower.startsWith('application/vnd.openxmlformats-') ||
    contentTypeLower.startsWith('application/vnd.oasis.opendocument.') ||
    contentTypeLower.startsWith('application/msword')
  ) {
    return true;
  }
  return false;
}

function applyHttpPathPrefixMapping(path: string): string {
  const p0 = path && path.startsWith('/') ? path : `/${path || ''}`;
  const prefix = (process.env.API_HTTP_PATH_PREFIX || '').trim();
  if (!prefix) return p0;
  const norm = prefix.startsWith('/') ? prefix : `/${prefix}`;
  if (p0 === norm) return '/';
  if (p0.startsWith(`${norm}/`)) {
    const rest = p0.slice(norm.length) || '/';
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return p0;
}

export const handler = async (
  event: APIGatewayProxyEventV2 | Record<string, unknown>,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  // ✅ CRITICAL CORS FIX: Wrap entire handler in try-catch to ensure OPTIONS always returns 200
  try {
    // Async campaign delivery job (Lambda.invoke Event) — no API Gateway, no EventBridge cron.
    if (
      event &&
      typeof event === 'object' &&
      ((event as { job?: string }).job === 'drive-image-ingest' ||
        (event as { job?: string }).job === 'drive-image-ingest-backfill')
    ) {
      try {
        const {
          isDriveImageIngestJobEvent,
          isDriveImageIngestBackfillEvent,
        } = await import('../utils/drive-image-ingest-invoke');
        const {
          processDriveImageIngestJob,
          processDriveImageIngestBackfillJob,
        } = await import('../utils/drive-image-ingest-worker');
        if (isDriveImageIngestBackfillEvent(event)) {
          const result = await processDriveImageIngestBackfillJob(event);
          return { statusCode: 200, body: JSON.stringify({ ok: true, job: 'drive-image-ingest-backfill', ...result }) };
        }
        if (isDriveImageIngestJobEvent(event)) {
          await processDriveImageIngestJob(event);
          return { statusCode: 200, body: JSON.stringify({ ok: true, job: 'drive-image-ingest' }) };
        }
        return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid drive ingest event' }) };
      } catch (jobErr) {
        secureLogError('[HANDLER] drive image ingest job failed', jobErr, {
          requestId: context.awsRequestId,
        });
        return {
          statusCode: 500,
          body: JSON.stringify({
            ok: false,
            error: jobErr instanceof Error ? jobErr.message : 'drive ingest job failed',
          }),
        };
      }
    }

    if (
      event &&
      typeof event === 'object' &&
      (event as { job?: string }).job === 'notification-campaign-delivery' &&
      typeof (event as { campaignId?: string }).campaignId === 'string'
    ) {
      try {
        const { processCampaignDeliveryJob } = await import('../utils/notification-campaign-worker');
        await processCampaignDeliveryJob(
          event as { job: 'notification-campaign-delivery'; campaignId: string }
        );
        return { statusCode: 200, body: JSON.stringify({ ok: true, job: 'notification-campaign-delivery' }) };
      } catch (jobErr) {
        secureLogError('[HANDLER] campaign delivery job failed', jobErr, {
          requestId: context.awsRequestId,
        });
        return {
          statusCode: 500,
          body: JSON.stringify({
            ok: false,
            error: jobErr instanceof Error ? jobErr.message : 'campaign job failed',
          }),
        };
      }
    }

    // ✅ CRITICAL CORS FIX: Handle OPTIONS requests FIRST, before ANY other code
    // This MUST be the absolute first thing - even before null checks
    // Self-contained OPTIONS handler that doesn't depend on any other functions
    
    // Check for OPTIONS method or preflight headers (handle null/undefined event safely)
    let isOptions = false;
    try {
      const httpMethod = (event as APIGatewayProxyEventV2)?.requestContext?.http?.method || 
                        (event as any)?.requestContext?.httpMethod || 
                        (event as any)?.httpMethod;
      isOptions = httpMethod === 'OPTIONS' || 
                 !!(event?.headers?.['access-control-request-method']) ||
                 !!(event?.headers?.['Access-Control-Request-Method']);
    } catch {
      // If we can't read the method, check for preflight headers
      try {
        isOptions = !!(event?.headers?.['access-control-request-method']) ||
                   !!(event?.headers?.['Access-Control-Request-Method']);
      } catch {
        // If event is completely malformed, assume it might be OPTIONS and return 200
        isOptions = true;
      }
    }
  
  if (isOptions) {
    try {
      const origin =
        event?.headers?.origin ||
        event?.headers?.Origin ||
        event?.headers?.['origin'] ||
        event?.headers?.['Origin'] ||
        '';

      const allowedOrigin = getAllowedOrigin(origin);
      const requestedHeaders =
        event?.headers?.['access-control-request-headers'] ||
        event?.headers?.['Access-Control-Request-Headers'] ||
        '';

      return {
        statusCode: 200,
        body: '',
        headers: corsPreflightResponseHeaders(allowedOrigin, requestedHeaders),
      };
    } catch (optionsError) {
      // CRITICAL: Even on ANY error, return 200 OK for CORS preflight
      // Browsers will reject non-200 responses for OPTIONS requests
      secureLogError('[HANDLER] Error in OPTIONS handler, but returning 200 OK', optionsError, {
        requestId: context.awsRequestId,
      });
      return {
        statusCode: 200,
        body: '',
        headers: corsPreflightResponseHeaders(getDefaultCorsOrigin(), ''),
      };
    }
  }
  
  // ✅ Guard: malformed or missing event (e.g. direct invoke) → return 200 CORS so callers don't get 5xx
  if (!event || typeof event !== 'object') {
    return {
      statusCode: 200,
      body: '',
      headers: corsPreflightResponseHeaders(getDefaultCorsOrigin(), ''),
    };
  }
  
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
    
    // Get HTTP method (OPTIONS already handled at the beginning of handler)
    const httpMethod = event.requestContext?.http?.method || 
                      (event as any).requestContext?.httpMethod || 
                      (event as any).httpMethod ||
                      'GET';

    // Convert API Gateway HTTP API (v2) event to Request
    // domainName is only present when using custom domains
    // For default endpoints, construct from apiId or use relative URL
    const rawPath = applyHttpPathPrefixMapping(
      event.rawPath || event.requestContext?.http?.path || '/'
    );
    const queryString = event.rawQueryString ? `?${event.rawQueryString}` : '';
    
    // Try to get domainName from requestContext (custom domain) or construct from apiId
    let domainName = event.requestContext?.domainName;
    if (!domainName) {
      // For default API Gateway endpoints, construct from apiId and region
      const apiId = event.requestContext?.apiId;
      if (apiId) {
        const region = process.env.AWS_REGION || 'ap-south-1';
        domainName = `${apiId}.execute-api.${region}.amazonaws.com`;
        // ✅ PRODUCTION: Log API Gateway ID for verification
        if (process.env.ENVIRONMENT === 'prod' && apiId === 'mss9sa4y01') {
          console.log('[API-GATEWAY] Using production API Gateway:', domainName);
        }
      } else {
        // ✅ PRODUCTION FIX: Use production API Gateway ID if in prod and apiId missing
        if (process.env.ENVIRONMENT === 'prod') {
          const region = process.env.AWS_REGION || 'ap-south-1';
          domainName = `mss9sa4y01.execute-api.${region}.amazonaws.com`;
          console.log('[API-GATEWAY] Production fallback: Using hardcoded API Gateway ID');
        } else {
          // Fallback: use a placeholder if apiId is also missing (shouldn't happen)
          domainName = 'api.warmpawz.com';
        }
      }
    }
    
    const url = `https://${domainName}${rawPath}${queryString}`;

    const headers = new Headers();
    if (event.headers) {
      Object.entries(event.headers).forEach(([key, value]) => {
        if (value !== undefined) headers.append(key, value);
      });
    }
    
    // Handle body based on content type
    const contentType = headers.get('content-type') || '';
    const isMultipartFormData = contentType.includes('multipart/form-data');
    const isJson =
      contentType.includes('application/json') ||
      contentType.includes('+json');
    
    // For multipart/form-data, we need to preserve binary data
    // For JSON, we can parse it
    // For other types, pass as-is
    let requestBody: string | ArrayBuffer | undefined = undefined;
    let parsedBody: Record<string, unknown> | null = null;
    
    if (event.body) {
      if (event.isBase64Encoded) {
        // Decode base64 body
        const decoded = Buffer.from(event.body, 'base64');
        
        if (isMultipartFormData) {
          // For multipart/form-data, pass as ArrayBuffer to preserve binary data
          requestBody = decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength);
        } else if (isJson) {
          // For JSON, convert to string and parse
          requestBody = decoded.toString('utf-8');
          try {
            parsedBody = JSON.parse(requestBody) as Record<string, unknown>;
          } catch (e) {
            // Not valid JSON, pass as string
            parsedBody = null;
          }
        } else {
          // For other content types, convert to string
          requestBody = decoded.toString('utf-8');
        }
      } else {
        // Body is not base64 encoded
        if (isJson) {
          requestBody = event.body;
          try {
            parsedBody = JSON.parse(requestBody) as Record<string, unknown>;
          } catch (e) {
            // Not valid JSON, pass as string
            parsedBody = null;
          }
        } else {
          requestBody = event.body;
        }
      }
    }

    // Clients / proxies sometimes omit or vary Content-Type; still parse JSON object bodies for `c.env.parsedBody`.
    if (
      !isMultipartFormData &&
      parsedBody === null &&
      typeof requestBody === 'string' &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpMethod)
    ) {
      const lead = requestBody.trim().charAt(0);
      if (lead === '{') {
        try {
          const obj = JSON.parse(requestBody) as unknown;
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            parsedBody = obj as Record<string, unknown>;
          }
        } catch {
          /* leave null */
        }
      }
    }
    
    // Only set default Content-Type for JSON if not already set
    if (requestBody && !headers.has('content-type') && !isMultipartFormData) {
      headers.append('content-type', 'application/json');
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
      secureLogError('[HANDLER] Error processing request', error, {
        requestId: context.awsRequestId,
      });
      throw error;
    }

    // Convert Response to API Gateway format.
    //
    // CRITICAL: API Gateway HTTP API requires binary responses (xlsx, pdf, zip,
    // images, octet-stream …) to be **base64-encoded** with `isBase64Encoded: true`.
    // Returning the body as a plain UTF-8 string corrupts non-text bytes, which
    // is exactly why the bulk-product XLSX failed to open in Google Sheets even
    // after the file-format fixes — the wire-level payload was mangled.
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value: string, key: string) => {
      responseHeaders[key] = value;
    });

    const respContentType = (responseHeaders['content-type'] || '').toLowerCase();
    const respDisposition = (responseHeaders['content-disposition'] || '').toLowerCase();
    const isBinaryResponse = isBinaryHttpContentType(respContentType, respDisposition);

    let responseBody: string;
    let isBase64Encoded = false;
    if (isBinaryResponse) {
      const ab = await response.arrayBuffer();
      responseBody = Buffer.from(ab).toString('base64');
      isBase64Encoded = true;
    } else {
      responseBody = await response.text();
    }

    // Ensure CORS headers are present in all responses
    const origin = event.headers?.origin || 
                   event.headers?.Origin ||
                   event.headers?.['origin'] ||
                   event.headers?.['Origin'];
    
    // Check if Hono CORS middleware already set CORS headers
    const hasCorsHeaders = responseHeaders['access-control-allow-origin'] || responseHeaders['access-control-allow-origin'];
    
    // Merge CORS headers with response headers
    // Only set CORS headers if Hono didn't already set them (prevents duplicates)
    const finalHeaders: Record<string, string> = { ...responseHeaders };
    
    if (!hasCorsHeaders) {
      Object.assign(finalHeaders, apiGwCorsHeadersForResponse(origin));
    }
    
    const finalResponse: APIGatewayProxyResultV2 = {
      statusCode: response.status,
      body: responseBody,
      headers: finalHeaders,
      ...(isBase64Encoded ? { isBase64Encoded: true } : {}),
    };
    return finalResponse;
  } catch (error) {
    secureLogError('Lambda handler error', error, {
      requestId: context.awsRequestId,
    });
    
    // ✅ CRITICAL FIX: If this is an OPTIONS request, always return 200 OK for CORS
    const httpMethod = event.requestContext?.http?.method || 
                      (event as any).requestContext?.httpMethod || 
                      (event as any).httpMethod ||
                      'GET';
    
    if (httpMethod === 'OPTIONS') {
      secureLogError('[OPTIONS] Error in handler, but returning 200 OK for CORS preflight', error, {
        requestId: context.awsRequestId,
      });
      const origin = event.headers?.origin || 
                     event.headers?.Origin || 
                     event.headers?.['origin'] ||
                     event.headers?.['Origin'] ||
                     '';
      
      return {
        statusCode: 200,
        body: '',
        headers: corsPreflightResponseHeaders(getAllowedOrigin(origin), ''),
      };
    }
    
    // Continue with normal error handling for non-OPTIONS requests
    // Capture error in error tracking
    captureException(error instanceof Error ? error : new Error(String(error)), {
      requestId: context.awsRequestId,
      path: event?.rawPath,
      method: event?.requestContext?.http?.method,
      apiId: event?.requestContext?.apiId,
    });
    
    // Ensure CORS headers in error responses too
    const origin = event?.headers?.origin || 
                   event?.headers?.Origin || 
                   event?.headers?.['origin'] ||
                   event?.headers?.['Origin'] ||
                   '';
    const allowedOrigin = getAllowedOrigin(origin);
    
    // Ensure CORS headers in error responses (Hono middleware won't run for errors)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: {
        'Content-Type': 'application/json',
        ...apiGwCorsHeadersForResponse(origin),
      },
    };
  }
} catch (outerError) {
    // ✅ CRITICAL: Outer catch for the entire handler - ensure OPTIONS always returns 200
    try {
      const httpMethod = event?.requestContext?.http?.method || 
                        (event as any)?.requestContext?.httpMethod || 
                        (event as any)?.httpMethod;
      const hasPreflight = !!(event?.headers?.['access-control-request-method']) ||
                          !!(event?.headers?.['Access-Control-Request-Method']);
      
      if (httpMethod === 'OPTIONS' || hasPreflight) {
        secureLogError('[HANDLER] Outer error, but returning 200 OK for OPTIONS', outerError, {
          requestId: context?.awsRequestId,
        });
        return {
          statusCode: 200,
          body: '',
          headers: corsPreflightResponseHeaders(getDefaultCorsOrigin(), ''),
        };
      }
    } catch {
      // If we can't check, assume OPTIONS and return 200
      return {
        statusCode: 200,
        body: '',
        headers: corsPreflightResponseHeaders(getDefaultCorsOrigin(), ''),
      };
    }
    
    // For non-OPTIONS errors, return 500 with CORS
    secureLogError('[HANDLER] Unhandled outer error', outerError, {
      requestId: context?.awsRequestId,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: {
        'Content-Type': 'application/json',
        ...apiGwCorsHeadersForResponse(undefined),
      },
    };
  }
};
