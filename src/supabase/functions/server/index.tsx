import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

// Route registration functions
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
import { vendorDashboardEndpoints } from "./vendor-dashboard-endpoints.tsx";
import { reviewEndpoints } from "./review-endpoints.tsx";
import { analyticsEndpoints } from "./analytics-endpoints.tsx";
import { registerDynamicOnboarding } from "./dynamic-onboarding-management.tsx";
import { registerAuthEndpoints } from "./auth-endpoints.tsx";
import { bookingEndpoints } from "./booking-endpoints.tsx";
import { registerAICRMRoutes } from "./ai-crm-routes.tsx";
import { registerAIChatbotRoutes } from "./ai-chatbot-routes.tsx";
import { vendorRoleConfigEndpoints } from "./vendor-role-config.tsx";
import { registerVendorServiceEndpoints } from "./vendor-services-endpoints.tsx";
import { registerVendorCatalogAPIV2 } from "./vendor-catalog-api-v2.tsx";
import { vendorScheduleV2Endpoints } from "./vendor-schedule-v2.tsx";
import { registerProblemGridSpecializationSystem } from "./problem-grid-specialization-system.tsx";
import { registerAdminCatalogEndpoints } from "./admin-catalog-endpoints.tsx";
import { adminIntegrationEndpoints } from "./admin-integration-endpoints.tsx";
import { registerVendorSettingsRulesEndpoints } from "./vendor-settings-rules-endpoints.tsx";
import { registerVideoCallEndpoints } from "./video-call-endpoints.tsx";
import { regionEndpoints } from "./region-endpoints.tsx";
import staffAvailabilityRoutes from "./staff-availability-routes.tsx";
import staffScheduleRoutes from "./staff-schedule-endpoints.tsx";
import staffCRUDRoutes from "./staff-crud-endpoints.tsx";
import staffAuthRoutes from "./staff-auth-endpoints.tsx";
import { paymentEndpoints } from "./payment-endpoints.tsx";
import { marketplacePaymentEndpoints } from "./marketplace-payment-endpoints.tsx";
import { criticalActionGuard } from "./critical-action-guard.tsx";
import orderRoutes from "./order-management-endpoints.tsx";
import ecommerceRoutes from "./ecommerce_routes.tsx";
import marketingRoutesV2 from "./marketing-routes-v2.tsx";
import customerEcommerceRoutes from "./customer-ecommerce-endpoints.tsx";
import { registerGPSTrackingEndpoints } from "./gps-tracking.tsx";
import { registerCafeFeatures } from "./cafe-features.tsx";
import { registerResortInventory } from "./resort-inventory.tsx";
import { registerBreederListings } from "./breeder-listings.tsx";
import { registerAnalyticsIngestion } from "./analytics-events.tsx";
import { registerLogisticsEndpoints } from "./logistics-adapter.tsx";
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
import { registerMarketplaceProducts } from "./marketplace-products.tsx";
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

// ✅ NEW: Payment & Logistics Integrations
import { razorpayEndpoints } from "./razorpay-integration.tsx";
import { registerShiprocketIntegration } from "./shiprocket-integration.tsx";
import { registerIntegrationInitEndpoints } from "./init-integrations.tsx";
import { agoraVideoEndpoints } from "./agora-video-integration.tsx";
import { automatedPayoutEndpoints } from "./automated-vendor-payouts.tsx";

// ✅ NEW: AWS Chime Video & Chat Integration
import { registerAWSChimeVideoEndpoints } from "./aws-chime-video-integration.tsx";
import { registerAWSChimeChatEndpoints } from "./aws-chime-chat-integration.tsx";

// ✅ NEW: Enterprise Admin Capabilities
import { analyticsAggregationEndpoints } from "./analytics-aggregation.tsx";
import { rbacEndpoints } from "./rbac-endpoints.tsx";
import { reportBuilderEndpoints } from "./report-builder-endpoints.tsx";
import { petIntelligenceEndpoints } from "./pet-intelligence-endpoints.tsx";
import { transactionMonitoringEndpoints } from "./transaction-monitoring-endpoints.tsx";

// ✅ NEW: Priority 2 Enhanced Endpoints
import enhancedServicePublishing from "./enhanced-service-publishing.tsx";
import enhancedStaffAvailability from "./enhanced-staff-availability-with-conflicts.tsx";
import enhancedGpsTracking from "./enhanced-gps-tracking.tsx";

// ✅ NEW: Critical Flow Fixes (P0)
import criticalFlowFixes from "./critical-flow-fixes.tsx";

// ✅ NEW: P1 Vendor-Specific Features
import groomerGallerySystem from "./groomer-gallery-system.tsx";
import trainerProgressTracking from "./trainer-progress-tracking.tsx";
import cafeTableManagement from "./cafe-table-management.tsx";
import insuranceClaimManagement from "./insurance-claim-management.tsx";

// ✅ NEW: Customer App Features (Manually Edited)
import customerWalletTopup from "./customer-wallet-topup.tsx";
import rewardsLoyaltySystem from "./rewards-loyalty-system.tsx";
import referralSystem from "./referral-system.tsx";
import customerMedicalRecords from "./customer-medical-records.tsx";

// ✅ NEW: Customer App Enhancements
import customerAppEnhancements from "./customer-app-enhancements.tsx";

// ✅ NEW: P2 Features - Final 18% to reach 100%
import profilePhotoManagement from "./profile-photo-management.tsx";
import advancedFilteringSystem from "./advanced-filtering-system.tsx";
import appointmentReminderSystem from "./appointment-reminder-system.tsx";
import serviceComparisonSystem from "./service-comparison-system.tsx";

// ✅ NEW: Platform Subscription Tiers & Mating/Dating Service
import { registerPlatformSubscriptionTiers } from "./platform-subscription-tiers.tsx";
import { registerMatingDatingService } from "./mating-dating-service.tsx";

// ✅ Vendor Bookings
import vendorBookings from "./vendor-bookings.tsx";

const app = new Hono();

// Global Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// ------------------------------------------------------------------
// CRITICAL: Region endpoint must be registered FIRST to avoid being shadowed
// ------------------------------------------------------------------
app.get('/make-server-3dd53475/regions', async (c) => {
  try {
    const regions = await kv.getByPrefix('region_');
    return sendSuccess(c, {
      regions: regions || [],
      count: regions?.length || 0
    });
  } catch (error) {
    console.error('Error fetching regions:', error);
    return sendError(c, error, 500);
  }
});

// Get active regions - MUST BE BEFORE /:regionId to avoid wildcard shadowing
app.get('/make-server-3dd53475/regions/active', async (c) => {
  try {
    const allRegions = await kv.getByPrefix('region_');
    const activeRegions = (allRegions || []).filter((r: any) => r.isActive === true);
    
    return sendSuccess(c, {
      regions: activeRegions,
      count: activeRegions.length
    });
  } catch (error) {
    console.error('Error fetching active regions:', error);
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

// Initialize India region endpoint
app.post('/make-server-3dd53475/admin/regions/init-india', async (c) => {
  try {
    console.log('🌍 POST /admin/regions/init-india called');
    
    // Check if region already exists
    const existing = await kv.get('region_india');
    if (existing) {
      return sendSuccess(c, { region: existing }, 'India region already exists');
    }
    
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
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      launchDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set('region_india', indiaRegion);
    
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

// 2. Vendor Specific Routes (Dashboard, Onboarding, Config, Services)
// These must be registered BEFORE customer-routes because customer-routes
// contains a generic /vendor/:vendorId wildcard that would shadow these.
vendorOnboardingEndpoints(app, kv);
vendorDashboardEndpoints(app, kv);
vendorRoleConfigEndpoints(app);
registerDynamicOnboarding(app);
registerVendorServiceEndpoints(app);
registerVendorCatalogAPIV2(app);
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
registerGPSTrackingEndpoints(app);
bookingEndpoints(app, kv);
registerCafeFeatures(app);
registerResortInventory(app);
registerBreederListings(app);
registerAnalyticsIngestion(app);
registerLogisticsEndpoints(app);
app.route('/make-server-3dd53475/orders', orderRoutes);
app.route('/make-server-3dd53475/ecommerce', ecommerceRoutes);
app.route('/make-server-3dd53475', customerEcommerceRoutes);
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

// ✅ NEW: Payment & Logistics Integrations
razorpayEndpoints(app);
registerShiprocketIntegration(app);
registerIntegrationInitEndpoints(app);
agoraVideoEndpoints(app);
automatedPayoutEndpoints(app);

// ✅ NEW: AWS Chime Video & Chat Integration
registerAWSChimeVideoEndpoints(app);
registerAWSChimeChatEndpoints(app);

// ✅ NEW: Enterprise Admin Capabilities
analyticsAggregationEndpoints(app);
rbacEndpoints(app);
reportBuilderEndpoints(app);
petIntelligenceEndpoints(app);
transactionMonitoringEndpoints(app);

// ✅ NEW: Priority 2 Enhanced Endpoints
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

// ✅ NEW: Critical Flow Fixes (P0)
if (criticalFlowFixes && typeof criticalFlowFixes === 'object') {
  app.route('/make-server-3dd53475', criticalFlowFixes);
} else {
  console.warn('⚠️ Critical Flow Fixes module undefined, skipping');
}

// ✅ NEW: P1 Vendor-Specific Features
if (groomerGallerySystem && typeof groomerGallerySystem === 'object') {
  app.route('/make-server-3dd53475', groomerGallerySystem);
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

if (insuranceClaimManagement && typeof insuranceClaimManagement === 'object') {
  app.route('/make-server-3dd53475', insuranceClaimManagement);
} else {
  console.warn('⚠️ Insurance Claim Management module undefined, skipping');
}

// ✅ NEW: Customer App Features (Manually Edited)
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

if (customerMedicalRecords && typeof customerMedicalRecords === 'object') {
  app.route('/make-server-3dd53475', customerMedicalRecords);
} else {
  console.warn('⚠️ Customer Medical Records module undefined, skipping');
}

// ✅ NEW: Customer App Enhancements
if (customerAppEnhancements && typeof customerAppEnhancements === 'object') {
  app.route('/make-server-3dd53475', customerAppEnhancements);
} else {
  console.warn('⚠️ Customer App Enhancements module undefined, skipping');
}

// ✅ NEW: P2 Features - Final 18% to reach 100%
if (profilePhotoManagement && typeof profilePhotoManagement === 'object') {
  app.route('/make-server-3dd53475', profilePhotoManagement);
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

// ✅ NEW: Platform Subscription Tiers & Mating/Dating Service
registerPlatformSubscriptionTiers(app);
registerMatingDatingService(app);

// ✅ Vendor Bookings
if (vendorBookings && typeof vendorBookings === 'object') {
  app.route('/make-server-3dd53475', vendorBookings);
} else {
  console.warn('⚠️ Vendor Bookings module undefined, skipping');
}

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
// 🇮🇳 NON-BLOCKING: Initialize India region in background (don't block server startup)
// ------------------------------------------------------------------
function initializeIndiaRegionInBackground() {
  // Run this asynchronously WITHOUT blocking server startup
  setTimeout(async () => {
    try {
      console.log('🌍 [BACKGROUND] Checking if India region exists...');
      
      // Use a shorter timeout for this check
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );
      
      const checkPromise = kv.get('region_india');
      
      const existing = await Promise.race([checkPromise, timeoutPromise]).catch(error => {
        console.log('⚠️ [BACKGROUND] KV check timed out, will retry later');
        return null;
      });
      
      if (existing) {
        console.log('✅ [BACKGROUND] India region already exists');
        return;
      }
      
      console.log('🔄 [BACKGROUND] India region not found. Creating...');
      
      // Create India region with comprehensive configuration
      const indiaRegion = {
        regionId: 'india',
        regionName: 'India',
        regionCode: 'IN',
        isActive: true,
        launchDate: new Date().toISOString(),
        phoneConfig: {
          countryCode: '+91',
          phoneLength: 10,
          phoneFormat: '+91 XXXXX XXXXX',
          validationRegex: '^[6-9]\\d{9}$',
          placeholder: '98765 43210',
          displayFormat: '+91 XXXXX XXXXX'
        },
        currency: {
          code: 'INR',
          symbol: '₹',
          symbolPosition: 'before',
          decimalPlaces: 2,
          thousandsSeparator: ',',
          decimalSeparator: '.'
        },
        localization: {
          primaryLanguage: 'en',
          supportedLanguages: ['en', 'hi'],
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '12h',
          timezone: 'Asia/Kolkata',
          rtlSupport: false
        },
        measurementSystem: {
          system: 'metric',
          weightUnit: 'kg',
          distanceUnit: 'km',
          heightUnit: 'cm'
        },
        serviceCatalog: {
          veterinary: true,
          grooming: true,
          training: true,
          walking: true,
          behavioral: true,
          boarding: true,
          adoption: true,
          sunset: true,
          insurance: true,
          pharmacy: true,
          petCafe: true
        },
        compliance: {
          gdprEnabled: false,
          dataRetentionDays: 730,
          requiresPetLicense: false,
          vaccinationMandatory: ['rabies'],
          ageRestrictions: {
            minAgeMonths: 2,
            maxAgeMonths: 180
          }
        },
        popularBreeds: {
          dogs: [
            'Labrador Retriever',
            'German Shepherd',
            'Golden Retriever',
            'Beagle',
            'Pug',
            'Indian Pariah Dog',
            'Pomeranian',
            'Shih Tzu'
          ],
          cats: [
            'Persian',
            'Siamese',
            'Maine Coon',
            'Indian Street Cat',
            'British Shorthair',
            'Himalayan'
          ]
        },
        business: {
          taxRate: 18,
          taxName: 'GST',
          businessHours: {
            start: '09:00',
            end: '21:00'
          },
          holidays: [
            '2024-01-26',
            '2024-08-15',
            '2024-10-02'
          ]
        },
        payments: {
          supportedMethods: ['razorpay', 'upi', 'card', 'wallet'],
          paymentGateway: 'razorpay',
          minBookingAmount: 100,
          maxBookingAmount: 50000
        },
        regional: {
          emergencyNumber: '112',
          addressFormat: 'flat, building, street, area, city, state, pincode',
          postalCodeRequired: true,
          stateRequired: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set('region_india', indiaRegion);
      
      console.log('✅ [BACKGROUND] India region initialized successfully!');
      console.log('   Region ID: india');
      console.log('   Currency: ₹ INR');
      console.log('   Phone: +91');
      console.log('   Status: Active');
    } catch (error) {
      console.log('⚠️ [BACKGROUND] Failed to initialize India region:', error.message);
      console.log('   This is OK - the region will be created when first accessed via API');
    }
  }, 2000); // Wait 2 seconds after server starts, then try in background
}

// Start Server
console.log("🚀 Server starting...");
console.log("💡 India region will be initialized in background (non-blocking)");
console.log("🎯 Server is ready to accept requests immediately");

// Initialize India region in background (won't block server startup)
initializeIndiaRegionInBackground();

Deno.serve(app.fetch);