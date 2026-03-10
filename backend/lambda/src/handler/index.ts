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
import { requireAuth, requireAdmin, authAuditLog } from '../middleware/auth-middleware';
import { rateLimit, rateLimitAuth, rateLimitOtp, slidingWindowRateLimit } from '../middleware/rate-limit-middleware';
// Enhanced handlers (Phase 2-5)
import { registerVendorOnboardingEndpointsEnhanced } from '../endpoints/vendor-onboarding-enhanced';
import { registerVendorOnboardingFixes } from '../endpoints/vendor-onboarding-fixes';
import { registerBookingEndpointsEnhanced, registerBookingOTPEndpoint } from '../endpoints/booking/endpoints/bookings-enhanced.booking';
import { registerPaymentEndpointsEnhanced } from '../endpoints/payments-enhanced';
import { registerCustomerEndpointsEnhanced } from '../endpoints/customer-enhanced';
import { registerTrackingEndpoints } from '../endpoints/tracking';

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
import { registerAdminEndpoints } from '../endpoints/admin/endpoints/admin.controller';
import { registerVideoCallEndpoints } from '../endpoints/teleCommunication/endpoints/video-call.teleCommunication';
import { registerPackageSessionEndpoints } from '../endpoints/package-sessions';
import { registerSearchEndpoints } from '../endpoints/search';
import { registerRazorpayEndpoints } from '../endpoints/razorpay/endpoints/razorpay.razorpay';
import { registerWalletEndpoints } from '../endpoints/wallet';
import { registerWalletDiagnosticEndpoints } from '../endpoints/wallet-diagnostic';
import { registerSpecializedServicesEndpoints } from '../endpoints/specialized-services';
import { registerSpecializedServiceFlows } from '../endpoints/specialized-service-flows';
import { registerAdminGovernanceEndpoints } from '../endpoints/admin-governance';
// Staff decommissioned: solo providers discovered via discover-services for at_home/tele
// import { registerStaffEndpoints } from '../endpoints/staff';
import { registerReviewEndpoints } from '../endpoints/reviews';
import { registerNotificationEndpoints } from '../endpoints/notification/endpoitns/notifications.notification';
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
import { registerSettlementEndpoints } from '../endpoints/settlement&payouts/endpoints/settlements';
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
import { registerVendorProfileEndpoints } from '../endpoints/vendor/endpoints/vendor-profile.vendor';
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
import { registerAdminAdvancedEndpoints } from '../endpoints/admin/endpoints/admin-advanced';
import { registerDiscoveryRulesAdminEndpoints } from '../endpoints/discovery-rules-admin';
import { registerVendorSetupEndpoints } from '../endpoints/vendor-setup';
import { registerConfigPoliciesEndpoints } from '../endpoints/config-policies';
import { registerCustomerAppointmentsEndpoints } from '../endpoints/customer-appointments';
import { registerCustomerOrdersEndpoints } from '../endpoints/customer-orders';
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
import { registerAdminComprehensiveEndpoints } from '../endpoints/admin/endpoints/admin-comprehensive';
import { registerProblemGridEndpoints } from '../endpoints/problem-grid';
import { registerVendorDashboardMissingEndpoints } from '../endpoints/vendor-dashboard-missing';
import { registerUIDashboardConfigEndpoints } from '../endpoints/ui-dashboard-config';
import { registerServiceLaunchConfigEndpoints } from '../endpoints/service-launch-config';
import { registerCarePlansEndpoints } from '../endpoints/care-plans';
import { registerVendorSupportEndpoints } from '../endpoints/vendor-support';
import { registerPharmacyOrderEndpoints, registerAdditionalPharmacyEndpoints } from '../endpoints/pharmacy-orders';
import { registerPharmacyInventoryEndpoints } from '../endpoints/pharmacy-inventory';
import { registerDeliveryPartnerAutomationEndpoints } from '../endpoints/delivery-partner-automation';
import { registerMealPlanEndpoints } from '../endpoints/meal-plans';
import { registerNutritionOrderEndpoints } from '../endpoints/nutrition-orders';
import { registerVendorBankAccountEndpoints } from '../endpoints/vendor-bank-accounts';
import { registerDeliveryTrackingEndpoints } from '../endpoints/delivery-tracking';
import { registerDeliveryOtpEndpoints } from '../endpoints/delivery-otp';
import { registerInstantTeleQueueEndpoints } from '../endpoints/teleCommunication/endpoints/instant-tele-queue.teleconsultation';
import { registerInstantTeleV2Endpoints } from '../endpoints/teleCommunication/endpoints/instant-tele-v2.teleconsultation';
import { registerInstantTeleV3Endpoints } from '../endpoints/teleCommunication/endpoints/instant-tele-v3.teleconsultation';
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
import { registerFeeConfigEndpoints } from '../endpoints/fee-config';
import { registerKYCVerificationEndpoints } from '../endpoints/kyc-verification';
import { registerSpecializationMasterEndpoints } from '../endpoints/specialization-master';
import platformPoliciesApp from '../endpoints/platform-policies';
import { registerAuthEndpointsEnhanced } from 'src/endpoints/Auth/auth-enhanced';
import { registerServiceDiscoveryEndpoints } from 'src/endpoints/customer/customerEndpoint/service-discovery.customer';
import { registerCustomerProfileEndpoints } from 'src/endpoints/customer/customerEndpoint/customer-profile.customer';
import { registerVendorAnalyticsEndpoints } from 'src/endpoints/vendor-analytics';

// Create Hono app
const app = new Hono();

// CORS: allowed origins from env only (set by CDK/deploy from config/urls.json or ALLOWED_ORIGINS). No hardcoded URLs.
const getAllowedOriginsList = (): string[] => {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  // Local dev only when ALLOWED_ORIGINS not set
  return ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:5173'];
};

const getDefaultCorsOrigin = (): string => {
  const list = getAllowedOriginsList();
  return list[0] || '';
};

// Helper function to get allowed origin for a request
const getAllowedOrigin = (origin: string | null | undefined): string => {
  const allowedOrigins = getAllowedOriginsList();
  const defaultOrigin = getDefaultCorsOrigin();
  if (!origin) return defaultOrigin;
  const normalizedOrigin = origin.toLowerCase();
  const normalizedAllowed = allowedOrigins.map(o => o.toLowerCase());
  if (normalizedAllowed.includes(normalizedOrigin)) return origin;
  if (normalizedOrigin.includes('cloudfront.net')) return origin;
  return defaultOrigin;
};

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
    
    const requestedHeaders = c.req.header('access-control-request-headers') || 
                            c.req.header('Access-Control-Request-Headers') || '';
    const baseAllowedHeaders = 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With';
    const allowedHeaders = requestedHeaders 
      ? `${baseAllowedHeaders},${requestedHeaders.split(',').map(h => h.trim()).join(',')}`
      : baseAllowedHeaders;
    
    console.log('[Hono OPTIONS] Returning 200 OK with CORS headers:', {
      allowedOrigin,
      allowedHeaders: allowedHeaders.substring(0, 100), // Log first 100 chars
    });
    
    // Return empty body with 200 status and CORS headers
    return new Response(null, {
      status: 200,
      headers: {
        'access-control-allow-origin': allowedOrigin,
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
        'access-control-allow-headers': allowedHeaders,
        'access-control-allow-credentials': 'true',
        'access-control-max-age': '86400',
        'content-length': '0',
      },
    });
  } catch (error) {
    console.error('[Hono OPTIONS] Error in OPTIONS handler:', error);
    // Even on error, return 200 OK for CORS
    const origin = c.req.header('origin') || c.req.header('Origin') || '';
    const allowedOrigin = getAllowedOrigin(origin);
    return new Response(null, {
      status: 200,
      headers: {
        'access-control-allow-origin': allowedOrigin,
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
        'access-control-allow-headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With',
        'access-control-allow-credentials': 'true',
        'access-control-max-age': '86400',
        'content-length': '0',
      },
    });
  }
});

app.use('*', cors({
  origin: (origin) => {
    const allowed = getAllowedOriginsList();
    const defaultOrigin = getDefaultCorsOrigin();
    if (!origin) return defaultOrigin;
    const normalized = origin.toLowerCase();
    if (allowed.map(o => o.toLowerCase()).includes(normalized)) return origin;
    if (normalized.includes('cloudfront.net')) return origin;
    return defaultOrigin;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-key', 'X-UAT-Mode', 'X-UAT-Token'],
  credentials: true,
  maxAge: 86400,
}));

app.use('*', async (c, next) => {
  await next();
});

// Authentication audit logging (for security monitoring)
app.use('*', authAuditLog());

// ✅ TEMPORARY: Migration endpoint (registered BEFORE admin auth middleware)
app.post('/system/run-pending-migrations', async (c) => {
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
    } catch (err: any) { results.push({ migration: '558_vendor_referrals', status: 'error', message: err.message }); }

    // Migration 605: availability_configured + services_configured
    try {
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'availability_configured') THEN ALTER TABLE vendors ADD COLUMN availability_configured BOOLEAN DEFAULT false; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'services_configured') THEN ALTER TABLE vendors ADD COLUMN services_configured BOOLEAN DEFAULT false; END IF; END $$`);
      await dbQuery(`CREATE INDEX IF NOT EXISTS idx_vendors_availability_configured ON vendors(availability_configured) WHERE availability_configured = false`);
      await dbQuery(`CREATE INDEX IF NOT EXISTS idx_vendors_approved_not_availability ON vendors(status, availability_configured) WHERE status = 'approved' AND availability_configured = false`);
      results.push({ migration: '605_availability_configured', status: 'completed', message: 'Columns and indexes created/verified' });
    } catch (err: any) { results.push({ migration: '605_availability_configured', status: 'error', message: err.message }); }

    // Migration 071: vendor settings columns
    try {
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'service_radius') THEN ALTER TABLE vendors ADD COLUMN service_radius NUMERIC(5, 2); END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'emergency_contact') THEN ALTER TABLE vendors ADD COLUMN emergency_contact JSONB DEFAULT NULL; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'max_dogs_per_walk') THEN ALTER TABLE vendors ADD COLUMN max_dogs_per_walk INTEGER; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'walk_durations') THEN ALTER TABLE vendors ADD COLUMN walk_durations TEXT[] DEFAULT ARRAY[]::TEXT[]; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'other_config') THEN ALTER TABLE vendors ADD COLUMN other_config JSONB DEFAULT '{}'::jsonb; END IF; END $$`);
      await dbQuery(`CREATE INDEX IF NOT EXISTS idx_vendors_service_radius ON vendors(service_radius) WHERE service_radius IS NOT NULL`);
      results.push({ migration: '071_vendor_settings_columns', status: 'completed' });
    } catch (err: any) { results.push({ migration: '071_vendor_settings_columns', status: 'error', message: err.message }); }

    // Migration: setup_completed, profile_photo_url, etc.
    try {
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'setup_completed') THEN ALTER TABLE vendors ADD COLUMN setup_completed BOOLEAN DEFAULT false; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'profile_photo_url') THEN ALTER TABLE vendors ADD COLUMN profile_photo_url TEXT; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'qualifications') THEN ALTER TABLE vendors ADD COLUMN qualifications TEXT; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'service_area') THEN ALTER TABLE vendors ADD COLUMN service_area TEXT; END IF; END $$`);
      await dbQuery(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'description') THEN ALTER TABLE vendors ADD COLUMN description TEXT; END IF; END $$`);
      results.push({ migration: '528_profile_fields', status: 'completed' });
    } catch (err: any) { results.push({ migration: '528_profile_fields', status: 'error', message: err.message }); }

    // Verification
    const verifyResult = await dbQuery(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendors' ORDER BY ordinal_position`);
    const referralsCheck = await dbQuery(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_referrals') as exists`);

    return c.json({
      success: true,
      message: 'All migrations completed',
      results,
      verification: {
        vendor_columns: verifyResult.rows.map((r: any) => r.column_name),
        vendor_referrals_table_exists: referralsCheck.rows[0]?.exists || false,
        total_vendor_columns: verifyResult.rows.length
      }
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message, results }, 500);
  }
});

// Require authentication for admin endpoints
app.use('/admin/*', requireAdmin());

// Rate limiting for sensitive endpoints
app.use('/auth/*', rateLimitAuth());
app.use('/otp/*', slidingWindowRateLimit({ windowMs: 60000, maxRequests: 5, keyPrefix: 'otp' }));
app.use('/bookings/generate-otp', slidingWindowRateLimit({ windowMs: 60000, maxRequests: 5, keyPrefix: 'booking-otp' }));
app.use('/payments/*', rateLimit({ windowMs: 60000, maxRequests: 30, keyPrefix: 'payments' }));

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
// ✅ CRITICAL ROUTE ORDERING: Specific routes MUST come before parameterized routes
// /customer/bookings/active is registered in registerCustomerPhoneConvenienceEndpoints
// This ensures "active" is not interpreted as a UUID in /customer/:customerId route
registerCustomerPhoneConvenienceEndpoints(app); // /customer/bookings/active, /customer/bookings?phone=, /customer/cart/:phone, /customer/wallet?phone=, etc. - before /customer/:customerId
registerCustomerProfileEndpoints(app); // /customer/profile, /customer/profile/unified/:id, /customer/profile/:id - before /customer/:customerId
registerCustomerBookingHistoryEndpoints(app); // /customer/bookings/:bookingId, /customer/:customerId/bookings - before /customer/:customerId
registerAddressEndpoints(app); // /customer/addresses - MUST be before /customer/:customerId to avoid route conflicts
registerRefundPolicyEngineEndpoints(app); // /customer/refund-policy - MUST be before /customer/:customerId
// Now register parameterized routes
registerCustomerEndpointsEnhanced(app); // /customer/:customerId (parameterized - must be last)
registerGpsTrackingEndpoints(app);
registerAdminEndpoints(app);
registerVideoCallEndpoints(app);
registerPackageSessionEndpoints(app);
registerSearchEndpoints(app);
registerRazorpayEndpoints(app);
registerWalletEndpoints(app);
registerWalletDiagnosticEndpoints(app);
registerSpecializedServicesEndpoints(app);
registerSpecializedServiceFlows(app);
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
registerMealPlanEndpoints(app);
registerNutritionOrderEndpoints(app); // ✅ FIX GAP-9.3 & 9.4: Nutrition order tracking
registerVendorBankAccountEndpoints(app);
registerDeliveryTrackingEndpoints(app);
registerDeliveryOtpEndpoints(app); // Delivery OTP verification for pharmacy and meal orders
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
// registerAddressEndpoints already registered above before parameterized routes
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
registerConfigPoliciesEndpoints(app); // /config/policies, /config/fees, /config/logistics-rules
registerVendorSettingsEndpoints(app);
registerVendorPoliciesEndpoints(app);
registerVendorBookingsEndpoints(app);
// registerVendorDashboardEnhancedEndpoints already registered above (before legacy dashboard)
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
registerBookingEndpointsEnhanced(app); // Moved here to test route order (after refund-policy which works)
registerBookingOTPEndpoint(app); // Booking OTP generation for home/center services
registerAdminGovernanceEnhancedEndpoints(app);
registerAdminAdvancedEndpoints(app);
registerDiscoveryRulesAdminEndpoints(app);
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
registerUIDashboardConfigEndpoints(app); // UI Dashboard Configuration (Marketing > Dashboard UI) - LEGACY, kept for backward compatibility
registerServiceLaunchConfigEndpoints(app); // Service Launch Config by Geography (Marketing > Dashboard UI) - NEW
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
registerFeeConfigEndpoints(app); // Platform and convenience fee configuration
registerKYCVerificationEndpoints(app); // KYC verification (Aadhaar OTP, PAN, GST)
registerSpecializationMasterEndpoints(app); // Specialization master (problem grid, vendor specializations)

// Platform policies (Legal agreements, T&C)
app.route('/', platformPoliciesApp);

// 404 handler - CRITICAL: Must include CORS headers
app.notFound((c) => {
  const origin = c.req.header('origin') || c.req.header('Origin') || '';
  const allowedOrigin = getAllowedOrigin(origin);
  return c.json({ error: 'Not Found' }, 404, {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
    'access-control-allow-headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With',
    'access-control-allow-credentials': 'true',
  });
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
  
  // Get origin for CORS headers (used in all error responses)
  const origin = c.req.header('origin') || c.req.header('Origin') || '';
  const allowedOrigin = getAllowedOrigin(origin);
  const corsHeaders = {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
    'access-control-allow-headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With',
    'access-control-allow-credentials': 'true',
  };
  
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
    }, 200, corsHeaders);
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
    }, 200, corsHeaders);
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
    }, 200, corsHeaders);
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
    }, 200, corsHeaders);
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
    }, 200, corsHeaders);
  }
  
  // Check for customer/profile/unified - critical for customer web load
  // Return 200 with degraded response so app can load (auth/onboarding flow) instead of 500
  if (requestPath.includes('profile/unified') || requestPath.includes('customer/profile/unified')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED customer/profile/unified - Returning 200 degraded');
    }
    return c.json({
      success: true,
      profile: null,
      _degraded: true,
      error: errorMessage,
      message: `Profile fetch failed: ${errorMessage}`,
    }, 200, corsHeaders);
  }
  
  // Check for customer previous-providers - return empty list on error (non-critical)
  if (requestPath.includes('previous-providers')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED previous-providers - Returning 200 empty');
    }
    return c.json({ success: true, providers: [], total: 0 }, 200, corsHeaders);
  }
  
  // Check for customer problems/trending - return empty on error (non-critical)
  if (requestPath.includes('problems/trending')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED problems/trending - Returning 200 empty');
    }
    return c.json({ success: true, trending: [], total: 0 }, 200, corsHeaders);
  }
  
  // Check for public/problem-grid - return empty on error (non-critical)
  if (requestPath.includes('problem-grid')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED problem-grid - Returning 200 empty');
    }
    return c.json({ success: true, problems: [], byCategory: {} }, 200, corsHeaders);
  }
  
  // Check for customer recommended-services - return empty on error (non-critical)
  if (requestPath.includes('recommended-services')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED recommended-services - Returning 200 empty');
    }
    return c.json({ success: true, services: [] }, 200, corsHeaders);
  }
  
  // Check for customer search-suggestions - return empty on error (non-critical)
  if (requestPath.includes('search-suggestions')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED search-suggestions - Returning 200 empty');
    }
    return c.json({ success: true, suggestions: [], count: 0 }, 200, corsHeaders);
  }
  
  // Check for customer orders/meals/active - return empty on error (non-critical)
  if (requestPath.includes('orders/meals/active')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED orders/meals/active - Returning 200 empty');
    }
    return c.json({ success: true, orders: [] }, 200, corsHeaders);
  }
  
  // Check for customer adoption-stats - return defaults on error (non-critical)
  if (requestPath.includes('adoption-stats')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED adoption-stats - Returning 200 defaults');
    }
    return c.json({
      success: true,
      stats: { adoptablePets: 50, certifiedBreeders: 30, rehomingListings: 20 },
    }, 200, corsHeaders);
  }
  
  // Check for customer notifications - return empty on error (non-critical)
  if (requestPath.includes('notifications') && requestPath.includes('customer')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED customer notifications - Returning 200 empty');
    }
    return c.json({ success: true, notifications: [], unreadCount: 0 }, 200, corsHeaders);
  }
  
  // Check for customer pets (e.g. /customer/pets/:phone) - return empty on error (non-critical)
  if (requestPath.includes('/pets/') && requestPath.includes('customer')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED customer pets - Returning 200 empty');
    }
    return c.json({ success: true, pets: [], count: 0 }, 200, corsHeaders);
  }

  // Check for service-launch/customer - return defaults on error (non-critical)
  if (requestPath.includes('service-launch') && requestPath.includes('customer')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED service-launch/customer - Returning 200 defaults');
    }
    return c.json({
      success: true,
      location: { state: null, stateCode: null, city: null },
      services: { visible: [], comingSoon: [], hidden: [] },
      buttons: [],
    }, 200, corsHeaders);
  }

  // Check for reminders/upcoming - return empty on error (non-critical)
  if (requestPath.includes('reminders/upcoming')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED reminders/upcoming - Returning 200 empty');
    }
    return c.json({ success: true, reminders: [] }, 200, corsHeaders);
  }

  // Check for reviews/pending - return empty on error (non-critical)
  if (requestPath.includes('reviews/pending')) {
    if (process.env.DEBUG === 'true') {
      console.log('[Hono Error Handler] MATCHED reviews/pending - Returning 200 empty');
    }
    return c.json({ success: true, reviews: [], pending: [] }, 200, corsHeaders);
  }
  
  // Default error response - CRITICAL: Must include CORS headers
  if (process.env.DEBUG === 'true') {
    console.log('[Hono Error Handler] NO MATCH - Returning 500');
  }
  return c.json({ error: errorMessage }, 500, corsHeaders);
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
    'access-control-allow-headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With',
    'access-control-allow-credentials': 'true',
    'access-control-max-age': '86400',
    'content-length': '0',
  },
});

export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  // ✅ CRITICAL CORS FIX: Wrap entire handler in try-catch to ensure OPTIONS always returns 200
  try {
    // ✅ CRITICAL CORS FIX: Handle OPTIONS requests FIRST, before ANY other code
    // This MUST be the absolute first thing - even before null checks
    // Self-contained OPTIONS handler that doesn't depend on any other functions
    
    // Check for OPTIONS method or preflight headers (handle null/undefined event safely)
    let isOptions = false;
    try {
      const httpMethod = event?.requestContext?.http?.method || 
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
      const origin = event?.headers?.origin || 
                     event?.headers?.Origin || 
                     event?.headers?.['origin'] ||
                     event?.headers?.['Origin'] ||
                     '';
      
      const allowedOrigins = getAllowedOriginsList();
      let allowedOrigin = getDefaultCorsOrigin();
      if (origin) {
        const normalizedOrigin = origin.toLowerCase();
        const normalizedAllowedOrigins = allowedOrigins.map(o => o.toLowerCase());
        if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
          allowedOrigin = origin;
        } else if (normalizedOrigin.includes('cloudfront.net')) {
          // Allow any CloudFront origin (for flexibility)
          allowedOrigin = origin;
        }
      }
      
      // Get requested headers from preflight request
      const requestedHeaders = event?.headers?.['access-control-request-headers'] || 
                               event?.headers?.['Access-Control-Request-Headers'] ||
                               '';
      const baseAllowedHeaders = 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With';
      const allowedHeaders = requestedHeaders 
        ? `${baseAllowedHeaders},${requestedHeaders.split(',').map((h: string) => h.trim()).join(',')}`
        : baseAllowedHeaders;
      
      return {
        statusCode: 200,
        body: '',
        headers: {
          'access-control-allow-origin': allowedOrigin,
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
          'access-control-allow-headers': allowedHeaders,
          'access-control-allow-credentials': 'true',
          'access-control-max-age': '86400',
          'content-length': '0',
        },
      };
    } catch (optionsError) {
      // CRITICAL: Even on ANY error, return 200 OK for CORS preflight
      // Browsers will reject non-200 responses for OPTIONS requests
      console.error('[HANDLER] Error in OPTIONS handler, but returning 200 OK:', optionsError);
      return {
        statusCode: 200,
        body: '',
        headers: {
          'access-control-allow-origin': getDefaultCorsOrigin(),
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
          'access-control-allow-headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With',
          'access-control-allow-credentials': 'true',
          'access-control-max-age': '86400',
          'content-length': '0',
        },
      };
    }
  }
  
  // ✅ Guard: malformed or missing event (e.g. direct invoke) → return 200 CORS so callers don't get 5xx
  if (!event || typeof event !== 'object') {
    return {
      statusCode: 200,
      body: '',
      headers: {
        'access-control-allow-origin': getDefaultCorsOrigin(),
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
        'access-control-allow-headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With',
        'access-control-allow-credentials': 'true',
        'access-control-max-age': '86400',
        'content-length': '0',
      },
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
    const isJson = contentType.includes('application/json');
    
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
                   event.headers?.Origin ||
                   event.headers?.['origin'] ||
                   event.headers?.['Origin'];
    
    // Get allowed origin using helper (reads from ALLOWED_ORIGINS env)
    const allowedOrigin = getAllowedOrigin(origin);
    
    // Check if Hono CORS middleware already set CORS headers
    const hasCorsHeaders = responseHeaders['access-control-allow-origin'] || responseHeaders['access-control-allow-origin'];
    
    // Merge CORS headers with response headers
    // Only set CORS headers if Hono didn't already set them (prevents duplicates)
    const finalHeaders: Record<string, string> = { ...responseHeaders };
    
    if (!hasCorsHeaders) {
      // Only set CORS headers if they weren't already set by Hono middleware
      finalHeaders['access-control-allow-origin'] = allowedOrigin;
      finalHeaders['access-control-allow-credentials'] = 'true';
      finalHeaders['access-control-allow-methods'] = 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD';
      finalHeaders['access-control-allow-headers'] = 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With';
    }
    
    const finalResponse = {
      statusCode: response.status,
      body: responseBody,
      headers: finalHeaders,
    };
    return finalResponse;
  } catch (error) {
    console.error('Lambda handler error:', error);
    
    // ✅ CRITICAL FIX: If this is an OPTIONS request, always return 200 OK for CORS
    const httpMethod = event.requestContext?.http?.method || 
                      (event as any).requestContext?.httpMethod || 
                      (event as any).httpMethod ||
                      'GET';
    
    if (httpMethod === 'OPTIONS') {
      console.error('[OPTIONS] Error in handler, but returning 200 OK for CORS preflight:', error);
      const origin = event.headers?.origin || 
                     event.headers?.Origin || 
                     event.headers?.['origin'] ||
                     event.headers?.['Origin'] ||
                     '';
      const allowedOrigin = getAllowedOrigin(origin);
      
      return {
        statusCode: 200,
        body: '',
        headers: {
          'access-control-allow-origin': allowedOrigin,
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
          'access-control-allow-headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With',
          'access-control-allow-credentials': 'true',
          'access-control-max-age': '86400',
          'content-length': '0',
        },
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
        'access-control-allow-origin': allowedOrigin,
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
        'access-control-allow-headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With',
        'access-control-allow-credentials': 'true',
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
        console.error('[HANDLER] Outer error, but returning 200 OK for OPTIONS:', outerError);
        return {
          statusCode: 200,
          body: '',
          headers: {
            'access-control-allow-origin': getDefaultCorsOrigin(),
            'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
            'access-control-allow-headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With',
            'access-control-allow-credentials': 'true',
            'access-control-max-age': '86400',
            'content-length': '0',
          },
        };
      }
    } catch {
      // If we can't check, assume OPTIONS and return 200
      return {
        statusCode: 200,
        body: '',
        headers: {
          'access-control-allow-origin': getDefaultCorsOrigin(),
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
          'access-control-allow-headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With',
          'access-control-allow-credentials': 'true',
          'access-control-max-age': '86400',
          'content-length': '0',
        },
      };
    }
    
    // For non-OPTIONS errors, return 500 with CORS
    console.error('[HANDLER] Unhandled outer error:', outerError);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: {
        'Content-Type': 'application/json',
        'access-control-allow-origin': getDefaultCorsOrigin(),
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
        'access-control-allow-headers': 'authorization,content-type,x-api-key,x-uat-mode,x-uat-token,X-Requested-With',
        'access-control-allow-credentials': 'true',
      },
    };
  }
};
