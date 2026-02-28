/**
 * ============================================================================
 * LOGISTICS ROUTES
 * ============================================================================
 * 
 * Route registration for logistics endpoints
 * 
 * Date: 2026-01-28
 * Phase 7: Logistics domain restructuring
 * ============================================================================
 */

import { Hono } from 'hono';

// Import from original backend (to be extracted to controllers/logistics/)
import { registerLogisticsEndpoints } from '../endpoints/logistics';
import { registerLogisticsWebhookEndpoints } from '../endpoints/logistics-webhooks';
import { registerPharmacyOrderEndpoints, registerAdditionalPharmacyEndpoints } from '../endpoints/pharmacy-orders';
import { registerPharmacyInventoryEndpoints } from '../endpoints/pharmacy-inventory';
import { registerDeliveryTrackingEndpoints } from '../endpoints/delivery-tracking';
import { registerDeliveryOtpEndpoints } from '../endpoints/delivery-otp';
import { registerDeliveryPartnerAutomationEndpoints } from '../endpoints/delivery-partner-automation';

/**
 * Register all logistics-related routes
 */
export function registerLogisticsRoutes(app: Hono) {
  registerLogisticsEndpoints(app);
  registerLogisticsWebhookEndpoints(app);
  registerPharmacyOrderEndpoints(app);
  registerPharmacyInventoryEndpoints(app);
  registerDeliveryTrackingEndpoints(app);
  registerDeliveryOtpEndpoints(app);
  registerDeliveryPartnerAutomationEndpoints(app);
  registerAdditionalPharmacyEndpoints(app);
}
