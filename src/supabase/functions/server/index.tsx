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

// ✅ NEW: Enterprise Admin Capabilities
import { analyticsAggregationEndpoints } from "./analytics-aggregation.tsx";
import { rbacEndpoints } from "./rbac-endpoints.tsx";
import { reportBuilderEndpoints } from "./report-builder-endpoints.tsx";
import { petIntelligenceEndpoints } from "./pet-intelligence-endpoints.tsx";
import { adminOperationsDashboard } from "./admin-operations-dashboard.tsx";

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
app.route('/make-server-3dd53475', marketingRoutesV2);
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

// ✅ NEW: Enterprise Admin Capabilities
analyticsAggregationEndpoints(app);
rbacEndpoints(app);
reportBuilderEndpoints(app);
petIntelligenceEndpoints(app);
adminOperationsDashboard(app);

// 5. Staff Routes
app.route('/make-server-3dd53475', staffAuthRoutes); // Register Auth FIRST to avoid shadowing by /staff wildcard
app.route('/make-server-3dd53475/staff', staffAvailabilityRoutes);
app.route('/', staffScheduleRoutes);
app.route('/', staffCRUDRoutes);

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

// Start Server
console.log("🚀 Server starting...");
Deno.serve(app.fetch);