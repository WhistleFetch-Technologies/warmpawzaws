/**
 * ============================================================================
 * CUSTOMER ROUTES
 * ============================================================================
 * 
 * Route registration for customer endpoints
 * 
 * Date: 2026-01-28
 * Phase 2: Customer domain restructuring
 * ============================================================================
 */

import { Hono } from 'hono';

// Import from original backend (to be extracted to controllers/customer/)
import { registerCustomerEndpointsEnhanced } from '../endpoints/customer-enhanced';
// NOTE: registerCustomerEndpoints is imported but NOT called in the original handler/index.ts
// import { registerCustomerEndpoints } from '../endpoints/customer';
import { registerCustomerProfileEndpoints } from '../endpoints/customer-profile';
import { registerCustomerPhoneConvenienceEndpoints } from '../endpoints/customer-phone-convenience';
import { registerCustomerBookingHistoryEndpoints } from '../endpoints/customer-booking-history';
import { registerCustomerAppointmentsEndpoints } from '../endpoints/customer-appointments';
import { registerCustomerOrdersEndpoints } from '../endpoints/customer-orders';
import { registerCustomerContentEndpoints } from '../endpoints/customer-content';
import { registerAddressEndpoints } from '../endpoints/addresses';
import { registerBehaviorJournalEndpoints } from '../endpoints/behavior-journal';
import { registerNotificationEndpoints } from '../endpoints/notifications';
import { registerRefundPolicyEngineEndpoints } from '../endpoints/refund-policy-engine';

/**
 * Register all customer-related routes
 * Preserves exact route registration order from handler/index.ts
 */
export function registerCustomerRoutes(app: Hono) {
  // Register in order (specific routes before parameterized)
  registerBehaviorJournalEndpoints(app); // /customer/behavior-journal - before /customer/:customerId
  registerNotificationEndpoints(app); // /customer/notifications - before /customer/:customerId
  registerCustomerPhoneConvenienceEndpoints(app); // /customer/bookings/active, etc. - before /customer/:customerId
  registerCustomerProfileEndpoints(app); // /customer/profile - before /customer/:customerId
  registerCustomerBookingHistoryEndpoints(app); // /customer/bookings/:bookingId - before /customer/:customerId
  registerAddressEndpoints(app); // /customer/addresses - before /customer/:customerId
  registerRefundPolicyEngineEndpoints(app); // /customer/refund-policy - before /customer/:customerId
  registerCustomerContentEndpoints(app); // /customer/banners, /customer/articles - before /customer/:customerId
  
  // Now register parameterized routes
  registerCustomerEndpointsEnhanced(app); // /customer/:customerId (parameterized - must be last)
  // registerCustomerEndpoints(app); // NOT called in original handler/index.ts - removed
  registerCustomerAppointmentsEndpoints(app);
  registerCustomerOrdersEndpoints(app);
}
