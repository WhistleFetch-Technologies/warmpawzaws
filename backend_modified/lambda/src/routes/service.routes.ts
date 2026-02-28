/**
 * ============================================================================
 * SERVICE ROUTES
 * ============================================================================
 * 
 * Route registration for service discovery and catalog endpoints
 * 
 * Date: 2026-01-28
 * Phase 6: Service domain restructuring
 * ============================================================================
 */

import { Hono } from 'hono';

// Import from original backend (to be extracted to controllers/service/)
import { registerServiceDiscoveryEndpoints } from '../endpoints/service-discovery';
import { registerServiceCatalogEndpoints } from '../endpoints/service-catalog';
import { registerSpecializedServicesEndpoints } from '../endpoints/specialized-services';
import { registerSpecializedServiceFlows } from '../endpoints/specialized-service-flows';
import { registerSearchEndpoints } from '../endpoints/search';
import { registerPetEndpoints } from '../endpoints/pets';
import { registerReviewEndpoints } from '../endpoints/reviews';
import { registerCommuteTimeEndpoints } from '../endpoints/commute-time';
import { registerInstantTeleQueueEndpoints } from '../endpoints/instant-tele-queue';
import { registerInstantTeleV2Endpoints } from '../endpoints/instant-tele-v2';
import { registerRoomsEndpoints } from '../endpoints/rooms';
import { registerVideoCallEndpoints } from '../endpoints/video-call';

/**
 * Register all service-related routes
 * Preserves exact route registration order from handler/index.ts
 */
export function registerServiceRoutes(app: Hono) {
  // Register specific routes before parameterized routes
  registerServiceDiscoveryEndpoints(app); // /customer/vendors/search, etc. - before /customer/:customerId
  registerServiceCatalogEndpoints(app); // /services/:serviceId - before /customer/:customerId
  
  // Register remaining service endpoints
  registerSpecializedServicesEndpoints(app);
  registerSpecializedServiceFlows(app);
  registerSearchEndpoints(app);
  registerPetEndpoints(app);
  registerReviewEndpoints(app);
  registerCommuteTimeEndpoints(app);
  registerInstantTeleQueueEndpoints(app);
  registerInstantTeleV2Endpoints(app);
  registerRoomsEndpoints(app);
  registerVideoCallEndpoints(app);
}
