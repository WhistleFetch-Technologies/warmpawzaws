// supabase/functions/make-server-3dd53475/index.ts

// Centralized CORS configuration
const DEFAULT_ALLOW_ORIGIN = "*"; // tighten in production
const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";
const ALLOW_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? DEFAULT_ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
  } as Record<string, string>;
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(origin),
    },
  });
}

// Import Hono and endpoint modules
import { Hono } from 'npm:hono@4';
import { regionEndpoints } from './region-endpoints.tsx';
import { onboardingFormAPI } from './onboarding-form-api.tsx';
import { onboardingConfigEndpoints } from './onboarding-config-endpoints.tsx';
import { registerAdminVendorRoutes } from './admin-vendor-routes-sql.tsx';
import { roleConfigEndpoints } from './role-config-endpoints.tsx';
import { catalogEndpointsSQL } from './catalog-endpoints-sql.tsx';
import { staffScheduleEndpointsSQL } from './staff-schedule-endpoints-sql.tsx';
import { reschedulingPoliciesEndpointsSQL } from './rescheduling-policies-sql.tsx';
import { searchEndpointsSQL } from './search-endpoints-sql.tsx';
import { agoraVideoEndpointsSQL } from './agora-video-integration-sql.tsx';
import { eventManagementEndpointsSQL } from './event-management-endpoints-sql.tsx'; // ✅ SQL-only: Event management (18 KV ops removed)
import { donationManagementEndpointsSQL } from './donation-management-endpoints-sql.tsx';
// ✅ NEW: Batch 13 SQL-only endpoints
import { staffDiscoveryEndpoints } from './staff-discovery-endpoints-sql.tsx'; // ✅ SQL-only: Staff discovery (13 KV ops removed)
import { standardizedOtpEndpointsSQL } from './standardized-otp-endpoints-sql.tsx'; // ✅ SQL-only: Standardized OTP (11 KV ops removed)
import { appointmentLifecycleEndpointsSQL } from './appointment-lifecycle-endpoints-sql.tsx'; // ✅ SQL-only: Appointment lifecycle (13 KV ops removed)
import { transactionMonitoringEndpoints } from './transaction-monitoring-endpoints-sql.tsx'; // ✅ SQL-only: Transaction monitoring (Batch 7 Phase 4)
import { registerProfilePhotoEndpoints } from './profile-photo-management-sql.tsx'; // ✅ SQL-only: Profile photo management (11 KV ops removed)
import { cctvAccessEndpointsSQL } from './cctv-access-endpoints-sql.tsx'; // ✅ SQL-only: CCTV access (11 KV ops removed)
import { homeServiceAutoAssignmentSQL } from './home-service-auto-assignment-sql.tsx'; // ✅ SQL-only: Home service auto-assignment (11 KV ops removed)
import { registerPetSuggestionSystem } from './pet-suggestion-system-sql.tsx'; // ✅ SQL-only: Pet suggestion system (12 KV ops removed)
import { advancedFilteringSystemSQL } from './advanced-filtering-system-sql.tsx'; // ✅ SQL-only: Advanced filtering (15 KV ops removed)
import { staffSpecializationEndpoints } from './staff-specialization-system-sql.tsx'; // ✅ SQL-only: Staff specialization system (7 KV ops removed - Batch 10 Phase 1)
import universalStaffProblemSearchSQL from './universal-staff-problem-search-sql.tsx'; // ✅ SQL-only: Universal staff problem search (7 KV ops removed - Batch 10 Phase 1)
import { tierUpgradeAutomationSQL } from './tier-upgrade-automation-sql.tsx'; // ✅ SQL-only: Tier upgrade automation (14 KV ops removed)
// ✅ NEW: Batch 14 SQL-only endpoints
import { systemHealthCheckSQL } from './system-health-check-sql.tsx'; // ✅ SQL-only: System health check (14 KV ops removed)
import { enhancedGpsTrackingSQL } from './enhanced-gps-tracking-sql.tsx'; // ✅ SQL-only: Enhanced GPS tracking (14 KV ops removed)
import { nutritionistFoodDeliveryEndpointsSQL } from './nutritionist-food-delivery-sql.tsx'; // ✅ SQL-only: Nutritionist food delivery (15 KV ops removed)
import { customerWalletTopupSQL } from './customer-wallet-topup-sql.tsx'; // ✅ SQL-only: Customer wallet top-up
import { universalStaffSearchSQL } from './universal-staff-search-sql.tsx'; // ✅ SQL-only: Universal staff search (Batch 8, 13 KV ops removed)
import { previousProvidersEndpointsSQL } from './previous-providers-sql.tsx'; // ✅ SQL-only: Previous providers (Batch 8, 12 KV ops removed)
import { nutritionistDietPlanEndpointsSQL } from './nutritionist-diet-plan-endpoints-sql.tsx'; // ✅ SQL-only: Nutritionist diet plans (Batch 8, 12 KV ops removed)
import { registerMedicalHistoryEndpointsSQL } from './medical-history-endpoints-sql.tsx'; // ✅ SQL-only: Medical history (Batch 8, 12 KV ops removed)
import { logisticsPartnerIntegrationEndpointsSQL } from './logistics-partner-integration-sql.tsx'; // ✅ SQL-only: Logistics partner integration (Batch 9, 28 KV ops removed)
import { foodDeliveryHyperlocalEndpointsSQL } from './food-delivery-hyperlocal-sql.tsx'; // ✅ SQL-only: Food delivery hyperlocal (Batch 9, 26 KV ops removed)
import additionalCapabilitiesEndpointsSQL from './additional-capabilities-endpoints-sql.tsx'; // ✅ SQL-only: Additional capabilities (Batch 9, 30 KV ops removed)
import { reportBuilderEndpoints } from './report-builder-endpoints-sql.tsx'; // ✅ SQL-only: Report builder (Batch 9, 20 KV ops removed)
import { registerAnalyticsDashboardSprint2SQL } from './analytics-dashboard-sprint2-sql.tsx'; // ✅ SQL-only: Analytics dashboard sprint 2 (Batch 9, 26 KV ops removed)
import { tierUpgradeEndpoints } from './tier-upgrade-endpoints-sql.tsx'; // ✅ SQL-only: Tier upgrade endpoints (Batch 9, 17 KV ops removed)
import { registerVideoCallEndpoints } from './video-call-endpoints-sql.tsx'; // ✅ SQL-only: Video call endpoints (Batch 9, 18 KV ops removed)
import { registerAWSChimeVideoEndpointsSQL } from './aws-chime-video-integration-sql.tsx'; // ✅ SQL-only: AWS Chime video (Batch 9, 12 KV ops removed)
import { registerAWSChimeChatEndpoints } from './aws-chime-chat-integration-sql.tsx'; // ✅ SQL-only: AWS Chime chat (Batch 9, 12 KV ops removed)
import dynamicOnboardingFieldsSQL from './dynamic-onboarding-fields-sql.tsx'; // ✅ SQL-only: Dynamic onboarding fields (Batch 9, 8 KV ops removed)
import { registerBookingLifecycleEndpoints } from './booking-lifecycle-sql.tsx'; // ✅ SQL-only: Booking lifecycle (Batch 9, 9 KV ops removed)
import serviceComparisonSystemSQL from './service-comparison-system-sql.tsx'; // ✅ SQL-only: Service comparison system (Batch 9, 9 KV ops removed)
import { registerVendorProfileUpdateEndpoints } from './vendor-profile-update-sql.tsx'; // ✅ SQL-only: Vendor profile update (Batch 9, 5 KV ops removed)
// ✅ NEW: Batch 10 SQL-only endpoints
import { initializeRoleService } from './role-service-sql.tsx'; // ✅ SQL-only: Role service (Batch 10, 7 KV ops removed)
import { staffSpecializationEndpointsSQL } from './staff-specialization-system-sql.tsx'; // ✅ SQL-only: Staff specialization system (Batch 10, 7 KV ops removed)
import { universalStaffProblemSearchEndpointsSQL } from './universal-staff-problem-search-sql.tsx'; // ✅ SQL-only: Universal staff problem search (Batch 10, 7 KV ops removed)
import homeServicesEnhancedSQL from './home-services-enhanced-sql.tsx'; // ✅ SQL-only: Home services enhanced (Batch 10, 5 KV ops removed)
import { unifiedServiceDiscoveryEndpointsSQL } from './unified-service-discovery-sql.tsx'; // ✅ SQL-only: Unified service discovery (Batch 10 Phase 2, 4 KV ops removed)
import vendorBankValidationSQL from './vendor-bank-validation-sql.tsx'; // ✅ SQL-only: Vendor bank validation (Batch 10 Phase 2, 4 KV ops removed)
import { registerLogisticsEndpoints } from './logistics-adapter-sql.tsx'; // ✅ SQL-only: Logistics adapter (Batch 10 Phase 2, 4 KV ops removed)
// ✅ NEW: Batch 10 Phase 3 SQL-only endpoints
import { registerAnalyticsIngestion } from './analytics-events-sql.tsx'; // ✅ SQL-only: Analytics events (Batch 10 Phase 3, 4 KV ops removed)
import scheduleSettingsEndpointsSQL from './schedule-settings-endpoints-sql.tsx'; // ✅ SQL-only: Schedule settings (Batch 10 Phase 3, 3 KV ops removed)
import { radarLocationSystemEndpoints } from './radar-location-system-sql.tsx'; // ✅ SQL-only: Radar location system (Batch 10 Phase 3, 3 KV ops removed)
import { registerVendorCatalogAPI } from './vendor-catalog-api-sql.tsx'; // ✅ SQL-only: Vendor catalog API (Batch 10 Phase 3, 3 KV ops removed)
import { registerLogisticsRoutingEndpointsSQL } from './logistics-routing-engine-sql.tsx'; // ✅ SQL-only: Logistics routing engine (Batch 10 Phase 3, 6 KV ops removed)
import enhancedProblemDiscoverySQL from './enhanced-problem-discovery-sql.tsx'; // ✅ SQL-only: Enhanced problem discovery (Batch 10 Phase 3, 4 KV ops removed)
// ✅ NEW: Batch 11 SQL-only endpoints
import { settlementTierSystemEndpoints } from './settlement-tier-system-enhanced-sql.tsx'; // ✅ SQL-only: Settlement tier system enhanced (Batch 11, 7 KV ops removed)
// ✅ NEW: Batch 15 SQL-only endpoints (additional ones)
import { independentVendorSystemEndpointsSQL } from './independent-vendor-system-sql.tsx'; // ✅ SQL-only: Independent vendor system (Batch 15, 12 KV ops removed)
import { registerDatingChatEndpointsSQL } from './dating-chat-endpoints-sql.tsx'; // ✅ SQL-only: Dating chat (Batch 15, 12 KV ops removed)
import scheduledTeleBookingSQL from './scheduled-tele-booking-sql.tsx'; // ✅ SQL-only: Scheduled tele booking (9 KV ops removed)
import { integratedServicesManagerEndpointsSQL } from './integrated-services-manager-sql.tsx'; // ✅ SQL-only: Integrated services manager (9 KV ops removed)
import { razorpayMarketplaceSettlementSQL } from './razorpay-marketplace-settlement-sql.tsx'; // ✅ SQL-only: Razorpay marketplace settlement (Batch 9, 6 KV ops removed)
import { tierCommissionIntegrationEndpointsSQL } from './tier-commission-integration-sql.tsx'; // ✅ SQL-only: Tier commission (Batch 15, 11 KV ops removed)
import { staffServiceStyleSetupEndpointsSQL } from './staff-service-style-setup-sql.tsx'; // ✅ SQL-only: Staff service style setup (Batch 15, 11 KV ops removed)
import memorialEndpointsSQL from './memorial-endpoints-sql.tsx'; // ✅ SQL-only: Memorial endpoints (Batch 15, 11 KV ops removed)
// ✅ NEW: Batch 16 SQL-only endpoints
import integratedServicesCompleteSQL from './integrated-services-complete-sql.tsx'; // ✅ SQL-only: Integrated services (11 KV ops removed)
import { updateProviderLocationIndex, findProvidersNearby } from './geospatial-index-sql.tsx'; // ✅ SQL-only: Geospatial indexing (11 KV ops removed)
import { assignInstantTele, assignHomeService } from './auto-assignment-logic-sql.tsx'; // ✅ SQL-only: Auto-assignment logic (11 KV ops removed)
import advancedSearchEngineSQL from './advanced-search-engine-sql.tsx'; // ✅ SQL-only: Advanced search engine (11 KV ops removed)
import vendorAnalyticsEndpointsSQL from './vendor-analytics-endpoints-sql.tsx'; // ✅ SQL-only: Vendor analytics (10 KV ops removed)
import { isSoloProvider, getSoloProviderSession, resolveVendorLogin } from './solo-provider-auth-sql.tsx'; // ✅ SQL-only: Solo provider auth (10 KV ops removed)
import searchAnalyticsAPISQL from './search-analytics-api-sql.tsx'; // ✅ SQL-only: Search analytics (10 KV ops removed)
import healthProblemEndpointsSQL from './health-problem-endpoints-sql.tsx'; // ✅ SQL-only: Health problem endpoints (10 KV ops removed)
import elasticsearchProxySQL from './elasticsearch-proxy-sql.tsx'; // ✅ SQL-only: Elasticsearch proxy (10 KV ops removed)
import automatedBankVerificationSQL from './automated-bank-verification-sql.tsx'; // ✅ SQL-only: Automated bank verification (10 KV ops removed)
// ✅ NEW: Batch 17 SQL-only endpoints
import bookingValidationEndpointsSQL from './booking-validation-endpoints-sql.tsx'; // ✅ SQL-only: Booking validation (Batch 17, 8 KV ops removed)
import { cancellationPolicyEndpoints } from './cancellation-policy-endpoints-sql.tsx'; // ✅ SQL-only: Cancellation policy (Batch 17, 8 KV ops removed)
import slotAvailabilityEndpointsSQL from './slot-availability-endpoints-sql.tsx'; // ✅ SQL-only: Slot availability (Batch 17, 8 KV ops removed)
import { nutritionistFoodIntegrationEndpoints } from './nutritionist-food-integration-sql.tsx'; // ✅ SQL-only: Nutritionist food integration (Batch 17, 7 KV ops removed)
import { refundPolicyEndpoints } from './refund-policy-engine-enhanced-sql.tsx'; // ✅ SQL-only: Refund policy engine (Batch 17, 7 KV ops removed)

// Create Hono app instance
const app = new Hono();

// Register endpoint modules
try {
  console.log('✅ Registering region endpoints...');
  regionEndpoints(app);
} catch (error) {
  console.error('❌ Error registering region endpoints:', error);
}

try {
  console.log('✅ Registering onboarding form API...');
  onboardingFormAPI(app);
} catch (error) {
  console.error('❌ Error registering onboarding form API:', error);
}

try {
  console.log('✅ Registering onboarding config endpoints (vendor applications)...');
  onboardingConfigEndpoints(app);
} catch (error) {
  console.error('❌ Error registering onboarding config endpoints:', error);
}

try {
  console.log('✅ Registering admin vendor routes (applications, approve, reject)...');
  registerAdminVendorRoutes(app);
} catch (error) {
  console.error('❌ Error registering admin vendor routes:', error);
}

try {
  console.log('✅ Registering role config endpoints (config/roles)...');
  roleConfigEndpoints(app);
} catch (error) {
  console.error('❌ Error registering role config endpoints:', error);
}

try {
  console.log('✅ Registering catalog endpoints (admin/catalog)...');
  catalogEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering catalog endpoints:', error);
}

try {
  console.log('✅ Registering staff schedule endpoints...');
  staffScheduleEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering staff schedule endpoints:', error);
}

try {
  console.log('✅ Registering rescheduling policies endpoints...');
  reschedulingPoliciesEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering rescheduling policies endpoints:', error);
}

try {
  console.log('✅ Registering search endpoints...');
  searchEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering search endpoints:', error);
}

try {
  console.log('✅ Registering Agora video integration endpoints...');
  agoraVideoEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering Agora video integration endpoints:', error);
}

try {
  console.log('✅ Registering event management endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', eventManagementEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering event management endpoints:', error);
}

try {
  console.log('✅ Registering nutritionist food delivery endpoints...');
  nutritionistFoodDeliveryEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering nutritionist food delivery endpoints:', error);
}

// ✅ NEW: Batch 13 SQL-only endpoint registrations
try {
  console.log('✅ Registering staff discovery endpoints (SQL-only)...');
  staffDiscoveryEndpoints(app);
} catch (error) {
  console.error('❌ Error registering staff discovery endpoints:', error);
}

try {
  console.log('✅ Registering standardized OTP endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', standardizedOtpEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering standardized OTP endpoints:', error);
}

try {
  console.log('✅ Registering appointment lifecycle endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', appointmentLifecycleEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering appointment lifecycle endpoints:', error);
}

try {
  console.log('✅ Registering transaction monitoring endpoints (SQL-only)...');
  transactionMonitoringEndpoints(app);
} catch (error) {
  console.error('❌ Error registering transaction monitoring endpoints:', error);
}

// ✅ NEW: Batch 14 SQL-only endpoint registrations
try {
  console.log('✅ Registering system health check (SQL-only)...');
  app.route('/make-server-3dd53475', systemHealthCheckSQL);
} catch (error) {
  console.error('❌ Error registering system health check:', error);
}

try {
  console.log('✅ Registering customer wallet top-up (SQL-only)...');
  app.route('/make-server-3dd53475', customerWalletTopupSQL);
} catch (error) {
  console.error('❌ Error registering customer wallet top-up:', error);
}

try {
  console.log('✅ Registering enhanced GPS tracking (SQL-only)...');
  app.route('/make-server-3dd53475', enhancedGpsTrackingSQL);
} catch (error) {
  console.error('❌ Error registering enhanced GPS tracking:', error);
}

try {
  console.log('✅ Registering universal staff search (SQL-only)...');
  app.route('/make-server-3dd53475', universalStaffSearchSQL);
} catch (error) {
  console.error('❌ Error registering universal staff search:', error);
}

// Removed duplicate registration of nutritionistFoodDeliveryEndpointsSQL (already registered above)

try {
  console.log('✅ Registering previous providers (SQL-only)...');
  previousProvidersEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering previous providers:', error);
}

try {
  console.log('✅ Registering nutritionist diet plans (SQL-only)...');
  nutritionistDietPlanEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering nutritionist diet plans:', error);
}

try {
  console.log('✅ Registering medical history (SQL-only)...');
  registerMedicalHistoryEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering medical history:', error);
}

try {
  console.log('✅ Registering logistics partner integration (SQL-only)...');
  logisticsPartnerIntegrationEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering logistics partner integration:', error);
}

try {
  console.log('✅ Registering food delivery hyperlocal (SQL-only)...');
  foodDeliveryHyperlocalEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering food delivery hyperlocal:', error);
}

try {
  console.log('✅ Registering additional capabilities (SQL-only)...');
  app.route('/make-server-3dd53475', additionalCapabilitiesEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering additional capabilities:', error);
}

try {
  console.log('✅ Registering report builder (SQL-only)...');
  reportBuilderEndpoints(app);
} catch (error) {
  console.error('❌ Error registering report builder:', error);
}

try {
  console.log('✅ Registering analytics dashboard sprint 2 (SQL-only)...');
  registerAnalyticsDashboardSprint2SQL(app);
} catch (error) {
  console.error('❌ Error registering analytics dashboard sprint 2:', error);
}

try {
  console.log('✅ Registering tier upgrade endpoints (SQL-only)...');
  tierUpgradeEndpoints(app);
} catch (error) {
  console.error('❌ Error registering tier upgrade endpoints:', error);
}

try {
  console.log('✅ Registering video call endpoints (SQL-only)...');
  registerVideoCallEndpoints(app);
} catch (error) {
  console.error('❌ Error registering video call endpoints:', error);
}

try {
  console.log('✅ Registering AWS Chime video endpoints (SQL-only)...');
  registerAWSChimeVideoEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering AWS Chime video endpoints:', error);
}

try {
  console.log('✅ Registering AWS Chime chat endpoints (SQL-only)...');
  registerAWSChimeChatEndpoints(app);
} catch (error) {
  console.error('❌ Error registering AWS Chime chat endpoints:', error);
}

try {
  console.log('✅ Registering dynamic onboarding fields (SQL-only)...');
  app.route('/make-server-3dd53475', dynamicOnboardingFieldsSQL);
} catch (error) {
  console.error('❌ Error registering dynamic onboarding fields:', error);
}

try {
  console.log('✅ Registering booking lifecycle (SQL-only)...');
  registerBookingLifecycleEndpoints(app);
} catch (error) {
  console.error('❌ Error registering booking lifecycle:', error);
}

try {
  console.log('✅ Registering service comparison system (SQL-only)...');
  app.route('/make-server-3dd53475', serviceComparisonSystemSQL);
} catch (error) {
  console.error('❌ Error registering service comparison system:', error);
}

try {
  console.log('✅ Registering vendor profile update (SQL-only)...');
  registerVendorProfileUpdateEndpoints(app);
} catch (error) {
  console.error('❌ Error registering vendor profile update:', error);
}

// ✅ NEW: Batch 15 SQL-only endpoint registrations (additional ones)
try {
  console.log('✅ Registering independent vendor system (SQL-only)...');
  independentVendorSystemEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering independent vendor system:', error);
}

try {
  console.log('✅ Registering dating chat endpoints (SQL-only)...');
  registerDatingChatEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering dating chat endpoints:', error);
}

try {
  console.log('✅ Registering scheduled tele booking endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', scheduledTeleBookingSQL);
} catch (error) {
  console.error('❌ Error registering scheduled tele booking endpoints:', error);
}

try {
  console.log('✅ Registering integrated services manager endpoints (SQL-only)...');
  integratedServicesManagerEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering integrated services manager endpoints:', error);
}

try {
  console.log('✅ Registering tier commission integration (SQL-only)...');
  tierCommissionIntegrationEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering tier commission integration:', error);
}

try {
  console.log('✅ Registering staff service style setup (SQL-only)...');
  staffServiceStyleSetupEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering staff service style setup:', error);
}

try {
  console.log('✅ Registering memorial endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', memorialEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering memorial endpoints:', error);
}

// ✅ NEW: Batch 16 SQL-only endpoint registrations
try {
  console.log('✅ Registering integrated services complete (SQL-only)...');
  app.route('/make-server-3dd53475', integratedServicesCompleteSQL);
} catch (error) {
  console.error('❌ Error registering integrated services:', error);
}

try {
  console.log('✅ Registering advanced search engine (SQL-only)...');
  app.route('/make-server-3dd53475', advancedSearchEngineSQL);
} catch (error) {
  console.error('❌ Error registering advanced search engine:', error);
}

try {
  console.log('✅ Registering vendor analytics (SQL-only)...');
  app.route('/make-server-3dd53475', vendorAnalyticsEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering vendor analytics:', error);
}

try {
  console.log('✅ Registering search analytics API (SQL-only)...');
  app.route('/make-server-3dd53475', searchAnalyticsAPISQL);
} catch (error) {
  console.error('❌ Error registering search analytics:', error);
}

try {
  console.log('✅ Registering health problem endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', healthProblemEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering health problem endpoints:', error);
}

try {
  console.log('✅ Registering elasticsearch proxy (SQL-only)...');
  app.route('/make-server-3dd53475', elasticsearchProxySQL);
} catch (error) {
  console.error('❌ Error registering elasticsearch proxy:', error);
}

try {
  console.log('✅ Registering automated bank verification (SQL-only)...');
  app.route('/make-server-3dd53475', automatedBankVerificationSQL);
} catch (error) {
  console.error('❌ Error registering automated bank verification:', error);
}

// ✅ NEW: Batch 17 SQL-only endpoint registrations
try {
  console.log('✅ Registering booking validation endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', bookingValidationEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering booking validation endpoints:', error);
}

try {
  console.log('✅ Registering cancellation policy endpoints (SQL-only)...');
  cancellationPolicyEndpoints(app);
} catch (error) {
  console.error('❌ Error registering cancellation policy endpoints:', error);
}

try {
  console.log('✅ Registering slot availability endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', slotAvailabilityEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering slot availability endpoints:', error);
}

try {
  console.log('✅ Registering nutritionist food integration (SQL-only)...');
  nutritionistFoodIntegrationEndpoints(app);
} catch (error) {
  console.error('❌ Error registering nutritionist food integration:', error);
}

try {
  console.log('✅ Registering refund policy engine (SQL-only)...');
  refundPolicyEndpoints(app);
} catch (error) {
  console.error('❌ Error registering refund policy engine:', error);
}

// Removed duplicate registration of scheduledTeleBookingSQL (already registered above)

// Removed duplicate registration of integratedServicesManagerEndpointsSQL (already registered above)

try {
  console.log('✅ Registering Razorpay marketplace settlement (SQL-only)...');
  razorpayMarketplaceSettlementSQL(app);
} catch (error) {
  console.error('❌ Error registering Razorpay marketplace settlement:', error);
}

// ✅ NEW: Batch 10 Phase 1 SQL-only endpoints
try {
  console.log('✅ Registering staff specialization system (SQL-only)...');
  staffSpecializationEndpoints(app);
} catch (error) {
  console.error('❌ Error registering staff specialization system:', error);
}

try {
  console.log('✅ Registering universal staff problem search (SQL-only)...');
  app.route('/make-server-3dd53475', universalStaffProblemSearchSQL);
} catch (error) {
  console.error('❌ Error registering universal staff problem search:', error);
}

// ✅ NEW: Batch 10 Phase 2 SQL-only endpoints
try {
  console.log('✅ Registering unified service discovery (SQL-only)...');
  unifiedServiceDiscoveryEndpoints(app);
} catch (error) {
  console.error('❌ Error registering unified service discovery:', error);
}

try {
  console.log('✅ Registering vendor bank validation (SQL-only)...');
  app.route('/make-server-3dd53475', vendorBankValidationSQL);
} catch (error) {
  console.error('❌ Error registering vendor bank validation:', error);
}

try {
  console.log('✅ Registering logistics adapter (SQL-only)...');
  registerLogisticsEndpoints(app);
} catch (error) {
  console.error('❌ Error registering logistics adapter:', error);
}

// ✅ NEW: Batch 10 Phase 3 SQL-only endpoints
try {
  console.log('✅ Registering analytics ingestion (SQL-only)...');
  registerAnalyticsIngestion(app);
} catch (error) {
  console.error('❌ Error registering analytics ingestion:', error);
}

try {
  console.log('✅ Registering schedule settings endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', scheduleSettingsEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering schedule settings endpoints:', error);
}

try {
  console.log('✅ Registering radar location system (SQL-only)...');
  radarLocationSystemEndpoints(app);
} catch (error) {
  console.error('❌ Error registering radar location system:', error);
}

try {
  console.log('✅ Registering vendor catalog API (SQL-only)...');
  registerVendorCatalogAPI(app);
} catch (error) {
  console.error('❌ Error registering vendor catalog API:', error);
}

try {
  console.log('✅ Registering logistics routing engine (SQL-only)...');
  registerLogisticsRoutingEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering logistics routing engine:', error);
}

try {
  console.log('✅ Registering enhanced problem discovery (SQL-only)...');
  app.route('/make-server-3dd53475', enhancedProblemDiscoverySQL);
} catch (error) {
  console.error('❌ Error registering enhanced problem discovery:', error);
}

try {
  console.log('✅ Registering settlement tier system enhanced (SQL-only)...');
  settlementTierSystemEndpoints(app);
} catch (error) {
  console.error('❌ Error registering settlement tier system enhanced:', error);
}

// Health endpoint (simple, no dependencies)
app.get('/make-server-3dd53475/health', (c) => {
  const origin = c.req.header('origin');
  return c.json({ status: 'ok', timestamp: new Date().toISOString() }, 200, {
    ...buildCorsHeaders(origin),
  });
});

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");

  // 1) Always answer preflight FIRST - this is critical for CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
  }

  // 2) Try Hono app for all other requests
  try {
    const response = await app.fetch(req);
    
    // Ensure CORS headers are on the response
    const headers = new Headers(response.headers);
    const corsHeaders = buildCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  } catch (error) {
    console.error('❌ [TOP-LEVEL] Error handling request:', error);
    return json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : String(error)
    }, 500, origin);
  }
});
