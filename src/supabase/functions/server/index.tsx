import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import * as kv from './kv_store.tsx';
import { sendSuccess, sendError } from './response-utils.ts';
import { safeGetByPrefix } from './kv-safe.tsx';
import { criticalActionGuard } from './critical-action-guard.tsx';

// Import all registration functions
import { registerUniversalDiscovery } from './universal-problem-discovery.tsx';
import { registerUniversalCustomerSearch } from './universal-customer-search.tsx';
import { registerCustomerBookingHistory } from './customer-booking-history.tsx';
import { registerCustomerSearchEndpoints } from './customer-search-endpoints.tsx';
import { notificationEndpoints } from './notification-system.tsx';
import { reviewEndpoints } from './review-endpoints.tsx';
import { analyticsEndpoints } from './analytics-endpoints.tsx';
import { enhancedSearchEngineEndpoints } from './enhanced-search-engine.tsx';
import { vendorOnboardingEndpoints } from './vendor-onboarding.tsx';
import { vendorApprovalWorkflowEndpoints } from './vendor-approval-workflow.tsx';
import { vendorDashboardEndpoints } from './vendor-dashboard-endpoints.tsx';
import { vendorRoleConfigEndpoints } from './vendor-role-config.tsx';
import { registerDynamicOnboarding } from './dynamic-onboarding-management.tsx';
import { onboardingConfigEndpoints } from './onboarding-config-endpoints.tsx';
import { registerVendorServiceEndpoints } from './vendor-services-endpoints.tsx';
import { registerVendorCatalogAPIV2 } from './vendor-catalog-api-v2.tsx';
import { customServiceEndpoints } from './custom-service-endpoints.tsx';
import { vendorScheduleV2Endpoints } from './vendor-schedule-v2.tsx';
import { registerAdminVendorRoutes } from './admin-vendor-routes.tsx';
import { adminVendorEndpoints } from './admin-vendor-endpoints.tsx';
import { registerAdminCatalogEndpoints } from './admin-catalog-endpoints.tsx';
import { adminIntegrationEndpoints } from './admin-integration-endpoints.tsx';
import { registerVendorSettingsRulesEndpoints } from './vendor-settings-rules-endpoints.tsx';
import { registerVideoCallEndpoints } from './video-call-endpoints.tsx';
import { regionEndpoints } from './region-endpoints.tsx';
import { registerProblemGridSpecializationSystem } from './problem-grid-specialization-system.tsx';
import { registerCustomerServices } from './customer-services.tsx';
import { registerCustomerRoutes } from './customer-routes.tsx';
import { registerAuthEndpoints } from './auth-endpoints.tsx';
import { registerAICRMRoutes } from './ai-crm-routes.tsx';
import { registerAIChatbotRoutes } from './ai-chatbot-routes.tsx';
import { paymentEndpoints } from './payment-endpoints.tsx';
import { marketplacePaymentEndpoints } from './marketplace-payment-endpoints.tsx';
import { registerChatEndpoints } from './chat-endpoints.tsx';
import { registerSubscriptionEndpoints } from './subscription-endpoints.tsx';
import { registerVideoConsultationEndpoints } from './video-consultation-endpoints.tsx';
import { registerMedicalHistoryEndpoints } from './medical-history-endpoints.tsx';
import { registerUniversalStaffSchedule } from './universal-staff-schedule.tsx';
import { registerCenterAvailabilityEndpoints } from './center-availability-endpoints.tsx';
import { registerBoardingRoomManagement } from './boarding-room-management.tsx';
import { registerNutritionistMealManagement } from './nutritionist-meal-management.tsx';
import { registerServicePackageManagement } from './service-package-management.tsx';
import { registerCustomerPackageEndpoints } from './customer-package-endpoints.tsx';
import { registerVendorMetricsEnhancement } from './vendor-metrics-enhancement.tsx';
import { bookingEndpoints } from './booking-endpoints.tsx';
import { registerCafeFeatures } from './cafe-features.tsx';
import { registerResortInventory } from './resort-inventory.tsx';
import marketingRoutesV2 from './marketing-routes-v2.tsx';
import { registerMarketplaceProducts } from './marketplace-products.tsx';
import { registerUniversalServiceDiscovery } from './universal-service-discovery.tsx';
import { registerUniversalOTPSystem } from './universal-otp-system.tsx';
import { registerHomeServiceBookingFlow } from './home-service-booking-flow.tsx';
import { registerBookingLifecycleManagement } from './booking-lifecycle-management.tsx';
import { bookingLifecycleCompleteEndpoints } from './booking-lifecycle-complete.tsx';
import { registerSmsOtpService } from './sms-otp-service.tsx';
import { registerRazorpayRefundProcessor } from './razorpay-refund-processor.tsx';
import { registerGooglePlacesService } from './google-places-service.tsx';
import { registerSettlementAutomation } from './settlement-automation.tsx';
import { registerS3AutoUploader } from './s3-auto-uploader.tsx';
import { registerSmsEventNotifications } from './sms-event-notifications.tsx';
import { registerShiprocketIntegration } from './shiprocket-integration.tsx';
import { registerDelhiveryIntegration } from './delhivery-integration.tsx';
import { registerLogisticsRoutingEndpoints } from './logistics-routing-engine.tsx';
import { registerReturnsManagementEndpoints } from './returns-management.tsx';
import { analyticsAggregationEndpoints } from './analytics-aggregation.tsx';
import { rbacEndpoints } from './rbac-endpoints.tsx';
import { reportBuilderEndpoints } from './report-builder-endpoints.tsx';
import { petIntelligenceEndpoints } from './pet-intelligence-endpoints.tsx';
import { transactionMonitoringEndpoints } from './transaction-monitoring-endpoints.tsx';
import enhancedServicePublishing from './enhanced-service-publishing.tsx';
import enhancedStaffAvailability from './enhanced-staff-availability-routes.tsx';
import { pharmacyPrescriptionEndpoints } from './pharmacy-prescription-endpoints.tsx';
import vetSpecializedServices from './vet-specialized-services.tsx'; // ✅ FIX: Import vet specialized services (ambulance, diagnostics, pharmacy)
import staffCrudEndpoints from './staff-crud-endpoints.tsx'; // ✅ FIX: Import staff CRUD endpoints (create, read, update, delete staff)
import { homeSampleCollectionEndpoints } from './home-sample-collection-endpoints.tsx';
import { holidayPackageEndpoints } from './holiday-package-endpoints.tsx';
import { smsNotificationServiceEnhanced } from './sms-notification-service-enhanced.tsx';
import { tierSystemIntegration } from './tier-system-integration.tsx';
import { hyperlocalDeliveryEndpoints } from './hyperlocal-delivery-endpoints.tsx';
import { marketplaceSettlementEnhanced } from './marketplace-settlement-enhanced.tsx';
import { elasticsearchIntegration } from './elasticsearch-integration.tsx';
import { integratedServicesEndpoints } from './integrated-services-endpoints.tsx';
import { specializedServicesBooking } from './specialized-services-booking.tsx';
import criticalFlowFixes from './critical-flow-fixes.tsx';
import { registerGroomerGalleryEndpoints } from './groomer-gallery-system.tsx';
import trainerProgressTracking from './trainer-progress-tracking.tsx';
import cafeTableManagement from './cafe-table-management.tsx';
import { registerInsuranceClaimEndpoints } from './insurance-claim-management.tsx';
import customerWalletTopup from './customer-wallet-topup.tsx';
import rewardsLoyaltySystem from './rewards-loyalty-system.tsx';
import portfolioEndpoints from './portfolio-endpoints.tsx';
import cctvAccessEndpoints from './cctv-access-endpoints.tsx';
import controlledSubstancesEndpoints from './controlled-substances-endpoints.tsx';
import vetSummaryEndpoints from './vet-summary-endpoints.tsx';
import adoptionEndpoints from './adoption-endpoints.tsx';
import memorialEndpoints from './memorial-endpoints.tsx';
import expiryManagementEndpoints from './expiry-management-endpoints.tsx';
import donationManagementEndpoints from './donation-management-endpoints.tsx';
import eventManagementEndpoints from './event-management-endpoints.tsx';
import patientMonitoringEndpoints from "./patient-monitoring-endpoints.tsx";
import customerEcommerceEndpoints from "./customer-ecommerce-endpoints.tsx";
import additionalCapabilitiesEndpoints from "./additional-capabilities-endpoints.tsx";
import { registerP0Features } from './p0-features-endpoints.tsx';
import missingCrudEndpoints from './missing-crud-endpoints.tsx';
import facilityEndpoints from './facility-endpoints.tsx';
import { packageEndpoints } from './package-endpoints.tsx';

import { ambulanceServiceEndpoints } from './ambulance-service-endpoints.tsx';
import { diagnosticsCenterEndpoints } from './diagnostics-center-endpoints.tsx';
import specializedVendorConfigEndpoints from './specialized-vendor-config-endpoints.tsx'; // ✅ NEW: Specialized vendor configurations
import { backwardsCompatibleEndpoints } from './backwards-compatible-endpoints.tsx'; // ✅ NEW: Backwards compatible routes for UI
import { razorpayPaymentEndpoints } from './razorpay-payment-endpoints.tsx';
import { specializedServicesEndpoints } from './specialized-services-endpoints.tsx';
import { insuranceEndpoints } from './insurance-endpoints.tsx';
import { trainingProgressEndpoints } from './training-progress-endpoints.tsx';
import { instantTeleEndpoints } from './instant-tele-endpoints.tsx';
import { petProfilePublishingEndpoints } from './pet-profile-publishing-endpoints.tsx';
import { deliveryIntegrationEndpoints } from './delivery-integration-endpoints.tsx';
import { resortPreCheckEndpoints } from './resort-precheck-endpoints.tsx';
import { notificationTemplateSystem } from './notification-template-system.tsx';
import { bankVerificationEndpoints } from './bank-verification-endpoints.tsx';
import { tierUpgradeEndpoints } from './tier-upgrade-endpoints.tsx';
import { settlementScheduleEndpoints } from './settlement-schedule-endpoints.tsx';
import { gstRuleEngineEndpoints } from './gst-rule-engine.tsx';
import { gstConfigurationEndpoints } from './gst-configuration-endpoints.tsx';
import { cancellationPolicyEndpoints } from './cancellation-policy-endpoints.tsx';
import { comprehensiveGapFixes } from './gap-fixes-comprehensive.tsx';
import { analyticsDashboardEndpoints } from './analytics-dashboard-endpoints.tsx';
import { performanceMonitoringEndpoints } from './performance-monitoring-endpoints.tsx';
import { systemOptimizationEndpoints } from './system-optimization-endpoints.tsx';
import { elasticsearchCoreEndpoints } from './elasticsearch-core.tsx';
import { advancedSearchAPI } from './advanced-search-api.tsx';
import { searchAnalyticsAPI } from './search-analytics-api.tsx';
import { nutritionistSystemEndpoints } from './nutritionist-system.tsx';
import { foodDeliveryHyperlocalEndpoints } from './food-delivery-hyperlocal.tsx';
import { nutritionistDietPlanEndpoints } from './nutritionist-diet-plan-endpoints.tsx';
import { nutritionistFoodIntegrationEndpoints } from './nutritionist-food-integration.tsx';
import { nutritionistFoodDeliveryEndpoints } from './nutritionist-food-delivery.tsx';
import { holidayPackageSystemEndpoints } from './holiday-package-system.tsx';
import { previousProvidersEndpoints } from './previous-providers.tsx';
import { radarLocationSystemEndpoints } from './radar-location-system.tsx';
import { multiServiceSchedulingEndpoints } from './multi-service-scheduling.tsx';
import { timeWindowSubscriptionEndpoints } from './time-window-subscription.tsx';
import { independentVendorSystemEndpoints } from './independent-vendor-system.tsx';
import { unifiedServiceDiscoveryEndpoints } from './unified-service-discovery.tsx';
import { logisticsPartnerIntegrationEndpoints } from './logistics-partner-integration.tsx';
import { automatedBankVerificationEndpoints } from './automated-bank-verification.tsx';
import { marketplaceSettlementAutomationEndpoints } from './marketplace-settlement-automation.tsx';
import { tierCommissionIntegrationEndpoints } from './tier-commission-integration.tsx';
import { reschedulingPoliciesEndpoints } from './rescheduling-policies.tsx';
import { servicesByProblemEndpoints } from './services-by-problem.tsx';
import { searchSuggestionsEndpoints } from './search-suggestions.tsx';
import qaGapFixesEndpoints from './qa-gap-fixes.tsx';
import performanceOptimizationEndpoints from './performance-optimization-endpoints.tsx';
import analyticsDashboardSprint2 from './analytics-dashboard-sprint2.tsx';
import settlementTierSystem from './settlement-tier-system.tsx';
import elasticsearchComplete from './elasticsearch-complete.tsx';
import refundReschedulingComplete from './refund-rescheduling-complete.tsx';
import homeServicesEnhanced from './home-services-enhanced.tsx';
import integratedServicesComplete from './integrated-services-complete.tsx';
import { elasticsearchProxyEndpoints } from './elasticsearch-proxy.tsx';
import { refundPolicyEndpoints } from './refund-policy-engine-enhanced.tsx';
import { settlementTierSystemEndpoints } from './settlement-tier-system-enhanced.tsx';
import { integratedServicesManagerEndpoints } from './integrated-services-manager.tsx';

import { tierSystemEndpoints } from './tier-system.tsx';
import { razorpayMarketplaceSettlement } from './razorpay-marketplace-settlement.tsx';
import appointmentDetailEndpoints from './appointment-detail-endpoints.tsx'; // ✅ FIX: Prescription upload endpoints
import { registerStorageEndpoints } from './storage-handler.tsx'; // ✅ FIX: Storage upload endpoints
import { staffServiceEndpoints } from './staff-service-endpoints.tsx'; // ✅ FIX: Staff service management endpoints
import { soloProviderEndpoints } from './solo-provider-endpoints.tsx'; // ✅ FIX: Solo provider onboarding endpoints
import { registerMedicalAISummaryEndpoints } from './medical-ai-summary-endpoints.tsx'; // ✅ NEW: Medical AI summary endpoints

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
    const regionsData = await safeGetByPrefix('region_', { timeout: 10000, limit: 500 });
    
    console.log(`✅ Returning ${regionsData?.length || 0} regions from GET /regions`);
    
    return sendSuccess(c, {
      regions: regionsData || [],
      count: regionsData?.length || 0
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
    
    // Use safeGetByPrefix which has built-in timeout protection and retry logic
    const regionsData = await safeGetByPrefix('region_', { timeout: 10000, limit: 500 });
    const regions = (regionsData || []).map((item: any) => item.value || item);
    const activeRegions = regions.filter((r: any) => r.isActive === true);
    
    console.log(`✅ Returning ${activeRegions.length} active regions from GET /regions/active`);
    
    return sendSuccess(c, {
      regions: activeRegions,
      count: activeRegions.length
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
    const region = await kv.get(`region_${regionId}`);
    
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
    const regions = await kv.getByPrefix('region_');
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
    
    // Store the region
    await kv.set(`region_${regionId}`, {
      ...regionData,
      regionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    return sendSuccess(c, {}, 'Region created successfully');
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
    
    const existing = await kv.get(`region_${regionId}`);
    if (!existing) {
      return sendError(c, 'Region not found', 404);
    }
    
    const updated = {
      ...existing,
      ...updates,
      regionId,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`region_${regionId}`, updated);
    
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
    
    const existing = await kv.get(`region_${regionId}`);
    if (!existing) {
      return sendError(c, 'Region not found', 404);
    }
    
    const updated = {
      ...existing,
      isActive,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`region_${regionId}`, updated);
    
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
    
    // Check if region already exists
    console.log('🔍 Checking if India region already exists...');
    const existing = await kv.get('region_india').catch(err => {
      console.error('⚠️ KV GET error during check:', err.message);
      return null;
    });
    
    if (existing) {
      console.log('✅ India region already exists, returning existing');
      return sendSuccess(c, { region: existing }, 'India region already exists');
    }
    
    console.log('🔨 Creating India region...');
    
    // Create India region
    const indiaRegion = {
      regionId: 'india',
      regionName: 'India',
      regionCode: 'IN',
      isActive: true,
      currency: {
        code: 'INR',
        symbol: '₹',
        name: 'Indian Rupee',
      },
      phoneConfig: {
        countryCode: '+91',
        format: '+91 XXXXX XXXXX',
        length: 10,
        validation: '/^[6-9]\\\\d{9}$/',
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
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      launchDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    console.log('💾 Attempting to save region to KV store with key: region_india');
    
    try {
      await kv.set('region_india', indiaRegion);
      console.log('✅ KV SET successful');
      
      // Verify it was saved
      const verification = await kv.get('region_india').catch(() => null);
      if (verification) {
        console.log('✅ Verification successful - region is persisted');
      } else {
        console.warn('⚠️ Verification failed - region may not be persisted');
      }
    } catch (kvError) {
      console.error('❌ KV SET error:', kvError.message);
      console.error('❌ Full error:', kvError);
      throw new Error(`Failed to save region to KV store: ${kvError.message}`);
    }
    
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
notificationEndpoints(app, kv);
reviewEndpoints(app, kv);
analyticsEndpoints(app, kv);

// ✅ NEW: Advanced Search Engine with Fuse.js
console.log('🔍 Registering Advanced Search Engine...');
enhancedSearchEngineEndpoints(app, kv);

// 2. Vendor Specific Routes (Dashboard, Onboarding, Config, Services)
// These must be registered BEFORE customer-routes because customer-routes
// contains a generic /vendor/:vendorId wildcard that would shadow these.
vendorOnboardingEndpoints(app, kv);
soloProviderEndpoints(app, kv); // ✅ FIX: Solo provider onboarding endpoints
vendorApprovalWorkflowEndpoints(app, kv);
vendorDashboardEndpoints(app, kv);
vendorRoleConfigEndpoints(app);
registerDynamicOnboarding(app);
onboardingConfigEndpoints(app, kv); // ✅ NEW: Register onboarding config endpoints for multi-staff applications
registerVendorServiceEndpoints(app);
registerVendorCatalogAPIV2(app);
customServiceEndpoints(app, kv); // ✅ FIX: Register custom service endpoints
app.route('/make-server-3dd53475', vendorScheduleV2Endpoints);

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
adminVendorEndpoints(app, kv);
registerAdminCatalogEndpoints(app);
adminIntegrationEndpoints(app);
registerVendorSettingsRulesEndpoints(app);
registerVideoCallEndpoints(app);
regionEndpoints(app, kv);
registerProblemGridSpecializationSystem(app);

// 4. Core Customer & Auth Routes
// MUST BE REGISTERED BEFORE STAFF ROUTES to avoid shadowing by staff wildcard router
registerCustomerServices(app); // Register specific routes BEFORE wildcard
registerCustomerRoutes(app);
registerAuthEndpoints(app);
registerAICRMRoutes(app, kv);
registerAIChatbotRoutes(app);
paymentEndpoints(app, kv);
marketplacePaymentEndpoints(app, kv);
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
bookingEndpoints(app, kv);
registerCafeFeatures(app);
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
bookingLifecycleCompleteEndpoints(app, kv);
registerSmsOtpService(app);
registerRazorpayRefundProcessor(app);
registerGooglePlacesService(app);
registerSettlementAutomation(app);
registerS3AutoUploader(app);
const smsNotifications = registerSmsEventNotifications(app);

// ✅ Payment & Logistics Integrations
registerShiprocketIntegration(app);
registerDelhiveryIntegration(app);
registerLogisticsRoutingEndpoints(app);
registerReturnsManagementEndpoints(app);

// ✅ Enterprise Admin Capabilities
analyticsAggregationEndpoints(app);
rbacEndpoints(app);
reportBuilderEndpoints(app);
petIntelligenceEndpoints(app);
transactionMonitoringEndpoints(app);

// ✅ NEW: Phase 2 & 3 Endpoints
if (ambulanceServiceEndpoints && typeof ambulanceServiceEndpoints === 'function') {
  console.log('✅ Registering Ambulance Service Endpoints...');
  ambulanceServiceEndpoints(app, kv);
} else {
  console.warn('⚠️ Ambulance Service Endpoints module undefined, skipping');
}

if (diagnosticsCenterEndpoints && typeof diagnosticsCenterEndpoints === 'function') {
  console.log('✅ Registering Diagnostics Center Endpoints...');
  diagnosticsCenterEndpoints(app, kv);
} else {
  console.warn('⚠️ Diagnostics Center Endpoints module undefined, skipping');
}

if (razorpayPaymentEndpoints && typeof razorpayPaymentEndpoints === 'function') {
  console.log('✅ Registering Razorpay Payment Endpoints...');
  razorpayPaymentEndpoints(app, kv);
} else {
  console.warn('⚠️ Razorpay Payment Endpoints module undefined, skipping');
}

if (specializedServicesEndpoints && typeof specializedServicesEndpoints === 'function') {
  console.log('✅ Registering Specialized Services Endpoints...');
  specializedServicesEndpoints(app, kv);
} else {
  console.warn('⚠️ Specialized Services Endpoints module undefined, skipping');
}

// ✅ NEW: Specialized Vendor Configuration Endpoints
if (specializedVendorConfigEndpoints && typeof specializedVendorConfigEndpoints === 'function') {
  console.log('✅ Registering Specialized Vendor Config Endpoints...');
  specializedVendorConfigEndpoints(app, kv);
} else {
  console.warn('⚠️ Specialized Vendor Config Endpoints module undefined, skipping');
}

// ✅ NEW: Backwards Compatible Endpoints (UI Compatibility Layer)
if (backwardsCompatibleEndpoints && typeof backwardsCompatibleEndpoints === 'function') {
  console.log('🔄 Registering Backwards Compatible Endpoints...');
  backwardsCompatibleEndpoints(app, kv);
} else {
  console.warn('⚠️ Backwards Compatible Endpoints module undefined, skipping');
}

if (insuranceEndpoints && typeof insuranceEndpoints === 'function') {
  console.log('✅ Registering Insurance Endpoints...');
  insuranceEndpoints(app, kv);
} else {
  console.warn('⚠️ Insurance Endpoints module undefined, skipping');
}

if (trainingProgressEndpoints && typeof trainingProgressEndpoints === 'function') {
  console.log('✅ Registering Training Progress Endpoints...');
  trainingProgressEndpoints(app, kv);
} else {
  console.warn('⚠️ Training Progress Endpoints module undefined, skipping');
}

// ✅ NEW: Phase 4 Endpoints
if (instantTeleEndpoints && typeof instantTeleEndpoints === 'function') {
  console.log('✅ Registering Instant Tele-Consultation Endpoints...');
  instantTeleEndpoints(app, kv);
} else {
  console.warn('⚠️ Instant Tele Endpoints module undefined, skipping');
}

if (petProfilePublishingEndpoints && typeof petProfilePublishingEndpoints === 'function') {
  console.log('✅ Registering Pet Profile Publishing Endpoints...');
  petProfilePublishingEndpoints(app, kv);
} else {
  console.warn('⚠️ Pet Profile Publishing Endpoints module undefined, skipping');
}

if (deliveryIntegrationEndpoints && typeof deliveryIntegrationEndpoints === 'function') {
  console.log('✅ Registering Delivery Integration Endpoints...');
  deliveryIntegrationEndpoints(app, kv);
} else {
  console.warn('⚠️ Delivery Integration Endpoints module undefined, skipping');
}

if (resortPreCheckEndpoints && typeof resortPreCheckEndpoints === 'function') {
  console.log('✅ Registering Resort Pre-Check Endpoints...');
  resortPreCheckEndpoints(app, kv);
} else {
  console.warn('⚠️ Resort Pre-Check Endpoints module undefined, skipping');
}

// ✅ NEW: Phase 5 Endpoints
if (notificationTemplateSystem && typeof notificationTemplateSystem === 'function') {
  console.log('✅ Registering Notification Template System...');
  notificationTemplateSystem(app, kv);
} else {
  console.warn('⚠️ Notification Template System module undefined, skipping');
}

if (bankVerificationEndpoints && typeof bankVerificationEndpoints === 'function') {
  console.log('✅ Registering Bank Verification Endpoints...');
  bankVerificationEndpoints(app, kv);
} else {
  console.warn('⚠️ Bank Verification Endpoints module undefined, skipping');
}

if (tierUpgradeEndpoints && typeof tierUpgradeEndpoints === 'function') {
  console.log('✅ Registering Tier Upgrade Endpoints...');
  tierUpgradeEndpoints(app, kv);
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
  analyticsDashboardEndpoints(app, kv);
} else {
  console.warn('⚠️ Analytics Dashboard Endpoints module undefined, skipping');
}

if (performanceMonitoringEndpoints && typeof performanceMonitoringEndpoints === 'function') {
  console.log('✅ Registering Performance Monitoring Endpoints...');
  performanceMonitoringEndpoints(app, kv);
} else {
  console.warn('⚠️ Performance Monitoring Endpoints module undefined, skipping');
}

if (systemOptimizationEndpoints && typeof systemOptimizationEndpoints === 'function') {
  console.log('✅ Registering System Optimization Endpoints...');
  systemOptimizationEndpoints(app, kv);
} else {
  console.warn('⚠️ System Optimization Endpoints module undefined, skipping');
}

if (elasticsearchCoreEndpoints && typeof elasticsearchCoreEndpoints === 'function') {
  console.log('✅ Registering Elasticsearch Core Endpoints...');
  elasticsearchCoreEndpoints(app, kv);
} else {
  console.warn('⚠️ Elasticsearch Core Endpoints module undefined, skipping');
}

if (advancedSearchAPI && typeof advancedSearchAPI === 'function') {
  console.log('✅ Registering Advanced Search API...');
  advancedSearchAPI(app, kv);
} else {
  console.warn('⚠️ Advanced Search API module undefined, skipping');
}

if (searchAnalyticsAPI && typeof searchAnalyticsAPI === 'function') {
  console.log('✅ Registering Search Analytics API...');
  searchAnalyticsAPI(app, kv);
} else {
  console.warn('⚠️ Search Analytics API module undefined, skipping');
}

if (nutritionistSystemEndpoints && typeof nutritionistSystemEndpoints === 'function') {
  console.log('✅ Registering Nutritionist System Endpoints...');
  nutritionistSystemEndpoints(app, kv);
} else {
  console.warn('⚠️ Nutritionist System Endpoints module undefined, skipping');
}

// ✅ NEW: Nutritionist Diet & Food Delivery Endpoints (Rule 8)
if (nutritionistDietPlanEndpoints && typeof nutritionistDietPlanEndpoints === 'function') {
  console.log('✅ Registering Nutritionist Diet Plan Endpoints...');
  nutritionistDietPlanEndpoints(app, kv);
} else {
  console.warn('⚠️ Nutritionist Diet Plan Endpoints module undefined, skipping');
}

if (nutritionistFoodIntegrationEndpoints && typeof nutritionistFoodIntegrationEndpoints === 'function') {
  console.log('✅ Registering Nutritionist Food Integration Endpoints...');
  nutritionistFoodIntegrationEndpoints(app, kv);
} else {
  console.warn('⚠️ Nutritionist Food Integration Endpoints module undefined, skipping');
}

if (nutritionistFoodDeliveryEndpoints && typeof nutritionistFoodDeliveryEndpoints === 'function') {
  console.log('✅ Registering Nutritionist Food Delivery Endpoints...');
  nutritionistFoodDeliveryEndpoints(app, kv);
} else {
  console.warn('⚠️ Nutritionist Food Delivery Endpoints module undefined, skipping');
}

if (foodDeliveryHyperlocalEndpoints && typeof foodDeliveryHyperlocalEndpoints === 'function') {
  console.log('✅ Registering Food Delivery Hyperlocal Endpoints...');
  foodDeliveryHyperlocalEndpoints(app, kv);
} else {
  console.warn('⚠️ Food Delivery Hyperlocal Endpoints module undefined, skipping');
}

if (holidayPackageSystemEndpoints && typeof holidayPackageSystemEndpoints === 'function') {
  console.log('✅ Registering Holiday Package System Endpoints...');
  holidayPackageSystemEndpoints(app, kv);
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
// if (staffAuthRoutes && typeof staffAuthRoutes === 'object') {
//   app.route('/make-server-3dd53475', staffAuthRoutes); // Register Auth FIRST to avoid shadowing by /staff wildcard
// } else {
//   console.warn('⚠️ Staff Auth Routes module undefined, skipping');
// }

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
  packageEndpoints(app, kv);
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
  pharmacyPrescriptionEndpoints(app, kv);
} else {
  console.warn('⚠️ Pharmacy Prescription Endpoints module undefined, skipping');
}

// ✅ NEW: Home Sample Collection Endpoints
if (homeSampleCollectionEndpoints && typeof homeSampleCollectionEndpoints === 'function') {
  console.log('✅ Registering Home Sample Collection Endpoints...');
  homeSampleCollectionEndpoints(app, kv);
} else {
  console.warn('⚠️ Home Sample Collection Endpoints module undefined, skipping');
}

// ✅ NEW: Holiday Package Endpoints
if (holidayPackageEndpoints && typeof holidayPackageEndpoints === 'function') {
  console.log('✅ Registering Holiday Package Endpoints...');
  holidayPackageEndpoints(app, kv);
} else {
  console.warn('⚠️ Holiday Package Endpoints module undefined, skipping');
}

// ✅ NEW: SMS Notification Service Enhanced
if (smsNotificationServiceEnhanced && typeof smsNotificationServiceEnhanced === 'function') {
  console.log('✅ Registering SMS Notification Service Enhanced...');
  smsNotificationServiceEnhanced(app, kv);
} else {
  console.warn('⚠️ SMS Notification Service Enhanced module undefined, skipping');
}

// ✅ NEW: Tier System Integration
if (tierSystemIntegration && typeof tierSystemIntegration === 'function') {
  console.log('✅ Registering Tier System Integration...');
  tierSystemIntegration(app, kv);
} else {
  console.warn('⚠️ Tier System Integration module undefined, skipping');
}

// ✅ NEW: Hyperlocal Delivery Endpoints
if (hyperlocalDeliveryEndpoints && typeof hyperlocalDeliveryEndpoints === 'function') {
  console.log('✅ Registering Hyperlocal Delivery Endpoints...');
  hyperlocalDeliveryEndpoints(app, kv);
} else {
  console.warn('⚠️ Hyperlocal Delivery Endpoints module undefined, skipping');
}

// ✅ NEW: Marketplace Settlement Enhanced
if (marketplaceSettlementEnhanced && typeof marketplaceSettlementEnhanced === 'function') {
  console.log('✅ Registering Marketplace Settlement Enhanced...');
  marketplaceSettlementEnhanced(app, kv);
} else {
  console.warn('⚠️ Marketplace Settlement Enhanced module undefined, skipping');
}

// ✅ NEW: Elasticsearch Integration
if (elasticsearchIntegration && typeof elasticsearchIntegration === 'function') {
  console.log('✅ Registering Elasticsearch Integration...');
  elasticsearchIntegration(app, kv);
} else {
  console.warn('⚠️ Elasticsearch Integration module undefined, skipping');
}

// ✅ NEW: Integrated Services Endpoints
if (integratedServicesEndpoints && typeof integratedServicesEndpoints === 'function') {
  console.log('✅ Registering Integrated Services Endpoints...');
  integratedServicesEndpoints(app, kv);
} else {
  console.warn('⚠️ Integrated Services Endpoints module undefined, skipping');
}

// ✅ NEW: Specialized Services Booking
if (specializedServicesBooking && typeof specializedServicesBooking === 'function') {
  console.log('✅ Registering Specialized Services Booking...');
  specializedServicesBooking(app, kv);
} else {
  console.warn('⚠️ Specialized Services Booking module undefined, skipping');
}

// ✅ NEW: Previous Providers Endpoints
if (previousProvidersEndpoints && typeof previousProvidersEndpoints === 'function') {
  console.log('✅ Registering Previous Providers Endpoints...');
  previousProvidersEndpoints(app, kv);
} else {
  console.warn('⚠️ Previous Providers Endpoints module undefined, skipping');
}

// ✅ NEW: Radar Location System Endpoints
if (radarLocationSystemEndpoints && typeof radarLocationSystemEndpoints === 'function') {
  console.log('✅ Registering Radar Location System Endpoints...');
  radarLocationSystemEndpoints(app, kv);
} else {
  console.warn('⚠️ Radar Location System Endpoints module undefined, skipping');
}

// ✅ NEW: Multi-Service Scheduling Endpoints
if (multiServiceSchedulingEndpoints && typeof multiServiceSchedulingEndpoints === 'function') {
  console.log('✅ Registering Multi-Service Scheduling Endpoints...');
  multiServiceSchedulingEndpoints(app, kv);
} else {
  console.warn('⚠️ Multi-Service Scheduling Endpoints module undefined, skipping');
}

// ✅ NEW: Time Window Subscription Endpoints
if (timeWindowSubscriptionEndpoints && typeof timeWindowSubscriptionEndpoints === 'function') {
  console.log('✅ Registering Time Window Subscription Endpoints...');
  timeWindowSubscriptionEndpoints(app, kv);
} else {
  console.warn('⚠️ Time Window Subscription Endpoints module undefined, skipping');
}

// ✅ NEW: Independent Vendor System Endpoints
if (independentVendorSystemEndpoints && typeof independentVendorSystemEndpoints === 'function') {
  console.log('✅ Registering Independent Vendor System Endpoints...');
  independentVendorSystemEndpoints(app, kv);
} else {
  console.warn('⚠️ Independent Vendor System Endpoints module undefined, skipping');
}

// ✅ NEW: Unified Service Discovery Endpoints
if (unifiedServiceDiscoveryEndpoints && typeof unifiedServiceDiscoveryEndpoints === 'function') {
  console.log('✅ Registering Unified Service Discovery Endpoints...');
  unifiedServiceDiscoveryEndpoints(app, kv);
} else {
  console.warn('⚠️ Unified Service Discovery Endpoints module undefined, skipping');
}

// ✅ NEW: Logistics Partner Integration Endpoints
if (logisticsPartnerIntegrationEndpoints && typeof logisticsPartnerIntegrationEndpoints === 'function') {
  console.log('✅ Registering Logistics Partner Integration Endpoints...');
  logisticsPartnerIntegrationEndpoints(app, kv);
} else {
  console.warn('⚠️ Logistics Partner Integration Endpoints module undefined, skipping');
}

// ✅ NEW: Automated Bank Verification Endpoints
if (automatedBankVerificationEndpoints && typeof automatedBankVerificationEndpoints === 'function') {
  console.log('✅ Registering Automated Bank Verification Endpoints...');
  automatedBankVerificationEndpoints(app, kv);
} else {
  console.warn('⚠️ Automated Bank Verification Endpoints module undefined, skipping');
}

// ✅ NEW: Marketplace Settlement Automation Endpoints
if (marketplaceSettlementAutomationEndpoints && typeof marketplaceSettlementAutomationEndpoints === 'function') {
  console.log('✅ Registering Marketplace Settlement Automation Endpoints...');
  marketplaceSettlementAutomationEndpoints(app, kv);
} else {
  console.warn('⚠️ Marketplace Settlement Automation Endpoints module undefined, skipping');
}

// ✅ NEW: Tier Commission Integration Endpoints
if (tierCommissionIntegrationEndpoints && typeof tierCommissionIntegrationEndpoints === 'function') {
  console.log('✅ Registering Tier Commission Integration Endpoints...');
  tierCommissionIntegrationEndpoints(app, kv);
} else {
  console.warn('⚠️ Tier Commission Integration Endpoints module undefined, skipping');
}

// ✅ NEW: Rescheduling Policies Endpoints
if (reschedulingPoliciesEndpoints && typeof reschedulingPoliciesEndpoints === 'function') {
  console.log('✅ Registering Rescheduling Policies Endpoints...');
  reschedulingPoliciesEndpoints(app, kv);
} else {
  console.warn('⚠️ Rescheduling Policies Endpoints module undefined, skipping');
}

// ✅ NEW: Services By Problem Endpoints (Rule 4)
if (servicesByProblemEndpoints && typeof servicesByProblemEndpoints === 'function') {
  console.log('✅ Registering Services By Problem Endpoints...');
  servicesByProblemEndpoints(app, kv);
} else {
  console.warn('⚠️ Services By Problem Endpoints module undefined, skipping');
}

// ✅ NEW: Search Suggestions Endpoints (Rule 4)
if (searchSuggestionsEndpoints && typeof searchSuggestionsEndpoints === 'function') {
  console.log('✅ Registering Search Suggestions Endpoints...');
  searchSuggestionsEndpoints(app, kv);
} else {
  console.warn('⚠️ Search Suggestions Endpoints module undefined, skipping');
}

// ✅ NEW: Enhanced Search Engine Endpoints (Rule 5)
if (enhancedSearchEngineEndpoints && typeof enhancedSearchEngineEndpoints === 'function') {
  console.log('✅ Registering Enhanced Search Engine Endpoints...');
  enhancedSearchEngineEndpoints(app, kv);
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
  elasticsearchProxyEndpoints(app, kv);
}

if (typeof refundPolicyEndpoints === 'function') {
  console.log('✅ Registering Refund Policy Engine Endpoints...');
  refundPolicyEndpoints(app, kv);
}

if (typeof settlementTierSystemEndpoints === 'function') {
  console.log('✅ Registering Settlement Tier System Endpoints...');
  settlementTierSystemEndpoints(app, kv);
}

if (typeof integratedServicesManagerEndpoints === 'function') {
  console.log('✅ Registering Integrated Services Manager Endpoints...');
  integratedServicesManagerEndpoints(app, kv);
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
  tierSystemEndpoints(app, kv);
}

// ✅ NEW: Razorpay Marketplace Settlement (Rule 15)
if (razorpayMarketplaceSettlement && typeof razorpayMarketplaceSettlement === 'function') {
  console.log('✅ Registering Razorpay Marketplace Settlement...');
  razorpayMarketplaceSettlement(app, kv);
}

// ✅ CRITICAL: Storage Upload Endpoints (Photos, Documents, etc.)
console.log('✅ Registering Storage Upload Endpoints...');
registerStorageEndpoints(app);

// ✅ CRITICAL: Staff Service Management Endpoints (Service Assignment, Custom Services)
console.log('✅ Registering Staff Service Management Endpoints...');
staffServiceEndpoints(app, kv);

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
// import { initializeRoleService } from "./role-service.tsx";
// initializeRoleService().catch(err => console.error('❌ Role service initialization failed:', err));

Deno.serve(app.fetch);