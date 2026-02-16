/**
 * ============================================================================
 * VENDOR WALLET ENDPOINTS
 * ============================================================================
 * 
 * Features:
 * - Get vendor wallet balance
 * - Get wallet transactions
 * - Withdraw to bank/UPI
 * 
 * Date: 2026-02-16
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../database/rds-connection';
import { resolveVendorById } from './vendor-profile';

export function registerVendorWalletEndpoints(app: Hono) {

  /**
   * GET /vendor/:vendorId/wallet
   * Get vendor wallet balance and summary
   */
  app.get("/vendor/:vendorId/wallet", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Verify vendor exists
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Get wallet balance
      const walletResult = await query(
        `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
        [resolvedVendorId]
      );

      let wallet = null;
      let balance = 0;

      if (walletResult.rows.length > 0) {
        wallet = walletResult.rows[0];
        balance = parseFloat(wallet.balance || 0);
      } else {
        // Wallet doesn't exist yet - return zero balance
        balance = 0;
      }

      // Get loyalty points (for reference)
      const pointsResult = await query(
        `SELECT * FROM vendor_loyalty_points WHERE vendor_id = $1`,
        [resolvedVendorId]
      );

      const points = pointsResult.rows.length > 0 ? pointsResult.rows[0] : null;

      return c.json({
        success: true,
        wallet: {
          balance,
          currency: 'INR',
          wallet_id: wallet?.id || null,
        },
        loyalty_points: points ? {
          total_points: points.total_points || 0,
          lifetime_earned: points.lifetime_points_earned || 0,
          lifetime_redeemed: points.lifetime_points_redeemed || 0,
        } : null,
      });
    } catch (error: any) {
      console.error('Error fetching vendor wallet:', error);
      return c.json({ 
        error: error.message || 'Failed to fetch wallet balance' 
      }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/wallet/transactions
   * Get vendor wallet transaction history
   */
  app.get("/vendor/:vendorId/wallet/transactions", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      // Verify vendor exists
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Get wallet ID
      const walletResult = await query(
        `SELECT id FROM vendor_wallets WHERE vendor_id = $1`,
        [resolvedVendorId]
      );

      if (walletResult.rows.length === 0) {
        return c.json({
          success: true,
          transactions: [],
          total: 0,
        });
      }

      const walletId = walletResult.rows[0].id;

      // Get transactions
      const transactionsResult = await query(
        `SELECT * FROM vendor_wallet_transactions 
         WHERE wallet_id = $1 
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [walletId, limit, offset]
      );

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total FROM vendor_wallet_transactions WHERE wallet_id = $1`,
        [walletId]
      );

      const total = parseInt(countResult.rows[0]?.total || '0');

      const transactions = transactionsResult.rows.map(t => ({
        id: t.id,
        transaction_type: t.transaction_type,
        amount: parseFloat(t.amount || 0),
        balance_after: parseFloat(t.balance_after || 0),
        reference_type: t.reference_type,
        reference_id: t.reference_id,
        description: t.description,
        created_at: t.created_at,
      }));

      return c.json({
        success: true,
        transactions,
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error fetching wallet transactions:', error);
      return c.json({ 
        error: error.message || 'Failed to fetch wallet transactions' 
      }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/wallet/loyalty-transactions
   * Get vendor loyalty point transactions (for reference)
   */
  app.get("/vendor/:vendorId/wallet/loyalty-transactions", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      // Verify vendor exists
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Get loyalty transactions
      const transactionsResult = await query(
        `SELECT * FROM vendor_loyalty_transactions 
         WHERE vendor_id = $1 
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [resolvedVendorId, limit, offset]
      );

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total FROM vendor_loyalty_transactions WHERE vendor_id = $1`,
        [resolvedVendorId]
      );

      const total = parseInt(countResult.rows[0]?.total || '0');

      const transactions = transactionsResult.rows.map(t => ({
        id: t.id,
        transaction_type: t.transaction_type,
        points: t.points,
        reference_type: t.reference_type,
        reference_id: t.reference_id,
        description: t.description,
        created_at: t.created_at,
      }));

      return c.json({
        success: true,
        transactions,
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error fetching loyalty transactions:', error);
      return c.json({ 
        error: error.message || 'Failed to fetch loyalty transactions' 
      }, 500);
    }
  });
}
