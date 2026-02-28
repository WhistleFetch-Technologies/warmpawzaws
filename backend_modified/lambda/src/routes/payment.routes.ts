/**
 * ============================================================================
 * PAYMENT ROUTES
 * ============================================================================
 * 
 * Route registration for payment endpoints
 * 
 * Date: 2026-01-28
 * Phase 5: Payment domain restructuring
 * ============================================================================
 */

import { Hono } from 'hono';

// Import from original backend (to be extracted to controllers/payment/)
import { registerPaymentEndpointsEnhanced } from '../endpoints/payments-enhanced';
import { registerPaymentEndpoints } from '../endpoints/payments';
import { registerRazorpayEndpoints } from '../endpoints/razorpay';
import { registerRazorpaySettlementEndpoints } from '../endpoints/razorpay-settlements';
import { registerWalletEndpoints } from '../endpoints/wallet';
import { registerWalletDiagnosticEndpoints } from '../endpoints/wallet-diagnostic';
import { registerSettlementEndpoints } from '../endpoints/settlements';
import { registerTransactionMonitoringEndpoints } from '../endpoints/transaction-monitoring';

/**
 * Register all payment-related routes
 * Preserves exact route registration order from handler/index.ts
 */
export function registerPaymentRoutes(app: Hono) {
  registerPaymentEndpointsEnhanced(app);
  registerPaymentEndpoints(app);
  registerRazorpayEndpoints(app);
  registerRazorpaySettlementEndpoints(app);
  registerWalletEndpoints(app);
  registerWalletDiagnosticEndpoints(app);
  registerSettlementEndpoints(app);
  registerTransactionMonitoringEndpoints(app);
}
