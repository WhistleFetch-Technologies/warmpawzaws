import { Hono } from 'hono';
import { cors } from "hono/cors";
import { logger } from "hono/logger";
// ✅ SQL MIGRATION: Removed KV import, using SQL repositories
import { sendSuccess, sendError } from './response-utils';
import { getRegionsRepository } from '../../../supabase/lib/repositories/regions';
import { criticalActionGuard } from './critical-action-guard';

// Import all registration functions
import { registerUniversalDiscovery } from './universal-problem-discovery';
import { registerUniversalCustomerSearch } from './universal-customer-search';
import { registerCustomerBookingHistory } from './customer-booking-history';
import { registerCustomerSearchEndpoints } from './customer-search-endpoints';
import { notificationEndpoints } from './notification-system';
import { reviewEndpoints } from './review-endpoints';
import { analyticsEndpoints } from './analytics-endpoints';
// ✅ SQL MIGRATION: enhancedSearchEngineEndpoints imported above
import { vendorOnboardingEndpoints } from './vendor-onboarding';
import { vendorApprovalWorkflowEndpoints } from './vendor-approval-workflow';
import { vendorDashboardEndpoints } from './vendor-dashboard-endpoints';
import { vendorRoleConfigEndpoints } from './vendor-role-config';
import { registerDynamicOnboarding } from './dynamic-onboarding-management';
import { onboardingConfigEndpoints } from './onboarding-config-endpoints';
import { registerVendorServiceEndpoints } from './vendor-services-endpoints';
import { registerVendorCatalogAPIV2 } from './vendor-catalog-api-v2';
import { customServiceEndpoints } from './custom-service-endpoints';
import { vendorScheduleV2SQL } from './vendor-schedule-v2-sql';
import { homeServicesEndpointsSQL } from './home-services-endpoints-sql';
import { registerAdminVendorRoutes } from './admin-vendor-routes';
import { adminVendorEndpoints } from './admin-vendor-endpoints';
import { registerAdminCatalogEndpoints } from './admin-catalog-endpoints';
import { adminIntegrationEndpoints } from './admin-integration-endpoints';
import { registerVendorSettingsRulesEndpoints } from './vendor-settings-rules-endpoints';
import { registerVideoCallEndpoints } from './video-call-endpoints';
import { regionEndpoints } from './region-endpoints';
import { registerProblemGridSpecializationSystem } from './problem-grid-specialization-system';
import { registerCustomerServices } from './customer-services';
import { registerCustomerRoutes } from './customer-routes';
import { registerAuthEndpoints } from './auth-endpoints';
import { registerAICRMRoutes } from './ai-crm-routes';
import { registerAIChatbotRoutes } from './ai-chatbot-routes';
import { paymentEndpoints } from './payment-endpoints';
import { paymentEndpointsSQL } from './payment-endpoints-sql';
import { marketplacePaymentEndpoints } from './marketplace-payment-endpoints';
import { registerChatEndpoints } from './chat-endpoints';
import { registerSubscriptionEndpoints } from './subscription-endpoints';
import { registerVideoConsultationEndpoints } from './video-consultation-endpoints';
import { registerMedicalHistoryEndpoints } from './medical-history-endpoints';
import { registerUniversalStaffSchedule } from './universal-staff-schedule';
import { registerCenterAvailabilityEndpoints } from './center-availability-endpoints';
import { registerBoardingRoomManagement } from './boarding-room-management';
import { registerNutritionistMealManagement } from './nutritionist-meal-management';
import { registerServicePackageManagement } from './service-package-management';
import { registerCustomerPackageEndpoints } from './customer-package-endpoints';
import { registerVendorMetricsEnhancement } from './vendor-metrics-enhancement';
import { bookingEndpoints } from './booking-endpoints';
import { registerCafeFeatures } from './cafe-features';
import { registerCapabilityEndpoints } from './capability-endpoints';
import { registerResortInventory } from './resort-inventory';
import marketingRoutesV2 from './marketing-routes-v2';
import { registerMarketplaceProducts } from './marketplace-products';
import { registerUniversalServiceDiscovery } from './universal-service-discovery';
import { registerUniversalOTPSystem } from './universal-otp-system';
import { registerHomeServiceBookingFlow } from './home-service-booking-flow';
import { registerBookingLifecycleManagement } from './booking-lifecycle-management';
import { bookingLifecycleCompleteEndpoints } from './booking-lifecycle-complete';
import { registerPayoutCronJob } from './payout-cron-job';
import { registerSmsOtpService } from './sms-otp-service';
import { registerRazorpayRefundProcessor } from './razorpay-refund-processor';
import { registerGooglePlacesService } from './google-places-service';
// ✅ SQL MIGRATION: Removed original settlement-automation.tsx import - using SQL version instead
// import { registerSettlementAutomation } from './settlement-automation';
import { registerS3AutoUploader } from './s3-auto-uploader';
import { registerSmsEventNotifications } from './sms-event-notifications';
import { registerShiprocketIntegration } from './shiprocket-integration';
import { registerDelhiveryIntegration } from './delhivery-integration';
import { registerLogisticsRoutingEndpoints } from './logistics-routing-engine';
import { registerReturnsManagementEndpoints } from './returns-management';
import { analyticsAggregationEndpoints } from './analytics-aggregation';
import { rbacEndpoints } from './rbac-endpoints';
import { reportBuilderEndpoints } from './report-builder-endpoints';
import { petIntelligenceEndpoints } from './pet-intelligence-endpoints';
import { transactionMonitoringEndpoints } from './transaction-monitoring-endpoints';
import enhancedServicePublishing from './enhanced-service-publishing';
import enhancedStaffAvailability from './enhanced-staff-availability-routes';
import { pharmacyPrescriptionEndpoints } from './pharmacy-prescription-endpoints';
import vetSpecializedServices from './vet-specialized-services'; // ✅ FIX: Import vet specialized services (ambulance, diagnostics, pharmacy)
import staffCrudEndpoints from './staff-crud-endpoints'; // ✅ FIX: Import staff CRUD endpoints (create, read, update, delete staff)
import { homeSampleCollectionEndpoints } from './home-sample-collection-endpoints';
import { holidayPackageEndpoints } from './holiday-package-endpoints';
import { smsNotificationServiceEnhanced } from './sms-notification-service-enhanced';
import { tierSystemIntegration } from './tier-system-integration';
import { hyperlocalDeliveryEndpoints } from './hyperlocal-delivery-endpoints';
import { marketplaceSettlementEnhanced } from './marketplace-settlement-enhanced';
import { elasticsearchIntegration } from './elasticsearch-integration';
import { integratedServicesEndpoints } from './integrated-services-endpoints';
import { specializedServicesBooking } from './specialized-services-booking';
import criticalFlowFixes from './critical-flow-fixes';
import { registerGroomerGalleryEndpoints } from './groomer-gallery-system';
import trainerProgressTracking from './trainer-progress-tracking';
import cafeTableManagement from './cafe-table-management';
import { registerInsuranceClaimEndpoints } from './insurance-claim-management';
import customerWalletTopup from './customer-wallet-topup';
import rewardsLoyaltySystem from './rewards-loyalty-system';
import portfolioEndpoints from './portfolio-endpoints';
import cctvAccessEndpoints from './cctv-access-endpoints';
import controlledSubstancesEndpoints from './controlled-substances-endpoints';
import vetSummaryEndpoints from './vet-summary-endpoints';
import adoptionEndpoints from './adoption-endpoints';
import memorialEndpoints from './memorial-endpoints';
import expiryManagementEndpoints from './expiry-management-endpoints';
import donationManagementEndpoints from './donation-management-endpoints';
import eventManagementEndpoints from './event-management-endpoints';
import patientMonitoringEndpoints from "./patient-monitoring-endpoints";
import customerEcommerceEndpoints from "./customer-ecommerce-endpoints";
import additionalCapabilitiesEndpoints from "./additional-capabilities-endpoints";
import { registerP0Features } from './p0-features-endpoints';
import missingCrudEndpoints from './missing-crud-endpoints';
import facilityEndpoints from './facility-endpoints';
import { packageEndpoints } from './package-endpoints';
import { registerContentManagementEndpoints } from './content-management-endpoints';
import { registerMatingDatingService } from './mating-dating-service';
import { registerPetSuggestionSystem } from './pet-suggestion-system';
import { registerPlatformSubscriptionTiers } from './platform-subscription-tiers';
import { registerDatingChatEndpoints } from './dating-chat-endpoints';
import { registerAWSChimeChatEndpoints } from './aws-chime-chat-integration';
import { registerAWSChimeVideoEndpoints } from './aws-chime-video-integration';
import { promotionEndpoints } from './promotion-endpoints';

import { ambulanceServiceEndpoints } from './ambulance-service-endpoints';
import { diagnosticsCenterEndpoints } from './diagnostics-center-endpoints';
import specializedVendorConfigEndpoints from './specialized-vendor-config-endpoints'; // ✅ NEW: Specialized vendor configurations
import { backwardsCompatibleEndpoints } from './backwards-compatible-endpoints'; // ✅ NEW: Backwards compatible routes for UI
import { razorpayPaymentEndpoints } from './razorpay-payment-endpoints';
import { paymentRazorpayEndpoints } from './payment-razorpay-endpoints';
import { groomingBookingAPIs } from './grooming-booking-apis';
import razorpayPaymentIntegration from './razorpay-payment-integration';
import { specializedServicesEndpoints } from './specialized-services-endpoints';
import { insuranceEndpoints } from './insurance-endpoints';
import { trainingProgressEndpoints } from './training-progress-endpoints';
import { instantTeleEndpoints } from './instant-tele-endpoints';
import { petProfilePublishingEndpoints } from './pet-profile-publishing-endpoints';
import { deliveryIntegrationEndpoints } from './delivery-integration-endpoints';
import { resortPreCheckEndpoints } from './resort-precheck-endpoints';
import { notificationTemplateSystem } from './notification-template-system';
import { bankVerificationEndpoints } from './bank-verification-endpoints';
import { tierUpgradeEndpoints } from './tier-upgrade-endpoints';
import { settlementScheduleEndpoints } from './settlement-schedule-endpoints';
import { gstRuleEngineEndpoints } from './gst-rule-engine';
import { gstConfigurationEndpoints } from './gst-configuration-endpoints';
import { cancellationPolicyEndpoints } from './cancellation-policy-endpoints';
import { comprehensiveGapFixes } from './gap-fixes-comprehensive';
import { analyticsDashboardEndpoints } from './analytics-dashboard-endpoints';
import { performanceMonitoringEndpoints } from './performance-monitoring-endpoints';
import { systemOptimizationEndpoints } from './system-optimization-endpoints';
import { elasticsearchCoreEndpoints } from './elasticsearch-core';
import { advancedSearchAPI } from './advanced-search-api';
import { searchAnalyticsAPI } from './search-analytics-api';
import { nutritionistSystemEndpoints } from './nutritionist-system';
import { foodDeliveryHyperlocalEndpoints } from './food-delivery-hyperlocal';
import { nutritionistDietPlanEndpoints } from './nutritionist-diet-plan-endpoints';
import { nutritionistFoodIntegrationEndpoints } from './nutritionist-food-integration';
import { nutritionistFoodDeliveryEndpoints } from './nutritionist-food-delivery';
import { holidayPackageSystemEndpoints } from './holiday-package-system';
import { previousProvidersEndpoints } from './previous-providers';
import { radarLocationSystemEndpoints } from './radar-location-system';
import { multiServiceSchedulingEndpoints } from './multi-service-scheduling';
import { timeWindowSubscriptionEndpoints } from './time-window-subscription';
import { independentVendorSystemEndpoints } from './independent-vendor-system';
import { unifiedServiceDiscoveryEndpoints } from './unified-service-discovery';
import { registerDiscoverySQLEndpoints } from './discovery-sql-endpoints';
import { registerRegulatedFlowsSQLEndpoints } from './regulated-flows-sql-endpoints';
import { packageEndpointsSQL } from './package-endpoints-sql';
import { staffDiscoveryEndpointsSQL } from './staff-discovery-endpoints-sql';
import { followupEndpointsSQL } from './followup-endpoints-sql';
import { staffAvailabilityRoutesSQL } from './staff-availability-routes-sql';
import { logisticsPartnerIntegrationEndpoints } from './logistics-partner-integration';
import { automatedBankVerificationEndpoints } from './automated-bank-verification';
import { marketplaceSettlementAutomationEndpoints } from './marketplace-settlement-automation';
import { tierCommissionIntegrationEndpoints } from './tier-commission-integration';
import { reschedulingPoliciesEndpoints } from './rescheduling-policies';
import { servicesByProblemEndpoints } from './services-by-problem';
import { searchSuggestionsEndpoints } from './search-suggestions';
import qaGapFixesEndpoints from './qa-gap-fixes';
import performanceOptimizationEndpoints from './performance-optimization-endpoints';
import analyticsDashboardSprint2 from './analytics-dashboard-sprint2';
import settlementTierSystem from './settlement-tier-system';
import elasticsearchComplete from './elasticsearch-complete';
import refundReschedulingComplete from './refund-rescheduling-complete';
import homeServicesEnhanced from './home-services-enhanced';
import integratedServicesComplete from './integrated-services-complete';
import { elasticsearchProxyEndpoints } from './elasticsearch-proxy';
import { refundPolicyEndpoints } from './refund-policy-engine-enhanced';
import { settlementTierSystemEndpoints } from './settlement-tier-system-enhanced';
import { integratedServicesManagerEndpoints } from './integrated-services-manager';

import { tierSystemEndpoints } from './tier-system';
import { razorpayMarketplaceSettlement } from './razorpay-marketplace-settlement';
import appointmentDetailEndpoints from './appointment-detail-endpoints'; // ✅ FIX: Prescription upload endpoints
import { registerStorageEndpoints } from './storage-handler'; // ✅ FIX: Storage upload endpoints
import { staffServiceEndpoints } from './staff-service-endpoints'; // ✅ FIX: Staff service management endpoints
import { soloProviderEndpoints } from './solo-provider-endpoints'; // ✅ FIX: Solo provider onboarding endpoints
import { registerMedicalAISummaryEndpoints } from './medical-ai-summary-endpoints'; // ✅ NEW: Medical AI summary endpoints

const app = new Hono();

// Global Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// ------------------------------------------------------------------
// CRITICAL: Region endpoint must be registered FIRST to avoid being shadowed
// ------------------------------------------------------------------
app.get('/make-server-3dd53475/regions', async (c) => {
  try {
    console.log('📍 [REGIONS] Fetching all regions...');
    // ✅ SQL: Get all regions from repository
    const regionsRepo = getRegionsRepository();
    const regions = await regionsRepo.findAll();
    
    // Map SQL schema to expected response format
    const mappedRegions = regions.map(r => ({
      regionId: r.code,
      regionName: r.name,
      regionCode: r.code,
      country: r.country || 'India',
      serviceCatalog: r.region_config?.serviceCatalog || {},
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      ...r.region_config, // Include any additional config
    }));
    
    console.log(`✅ Returning ${mappedRegions.length} regions from GET /regions`);
    
    return sendSuccess(c, {
      regions: mappedRegions,
      count: mappedRegions.length
    });
  } catch (error) {
    console.error('❌ Error fetching regions:', error);
    // Return empty array on error instead of failing
    return sendSuccess(c, {
      regions: [],
      count: 0,
      warning: 'Region data temporarily unavailable'
    });
  }
});

// Get active regions (non-blocking with timeout protection)
app.get('/make-server-3dd53475/regions/active', async (c) => {
  try {
    console.log('📍 [REGIONS] Fetching active regions...');
    
    // ✅ SQL: Get active regions from repository
    const regionsRepo = getRegionsRepository();
    const regions = await regionsRepo.findActive();
    
    // Map SQL schema to expected response format
    const mappedRegions = regions.map(r => ({
      regionId: r.code,
      regionName: r.name,
      regionCode: r.code,
      country: r.country || 'India',
      serviceCatalog: r.region_config?.serviceCatalog || {},
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      ...r.region_config, // Include any additional config
    }));
    
    console.log(`✅ Returning ${mappedRegions.length} active regions from GET /regions/active`);
    
    return sendSuccess(c, {
      regions: mappedRegions,
      count: mappedRegions.length
    });
  } catch (error) {
    console.error('❌ Error fetching active regions:', error);
    
    // Return empty array on error instead of failing
    console.warn('⚠️ Region fetch failed, returning empty array');
    return sendSuccess(c, {
      regions: [],
      count: 0,
      warning: 'Region data temporarily unavailable'
    });
  }
});

// Get specific region by ID - MUST BE AFTER /active route
app.get('/make-server-3dd53475/regions/:regionId', async (c) => {
  try {
    const regionId = c.req.param('regionId');
    // ✅ SQL: Get region from repository
    const regionsRepo = getRegionsRepository();
    const region = await regionsRepo.findByCode(regionId);
    
    if (!region) {
      return sendError(c, 'Region not found', 404);
    }
    
    return sendSuccess(c, { region });
  } catch (error) {
    console.error('Error fetching region:', error);
    return sendError(c, error, 500);
  }
});

app.get('/make-server-3dd53475/admin/regions', async (c) => {
  try {
    // ✅ SQL: Get all regions from repository
    const regionsRepo = getRegionsRepository();
    const regions = await regionsRepo.findAll();
    return sendSuccess(c, {
      regions: regions || [],
      count: regions?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching admin regions:', error);
    return sendError(c, error, 500);
  }
});

// Create region endpoint
app.post('/make-server-3dd53475/admin/regions', async (c) => {
  try {
    const body = await c.req.json();
    const { regionId, ...regionData } = body;
    
    if (!regionId) {
      return sendError(c, 'regionId is required', 400);
    }
    
    // ✅ SQL: Create region using repository
    const regionsRepo = getRegionsRepository();
    const region = await regionsRepo.create({
      id: regionId,
      code: regionData.regionCode || regionId,
      name: regionData.regionName || regionId,
      country: regionData.country || undefined,
      region_config: regionData,
      is_active: regionData.isActive ?? true,
    });
    
    return sendSuccess(c, { region }, 'Region created successfully');
  } catch (error) {
    console.error('Error creating region:', error);
    return sendError(c, error, 500);
  }
});

// Update region endpoint
app.put('/make-server-3dd53475/admin/regions/:regionId', async (c) => {
  try {
    const regionId = c.req.param('regionId');
    const updates = await c.req.json();
    
    // ✅ SQL: Get existing region
    const regionsRepo = getRegionsRepository();
    const existing = await regionsRepo.findByCode(regionId);
    if (!existing) {
      return sendError(c, 'Region not found', 404);
    }
    
    // ✅ SQL: Update region
    const updated = await regionsRepo.update(regionId, {
      name: updates.regionName || existing.name,
      region_config: updates.region_config || existing.region_config,
      is_active: updates.isActive !== undefined ? updates.isActive : existing.is_active,
    });
    
    return sendSuccess(c, { region: updated }, 'Region updated successfully');
  } catch (error) {
    console.error('Error updating region:', error);
    return sendError(c, error, 500);
  }
});

// Toggle region status endpoint
app.patch('/make-server-3dd53475/admin/regions/:regionId/status', async (c) => {
  try {
    const regionId = c.req.param('regionId');
    const { isActive } = await c.req.json();
    
    // ✅ SQL: Get existing region
    const regionsRepo = getRegionsRepository();
    const existing = await regionsRepo.findByCode(regionId);
    if (!existing) {
      return sendError(c, 'Region not found', 404);
    }
    
    // ✅ SQL: Update region status
    await regionsRepo.setActive(regionId, isActive);
    
    return sendSuccess(c, {}, 'Region status updated successfully');
  } catch (error) {
    console.error('Error updating region status:', error);
    return sendError(c, error, 500);
  }
});

// Initialize India region endpoint - IDEMPOTENT, NO AUTO-CREATION
app.post('/make-server-3dd53475/admin/regions/init-india', async (c) => {
  try {
    console.log('🌍 POST /admin/regions/init-india called');
    
    // ✅ SQL: Check if region already exists
    console.log('🔍 Checking if India region already exists...');
    const regionsRepo = getRegionsRepository();
    const existing = await regionsRepo.findByCode('india');
    
    if (existing) {
      console.log('✅ India region already exists, returning existing');
      return sendSuccess(c, { region: existing }, 'India region already exists');
    }
    
    console.log('🔨 Creating India region...');
    
    // ✅ SQL: Create India region
    const indiaRegion = await regionsRepo.create({
      id: 'india',
      code: 'IN',
      name: 'India',
      country_code: 'IND',
      currency_code: 'INR',
      currency_symbol: '₹',
      timezone: 'Asia/Kolkata',
      region_config: {
        currency: {
          code: 'INR',
          symbol: '₹',
          name: 'Indian Rupee',
        },
        phoneConfig: {
          countryCode: '+91',
          format: '+91 XXXXX XXXXX',
          length: 10,
          validation: '/^[6-9]\\d{9}$/',
        },
        serviceCatalog: {
          veterinary: true,
          grooming: true,
          training: true,
          daycare: true,
          boarding: true,
          walking: true,
          sitting: true,
          adoption: true,
          ecommerce: true,
          telemedicine: true,
          emergency: true,
          nutrition: true,
          breeding: true,
          photography: true,
          insurance: true,
          cremation: true,
          spa: true,
          cafe: true,
          'mating-dating': true,
        },
        popularBreeds: {
          dogs: ['Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'Beagle', 'Pug', 'Indian Pariah Dog'],
          cats: ['Persian', 'Siamese', 'Maine Coon', 'Indian Street Cat', 'British Shorthair'],
        },
        localization: {
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '12h',
          timezone: 'Asia/Kolkata',
        },
        business: {
          taxRate: 18,
          taxName: 'GST',
        },
      },
      is_active: true,
    });
    
    console.log('✅ India region initialized successfully');
    
    return sendSuccess(c, { region: indiaRegion }, 'India region initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing India region:', error);
    return sendError(c, error, 500);
  }
});

// CRITICAL ACTION GUARD
// Protects destructive endpoints from accidental execution
app.use('/make-server-3dd53475/admin/catalog/clear', criticalActionGuard());
app.use('/make-server-3dd53475/admin/catalog/seed', criticalActionGuard());
app.use('/make-server-3dd53475/admin/onboarding-fields/sync', criticalActionGuard());

// ------------------------------------------------------------------
// REGISTER ROUTES
// IMPORTANT: Order matters! Specific routes must be registered before generic wildcards.
// ------------------------------------------------------------------

// 1. Universal Problem Discovery (Specific /customer/ path)
registerUniversalDiscovery(app);
registerUniversalCustomerSearch(app);
registerCustomerBookingHistory(app);
registerCustomerSearchEndpoints(app);
// ✅ SQL MIGRATION: These endpoints need to be migrated - using SQL-compatible versions
notificationEndpoints(app); // TODO: Migrate to SQL
// ✅ SQL MIGRATION: Review endpoints now use SQL repositories - no KV needed
reviewEndpoints(app); // TODO: Migrate to SQL
// ✅ SQL MIGRATION: Analytics endpoints now use SQL repositories - no KV needed
analyticsEndpoints(app); // TODO: Migrate to SQL

// ✅ NEW: Advanced Search Engine with Fuse.js
console.log('🔍 Registering Advanced Search Engine...');
enhancedSearchEngineEndpoints(app);

// 2. Vendor Specific Routes (Dashboard, Onboarding, Config, Services)
// These must be registered BEFORE customer-routes because customer-routes
// contains a generic /vendor/:vendorId wildcard that would shadow these.
vendorOnboardingEndpoints(app);
soloProviderEndpoints(app); // ✅ FIX: Solo provider onboarding endpoints
vendorApprovalWorkflowEndpoints(app);
vendorDashboardEndpoints(app);
vendorRoleConfigEndpoints(app);
registerDynamicOnboarding(app);
onboardingConfigEndpoints(app); // ✅ NEW: Register onboarding config endpoints for multi-staff applications
registerVendorServiceEndpoints(app);
registerVendorCatalogAPIV2(app);
customServiceEndpoints(app); // ✅ FIX: Register custom service endpoints
// ✅ SQL-based Vendor Schedule V2 (NO KV STORE)
app.route('/make-server-3dd53475', vendorScheduleV2SQL);
console.log('✅ Registered SQL-based Vendor Schedule V2 Endpoints (NO KV STORE)');

// ✅ SQL-based Home Services Endpoints (NO KV STORE)
homeServicesEndpointsSQL(app);
console.log('✅ Registered SQL-based Home Services Endpoints (NO KV STORE)');

// ✅ FIX: Register Vet Specialized Services (ambulance, diagnostics, pharmacy, emergency protocols)
if (vetSpecializedServices && typeof vetSpecializedServices === 'object') {
  console.log('✅ Registering Vet Specialized Services (Ambulance, Diagnostics, Pharmacy)...');
  app.route('/make-server-3dd53475', vetSpecializedServices);
} else {
  console.warn('⚠️ Vet Specialized Services module undefined, skipping');
}

// ✅ FIX: Register Staff CRUD Endpoints (create, read, update, delete staff members)
if (staffCrudEndpoints && typeof staffCrudEndpoints === 'object') {
  console.log('✅ Registering Staff CRUD Endpoints (Create, Read, Update, Delete)...');
  app.route('/', staffCrudEndpoints); // Mount without prefix as it already has /make-server-3dd53475
} else {
  console.warn('⚠️ Staff CRUD Endpoints module undefined, skipping');
}

// 3. Admin Routes
registerAdminVendorRoutes(app);
// ✅ SQL MIGRATION: Admin vendor endpoints now use SQL repositories - no KV needed
adminVendorEndpoints(app);
registerAdminCatalogEndpoints(app);
adminIntegrationEndpoints(app);
registerVendorSettingsRulesEndpoints(app);
registerVideoCallEndpoints(app);
regionEndpoints(app);
registerProblemGridSpecializationSystem(app);

// 4. Core Customer & Auth Routes
// MUST BE REGISTERED BEFORE STAFF ROUTES to avoid shadowing by staff wildcard router
registerCustomerServices(app); // Register specific routes BEFORE wildcard
registerCustomerRoutes(app);
registerAuthEndpoints(app);
registerAICRMRoutes(app);
registerAIChatbotRoutes(app);
// ✅ SQL MIGRATION: Payment endpoints now use SQL repositories - no KV needed
paymentEndpoints(app);
// TODO: Migrate marketplacePaymentEndpoints to SQL
marketplacePaymentEndpoints(app);
registerChatEndpoints(app);
registerSubscriptionEndpoints(app);
registerVideoConsultationEndpoints(app);
registerMedicalHistoryEndpoints(app);
registerUniversalStaffSchedule(app);
registerCenterAvailabilityEndpoints(app);
registerBoardingRoomManagement(app);
registerNutritionistMealManagement(app);
registerServicePackageManagement(app);
registerCustomerPackageEndpoints(app); // ✅ GAP #3 FIX
registerVendorMetricsEnhancement(app); // ✅ GAP #8 FIX
// ✅ SQL MIGRATION: Booking endpoints now use SQL repositories - no KV needed
bookingEndpoints(app);
registerCafeFeatures(app);
registerCapabilityEndpoints(app);
registerResortInventory(app);

// Marketing routes with error handling
if (marketingRoutesV2 && typeof marketingRoutesV2 === 'object') {
  console.log('✅ Registering marketing routes...');
  app.route('/make-server-3dd53475/marketing', marketingRoutesV2);
} else {
  console.warn('⚠️ Marketing routes module is undefined or invalid, skipping registration');
}

registerMarketplaceProducts(app);
registerUniversalServiceDiscovery(app);
registerUniversalOTPSystem(app);
registerHomeServiceBookingFlow(app);
registerBookingLifecycleManagement(app);
bookingLifecycleCompleteEndpoints(app);
registerPayoutCronJob(app);
registerSmsOtpService(app);
registerRazorpayRefundProcessor(app);
registerGooglePlacesService(app);
// ✅ SQL MIGRATION: Removed registerSettlementAutomation(app) - using SQL version (registerSettlementAutomationSQL) below
registerS3AutoUploader(app);
const smsNotifications = registerSmsEventNotifications(app);

// ✅ Payment & Logistics Integrations
registerShiprocketIntegration(app);
registerDelhiveryIntegration(app);
registerLogisticsRoutingEndpoints(app);
registerReturnsManagementEndpoints(app);

// ✅ Enterprise Admin Capabilities
analyticsAggregationEndpoints(app);
// ✅ SQL MIGRATION: RBAC endpoints now use SQL repositories - no KV needed
rbacEndpoints(app);
reportBuilderEndpoints(app);
petIntelligenceEndpoints(app);
transactionMonitoringEndpoints(app);

// ✅ Content Management System
console.log('✅ Registering Content Management Endpoints...');
registerContentManagementEndpoints(app);

// ✅ Mating & Dating Service
console.log('✅ Registering Mating & Dating Service Endpoints...');
registerMatingDatingService(app);

// ✅ Pet Suggestion System
console.log('✅ Registering Pet Suggestion System Endpoints...');
registerPetSuggestionSystem(app);

// ✅ Platform Subscription Tiers (includes subscription access check)
console.log('✅ Registering Platform Subscription Tiers Endpoints...');
registerPlatformSubscriptionTiers(app);

// ✅ AWS Chime Integration (Video & Chat)
console.log('✅ Registering AWS Chime Video Endpoints...');
registerAWSChimeVideoEndpoints(app);
console.log('✅ Registering AWS Chime Chat Endpoints...');
registerAWSChimeChatEndpoints(app);

// ✅ Dating Chat Endpoints (uses Chime or KV fallback)
console.log('✅ Registering Dating Chat Endpoints...');
registerDatingChatEndpoints(app);

// ✅ Promotion Endpoints
console.log('✅ Registering Promotion Endpoints...');
promotionEndpoints(app);

// ✅ NEW: Phase 2 & 3 Endpoints
if (ambulanceServiceEndpoints && typeof ambulanceServiceEndpoints === 'function') {
  console.log('✅ Registering Ambulance Service Endpoints...');
  ambulanceServiceEndpoints(app);
} else {
  console.warn('⚠️ Ambulance Service Endpoints module undefined, skipping');
}

if (diagnosticsCenterEndpoints && typeof diagnosticsCenterEndpoints === 'function') {
  console.log('✅ Registering Diagnostics Center Endpoints...');
  diagnosticsCenterEndpoints(app);
} else {
  console.warn('⚠️ Diagnostics Center Endpoints module undefined, skipping');
}

if (razorpayPaymentEndpoints && typeof razorpayPaymentEndpoints === 'function') {
  console.log('✅ Registering Razorpay Payment Endpoints...');
  razorpayPaymentEndpoints(app);
} else {
  console.warn('⚠️ Razorpay Payment Endpoints module undefined, skipping');
}

// ✅ SQL MIGRATION: Register migrated payment endpoints
if (paymentRazorpayEndpoints && typeof paymentRazorpayEndpoints === 'function') {
  console.log('✅ Registering Payment Razorpay Endpoints (SQL)...');
  paymentRazorpayEndpoints(app);
} else {
  console.warn('⚠️ Payment Razorpay Endpoints module undefined, skipping');
}

// ✅ SQL MIGRATION: Register grooming booking APIs
if (groomingBookingAPIs) {
  console.log('✅ Registering Grooming Booking APIs (SQL)...');
  app.route('/', groomingBookingAPIs);
} else {
  console.warn('⚠️ Grooming Booking APIs module undefined, skipping');
}

// ✅ SQL MIGRATION: Register Razorpay payment integration
if (razorpayPaymentIntegration) {
  console.log('✅ Registering Razorpay Payment Integration (SQL)...');
  app.route('/', razorpayPaymentIntegration);
} else {
  console.warn('⚠️ Razorpay Payment Integration module undefined, skipping');
}

if (specializedServicesEndpoints && typeof specializedServicesEndpoints === 'function') {
  console.log('✅ Registering Specialized Services Endpoints...');
  specializedServicesEndpoints(app);
} else {
  console.warn('⚠️ Specialized Services Endpoints module undefined, skipping');
}

// ✅ NEW: Specialized Vendor Configuration Endpoints
if (specializedVendorConfigEndpoints && typeof specializedVendorConfigEndpoints === 'function') {
  console.log('✅ Registering Specialized Vendor Config Endpoints...');
  specializedVendorConfigEndpoints(app);
} else {
  console.warn('⚠️ Specialized Vendor Config Endpoints module undefined, skipping');
}

// ✅ NEW: Backwards Compatible Endpoints (UI Compatibility Layer)
if (backwardsCompatibleEndpoints && typeof backwardsCompatibleEndpoints === 'function') {
  console.log('🔄 Registering Backwards Compatible Endpoints...');
  backwardsCompatibleEndpoints(app);
} else {
  console.warn('⚠️ Backwards Compatible Endpoints module undefined, skipping');
}

if (insuranceEndpoints && typeof insuranceEndpoints === 'function') {
  console.log('✅ Registering Insurance Endpoints...');
  insuranceEndpoints(app);
} else {
  console.warn('⚠️ Insurance Endpoints module undefined, skipping');
}

if (trainingProgressEndpoints && typeof trainingProgressEndpoints === 'function') {
  console.log('✅ Registering Training Progress Endpoints...');
  trainingProgressEndpoints(app);
} else {
  console.warn('⚠️ Training Progress Endpoints module undefined, skipping');
}

// ✅ NEW: Phase 4 Endpoints
if (instantTeleEndpoints && typeof instantTeleEndpoints === 'function') {
  console.log('✅ Registering Instant Tele-Consultation Endpoints...');
  instantTeleEndpoints(app);
} else {
  console.warn('⚠️ Instant Tele Endpoints module undefined, skipping');
}

if (petProfilePublishingEndpoints && typeof petProfilePublishingEndpoints === 'function') {
  console.log('✅ Registering Pet Profile Publishing Endpoints...');
  petProfilePublishingEndpoints(app);
} else {
  console.warn('⚠️ Pet Profile Publishing Endpoints module undefined, skipping');
}

if (deliveryIntegrationEndpoints && typeof deliveryIntegrationEndpoints === 'function') {
  console.log('✅ Registering Delivery Integration Endpoints...');
  deliveryIntegrationEndpoints(app);
} else {
  console.warn('⚠️ Delivery Integration Endpoints module undefined, skipping');
}

if (resortPreCheckEndpoints && typeof resortPreCheckEndpoints === 'function') {
  console.log('✅ Registering Resort Pre-Check Endpoints...');
  resortPreCheckEndpoints(app);
} else {
  console.warn('⚠️ Resort Pre-Check Endpoints module undefined, skipping');
}

// ✅ NEW: Phase 5 Endpoints
if (notificationTemplateSystem && typeof notificationTemplateSystem === 'function') {
  console.log('✅ Registering Notification Template System...');
  notificationTemplateSystem(app);
} else {
  console.warn('⚠️ Notification Template System module undefined, skipping');
}

if (bankVerificationEndpoints && typeof bankVerificationEndpoints === 'function') {
  console.log('✅ Registering Bank Verification Endpoints...');
  bankVerificationEndpoints(app);
} else {
  console.warn('⚠️ Bank Verification Endpoints module undefined, skipping');
}

if (tierUpgradeEndpoints && typeof tierUpgradeEndpoints === 'function') {
  console.log('✅ Registering Tier Upgrade Endpoints...');
  tierUpgradeEndpoints(app);
} else {
  console.warn('⚠️ Tier Upgrade Endpoints module undefined, skipping');
}

if (settlementScheduleEndpoints && typeof settlementScheduleEndpoints === 'function') {
  console.log('✅ Registering Settlement Schedule Endpoints...');
  settlementScheduleEndpoints(app);
} else {
  console.warn('⚠️ Settlement Schedule Endpoints module undefined, skipping');
}

if (gstRuleEngineEndpoints && typeof gstRuleEngineEndpoints === 'function') {
  console.log('✅ Registering GST Rule Engine Endpoints...');
  gstRuleEngineEndpoints(app);
} else {
  console.warn('⚠️ GST Rule Engine Endpoints module undefined, skipping');
}

if (gstConfigurationEndpoints && typeof gstConfigurationEndpoints === 'function') {
  console.log('✅ Registering GST Configuration Endpoints...');
  gstConfigurationEndpoints(app);
} else {
  console.warn('⚠️ GST Configuration Endpoints module undefined, skipping');
}

if (cancellationPolicyEndpoints && typeof cancellationPolicyEndpoints === 'function') {
  console.log('✅ Registering Cancellation Policy Endpoints...');
  cancellationPolicyEndpoints(app);
} else {
  console.warn('⚠️ Cancellation Policy Endpoints module undefined, skipping');
}

if (comprehensiveGapFixes && typeof comprehensiveGapFixes === 'function') {
  console.log('✅ Registering Comprehensive Gap Fixes Endpoints...');
  comprehensiveGapFixes(app);
} else {
  console.warn('⚠️ Comprehensive Gap Fixes module undefined, skipping');
}

if (analyticsDashboardEndpoints && typeof analyticsDashboardEndpoints === 'function') {
  console.log('✅ Registering Analytics Dashboard Endpoints...');
  analyticsDashboardEndpoints(app);
} else {
  console.warn('⚠️ Analytics Dashboard Endpoints module undefined, skipping');
}

if (performanceMonitoringEndpoints && typeof performanceMonitoringEndpoints === 'function') {
  console.log('✅ Registering Performance Monitoring Endpoints...');
  performanceMonitoringEndpoints(app);
} else {
  console.warn('⚠️ Performance Monitoring Endpoints module undefined, skipping');
}

if (systemOptimizationEndpoints && typeof systemOptimizationEndpoints === 'function') {
  console.log('✅ Registering System Optimization Endpoints...');
  systemOptimizationEndpoints(app);
} else {
  console.warn('⚠️ System Optimization Endpoints module undefined, skipping');
}

if (elasticsearchCoreEndpoints && typeof elasticsearchCoreEndpoints === 'function') {
  console.log('✅ Registering Elasticsearch Core Endpoints...');
  elasticsearchCoreEndpoints(app);
} else {
  console.warn('⚠️ Elasticsearch Core Endpoints module undefined, skipping');
}

if (advancedSearchAPI && typeof advancedSearchAPI === 'function') {
  console.log('✅ Registering Advanced Search API...');
  advancedSearchAPI(app);
} else {
  console.warn('⚠️ Advanced Search API module undefined, skipping');
}

if (searchAnalyticsAPI && typeof searchAnalyticsAPI === 'function') {
  console.log('✅ Registering Search Analytics API...');
  searchAnalyticsAPI(app); // ✅ SQL MIGRATION: Removed kv parameter
} else {
  console.warn('⚠️ Search Analytics API module undefined, skipping');
}

if (nutritionistSystemEndpoints && typeof nutritionistSystemEndpoints === 'function') {
  console.log('✅ Registering Nutritionist System Endpoints...');
  nutritionistSystemEndpoints(app);
} else {
  console.warn('⚠️ Nutritionist System Endpoints module undefined, skipping');
}

// ✅ NEW: Nutritionist Diet & Food Delivery Endpoints (Rule 8)
if (nutritionistDietPlanEndpoints && typeof nutritionistDietPlanEndpoints === 'function') {
  console.log('✅ Registering Nutritionist Diet Plan Endpoints...');
  nutritionistDietPlanEndpoints(app);
} else {
  console.warn('⚠️ Nutritionist Diet Plan Endpoints module undefined, skipping');
}

if (nutritionistFoodIntegrationEndpoints && typeof nutritionistFoodIntegrationEndpoints === 'function') {
  console.log('✅ Registering Nutritionist Food Integration Endpoints...');
  nutritionistFoodIntegrationEndpoints(app);
} else {
  console.warn('⚠️ Nutritionist Food Integration Endpoints module undefined, skipping');
}

if (nutritionistFoodDeliveryEndpoints && typeof nutritionistFoodDeliveryEndpoints === 'function') {
  console.log('✅ Registering Nutritionist Food Delivery Endpoints...');
  nutritionistFoodDeliveryEndpoints(app);
} else {
  console.warn('⚠️ Nutritionist Food Delivery Endpoints module undefined, skipping');
}

if (foodDeliveryHyperlocalEndpoints && typeof foodDeliveryHyperlocalEndpoints === 'function') {
  console.log('✅ Registering Food Delivery Hyperlocal Endpoints...');
  foodDeliveryHyperlocalEndpoints(app);
} else {
  console.warn('⚠️ Food Delivery Hyperlocal Endpoints module undefined, skipping');
}

if (holidayPackageSystemEndpoints && typeof holidayPackageSystemEndpoints === 'function') {
  console.log('✅ Registering Holiday Package System Endpoints...');
  holidayPackageSystemEndpoints(app);
} else {
  console.warn('⚠️ Holiday Package System Endpoints module undefined, skipping');
}

// ✅ Priority 2 Enhanced Endpoints
if (enhancedServicePublishing && typeof enhancedServicePublishing === 'object') {
  app.route('/make-server-3dd53475', enhancedServicePublishing);
} else {
  console.warn('⚠️ Enhanced Service Publishing module undefined, skipping');
}

if (enhancedStaffAvailability && typeof enhancedStaffAvailability === 'object') {
  app.route('/make-server-3dd53475', enhancedStaffAvailability);
} else {
  console.warn('⚠️ Enhanced Staff Availability module undefined, skipping');
}

// ✅ CRITICAL: Specialized Vendor Configuration Endpoints
if (specializedVendorConfigEndpoints && typeof specializedVendorConfigEndpoints === 'object') {
  console.log('✅ Registering Specialized Vendor Config Endpoints...');
  app.route('/make-server-3dd53475', specializedVendorConfigEndpoints);
} else {
  console.warn('⚠️ Specialized Vendor Config Endpoints module undefined, skipping');
}

// ✅ P1 Vendor-Specific Features
if (registerGroomerGalleryEndpoints && typeof registerGroomerGalleryEndpoints === 'function') {
  registerGroomerGalleryEndpoints(app);
} else {
  console.warn('⚠️ Groomer Gallery System module undefined, skipping');
}

if (trainerProgressTracking && typeof trainerProgressTracking === 'object') {
  app.route('/make-server-3dd53475', trainerProgressTracking);
} else {
  console.warn('⚠️ Trainer Progress Tracking module undefined, skipping');
}

if (cafeTableManagement && typeof cafeTableManagement === 'object') {
  app.route('/make-server-3dd53475', cafeTableManagement);
} else {
  console.warn('⚠️ Cafe Table Management module undefined, skipping');
}

if (registerInsuranceClaimEndpoints && typeof registerInsuranceClaimEndpoints === 'function') {
  registerInsuranceClaimEndpoints(app);
} else {
  console.warn('⚠️ Insurance Claim Management module undefined, skipping');
}

// ✅ Customer App Features (Manually Edited)
if (customerWalletTopup && typeof customerWalletTopup === 'object') {
  app.route('/make-server-3dd53475', customerWalletTopup);
} else {
  console.warn('⚠️ Customer Wallet Topup module undefined, skipping');
}

if (rewardsLoyaltySystem && typeof rewardsLoyaltySystem === 'object') {
  app.route('/make-server-3dd53475', rewardsLoyaltySystem);
} else {
  console.warn('⚠️ Rewards Loyalty System module undefined, skipping');
}

// ✅ NEW: Missing API Endpoints (Priority 1 Critical Fixes)
if (portfolioEndpoints && typeof portfolioEndpoints === 'object') {
  app.route('/make-server-3dd53475/vendor/portfolio', portfolioEndpoints);
  console.log('✅ Registered Portfolio Endpoints');
} else {
  console.warn('⚠️ Portfolio Endpoints module undefined, skipping');
}

if (cctvAccessEndpoints && typeof cctvAccessEndpoints === 'object') {
  app.route('/make-server-3dd53475/vendor/cctv', cctvAccessEndpoints);
  console.log('✅ Registered CCTV Access Endpoints');
} else {
  console.warn('⚠️ CCTV Access Endpoints module undefined, skipping');
}

if (controlledSubstancesEndpoints && typeof controlledSubstancesEndpoints === 'object') {
  app.route('/make-server-3dd53475/vendor/controlled-substances', controlledSubstancesEndpoints);
  console.log('✅ Registered Controlled Substances Endpoints');
} else {
  console.warn('⚠️ Controlled Substances Endpoints module undefined, skipping');
}

if (vetSummaryEndpoints && typeof vetSummaryEndpoints === 'object') {
  app.route('/make-server-3dd53475/vendor/vet-summary', vetSummaryEndpoints);
  console.log('✅ Registered Vet Summary Endpoints');
} else {
  console.warn('⚠️ Vet Summary Endpoints module undefined, skipping');
}

if (adoptionEndpoints && typeof adoptionEndpoints === 'object') {
  app.route('/make-server-3dd53475/vendor/adoption', adoptionEndpoints);
  console.log('✅ Registered Adoption Endpoints');
} else {
  console.warn('⚠️ Adoption Endpoints module undefined, skipping');
}

if (memorialEndpoints && typeof memorialEndpoints === 'object') {
  app.route('/make-server-3dd53475/vendor/memorial', memorialEndpoints);
  console.log('✅ Registered Memorial Endpoints');
} else {
  console.warn('⚠️ Memorial Endpoints module undefined, skipping');
}

if (expiryManagementEndpoints && typeof expiryManagementEndpoints === 'object') {
  app.route('/make-server-3dd53475/vendor/expiry-management', expiryManagementEndpoints);
  console.log('✅ Registered Expiry Management Endpoints');
} else {
  console.warn('⚠️ Expiry Management Endpoints module undefined, skipping');
}

if (donationManagementEndpoints && typeof donationManagementEndpoints === 'object') {
  app.route('/make-server-3dd53475/vendor/donation-management', donationManagementEndpoints);
  console.log('✅ Registered Donation Management Endpoints');
} else {
  console.warn('⚠️ Donation Management Endpoints module undefined, skipping');
}

if (eventManagementEndpoints && typeof eventManagementEndpoints === 'object') {
  app.route('/make-server-3dd53475/vendor/event-management', eventManagementEndpoints);
  console.log('✅ Registered Event Management Endpoints');
} else {
  console.warn('⚠️ Event Management Endpoints module undefined, skipping');
}

if (patientMonitoringEndpoints && typeof patientMonitoringEndpoints === 'object') {
  app.route('/make-server-3dd53475/vendor/patient-monitoring', patientMonitoringEndpoints);
  console.log('✅ Registered Patient Monitoring Endpoints');
} else {
  console.warn('⚠️ Patient Monitoring Endpoints module undefined, skipping');
}

if (customerEcommerceEndpoints && typeof customerEcommerceEndpoints === 'object') {
  app.route('/make-server-3dd53475', customerEcommerceEndpoints);
  console.log('✅ Registered Customer E-commerce Endpoints');
} else {
  console.warn('⚠️ Customer E-commerce Endpoints module undefined, skipping');
}

if (additionalCapabilitiesEndpoints && typeof additionalCapabilitiesEndpoints === 'object') {
  app.route('/make-server-3dd53475/vendor/additional-capabilities', additionalCapabilitiesEndpoints);
  console.log('✅ Registered Additional Capabilities Endpoints');
} else {
  console.warn('⚠️ Additional Capabilities Endpoints module undefined, skipping');
}

// ✅ Appointment Detail & Prescription Endpoints
if (appointmentDetailEndpoints && typeof appointmentDetailEndpoints === 'object') {
  app.route('/', appointmentDetailEndpoints);
  console.log('✅ Registered Appointment Detail & Prescription Endpoints');
} else {
  console.warn('⚠️ Appointment Detail Endpoints module undefined, skipping');
}

// ✅ P0 Features
registerP0Features(app);

// 5. Staff Routes - COMMENTED OUT: These modules are not imported/defined
// Register Staff Auth Endpoints
try {
  const { staffAuthEndpoints } = await import('./staff-auth-endpoints.tsx');
  if (staffAuthEndpoints && typeof staffAuthEndpoints === 'function') {
    console.log('✅ Registering Staff Auth Endpoints...');
    staffAuthEndpoints(app);
  } else {
    console.warn('⚠️ Staff Auth Endpoints module undefined, skipping');
  }
} catch (error) {
  console.warn('⚠️ Failed to import Staff Auth Endpoints:', error);
}

// if (staffAvailabilityRoutes && typeof staffAvailabilityRoutes === 'object') {
//   app.route('/make-server-3dd53475/staff', staffAvailabilityRoutes);
// } else {
//   console.warn('⚠️ Staff Availability Routes module undefined, skipping');
// }

// if (staffScheduleRoutes && typeof staffScheduleRoutes === 'object') {
//   app.route('/', staffScheduleRoutes);
// } else {
//   console.warn('⚠️ Staff Schedule Routes module undefined, skipping');
// }

// if (staffCRUDRoutes && typeof staffCRUDRoutes === 'object') {
//   app.route('/', staffCRUDRoutes);
// } else {
//   console.warn('⚠️ Staff CRUD Routes module undefined, skipping');
// }

// ✅ CRITICAL: Staff service and discovery endpoints
// Staff Service Endpoints - requires both app and kv parameters
// COMMENTED OUT: staffServiceEndpoints is not imported/defined
// console.log('✅ Registering staff service endpoints...');
// staffServiceEndpoints(app, kv);

// if (staffDiscoveryEndpoints && typeof staffDiscoveryEndpoints === 'object') {
//   console.log('✅ Registering staff discovery endpoints...');
//   app.route('/make-server-3dd53475', staffDiscoveryEndpoints);
// } else {
//   console.warn('⚠️ Staff Discovery Endpoints module undefined, skipping');
// }

// if (universalStaffSearch && typeof universalStaffSearch === 'object') {
//   console.log('✅ Registering universal staff search...');
//   app.route('/make-server-3dd53475', universalStaffSearch);
// } else {
//   console.warn('⚠️ Universal Staff Search module undefined, skipping');
// }

// if (universalStaffProblemSearch && typeof universalStaffProblemSearch === 'object') {
//   console.log('✅ Registering universal staff problem search...');
//   app.route('/make-server-3dd53475', universalStaffProblemSearch);
// } else {
//   console.warn('⚠️ Universal Staff Problem Search module undefined, skipping');
// }

// ✅ NEW: Register missing CRUD endpoints
if (missingCrudEndpoints && typeof missingCrudEndpoints === 'object') {
  console.log('✅ Registering missing CRUD endpoints...');
  app.route('/make-server-3dd53475', missingCrudEndpoints);
} else {
  console.warn('⚠️ Missing CRUD Endpoints module undefined, skipping');
}

// ✅ NEW: Register facility endpoints
if (facilityEndpoints && typeof facilityEndpoints === 'object') {
  console.log('✅ Registering facility endpoints...');
  app.route('/make-server-3dd53475', facilityEndpoints);
} else {
  console.warn('⚠️ Facility Endpoints module undefined, skipping');
}

// ✅ NEW: Register package endpoints
if (packageEndpoints && typeof packageEndpoints === 'function') {
  console.log('✅ Registering package endpoints...');
  packageEndpoints(app);
} else {
  console.warn('⚠️ Package Endpoints module undefined, skipping');
}

// ✅ NEW: Additional Capabilities Endpoints (Prescription Verification, Delivery, Diet Charts, Counseling, Policy Management)
if (additionalCapabilitiesEndpoints && typeof additionalCapabilitiesEndpoints === 'object') {
  app.route('/make-server-3dd53475', additionalCapabilitiesEndpoints);
  console.log('✅ Registered Additional Capabilities Endpoints (Prescription Verification, Delivery, Diet Charts, Counseling, Policy Management)');
} else {
  console.warn('⚠️ Additional Capabilities Endpoints module undefined, skipping');
}

// ✅ NEW: Pharmacy Prescription Endpoints
if (pharmacyPrescriptionEndpoints && typeof pharmacyPrescriptionEndpoints === 'function') {
  console.log('✅ Registering Pharmacy Prescription Endpoints...');
  pharmacyPrescriptionEndpoints(app);
} else {
  console.warn('⚠️ Pharmacy Prescription Endpoints module undefined, skipping');
}

// ✅ NEW: Home Sample Collection Endpoints
if (homeSampleCollectionEndpoints && typeof homeSampleCollectionEndpoints === 'function') {
  console.log('✅ Registering Home Sample Collection Endpoints...');
  homeSampleCollectionEndpoints(app);
} else {
  console.warn('⚠️ Home Sample Collection Endpoints module undefined, skipping');
}

// ✅ NEW: Holiday Package Endpoints
if (holidayPackageEndpoints && typeof holidayPackageEndpoints === 'function') {
  console.log('✅ Registering Holiday Package Endpoints...');
  holidayPackageEndpoints(app);
} else {
  console.warn('⚠️ Holiday Package Endpoints module undefined, skipping');
}

// ✅ NEW: SMS Notification Service Enhanced
if (smsNotificationServiceEnhanced && typeof smsNotificationServiceEnhanced === 'function') {
  console.log('✅ Registering SMS Notification Service Enhanced...');
  smsNotificationServiceEnhanced(app);
} else {
  console.warn('⚠️ SMS Notification Service Enhanced module undefined, skipping');
}

// ✅ NEW: Tier System Integration
if (tierSystemIntegration && typeof tierSystemIntegration === 'function') {
  console.log('✅ Registering Tier System Integration...');
  tierSystemIntegration(app); // ✅ SQL MIGRATION: Removed kv parameter
} else {
  console.warn('⚠️ Tier System Integration module undefined, skipping');
}

// ✅ NEW: Hyperlocal Delivery Endpoints
if (hyperlocalDeliveryEndpoints && typeof hyperlocalDeliveryEndpoints === 'function') {
  console.log('✅ Registering Hyperlocal Delivery Endpoints...');
  hyperlocalDeliveryEndpoints(app);
} else {
  console.warn('⚠️ Hyperlocal Delivery Endpoints module undefined, skipping');
}

// ✅ NEW: Marketplace Settlement Enhanced
if (marketplaceSettlementEnhanced && typeof marketplaceSettlementEnhanced === 'function') {
  console.log('✅ Registering Marketplace Settlement Enhanced...');
  marketplaceSettlementEnhanced(app);
} else {
  console.warn('⚠️ Marketplace Settlement Enhanced module undefined, skipping');
}

// ✅ NEW: Elasticsearch Integration
if (elasticsearchIntegration && typeof elasticsearchIntegration === 'function') {
  console.log('✅ Registering Elasticsearch Integration...');
  elasticsearchIntegration(app);
} else {
  console.warn('⚠️ Elasticsearch Integration module undefined, skipping');
}

// ✅ NEW: Integrated Services Endpoints
if (integratedServicesEndpoints && typeof integratedServicesEndpoints === 'function') {
  console.log('✅ Registering Integrated Services Endpoints...');
  integratedServicesEndpoints(app);
} else {
  console.warn('⚠️ Integrated Services Endpoints module undefined, skipping');
}

// ✅ NEW: Specialized Services Booking
if (specializedServicesBooking && typeof specializedServicesBooking === 'function') {
  console.log('✅ Registering Specialized Services Booking...');
  specializedServicesBooking(app);
} else {
  console.warn('⚠️ Specialized Services Booking module undefined, skipping');
}

// ✅ NEW: Previous Providers Endpoints
if (previousProvidersEndpoints && typeof previousProvidersEndpoints === 'function') {
  console.log('✅ Registering Previous Providers Endpoints...');
  previousProvidersEndpoints(app);
} else {
  console.warn('⚠️ Previous Providers Endpoints module undefined, skipping');
}

// ✅ NEW: Radar Location System Endpoints
if (radarLocationSystemEndpoints && typeof radarLocationSystemEndpoints === 'function') {
  console.log('✅ Registering Radar Location System Endpoints...');
  radarLocationSystemEndpoints(app);
} else {
  console.warn('⚠️ Radar Location System Endpoints module undefined, skipping');
}

// ✅ NEW: Multi-Service Scheduling Endpoints
if (multiServiceSchedulingEndpoints && typeof multiServiceSchedulingEndpoints === 'function') {
  console.log('✅ Registering Multi-Service Scheduling Endpoints...');
  multiServiceSchedulingEndpoints(app);
} else {
  console.warn('⚠️ Multi-Service Scheduling Endpoints module undefined, skipping');
}

// ✅ NEW: Time Window Subscription Endpoints
if (timeWindowSubscriptionEndpoints && typeof timeWindowSubscriptionEndpoints === 'function') {
  console.log('✅ Registering Time Window Subscription Endpoints...');
  timeWindowSubscriptionEndpoints(app);
} else {
  console.warn('⚠️ Time Window Subscription Endpoints module undefined, skipping');
}

// ✅ NEW: Independent Vendor System Endpoints
if (independentVendorSystemEndpoints && typeof independentVendorSystemEndpoints === 'function') {
  console.log('✅ Registering Independent Vendor System Endpoints...');
  independentVendorSystemEndpoints(app);
} else {
  console.warn('⚠️ Independent Vendor System Endpoints module undefined, skipping');
}

// ✅ NEW: Unified Service Discovery Endpoints
if (unifiedServiceDiscoveryEndpoints && typeof unifiedServiceDiscoveryEndpoints === 'function') {
  console.log('✅ Registering Unified Service Discovery Endpoints...');
  unifiedServiceDiscoveryEndpoints(app);
} else {
  console.warn('⚠️ Unified Service Discovery Endpoints module undefined, skipping');
}

// ✅ NEW: SQL-Based Discovery Endpoints (NO KV STORE)
console.log('✅ Registering SQL-Based Discovery Endpoints...');
registerDiscoverySQLEndpoints(app);

// ✅ NEW: Regulated Flows SQL Endpoints (NO KV STORE)
console.log('✅ Registering Regulated Flows SQL Endpoints...');
registerRegulatedFlowsSQLEndpoints(app);

// ✅ NEW: SQL-based Payment Endpoints (NO KV STORE)
console.log('✅ Registering SQL-based Payment Endpoints...');
if (paymentEndpointsSQL && typeof paymentEndpointsSQL === 'function') {
  paymentEndpointsSQL(app);
  console.log('✅ Registered SQL-based Payment Endpoints (NO KV STORE)');
}

// ✅ NEW: SQL-based Payout Cron Job (NO KV STORE)
import { registerPayoutCronJobSQL } from './payout-cron-job-sql';
console.log('✅ Registering SQL-based Payout Cron Job...');
registerPayoutCronJobSQL(app);
console.log('✅ Registered SQL-based Payout Cron Job (NO KV STORE)');

// ✅ NEW: SQL-based Booking Endpoints (NO KV STORE)
import { bookingEndpointsSQL } from './booking-endpoints-sql';
console.log('✅ Registering SQL-based Booking Endpoints...');
bookingEndpointsSQL(app);
console.log('✅ Registered SQL-based Booking Endpoints (NO KV STORE)');

// ✅ NEW: SQL-based Customer Services (NO KV STORE)
import { registerCustomerServicesSQL } from './customer-services-sql';
console.log('✅ Registering SQL-based Customer Services...');
registerCustomerServicesSQL(app);
console.log('✅ Registered SQL-based Customer Services (NO KV STORE)');

// ✅ NEW: SQL-based RBAC Endpoints (NO KV STORE)
import { rbacEndpointsSQL } from './rbac-endpoints-sql';
console.log('✅ Registering SQL-based RBAC Endpoints...');
rbacEndpointsSQL(app);
console.log('✅ Registered SQL-based RBAC Endpoints (NO KV STORE)');

// ✅ NEW: SQL-based Settlement Automation (NO KV STORE)
import { registerSettlementAutomationSQL } from './settlement-automation-sql';
console.log('✅ Registering SQL-based Settlement Automation...');
registerSettlementAutomationSQL(app);
console.log('✅ Registered SQL-based Settlement Automation (NO KV STORE)');

// ✅ NEW: SQL-based Wallet Endpoints (NO KV STORE)
import { walletEndpointsSQL } from './wallet-endpoints-sql';
console.log('✅ Registering SQL-based Wallet Endpoints...');
walletEndpointsSQL(app);
console.log('✅ Registered SQL-based Wallet Endpoints (NO KV STORE)');

// ✅ NEW: SQL-based Order Endpoints (NO KV STORE)
import { orderEndpointsSQL } from './order-endpoints-sql';
console.log('✅ Registering SQL-based Order Endpoints...');
orderEndpointsSQL(app);
console.log('✅ Registered SQL-based Order Endpoints (NO KV STORE)');

// ✅ NEW: SQL-based Coupon Endpoints (NO KV STORE)
import { couponEndpointsSQL } from './coupon-endpoints-sql';
console.log('✅ Registering SQL-based Coupon Endpoints...');
couponEndpointsSQL(app);
console.log('✅ Registered SQL-based Coupon Endpoints (NO KV STORE)');

// ✅ NEW: SQL-based Scheduling Endpoints (NO KV STORE)
console.log('✅ Registering SQL-based Scheduling Endpoints...');
if (packageEndpointsSQL && typeof packageEndpointsSQL === 'function') {
  packageEndpointsSQL(app);
  console.log('✅ Registered SQL-based Package Endpoints (NO KV STORE)');
}

if (staffDiscoveryEndpointsSQL && typeof staffDiscoveryEndpointsSQL === 'function') {
  staffDiscoveryEndpointsSQL(app);
  console.log('✅ Registered SQL-based Staff Discovery Endpoints (NO KV STORE)');
}

if (followupEndpointsSQL && typeof followupEndpointsSQL === 'function') {
  followupEndpointsSQL(app);
  console.log('✅ Registered SQL-based Followup Endpoints (NO KV STORE)');
}

if (staffAvailabilityRoutesSQL && typeof staffAvailabilityRoutesSQL === 'function') {
  staffAvailabilityRoutesSQL(app);
  console.log('✅ Registered SQL-based Staff Availability Routes (NO KV STORE)');
}

// ✅ NEW: Logistics Partner Integration Endpoints
if (logisticsPartnerIntegrationEndpoints && typeof logisticsPartnerIntegrationEndpoints === 'function') {
  console.log('✅ Registering Logistics Partner Integration Endpoints...');
  logisticsPartnerIntegrationEndpoints(app);
} else {
  console.warn('⚠️ Logistics Partner Integration Endpoints module undefined, skipping');
}

// ✅ NEW: Automated Bank Verification Endpoints
if (automatedBankVerificationEndpoints && typeof automatedBankVerificationEndpoints === 'function') {
  console.log('✅ Registering Automated Bank Verification Endpoints...');
  automatedBankVerificationEndpoints(app);
} else {
  console.warn('⚠️ Automated Bank Verification Endpoints module undefined, skipping');
}

// ✅ NEW: Marketplace Settlement Automation Endpoints
if (marketplaceSettlementAutomationEndpoints && typeof marketplaceSettlementAutomationEndpoints === 'function') {
  console.log('✅ Registering Marketplace Settlement Automation Endpoints...');
  marketplaceSettlementAutomationEndpoints(app);
} else {
  console.warn('⚠️ Marketplace Settlement Automation Endpoints module undefined, skipping');
}

// ✅ NEW: Tier Commission Integration Endpoints
if (tierCommissionIntegrationEndpoints && typeof tierCommissionIntegrationEndpoints === 'function') {
  console.log('✅ Registering Tier Commission Integration Endpoints...');
  tierCommissionIntegrationEndpoints(app);
} else {
  console.warn('⚠️ Tier Commission Integration Endpoints module undefined, skipping');
}

// ✅ NEW: Rescheduling Policies Endpoints
if (reschedulingPoliciesEndpoints && typeof reschedulingPoliciesEndpoints === 'function') {
  console.log('✅ Registering Rescheduling Policies Endpoints...');
  reschedulingPoliciesEndpoints(app);
} else {
  console.warn('⚠️ Rescheduling Policies Endpoints module undefined, skipping');
}

// ✅ NEW: Services By Problem Endpoints (Rule 4)
if (servicesByProblemEndpoints && typeof servicesByProblemEndpoints === 'function') {
  console.log('✅ Registering Services By Problem Endpoints...');
  servicesByProblemEndpoints(app);
} else {
  console.warn('⚠️ Services By Problem Endpoints module undefined, skipping');
}

// ✅ NEW: Search Suggestions Endpoints (Rule 4)
if (searchSuggestionsEndpoints && typeof searchSuggestionsEndpoints === 'function') {
  console.log('✅ Registering Search Suggestions Endpoints...');
  searchSuggestionsEndpoints(app);
} else {
  console.warn('⚠️ Search Suggestions Endpoints module undefined, skipping');
}

// ✅ NEW: Enhanced Search Engine Endpoints (Rule 5)
if (enhancedSearchEngineEndpoints && typeof enhancedSearchEngineEndpoints === 'function') {
  console.log('✅ Registering Enhanced Search Engine Endpoints...');
  enhancedSearchEngineEndpoints(app);
} else {
  console.warn('⚠️ Enhanced Search Engine Endpoints module undefined, skipping');
}

// ✅ NEW: QA Gap Fixes Endpoints
if (qaGapFixesEndpoints && typeof qaGapFixesEndpoints === 'object') {
  console.log('✅ Registering QA Gap Fixes Endpoints...');
  app.route('/make-server-3dd53475', qaGapFixesEndpoints);
} else {
  console.warn('⚠️ QA Gap Fixes Endpoints module undefined, skipping');
}

// ✅ NEW: Performance Optimization Endpoints
if (performanceOptimizationEndpoints && typeof performanceOptimizationEndpoints === 'object') {
  console.log('✅ Registering Performance Optimization Endpoints...');
  app.route('/make-server-3dd53475', performanceOptimizationEndpoints);
} else {
  console.warn('⚠️ Performance Optimization Endpoints module undefined, skipping');
}

// ✅ NEW: Analytics Dashboard Sprint 2 Endpoints
if (analyticsDashboardSprint2 && typeof analyticsDashboardSprint2 === 'object') {
  console.log('✅ Registering Analytics Dashboard Sprint 2 Endpoints...');
  app.route('/make-server-3dd53475', analyticsDashboardSprint2);
} else {
  console.warn('⚠️ Analytics Dashboard Sprint 2 Endpoints module undefined, skipping');
}

// ✅ NEW: Settlement Tier System Endpoints
if (settlementTierSystem && typeof settlementTierSystem === 'object') {
  console.log('✅ Registering Settlement Tier System Endpoints...');
  app.route('/make-server-3dd53475', settlementTierSystem);
} else {
  console.warn('⚠️ Settlement Tier System Endpoints module undefined, skipping');
}

// ✅ NEW: Elasticsearch Complete Endpoints
if (elasticsearchComplete && typeof elasticsearchComplete === 'object') {
  console.log('✅ Registering Elasticsearch Complete Endpoints...');
  app.route('/make-server-3dd53475', elasticsearchComplete);
} else {
  console.warn('⚠️ Elasticsearch Complete Endpoints module undefined, skipping');
}

// ✅ NEW: Refund Rescheduling Complete Endpoints
if (refundReschedulingComplete && typeof refundReschedulingComplete === 'object') {
  console.log('✅ Registering Refund Rescheduling Complete Endpoints...');
  app.route('/make-server-3dd53475', refundReschedulingComplete);
} else {
  console.warn('⚠️ Refund Rescheduling Complete Endpoints module undefined, skipping');
}

// ✅ NEW: Home Services Enhanced Endpoints
if (homeServicesEnhanced && typeof homeServicesEnhanced === 'object') {
  console.log('✅ Registering Home Services Enhanced Endpoints...');
  app.route('/make-server-3dd53475', homeServicesEnhanced);
} else {
  console.warn('⚠️ Home Services Enhanced Endpoints module undefined, skipping');
}

// ✅ NEW: Integrated Services Complete Endpoints
if (integratedServicesComplete && typeof integratedServicesComplete === 'object') {
  console.log('✅ Registering Integrated Services Complete Endpoints...');
  app.route('/make-server-3dd53475', integratedServicesComplete);
} else {
  console.warn('⚠️ Integrated Services Complete Endpoints module undefined, skipping');
}

if (typeof elasticsearchProxyEndpoints === 'function') {
  console.log('✅ Registering Elasticsearch Proxy Endpoints...');
  elasticsearchProxyEndpoints(app); // ✅ SQL MIGRATION: Removed kv parameter
}

if (typeof refundPolicyEndpoints === 'function') {
  console.log('✅ Registering Refund Policy Engine Endpoints...');
  refundPolicyEndpoints(app);
}

if (typeof settlementTierSystemEndpoints === 'function') {
  console.log('✅ Registering Settlement Tier System Endpoints...');
  settlementTierSystemEndpoints(app);
}

if (typeof integratedServicesManagerEndpoints === 'function') {
  console.log('✅ Registering Integrated Services Manager Endpoints...');
  integratedServicesManagerEndpoints(app);
}

// ✅ NEW: Critical Flow Fixes Endpoints
if (criticalFlowFixes && typeof criticalFlowFixes === 'object') {
  console.log('✅ Registering Critical Flow Fixes Endpoints...');
  app.route('/make-server-3dd53475', criticalFlowFixes);
} else {
  console.warn('⚠️ Critical Flow Fixes module undefined, skipping');
}

// ✅ NEW: Cafe Table Management Endpoints
if (cafeTableManagement && typeof cafeTableManagement === 'object') {
  console.log('✅ Registering Cafe Table Management Endpoints...');
  app.route('/make-server-3dd53475', cafeTableManagement);
} else {
  console.warn('⚠️ Cafe Table Management module undefined, skipping');
}

// ✅ NEW: Tier System Endpoints (Rule 15)
if (tierSystemEndpoints && typeof tierSystemEndpoints === 'function') {
  console.log('✅ Registering Tier System Endpoints...');
  tierSystemEndpoints(app);
}

// ✅ NEW: Razorpay Marketplace Settlement (Rule 15)
if (razorpayMarketplaceSettlement && typeof razorpayMarketplaceSettlement === 'function') {
  console.log('✅ Registering Razorpay Marketplace Settlement...');
  razorpayMarketplaceSettlement(app);
}

// ✅ CRITICAL: Storage Upload Endpoints (Photos, Documents, etc.)
console.log('✅ Registering Storage Upload Endpoints...');
registerStorageEndpoints(app);

// ✅ CRITICAL: Staff Service Management Endpoints (Service Assignment, Custom Services)
console.log('✅ Registering Staff Service Management Endpoints...');
staffServiceEndpoints(app);

// ✅ NEW: Medical AI Summary Endpoints (AI-powered consultation summaries)
console.log('✅ Registering Medical AI Summary Endpoints...');
registerMedicalAISummaryEndpoints(app);

// ------------------------------------------------------------------
// GLOBAL ERROR HANDLERS
// ------------------------------------------------------------------

app.notFound((c) => {
  return sendError(c, 'Not Found', 404, { path: c.req.path });
});

app.onError((err, c) => {
  console.error('Server Error:', err);
  return sendError(c, err, 500);
});

// ------------------------------------------------------------------
// HEALTH CHECK
// ------------------------------------------------------------------
app.get('/', (c) => c.text('Warmpawz API Server Running'));
app.get('/make-server-3dd53475/health', (c) => sendSuccess(c, { status: 'ok', timestamp: new Date().toISOString() }));

// ------------------------------------------------------------------
// 🚀 Server is ready - no blocking initialization
// ------------------------------------------------------------------
console.log("🚀 Server starting...");
console.log("✅ Server is ready to accept requests immediately");
console.log("💡 India region will be auto-created by frontend when needed");

// ✅ DISABLED: Role Service initialization to prevent KV store timeout on cold starts
// The system has 84+ custom roles which causes getByPrefix to timeout
// Roles are now cached in-memory and loaded on-demand by role-service.tsx
// import { initializeRoleService } from "./role-service";
// initializeRoleService().catch(err => console.error('❌ Role service initialization failed:', err));

Deno.serve(app.fetch);