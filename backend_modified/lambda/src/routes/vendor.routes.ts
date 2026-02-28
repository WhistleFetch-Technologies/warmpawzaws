/**
 * ============================================================================
 * VENDOR ROUTES
 * ============================================================================
 * 
 * Route registration for vendor endpoints
 * 
 * Date: 2026-01-28
 * Phase 3: Vendor domain restructuring
 * ============================================================================
 */

import { Hono } from 'hono';

// Import from original backend (to be extracted to controllers/vendor/)
import { registerVendorOnboardingEndpointsEnhanced } from '../endpoints/vendor-onboarding-enhanced';
import { registerVendorOnboardingFixes } from '../endpoints/vendor-onboarding-fixes';
import { registerVendorDashboardEnhancedEndpoints } from '../endpoints/vendor-dashboard-enhanced';
import { registerVendorDashboardEndpoints } from '../endpoints/vendor-dashboard';
import { registerVendorScheduleEndpoints } from '../endpoints/vendor-schedule';
import { registerVendorServicesEndpoints } from '../endpoints/vendor-services';
import { registerVendorSetupEndpoints } from '../endpoints/vendor-setup';
import { registerVendorPricingEndpoints } from '../endpoints/vendor-pricing';
import { registerVendorProductsEndpoints } from '../endpoints/vendor-products';
import { registerVendorOrdersEndpoints } from '../endpoints/vendor-orders';
import { registerVendorProfileEndpoints } from '../endpoints/vendor-profile';
import { registerVendorSettingsEndpoints } from '../endpoints/vendor-settings';
import { registerVendorPoliciesEndpoints } from '../endpoints/vendor-policies';
import { registerVendorBookingsEndpoints } from '../endpoints/vendor-bookings';
import { registerVendorBookingActionsEndpoints } from '../endpoints/vendor-booking-actions';
import { registerVendorAnalyticsEndpoints } from '../endpoints/vendor-analytics';
import { registerVendorPromotionsEndpoints } from '../endpoints/vendor-promotions';
import { registerVendorBankAccountEndpoints } from '../endpoints/vendor-bank-accounts';
import { registerVendorSecurityEndpoints } from '../endpoints/vendor-security';
import { registerVendorDistancePricingEndpoints } from '../endpoints/vendor-distance-pricing';
import { registerVendorLiveStatusEndpoints } from '../endpoints/vendor-live-status';
import { registerVendorSupportEndpoints } from '../endpoints/vendor-support';
import { registerVendorRadarEndpoints } from '../endpoints/vendor-radar';

/**
 * Register all vendor-related routes
 * Preserves exact route registration order from handler/index.ts
 */
export function registerVendorRoutes(app: Hono) {
  // Register enhanced dashboard BEFORE legacy (per handler/index.ts line 449)
  registerVendorDashboardEnhancedEndpoints(app);
  registerVendorDashboardEndpoints(app);
  
  // Register onboarding endpoints
  registerVendorOnboardingEndpointsEnhanced(app);
  registerVendorOnboardingFixes(app);
  
  // Register vendor management endpoints
  registerVendorScheduleEndpoints(app);
  registerVendorServicesEndpoints(app);
  registerVendorSetupEndpoints(app);
  registerVendorPricingEndpoints(app);
  registerVendorProductsEndpoints(app);
  registerVendorOrdersEndpoints(app);
  registerVendorProfileEndpoints(app);
  registerVendorSettingsEndpoints(app);
  registerVendorPoliciesEndpoints(app);
  registerVendorBookingsEndpoints(app);
  registerVendorBookingActionsEndpoints(app);
  registerVendorAnalyticsEndpoints(app);
  registerVendorPromotionsEndpoints(app);
  registerVendorBankAccountEndpoints(app);
  registerVendorSecurityEndpoints(app);
  registerVendorDistancePricingEndpoints(app);
  registerVendorLiveStatusEndpoints(app);
  registerVendorSupportEndpoints(app);
  registerVendorRadarEndpoints(app);
}
