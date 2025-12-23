/**
 * ============================================================================
 * SQL-BASED WALLET ENDPOINTS
 * ============================================================================
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All operations wrapped in transactions
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient, withTransaction } from "../../lib/db.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";

export function walletEndpointsSQL(app: Hono) {
  const client = getDbClient();

  /**
   * Get wallet balance - SQL-BASED
   * GET /make-server-3dd53475/wallet/:customerId/balance
   */
  app.get("/make-server-3dd53475/wallet/:customerId/balance", async (c) => {
    try {
      const { customerId } = c.req.param();

      const { data: wallet, error } = await client
        .from('customer_wallets')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const balance = wallet?.balance || 0;

      return sendSuccess(c, { 
        customerId,
        balance: Number(balance),
        currency: 'INR'
      });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to get wallet balance', 500);
    }
  });

  /**
   * Add funds to wallet - SQL-BASED
   * POST /make-server-3dd53475/wallet/:customerId/add
   */
  app.post("/make-server-3dd53475/wallet/:customerId/add", async (c) => {
    try {
      const { customerId } = c.req.param();
      const { amount, paymentId, description } = await c.req.json();

      if (!amount || amount <= 0) {
        return sendError(c, 'Invalid amount', 400);
      }

      return await withTransaction(async (txClient) => {
      // Get or create wallet
      let { data: wallet, error: walletError } = await txClient
        .from('customer_wallets')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (!wallet) {
        // Create wallet if doesn't exist
        const { data: newWallet, error: createError } = await txClient
          .from('customer_wallets')
          .insert({
            customer_id: customerId,
            balance: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        wallet = newWallet;
      } else if (walletError) {
        throw walletError;
      }

        // Add funds
        const newBalance = (wallet.balance || 0) + Number(amount);
        
        const { data: updated, error: updateError } = await txClient
          .from('customer_wallets')
          .update({ balance: newBalance })
          .eq('customer_id', customerId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Create transaction record
        await txClient.from('wallet_transactions').insert({
          wallet_id: updated.id,
          transaction_type: 'credit',
          amount: Number(amount),
          balance_after: newBalance,
          reference_type: 'payment',
          reference_id: paymentId,
          description: description || 'Wallet top-up',
        });

        return sendSuccess(c, { 
          customerId,
          balance: newBalance,
          added: amount
        });
      });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to add funds', 500);
    }
  });

  /**
   * Deduct from wallet - SQL-BASED
   * POST /make-server-3dd53475/wallet/:customerId/deduct
   */
  app.post("/make-server-3dd53475/wallet/:customerId/deduct", async (c) => {
    try {
      const { customerId } = c.req.param();
      const { amount, bookingId, orderId, description } = await c.req.json();

      if (!amount || amount <= 0) {
        return sendError(c, 'Invalid amount', 400);
      }

      return await withTransaction(async (txClient) => {
        // Get wallet
        const { data: wallet, error: walletError } = await txClient
          .from('customer_wallets')
          .select('*')
          .eq('customer_id', customerId)
          .single();

        if (walletError || !wallet) {
          return sendError(c, 'Wallet not found', 404);
        }

        const currentBalance = wallet.balance || 0;
        
        if (currentBalance < amount) {
          return sendError(c, 'Insufficient wallet balance', 400);
        }

        // Deduct funds
        const newBalance = currentBalance - Number(amount);
        
        const { data: updated, error: updateError } = await txClient
          .from('customer_wallets')
          .update({ balance: newBalance })
          .eq('customer_id', customerId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Create transaction record
        await txClient.from('wallet_transactions').insert({
          wallet_id: updated.id,
          transaction_type: 'debit',
          amount: Number(amount),
          balance_after: newBalance,
          reference_type: bookingId ? 'booking' : 'order',
          reference_id: bookingId || orderId,
          description: description || 'Wallet payment',
        });

        return sendSuccess(c, { 
          customerId,
          balance: newBalance,
          deducted: amount
        });
      });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to deduct funds', 500);
    }
  });

  /**
   * Get wallet transactions - SQL-BASED
   * GET /make-server-3dd53475/wallet/:customerId/transactions
   */
  app.get("/make-server-3dd53475/wallet/:customerId/transactions", async (c) => {
    try {
      const { customerId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      // Get wallet first
      const { data: wallet } = await client
        .from('customer_wallets')
        .select('id')
        .eq('customer_id', customerId)
        .single();

      if (!wallet) {
        return sendSuccess(c, { transactions: [], count: 0 });
      }

      const { data: transactions, error } = await client
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return sendSuccess(c, { 
        transactions: transactions || [],
        count: transactions?.length || 0
      });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to get transactions', 500);
    }
  });
}

