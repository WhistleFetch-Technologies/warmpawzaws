import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";
import { criticalActionGuard } from "./critical-action-guard.tsx";

// Core route registration functions
import { registerCustomerRoutes } from "./customer-routes.tsx";
import { registerCustomerServices } from "./customer-services.tsx";
import { registerAdminVendorRoutes } from "./admin-vendor-routes.tsx";
import { adminVendorEndpoints } from "./admin-vendor-endpoints.tsx";
import { registerUniversalDiscovery } from "./universal-problem-discovery.tsx";
import { registerUniversalCustomerSearch } from "./universal-customer-search.tsx";
import { notificationEndpoints } from "./notification-system.tsx";
import { registerCustomerBookingHistory } from "./customer-booking-history.tsx";
import { registerCustomerSearchEndpoints } from "./customer-search-endpoints.tsx";
import { vendorOnboardingEndpoints } from "./vendor-onboarding.tsx";
import { vendorApprovalWorkflowEndpoints } from "./vendor-approval-workflow.tsx";
import { vendorDashboardEndpoints } from "./vendor-dashboard-endpoints.tsx";
import { vendorRoleConfigEndpoints } from "./vendor-role-config.tsx";
import { registerDynamicOnboarding } from "./dynamic-onboarding-management.tsx";
import { registerVendorServiceEndpoints } from "./vendor-services-endpoints.tsx";
import { registerVendorCatalogAPIV2 } from "./vendor-catalog-api-v2.tsx";
import { reviewEndpoints } from "./review-endpoints.tsx";
import { analyticsEndpoints } from "./analytics-endpoints.tsx";
import { registerP0Features } from "./p0-features-endpoints.tsx";
import { customServiceEndpoints } from "./custom-service-endpoints.tsx"; // ✅ FIX: Add custom service endpoints
import { advancedSearchEngine } from "./advanced-search-engine.tsx"; // ✅ NEW: Advanced search with Fuse.js

// Vendor & Admin modules
import { vendorScheduleV2Endpoints } from "./vendor-schedule-v2.tsx";
import { registerAdminCatalogEndpoints } from "./admin-catalog-endpoints.tsx";
import { adminIntegrationEndpoints } from "./admin-integration-endpoints.tsx";
import { registerVendorSettingsRulesEndpoints } from "./vendor-settings-rules-endpoints.tsx";
import { registerVideoCallEndpoints } from "./video-call-endpoints.tsx";
import { regionEndpoints } from "./region-endpoints.tsx";
import { registerProblemGridSpecializationSystem } from "./problem-grid-specialization-system.tsx";

// Auth & Core Features
import { registerAuthEndpoints } from "./auth-endpoints.tsx";
import { registerAICRMRoutes } from "./ai-crm-routes.tsx";
import { registerAIChatbotRoutes } from "./ai-chatbot-routes.tsx";
import { paymentEndpoints } from "./payment-endpoints.tsx";
import { marketplacePaymentEndpoints } from "./marketplace-payment-endpoints.tsx";
import { registerChatEndpoints } from "./chat-endpoints.tsx";
import { registerSubscriptionEndpoints } from "./subscription-endpoints.tsx";
import { registerVideoConsultationEndpoints } from "./video-consultation-endpoints.tsx";
import { registerMedicalHistoryEndpoints } from "./medical-history-endpoints.tsx";
import { registerUniversalStaffSchedule } from "./universal-staff-schedule.tsx";
import { registerCenterAvailabilityEndpoints } from "./center-availability-endpoints.tsx";
import { registerBoardingRoomManagement } from "./boarding-room-management.tsx";
import { registerPetListingManagement } from "./pet-listing-management.tsx";
import { registerNutritionistMealManagement } from "./nutritionist-meal-management.tsx";
import { registerServicePackageManagement } from "./service-package-management.tsx";
import { registerCustomerPackageEndpoints } from "./customer-package-endpoints.tsx"; // ✅ GAP #3 FIX
import { registerVendorMetricsEnhancement } from "./vendor-metrics-enhancement.tsx"; // ✅ GAP #8 FIX
import { bookingEndpoints } from "./booking-endpoints.tsx";
import { registerCafeFeatures } from "./cafe-features.tsx";
import { registerResortInventory } from "./resort-inventory.tsx";
import { registerBreederListings } from "./breeder-listings.tsx";
import marketingRoutesV2 from "./marketing-routes-v2.tsx";
import { registerMarketplaceProducts } from "./marketplace-products.tsx";
// ✅ CRITICAL FIX: Import missing endpoints
import facilityEndpoints from "./facility-endpoints.tsx"; // Default export (Hono app)
import { packageEndpoints } from "./package-endpoints.tsx"; // Named export (function)
import { registerUniversalServiceDiscovery } from "./universal-service-discovery.tsx";
import { registerUniversalOTPSystem } from "./universal-otp-system.tsx";
import { registerHomeServiceBookingFlow } from "./home-service-booking-flow.tsx";
import { registerBookingLifecycleManagement } from "./booking-lifecycle-management.tsx";
import { registerSmsOtpService } from "./sms-otp-service.tsx";
import { registerRazorpayRefundProcessor } from "./razorpay-refund-processor.tsx";
import { registerGooglePlacesService } from "./google-places-service.tsx";
import { registerSettlementAutomation } from "./settlement-automation.tsx";
import { registerS3AutoUploader } from "./s3-auto-uploader.tsx";
import { registerSmsEventNotifications } from "./sms-event-notifications.tsx";
import { registerShiprocketIntegration } from "./shiprocket-integration.tsx";
import { registerDelhiveryIntegration } from "./delhivery-integration.tsx";
import { registerLogisticsRoutingEndpoints } from "./logistics-routing-engine.tsx";
import { registerReturnsManagementEndpoints } from "./returns-management.tsx";
import missingCrudEndpoints from "./missing-crud-endpoints.tsx"; // ✅ NEW: Missing CRUD endpoints

// Enterprise & Analytics
import { analyticsAggregationEndpoints } from "./analytics-aggregation.tsx";
import { rbacEndpoints } from "./rbac-endpoints.tsx";
import { reportBuilderEndpoints } from "./report-builder-endpoints.tsx";
import { petIntelligenceEndpoints } from "./pet-intelligence-endpoints.tsx";
import { transactionMonitoringEndpoints } from "./transaction-monitoring-endpoints.tsx";

// Enhanced features - Import default exports
import enhancedServicePublishing from "./enhanced-service-publishing.tsx";
import enhancedStaffAvailability from "./enhanced-staff-availability-routes.tsx";
import enhancedGpsTracking from "./enhanced-gps-tracking.tsx";
import criticalFlowFixes from "./critical-flow-fixes.tsx";
import { registerGroomerGalleryEndpoints } from "./groomer-gallery-system.tsx";
import trainerProgressTracking from "./trainer-progress-tracking.tsx";
import cafeTableManagement from "./cafe-table-management.tsx";
import { registerInsuranceClaimEndpoints } from "./insurance-claim-management.tsx";
import customerWalletTopup from "./customer-wallet-topup.tsx";
import rewardsLoyaltySystem from "./rewards-loyalty-system.tsx";
import referralSystem from "./referral-system.tsx";
import { registerCustomerMedicalRecordsEndpoints } from "./customer-medical-records.tsx";
import customerAppEnhancements from "./customer-app-enhancements.tsx";
import { registerProfilePhotoEndpoints } from "./profile-photo-management.tsx";
import advancedFilteringSystem from "./advanced-filtering-system.tsx";
import appointmentReminderSystem from "./appointment-reminder-system.tsx";
import serviceComparisonSystem from "./service-comparison-system.tsx";
import { registerPlatformSubscriptionTiers } from "./platform-subscription-tiers.tsx";
import { registerMatingDatingService } from "./mating-dating-service.tsx";
import vendorBookings from "./vendor-bookings.tsx";
import automatedPayoutProcessing from "./automated-payout-processing.tsx";
import enhancedRefundSystem from "./enhanced-refund-system.tsx";
import tierUpgradeAutomation from "./tier-upgrade-automation.tsx";
import systemHealthCheck from "./system-health-check.tsx";
import adminCleanupDuplicates from "./admin-cleanup-duplicates.tsx";
import vendorBankValidation from "./vendor-bank-validation.tsx";
import vetSpecializedServices from "./vet-specialized-services.tsx"; // ✅ NEW: Vet specialized services
import controlledSubstancesEndpoints from "./controlled-substances-endpoints.tsx"; // ✅ NEW: Controlled substances for pharmacies

// ✅ NEW: Solo Provider System
import { soloProviderEndpoints } from "./solo-provider-endpoints.tsx";

// ✅ NEW: Role Consolidation Migration
import roleConsolidationMigration from "./role-consolidation-migration.tsx";
import vendorRoleCleanupMigration from "./vendor-role-cleanup-migration.tsx";

// Staff routes - All export default app
import staffAuthRoutes from "./staff-auth-endpoints.tsx";
import staffAvailabilityRoutes from "./staff-availability-routes.tsx";
import staffScheduleRoutes from "./staff-schedule-endpoints.tsx";
import staffCRUDRoutes from "./staff-crud-endpoints.tsx";

// ✅ CRITICAL: Staff service and discovery endpoints
import { staffServiceEndpoints } from "./staff-service-endpoints.tsx";
import staffDiscoveryEndpoints from "./staff-discovery-endpoints.tsx";
import universalStaffSearch from "./universal-staff-search.tsx";
import universalStaffProblemSearch from "./universal-staff-problem-search.tsx";

const app = new Hono();

// Global Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// ------------------------------------------------------------------
// CRITICAL: Region endpoint must be registered FIRST to avoid being shadowed
// ------------------------------------------------------------------
app.get('/make-server-3dd53475/regions', async (c) => {
  try {
    const regionsData = await kv.getByPrefix('region_');
    
    console.log(`✅ Returning ${regionsData?.length || 0} regions from GET /regions`);
    
    return sendSuccess(c, {
      regions: regionsData || [],
      count: regionsData?.length || 0
    });
  } catch (error) {
    console.error('Error fetching regions:', error);
    return sendError(c, error, 500);
  }
});

// Get active regions (non-blocking with timeout protection)
app.get('/make-server-3dd53475/regions/active', async (c) => {
  try {
    console.log('📍 [REGIONS] Fetching active regions...');
    
    // Use Promise.race to timeout after 2 seconds
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 2000)
    );
    
    const fetchPromise = (async () => {
      const regionsData = await kv.getByPrefix('region_');
      const regions = (regionsData || []).map((item: any) => item.value || item);
      const activeRegions = regions.filter((r: any) => r.isActive === true);
      return activeRegions;
    })();
    
    const activeRegions = await Promise.race([fetchPromise, timeoutPromise]) as any[];
    
    console.log(`✅ Returning ${activeRegions.length} active regions from GET /regions/active`);
    
    return sendSuccess(c, {
      regions: activeRegions,
      count: activeRegions.length
    });
  } catch (error) {
    console.error('❌ Error fetching active regions:', error);
    
    // Return empty array on timeout instead of failing
    if (error instanceof Error && error.message === 'Request timeout') {
      console.warn('⚠️ Region fetch timeout, returning empty array');
      return sendSuccess(c, {
        regions: [],
        count: 0,
        warning: 'Region data temporarily unavailable'
      });
    }
    
    return sendError(c, error, 500);
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
advancedSearchEngine(app, kv);

// 2. Vendor Specific Routes (Dashboard, Onboarding, Config, Services)
// These must be registered BEFORE customer-routes because customer-routes
// contains a generic /vendor/:vendorId wildcard that would shadow these.
vendorOnboardingEndpoints(app, kv);
vendorApprovalWorkflowEndpoints(app, kv);
vendorDashboardEndpoints(app, kv);
vendorRoleConfigEndpoints(app);
registerDynamicOnboarding(app);
registerVendorServiceEndpoints(app);
registerVendorCatalogAPIV2(app);
customServiceEndpoints(app, kv); // ✅ FIX: Register custom service endpoints
app.route('/make-server-3dd53475', vendorScheduleV2Endpoints);

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
registerPetListingManagement(app);
registerNutritionistMealManagement(app);
registerServicePackageManagement(app);
registerCustomerPackageEndpoints(app); // ✅ GAP #3 FIX
registerVendorMetricsEnhancement(app); // ✅ GAP #8 FIX
bookingEndpoints(app, kv);
registerCafeFeatures(app);
registerResortInventory(app);
registerBreederListings(app);

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

if (enhancedGpsTracking && typeof enhancedGpsTracking === 'object') {
  app.route('/make-server-3dd53475', enhancedGpsTracking);
} else {
  console.warn('⚠️ Enhanced GPS Tracking module undefined, skipping');
}

// ✅ Critical Flow Fixes (P0)
if (criticalFlowFixes && typeof criticalFlowFixes === 'object') {
  app.route('/make-server-3dd53475', criticalFlowFixes);
} else {
  console.warn('⚠️ Critical Flow Fixes module undefined, skipping');
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

if (referralSystem && typeof referralSystem === 'object') {
  app.route('/make-server-3dd53475', referralSystem);
} else {
  console.warn('⚠️ Referral System module undefined, skipping');
}

if (registerCustomerMedicalRecordsEndpoints && typeof registerCustomerMedicalRecordsEndpoints === 'function') {
  registerCustomerMedicalRecordsEndpoints(app);
} else {
  console.warn('⚠️ Customer Medical Records module undefined, skipping');
}

// ✅ Customer App Enhancements
if (customerAppEnhancements && typeof customerAppEnhancements === 'object') {
  app.route('/make-server-3dd53475', customerAppEnhancements);
} else {
  console.warn('⚠️ Customer App Enhancements module undefined, skipping');
}

// ✅ P2 Features - Final 18% to reach 100%
if (registerProfilePhotoEndpoints && typeof registerProfilePhotoEndpoints === 'function') {
  registerProfilePhotoEndpoints(app);
} else {
  console.warn('⚠️ Profile Photo Management module undefined, skipping');
}

if (advancedFilteringSystem && typeof advancedFilteringSystem === 'object') {
  app.route('/make-server-3dd53475', advancedFilteringSystem);
} else {
  console.warn('⚠️ Advanced Filtering System module undefined, skipping');
}

if (appointmentReminderSystem && typeof appointmentReminderSystem === 'object') {
  app.route('/make-server-3dd53475', appointmentReminderSystem);
} else {
  console.warn('⚠️ Appointment Reminder System module undefined, skipping');
}

if (serviceComparisonSystem && typeof serviceComparisonSystem === 'object') {
  app.route('/make-server-3dd53475', serviceComparisonSystem);
} else {
  console.warn('⚠️ Service Comparison System module undefined, skipping');
}

// ✅ Platform Subscription Tiers & Mating/Dating Service
registerPlatformSubscriptionTiers(app);
registerMatingDatingService(app);

// ✅ Vendor Bookings
if (vendorBookings && typeof vendorBookings === 'object') {
  app.route('/make-server-3dd53475', vendorBookings);
} else {
  console.warn('⚠️ Vendor Bookings module undefined, skipping');
}

// ✅ P0 CRITICAL: Automated Payout Processing
if (automatedPayoutProcessing && typeof automatedPayoutProcessing === 'object') {
  app.route('/make-server-3dd53475', automatedPayoutProcessing);
  console.log('✅ Automated Payout Processing module registered');
} else {
  console.warn('⚠️ Automated Payout Processing module undefined, skipping');
}

// ✅ P0 CRITICAL: Enhanced Refund System with Policy Enforcement
if (enhancedRefundSystem && typeof enhancedRefundSystem === 'object') {
  app.route('/make-server-3dd53475', enhancedRefundSystem);
  console.log('✅ Enhanced Refund System module registered');
} else {
  console.warn('⚠️ Enhanced Refund System module undefined, skipping');
}

// ✅ P0 CRITICAL: Tier Upgrade Automation
if (tierUpgradeAutomation && typeof tierUpgradeAutomation === 'object') {
  app.route('/make-server-3dd53475', tierUpgradeAutomation);
  console.log('✅ Tier Upgrade Automation module registered');
} else {
  console.warn('⚠️ Tier Upgrade Automation module undefined, skipping');
}

// ✅ SYSTEM HEALTH CHECK
if (systemHealthCheck && typeof systemHealthCheck === 'object') {
  app.route('/make-server-3dd53475', systemHealthCheck);
  console.log('✅ System Health Check module registered');
} else {
  console.warn('⚠️ System Health Check module undefined, skipping');
}

// ✅ ADMIN CLEANUP DUPLICATES
if (adminCleanupDuplicates && typeof adminCleanupDuplicates === 'object') {
  app.route('/make-server-3dd53475', adminCleanupDuplicates);
  console.log('✅ Admin Cleanup Duplicates module registered');
} else {
  console.warn('⚠️ Admin Cleanup Duplicates module undefined, skipping');
}

// ✅ VENDOR BANK VALIDATION
if (vendorBankValidation && typeof vendorBankValidation === 'object') {
  app.route('/make-server-3dd53475', vendorBankValidation);
  console.log('✅ Vendor Bank Validation module registered');
} else {
  console.warn('⚠️ Vendor Bank Validation module undefined, skipping');
}

// ✅ VET SPECIALIZED SERVICES
if (vetSpecializedServices && typeof vetSpecializedServices === 'object') {
  app.route('/make-server-3dd53475', vetSpecializedServices);
  console.log('✅ Vet Specialized Services module registered');
} else {
  console.warn('⚠️ Vet Specialized Services module undefined, skipping');
}

// ✅ NEW: Controlled Substances Endpoints
if (controlledSubstancesEndpoints && typeof controlledSubstancesEndpoints === 'object') {
  app.route('/make-server-3dd53475', controlledSubstancesEndpoints);
  console.log('✅ Controlled Substances Endpoints module registered');
} else {
  console.warn('⚠️ Controlled Substances Endpoints module undefined, skipping');
}

// ✅ NEW: Solo Provider System
console.log('✅ Registering Solo Provider Endpoints...');
soloProviderEndpoints(app, kv);

// ✅ NEW: Role Consolidation Migration
console.log('✅ Registering Role Consolidation Migration...');
if (roleConsolidationMigration && typeof roleConsolidationMigration === 'object') {
  app.route('/make-server-3dd53475', roleConsolidationMigration);
  console.log('✅ Role Consolidation Migration module registered');
} else {
  console.warn('⚠️ Role Consolidation Migration module undefined, skipping');
}

// ✅ NEW: Vendor Role Cleanup Migration
console.log('✅ Registering Vendor Role Cleanup Migration...');
if (vendorRoleCleanupMigration && typeof vendorRoleCleanupMigration === 'object') {
  app.route('/make-server-3dd53475', vendorRoleCleanupMigration);
  console.log('✅ Vendor Role Cleanup Migration module registered');
} else {
  console.warn('⚠️ Vendor Role Cleanup Migration module undefined, skipping');
}

// ✅ P0 Features
registerP0Features(app);

// 5. Staff Routes
if (staffAuthRoutes && typeof staffAuthRoutes === 'object') {
  app.route('/make-server-3dd53475', staffAuthRoutes); // Register Auth FIRST to avoid shadowing by /staff wildcard
} else {
  console.warn('⚠️ Staff Auth Routes module undefined, skipping');
}

if (staffAvailabilityRoutes && typeof staffAvailabilityRoutes === 'object') {
  app.route('/make-server-3dd53475/staff', staffAvailabilityRoutes);
} else {
  console.warn('⚠️ Staff Availability Routes module undefined, skipping');
}

if (staffScheduleRoutes && typeof staffScheduleRoutes === 'object') {
  app.route('/', staffScheduleRoutes);
} else {
  console.warn('⚠️ Staff Schedule Routes module undefined, skipping');
}

if (staffCRUDRoutes && typeof staffCRUDRoutes === 'object') {
  app.route('/', staffCRUDRoutes);
} else {
  console.warn('⚠️ Staff CRUD Routes module undefined, skipping');
}

// ✅ CRITICAL: Staff service and discovery endpoints
// Staff Service Endpoints - requires both app and kv parameters
console.log('✅ Registering staff service endpoints...');
staffServiceEndpoints(app, kv);

if (staffDiscoveryEndpoints && typeof staffDiscoveryEndpoints === 'object') {
  console.log('✅ Registering staff discovery endpoints...');
  app.route('/make-server-3dd53475', staffDiscoveryEndpoints);
} else {
  console.warn('⚠️ Staff Discovery Endpoints module undefined, skipping');
}

if (universalStaffSearch && typeof universalStaffSearch === 'object') {
  console.log('✅ Registering universal staff search...');
  app.route('/make-server-3dd53475', universalStaffSearch);
} else {
  console.warn('⚠️ Universal Staff Search module undefined, skipping');
}

if (universalStaffProblemSearch && typeof universalStaffProblemSearch === 'object') {
  console.log('✅ Registering universal staff problem search...');
  app.route('/make-server-3dd53475', universalStaffProblemSearch);
} else {
  console.warn('⚠️ Universal Staff Problem Search module undefined, skipping');
}

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
  packageEndpoints(app, kv); // ✅ FIX: Pass kv parameter
} else {
  console.warn('⚠️ Package Endpoints module undefined, skipping');
}

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