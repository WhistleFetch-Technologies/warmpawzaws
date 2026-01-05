/**
 * ============================================================================
 * WALLET ENDPOINTS - LAMBDA VERSION WITH ROW-LEVEL LOCKING
 * ============================================================================
 *
 * Provides atomic wallet operations with concurrency safety
 *
 * Endpoints:
 * - GET /wallet/:customerId - Get wallet balance
 * - POST /wallet/:customerId/credit - Credit wallet (add funds)
 * - POST /wallet/:customerId/debit - Debit wallet (spend funds)
 * - GET /wallet/:customerId/transactions - Get transaction history
 *
 * Date: 2026-01-03
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerWalletEndpoints(app: Hono): void;
//# sourceMappingURL=wallet.d.ts.map