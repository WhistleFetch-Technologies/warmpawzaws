/**
 * Wallet Diagnostic Endpoint (Stage 2 P0)
 * Admin-only. Does not expose balances, ledger rows, or stack traces.
 */

import { Hono } from 'hono';
import { query } from '../database/rds-connection';
import { isAdminRole } from '../utils/security-ownership';
import { captureException } from '../utils/error-tracking';
import { SAFE_INTERNAL_ERROR_MESSAGE } from '../utils/safe-hono-error';

export function registerWalletDiagnosticEndpoints(app: Hono) {
  /**
   * GET /wallet/:customerId/diagnostic
   * Authorized admin only — existence flags, no financial payloads.
   */
  app.get('/wallet/:customerId/diagnostic', async (c) => {
    try {
      if (!isAdminRole(c)) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }

      const customerId = c.req.param('customerId');
      if (!customerId) {
        return c.json({ success: false, error: 'Customer ID is required' }, 400);
      }

      const walletResult = await query(
        `SELECT 1 AS ok FROM customer_wallets WHERE customer_id = $1 LIMIT 1`,
        [customerId],
      );

      let transactionCount = 0;
      try {
        const tx = await query(
          `SELECT COUNT(*)::text AS c FROM wallet_transactions WHERE customer_id = $1`,
          [customerId],
        );
        transactionCount = parseInt(tx.rows[0]?.c || '0', 10) || 0;
      } catch {
        transactionCount = 0;
      }

      return c.json({
        success: true,
        customerId,
        walletExists: (walletResult.rows?.length ?? 0) > 0,
        transactionCount,
        message: 'Diagnostic summary only; financial details are not exposed',
      });
    } catch (error: any) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        path: c.req.path,
        method: c.req.method,
      });
      return c.json({ success: false, error: SAFE_INTERNAL_ERROR_MESSAGE }, 500);
    }
  });
}
