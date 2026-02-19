/**
 * Wallet Diagnostic Endpoint
 * Direct database queries to check wallet balance and transactions
 */

import { Hono } from 'hono';
import { query } from '../database/rds-connection';

export function registerWalletDiagnosticEndpoints(app: Hono) {
  /**
   * GET /wallet/:customerId/diagnostic
   * Direct database query to check wallet balance and transactions
   */
  app.get('/wallet/:customerId/diagnostic', async (c) => {
    try {
      const customerId = c.req.param('customerId');

      if (!customerId) {
        return c.json({ error: 'Customer ID is required' }, 400);
      }

      // 1. Check customer_wallets table
      const walletResult = await query(
        `SELECT * FROM customer_wallets WHERE customer_id = $1`,
        [customerId]
      );

      // 2. Check wallet_transactions table (handle both wallet_id and customer_id schemas)
      let transactionsResult;
      try {
        // Try with customer_id first (migration 012)
        transactionsResult = await query(
          `SELECT * FROM wallet_transactions 
           WHERE customer_id = $1 
           ORDER BY created_at DESC 
           LIMIT 20`,
          [customerId]
        );
      } catch (error: any) {
        // If customer_id doesn't exist, try with wallet_id (schema.sql)
        const wallet = walletResult.rows[0];
        if (wallet?.id) {
          transactionsResult = await query(
            `SELECT * FROM wallet_transactions 
             WHERE wallet_id = $1 
             ORDER BY created_at DESC 
             LIMIT 20`,
            [wallet.id]
          );
        } else {
          transactionsResult = { rows: [] };
        }
      }

      // 3. Check loyalty_transactions for this vendor
      const loyaltyResult = await query(
        `SELECT * FROM loyalty_transactions 
         WHERE customer_id = $1 
         AND reference_type = 'vendor_referral'
         ORDER BY created_at DESC 
         LIMIT 20`,
        [customerId]
      );

      // 4. Check customer_loyalty_points
      const loyaltyPointsResult = await query(
        `SELECT * FROM customer_loyalty_points WHERE customer_id = $1`,
        [customerId]
      );

      // 5. Calculate total loyalty credits from wallet_transactions
      let loyaltyCreditsResult;
      try {
        // Try with customer_id first
        loyaltyCreditsResult = await query(
          `SELECT 
            COUNT(*) as count,
            COALESCE(SUM(amount), 0) as total_amount
           FROM wallet_transactions 
           WHERE customer_id = $1 
           AND (description LIKE '%loyalty%' OR description LIKE '%points%')`,
          [customerId]
        );
      } catch (error: any) {
        // If customer_id doesn't exist, try with wallet_id
        const wallet = walletResult.rows[0];
        if (wallet?.id) {
          loyaltyCreditsResult = await query(
            `SELECT 
              COUNT(*) as count,
              COALESCE(SUM(amount), 0) as total_amount
             FROM wallet_transactions 
             WHERE wallet_id = $1 
             AND (description LIKE '%loyalty%' OR description LIKE '%points%')`,
            [wallet.id]
          );
        } else {
          loyaltyCreditsResult = { rows: [{ count: '0', total_amount: '0' }] };
        }
      }

      return c.json({
        success: true,
        customerId,
        wallet: {
          exists: walletResult.rows.length > 0,
          data: walletResult.rows[0] || null,
          balance: walletResult.rows[0]?.balance || 0,
        },
        transactions: {
          count: transactionsResult.rows.length,
          data: transactionsResult.rows,
        },
        loyaltyTransactions: {
          count: loyaltyResult.rows.length,
          data: loyaltyResult.rows,
          totalPoints: loyaltyResult.rows.reduce((sum, t) => sum + (parseInt(t.points) || 0), 0),
        },
        loyaltyPoints: {
          exists: loyaltyPointsResult.rows.length > 0,
          data: loyaltyPointsResult.rows[0] || null,
          totalPoints: loyaltyPointsResult.rows[0]?.total_points || 0,
        },
        loyaltyCredits: {
          count: parseInt(loyaltyCreditsResult.rows[0]?.count || '0'),
          totalAmount: parseFloat(loyaltyCreditsResult.rows[0]?.total_amount || '0'),
        },
      });
    } catch (error: any) {
      console.error('Error in wallet diagnostic:', error);
      return c.json({ 
        error: error.message,
        stack: error.stack 
      }, 500);
    }
  });
}
