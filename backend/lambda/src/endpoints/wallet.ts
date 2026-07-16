/**
 * ============================================================================
 * WALLET ENDPOINTS - LAMBDA VERSION WITH ROW-LEVEL LOCKING
 * ============================================================================
 * 
 * Provides atomic wallet operations with concurrency safety
 * 
 * Endpoints:
 * - GET /wallet/:customerId - Get wallet balance (by UUID)
 * - GET /customer/wallet?phone=... - Get wallet balance (by phone)
 * - POST /wallet/:customerId/credit - Credit wallet (add funds)
 * - POST /wallet/:customerId/debit - Debit wallet (spend funds)
 * - POST /customer/wallet/add-funds - Add funds (by phone)
 * - POST /customer/wallet/use - Use wallet balance (by phone)
 * - GET /wallet/:customerId/transactions - Get transaction history
 * 
 * Date: 2026-01-03
 * Updated: 2026-01-27 - Added phone-based lookup endpoints
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, withTransaction, getClient } from '../database/rds-connection';
import { logAuditEntry } from '../utils/audit-log';
import { checkIdempotencyKey, storeIdempotencyKey } from '../utils/idempotency';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// HELPER: Look up customer by phone
// ============================================================================

async function getCustomerIdByPhone(phone: string): Promise<string | null> {
  try {
    // Normalize phone (remove spaces, ensure +91 prefix for Indian numbers)
    let normalizedPhone = phone.replace(/\s+/g, '').replace(/^0+/, '');
    if (!normalizedPhone.startsWith('+')) {
      // Assume Indian number if no country code
      if (normalizedPhone.length === 10) {
        normalizedPhone = '+91' + normalizedPhone;
      }
    }
    
    // Try to find customer by phone
    const result = await query(
      `SELECT id FROM customers WHERE phone = $1 OR phone = $2 LIMIT 1`,
      [phone, normalizedPhone]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    
    return null;
  } catch (error: any) {
    console.error('[WALLET] Error looking up customer by phone:', error.message);
    return null;
  }
}

/** Lifetime wallet credits / debits from ledger (for My Wallet summary UI). */
async function getWalletLedgerTotals(
  customerId: string
): Promise<{ totalEarned: number; totalSpent: number }> {
  try {
    // Rows may use customer_id and/or wallet_id (legacy). Include both so totals match the ledger.
    // Types vary by writer — include refund/topup as inflow; payment/purchase as spend.
    const result = await query(
      `SELECT
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(COALESCE(wt.transaction_type::text, ''))) IN (
                'credit','c','refund','r','topup','top_up','cashback','credit_adjustment'
              )
              THEN ABS(wt.amount::numeric)
              ELSE 0::numeric
            END
          ),
          0
        )::text AS total_earned,
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(COALESCE(wt.transaction_type::text, ''))) IN (
                'debit','d','payout','payment','purchase','withdraw','debit_adjustment'
              )
              THEN ABS(wt.amount::numeric)
              ELSE 0::numeric
            END
          ),
          0
        )::text AS total_spent
       FROM wallet_transactions wt
       WHERE wt.customer_id = $1::uuid
          OR wt.wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = $1::uuid)`,
      [customerId]
    );
    if (!result.rows.length) {
      return { totalEarned: 0, totalSpent: 0 };
    }
    const r = result.rows[0] as { total_earned?: string; total_spent?: string };
    return {
      totalEarned: parseFloat(String(r.total_earned ?? '0')) || 0,
      totalSpent: parseFloat(String(r.total_spent ?? '0')) || 0,
    };
  } catch (e: any) {
    console.warn('[WALLET] Ledger totals query failed:', e?.message);
    return { totalEarned: 0, totalSpent: 0 };
  }
}

// ============================================================================
// WALLET HANDLERS
// ============================================================================

class GetWalletHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    // Get or create wallet
    const wallet = await this.getOrCreateWallet(customerId);

    // Get recent transactions
    const transactions = await this.getRecentTransactions(customerId);
    const { totalEarned, totalSpent } = await getWalletLedgerTotals(customerId);

    // Optional denormalized columns (when migration 008+ applied) — keep DB in sync with ledger truth.
    try {
      const colq = (await query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'customer_wallets'`
      )) as { rows: Array<{ column_name: string }> };
      const cw = new Set(colq.rows.map((r) => r.column_name));
      if (cw.has('total_earned') && cw.has('total_spent')) {
        const hasUpd = cw.has('updated_at');
        await query(
          hasUpd
            ? `UPDATE customer_wallets
               SET total_earned = $1::numeric, total_spent = $2::numeric, updated_at = NOW()
               WHERE customer_id = $3::uuid`
            : `UPDATE customer_wallets
               SET total_earned = $1::numeric, total_spent = $2::numeric
               WHERE customer_id = $3::uuid`,
          [totalEarned, totalSpent, customerId]
        );
      }
    } catch (syncErr: any) {
      console.warn('[WALLET] total_earned/total_spent sync skipped:', syncErr?.message);
    }

    // Calculate loyalty points converted to wallet
    const loyaltyCredits = transactions.filter(t => t.isLoyaltyConversion || t.source === 'loyalty_points');
    const totalLoyaltyCredits = loyaltyCredits.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Single flat JSON body (BaseHandler.success) — avoids double-nested `data.data` on the client.
    return this.success({
      customerId: wallet.customer_id,
      balance: parseFloat(wallet.balance),
      currency: wallet.currency || 'INR',
      lastUpdated: wallet.updated_at,
      recentTransactions: transactions,
      loyaltyPointsConverted: totalLoyaltyCredits,
      loyaltyTransactionsCount: loyaltyCredits.length,
      totalEarned,
      totalSpent,
      total_earned: totalEarned,
      total_spent: totalSpent,
    });
  }

  private async getOrCreateWallet(customerId: string): Promise<any> {
    try {
      let wallets = await select('customer_wallets', { customer_id: customerId });
      
      if (wallets.length === 0) {
        // Create new wallet
        const result = await query(
          `INSERT INTO customer_wallets (customer_id, balance, currency)
           VALUES ($1, 0, 'INR')
           ON CONFLICT (customer_id) DO NOTHING
           RETURNING *`,
          [customerId]
        );
        
        if (result.rows.length > 0) {
          return result.rows[0];
        }
        
        // If insert failed due to race condition, try select again
        wallets = await select('customer_wallets', { customer_id: customerId });
      }

      if (wallets.length === 0) {
        // If still no wallet, return a default wallet object
        return {
          customer_id: customerId,
          balance: 0,
          currency: 'INR',
          updated_at: new Date().toISOString(),
        };
      }

      return wallets[0];
    } catch (error: any) {
      // Handle case where table doesn't exist
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        console.warn('[WALLET] customer_wallets table does not exist, returning default wallet');
        return {
          customer_id: customerId,
          balance: 0,
          currency: 'INR',
          updated_at: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  private async getRecentTransactions(customerId: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT id, transaction_type, amount, balance_after, description, created_at, source, reference_type, reference_id
         FROM wallet_transactions wt
         WHERE wt.customer_id = $1
            OR wt.wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = $1)
         ORDER BY wt.created_at DESC
         LIMIT 10`,
        [customerId]
      );
      return result.rows.map(row => ({
        id: row.id,
        type: row.transaction_type,
        amount: parseFloat(row.amount),
        balanceAfter: parseFloat(row.balance_after),
        description: row.description,
        timestamp: row.created_at,
        source: row.source || null,
        referenceType: row.reference_type || null,
        referenceId: row.reference_id || null,
        isLoyaltyConversion: row.source === 'loyalty_points' || row.description?.toLowerCase().includes('loyalty') || row.description?.toLowerCase().includes('points'),
      }));
    } catch (error: any) {
      // Table might not exist
      return [];
    }
  }
}

// ============================================================================
// GET WALLET BY PHONE HANDLER
// ============================================================================

class GetWalletByPhoneHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;

    if (!phone) {
      return this.error('Phone number is required', 400);
    }

    // Look up customer by phone
    const customerId = await getCustomerIdByPhone(phone);
    
    if (!customerId) {
      // Return default wallet info for non-existent customer
      return this.success({
        wallet: {
          customerId: null,
          balance: 0,
          currency: 'INR',
          lastUpdated: new Date().toISOString(),
        },
        message: 'Customer not found, returning default wallet',
      });
    }

    // Get or create wallet
    const wallet = await this.getOrCreateWallet(customerId);

    // Get recent transactions
    const transactions = await this.getRecentTransactions(customerId);
    const { totalEarned, totalSpent } = await getWalletLedgerTotals(customerId);

    // Calculate loyalty points converted to wallet
    const loyaltyCredits = transactions.filter(t => t.isLoyaltyConversion || t.source === 'loyalty_points');
    const totalLoyaltyCredits = loyaltyCredits.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return this.success({
      wallet: {
        customerId: wallet.customer_id,
        balance: parseFloat(wallet.balance),
        currency: wallet.currency || 'INR',
        lastUpdated: wallet.updated_at,
        recentTransactions: transactions,
        loyaltyPointsConverted: totalLoyaltyCredits,
        loyaltyTransactionsCount: loyaltyCredits.length,
        totalEarned,
        totalSpent,
        total_earned: totalEarned,
        total_spent: totalSpent,
      },
    });
  }

  private async getOrCreateWallet(customerId: string): Promise<any> {
    try {
      let wallets = await select('customer_wallets', { customer_id: customerId });
      
      if (wallets.length === 0) {
        // Create new wallet
        const result = await query(
          `INSERT INTO customer_wallets (customer_id, balance, currency)
           VALUES ($1, 0, 'INR')
           ON CONFLICT (customer_id) DO NOTHING
           RETURNING *`,
          [customerId]
        );
        
        if (result.rows.length > 0) {
          return result.rows[0];
        }
        
        wallets = await select('customer_wallets', { customer_id: customerId });
      }

      if (wallets.length === 0) {
        return {
          customer_id: customerId,
          balance: 0,
          currency: 'INR',
          updated_at: new Date().toISOString(),
        };
      }

      return wallets[0];
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        console.warn('[WALLET] customer_wallets table does not exist, returning default wallet');
        return {
          customer_id: customerId,
          balance: 0,
          currency: 'INR',
          updated_at: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  private async getRecentTransactions(customerId: string): Promise<any[]> {
    try {
      // Try to get source column if it exists
      const result = await query(
        `SELECT id, transaction_type, amount, balance_after, description, created_at, 
                COALESCE(source, '') as source, 
                COALESCE(reference_type, '') as reference_type, 
                COALESCE(reference_id::text, '') as reference_id
         FROM wallet_transactions wt
         WHERE wt.customer_id = $1
            OR wt.wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = $1)
         ORDER BY wt.created_at DESC
         LIMIT 10`,
        [customerId]
      );
      return result.rows.map(row => {
        const isLoyalty = row.source === 'loyalty_points' || 
                         row.description?.toLowerCase().includes('loyalty') || 
                         row.description?.toLowerCase().includes('points');
        return {
          id: row.id,
          type: row.transaction_type,
          amount: parseFloat(row.amount),
          balanceAfter: parseFloat(row.balance_after),
          description: row.description,
          timestamp: row.created_at,
          source: row.source || null,
          referenceType: row.reference_type || null,
          referenceId: row.reference_id || null,
          isLoyaltyConversion: isLoyalty,
        };
      });
    } catch (error: any) {
      // Table might not exist or column might not exist - try without source
      try {
        const result = await query(
          `SELECT id, transaction_type, amount, balance_after, description, created_at
           FROM wallet_transactions wt
           WHERE wt.customer_id = $1
              OR wt.wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = $1)
           ORDER BY wt.created_at DESC
           LIMIT 10`,
          [customerId]
        );
        return result.rows.map(row => {
          const isLoyalty = row.description?.toLowerCase().includes('loyalty') || 
                           row.description?.toLowerCase().includes('points');
          return {
            id: row.id,
            type: row.transaction_type,
            amount: parseFloat(row.amount),
            balanceAfter: parseFloat(row.balance_after),
            description: row.description,
            timestamp: row.created_at,
            source: null,
            referenceType: null,
            referenceId: null,
            isLoyaltyConversion: isLoyalty,
          };
        });
      } catch (fallbackError: any) {
        // Table might not exist
        return [];
      }
    }
  }
}

// ============================================================================
// ADD FUNDS BY PHONE HANDLER
// ============================================================================

class AddFundsByPhoneHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone, amount, referenceType, referenceId, description, idempotencyKey } = body;
    const requestId = context.event.requestContext?.requestId;

    if (!phone) {
      return this.error('Phone number is required', 400);
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return this.error('Amount must be a positive number', 400);
    }

    // Look up customer by phone
    const customerId = await getCustomerIdByPhone(phone);
    
    if (!customerId) {
      return this.error('Customer not found for the provided phone number', 404);
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = await checkIdempotencyKey(idempotencyKey);
      if (existing.exists) {
        return this.success({
          ...existing.response,
          cached: true,
          message: 'Transaction already processed',
        });
      }
    }

    // Use transaction with row-level locking
    const result = await withTransaction(async (client) => {
      // Lock wallet row FOR UPDATE
      const walletResult = await client.query(
        `SELECT id, customer_id, balance, currency
         FROM customer_wallets
         WHERE customer_id = $1
         FOR UPDATE`,
        [customerId]
      );

      let wallet;
      if (walletResult.rows.length === 0) {
        // Create wallet if doesn't exist
        const createResult = await client.query(
          `INSERT INTO customer_wallets (customer_id, balance, currency)
           VALUES ($1, $2, 'INR')
           RETURNING *`,
          [customerId, amount]
        );
        wallet = createResult.rows[0];
      } else {
        wallet = walletResult.rows[0];
        
        // Update balance atomically
        const updateResult = await client.query(
          `UPDATE customer_wallets
           SET balance = balance + $1, updated_at = NOW()
           WHERE customer_id = $2
           RETURNING *`,
          [amount, customerId]
        );
        wallet = updateResult.rows[0];
      }

      // Record transaction
      const txnResult = await client.query(
        `INSERT INTO wallet_transactions (
          customer_id, transaction_type, amount, balance_after,
          reference_type, reference_id, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          customerId,
          'credit',
          amount,
          wallet.balance,
          referenceType || 'add_funds',
          referenceId || null,
          description || 'Wallet top-up',
        ]
      );

      return {
        wallet,
        transaction: txnResult.rows[0],
      };
    });

    // Log audit entry
    await logAuditEntry({
      entityType: 'wallet',
      entityId: result.wallet.id,
      action: 'add_funds',
      newValues: {
        amount,
        balanceAfter: result.wallet.balance,
        phone,
      },
      actorId: customerId,
      actorType: 'customer',
      requestId,
    });

    const response = {
      success: true,
      transactionId: result.transaction.id,
      customerId,
      amount: Number(amount),
      newBalance: Number(result.wallet.balance),
      transactionType: 'credit',
      timestamp: result.transaction.created_at,
      message: 'Funds added successfully',
    };

    // Store idempotency key
    if (idempotencyKey) {
      await storeIdempotencyKey(
        idempotencyKey,
        'wallet_transaction',
        result.transaction.id,
        response,
        200
      );
    }

    return this.success(response);
  }
}

// ============================================================================
// USE WALLET BY PHONE HANDLER
// ============================================================================

class UseWalletByPhoneHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone, amount, referenceType, referenceId, description, idempotencyKey } = body;
    const requestId = context.event.requestContext?.requestId;

    if (!phone) {
      return this.error('Phone number is required', 400);
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return this.error('Amount must be a positive number', 400);
    }

    // Look up customer by phone
    const customerId = await getCustomerIdByPhone(phone);
    
    if (!customerId) {
      return this.error('Customer not found for the provided phone number', 404);
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = await checkIdempotencyKey(idempotencyKey);
      if (existing.exists) {
        return this.success({
          ...existing.response,
          cached: true,
          message: 'Transaction already processed',
        });
      }
    }

    try {
      // Use transaction with row-level locking
      const result = await withTransaction(async (client) => {
        // Lock wallet row FOR UPDATE
        const walletResult = await client.query(
          `SELECT id, customer_id, balance, currency
           FROM customer_wallets
           WHERE customer_id = $1
           FOR UPDATE`,
          [customerId]
        );

        if (walletResult.rows.length === 0) {
          throw new Error('Wallet not found');
        }

        const wallet = walletResult.rows[0];

        // Check sufficient balance
        if (parseFloat(wallet.balance) < amount) {
          throw new Error('Insufficient balance');
        }

        // Update balance atomically
        const updateResult = await client.query(
          `UPDATE customer_wallets
           SET balance = balance - $1, updated_at = NOW()
           WHERE customer_id = $2 AND balance >= $1
           RETURNING *`,
          [amount, customerId]
        );

        if (updateResult.rows.length === 0) {
          throw new Error('Insufficient balance (race condition)');
        }

        const updatedWallet = updateResult.rows[0];

        // Record transaction
        const txnResult = await client.query(
          `INSERT INTO wallet_transactions (
            customer_id, transaction_type, amount, balance_after,
            reference_type, reference_id, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [
            customerId,
            'debit',
            amount,
            updatedWallet.balance,
            referenceType || 'payment',
            referenceId || null,
            description || 'Wallet payment',
          ]
        );

        return {
          wallet: updatedWallet,
          transaction: txnResult.rows[0],
        };
      });

      // Log audit entry
      await logAuditEntry({
        entityType: 'wallet',
        entityId: result.wallet.id,
        action: 'use_wallet',
        newValues: {
          amount,
          balanceAfter: result.wallet.balance,
          phone,
          referenceType,
          referenceId,
        },
        actorId: customerId,
        actorType: 'customer',
        requestId,
      });

      const response = {
        success: true,
        transactionId: result.transaction.id,
        customerId,
        amount: Number(amount),
        newBalance: Number(result.wallet.balance),
        transactionType: 'debit',
        timestamp: result.transaction.created_at,
        message: 'Wallet balance used successfully',
      };

      // Store idempotency key
      if (idempotencyKey) {
        await storeIdempotencyKey(
          idempotencyKey,
          'wallet_transaction',
          result.transaction.id,
          response,
          200
        );
      }

      return this.success(response);
    } catch (error: any) {
      if (error.message.includes('Insufficient balance')) {
        return this.error('Insufficient wallet balance', 400);
      }
      if (error.message.includes('Wallet not found')) {
        return this.error('Wallet not found. Please add funds first.', 404);
      }
      throw error;
    }
  }
}

// ============================================================================
// CREDIT WALLET HANDLER (by customerId)
// ============================================================================

class CreditWalletHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);
    const { amount, referenceType, referenceId, description, idempotencyKey } = body;
    const requestId = context.event.requestContext?.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    this.validateRequired(body, ['amount']);

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return this.error('Amount must be a positive number', 400);
    }

    // ✅ TEMPORAL FIX: Check idempotency
    if (idempotencyKey) {
      const existing = await checkIdempotencyKey(idempotencyKey);
      if (existing.exists) {
        return this.success({
          ...existing.response,
          cached: true,
          message: 'Transaction already processed',
        });
      }
    }

    // ✅ TEMPORAL FIX: Use transaction with row-level locking
    const result = await withTransaction(async (client) => {
      // Lock wallet row FOR UPDATE (prevents concurrent modifications)
      const walletResult = await client.query(
        `SELECT id, customer_id, balance, currency
         FROM customer_wallets
         WHERE customer_id = $1
         FOR UPDATE`,
        [customerId]
      );

      let wallet;
      if (walletResult.rows.length === 0) {
        // Create wallet if doesn't exist
        const createResult = await client.query(
          `INSERT INTO customer_wallets (customer_id, balance, currency)
           VALUES ($1, $2, 'INR')
           RETURNING *`,
          [customerId, amount]
        );
        wallet = createResult.rows[0];
      } else {
        wallet = walletResult.rows[0];
        
        // Update balance atomically
        const updateResult = await client.query(
          `UPDATE customer_wallets
           SET balance = balance + $1, updated_at = NOW()
           WHERE customer_id = $2
           RETURNING *`,
          [amount, customerId]
        );
        wallet = updateResult.rows[0];
      }

      // Record transaction
      const txnResult = await client.query(
        `INSERT INTO wallet_transactions (
          customer_id, transaction_type, amount, balance_after,
          reference_type, reference_id, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          customerId,
          'credit',
          amount,
          wallet.balance,
          referenceType || null,
          referenceId || null,
          description || null,
        ]
      );

      return {
        wallet,
        transaction: txnResult.rows[0],
      };
    });

    // ✅ TEMPORAL FIX: Log audit entry
    await logAuditEntry({
      entityType: 'wallet',
      entityId: result.wallet.id,
      action: 'credit',
      newValues: {
        amount,
        balanceAfter: result.wallet.balance,
        referenceType,
        referenceId,
      },
      actorId: customerId,
      actorType: 'customer',
      requestId,
    });

    const response = {
      transactionId: result.transaction.id,
      customerId,
      amount: Number(amount),
      newBalance: Number(result.wallet.balance),
      transactionType: 'credit',
      timestamp: result.transaction.created_at,
      message: 'Wallet credited successfully',
    };

    // ✅ TEMPORAL FIX: Store idempotency key
    if (idempotencyKey) {
      await storeIdempotencyKey(
        idempotencyKey,
        'wallet_transaction',
        result.transaction.id,
        response,
        200
      );
    }

    return this.success(response);
  }
}

class DebitWalletHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);
    const { amount, referenceType, referenceId, description, idempotencyKey } = body;
    const requestId = context.event.requestContext?.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    this.validateRequired(body, ['amount']);

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return this.error('Amount must be a positive number', 400);
    }

    // ✅ TEMPORAL FIX: Check idempotency
    if (idempotencyKey) {
      const existing = await checkIdempotencyKey(idempotencyKey);
      if (existing.exists) {
        return this.success({
          ...existing.response,
          cached: true,
          message: 'Transaction already processed',
        });
      }
    }

    // ✅ TEMPORAL FIX: Use transaction with row-level locking
    try {
      const result = await withTransaction(async (client) => {
        // Lock wallet row FOR UPDATE
        const walletResult = await client.query(
          `SELECT id, customer_id, balance, currency
           FROM customer_wallets
           WHERE customer_id = $1
           FOR UPDATE`,
          [customerId]
        );

        if (walletResult.rows.length === 0) {
          throw new Error('Wallet not found');
        }

        const wallet = walletResult.rows[0];

        // Check sufficient balance
        if (parseFloat(wallet.balance) < amount) {
          throw new Error('Insufficient balance');
        }

        // Update balance atomically
        const updateResult = await client.query(
          `UPDATE customer_wallets
           SET balance = balance - $1, updated_at = NOW()
           WHERE customer_id = $2 AND balance >= $1
           RETURNING *`,
          [amount, customerId]
        );

        if (updateResult.rows.length === 0) {
          throw new Error('Insufficient balance (race condition)');
        }

        const updatedWallet = updateResult.rows[0];

        // Record transaction
        const txnResult = await client.query(
          `INSERT INTO wallet_transactions (
            customer_id, transaction_type, amount, balance_after,
            reference_type, reference_id, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [
            customerId,
            'debit',
            amount,
            updatedWallet.balance,
            referenceType || null,
            referenceId || null,
            description || null,
          ]
        );

        return {
          wallet: updatedWallet,
          transaction: txnResult.rows[0],
        };
      });

      // ✅ TEMPORAL FIX: Log audit entry
      await logAuditEntry({
        entityType: 'wallet',
        entityId: result.wallet.id,
        action: 'debit',
        newValues: {
          amount,
          balanceAfter: result.wallet.balance,
          referenceType,
          referenceId,
        },
        actorId: customerId,
        actorType: 'customer',
        requestId,
      });

      const response = {
        transactionId: result.transaction.id,
        customerId,
        amount: Number(amount),
        newBalance: Number(result.wallet.balance),
        transactionType: 'debit',
        timestamp: result.transaction.created_at,
        message: 'Wallet debited successfully',
      };

      // ✅ TEMPORAL FIX: Store idempotency key
      if (idempotencyKey) {
        await storeIdempotencyKey(
          idempotencyKey,
          'wallet_transaction',
          result.transaction.id,
          response,
          200
        );
      }

      return this.success(response);
    } catch (error: any) {
      if (error.message.includes('Insufficient balance')) {
        return this.error('Insufficient wallet balance', 400);
      }
      if (error.message.includes('Wallet not found')) {
        return this.error('Wallet not found', 404);
      }
      throw error;
    }
  }
}

// ============================================================================
// GET TRANSACTIONS BY PHONE HANDLER
// ============================================================================

class GetTransactionsByPhoneHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    const limit = parseInt(context.event.queryStringParameters?.limit || '50');
    const offset = parseInt(context.event.queryStringParameters?.offset || '0');

    if (!phone) {
      return this.error('Phone number is required', 400);
    }

    // Look up customer by phone
    const customerId = await getCustomerIdByPhone(phone);
    
    if (!customerId) {
      return this.success({
        transactions: [],
        count: 0,
        limit,
        offset,
        message: 'Customer not found',
      });
    }

    try {
      const result = await query(
        `SELECT * FROM wallet_transactions wt
         WHERE wt.customer_id = $1
            OR wt.wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = $1)
         ORDER BY wt.created_at DESC
         LIMIT $2 OFFSET $3`,
        [customerId, Math.min(limit, 100), offset]
      );

      const transactions = result.rows.map((row) => ({
        id: row.id,
        type: row.transaction_type,
        amount: parseFloat(row.amount),
        balanceAfter: parseFloat(row.balance_after),
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        description: row.description,
        timestamp: row.created_at,
      }));

      return this.success({
        transactions,
        count: transactions.length,
        limit,
        offset,
      });
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        return this.success({
          transactions: [],
          count: 0,
          limit,
          offset,
          message: 'Wallet transactions table not found',
        });
      }
      throw error;
    }
  }
}

// ============================================================================
// GET TRANSACTIONS BY UUID HANDLER
// ============================================================================

class GetWalletTransactionsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const limit = parseInt(context.event.queryStringParameters?.limit || '50');
    const offset = parseInt(context.event.queryStringParameters?.offset || '0');

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    try {
      // Check if table uses customer_id or wallet_id
      const tableCheck = await query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'wallet_transactions' 
         AND column_name IN ('customer_id', 'wallet_id')`
      );
      
      const hasCustomerId = tableCheck.rows.some(r => r.column_name === 'customer_id');
      const hasWalletId = tableCheck.rows.some(r => r.column_name === 'wallet_id');
      
      let result;
      if (hasCustomerId && hasWalletId) {
        result = await query(
          `SELECT * FROM wallet_transactions wt
           WHERE wt.customer_id = $1::uuid
              OR wt.wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = $1::uuid)
           ORDER BY wt.created_at DESC
           LIMIT $2 OFFSET $3`,
          [customerId, Math.min(limit, 100), offset]
        );
      } else if (hasCustomerId) {
        result = await query(
          `SELECT * FROM wallet_transactions
           WHERE customer_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [customerId, Math.min(limit, 100), offset]
        );
      } else if (hasWalletId) {
        // Get wallet ID first
        const wallet = await query(
          `SELECT id FROM customer_wallets WHERE customer_id = $1 LIMIT 1`,
          [customerId]
        );
        
        if (wallet.rows.length === 0) {
          return this.success({
            transactions: [],
            count: 0,
            limit,
            offset,
          });
        }
        
        const walletId = wallet.rows[0].id;
        result = await query(
          `SELECT * FROM wallet_transactions
           WHERE wallet_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [walletId, Math.min(limit, 100), offset]
        );
      } else {
        // Table doesn't exist or has different schema
        return this.success({
          transactions: [],
          count: 0,
          limit,
          offset,
          message: 'Wallet transactions table schema not recognized',
        });
      }

      const transactions = result.rows.map((row) => ({
        id: row.id,
        type: row.transaction_type,
        amount: parseFloat(row.amount),
        balanceAfter: parseFloat(row.balance_after),
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        description: row.description,
        timestamp: row.created_at,
      }));

      return this.success({
        transactions,
        count: transactions.length,
        limit,
        offset,
      });
    } catch (error: any) {
      // Handle case where table doesn't exist
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        console.warn('[WALLET] wallet_transactions table does not exist, returning empty transactions');
        return this.success({
          transactions: [],
          count: 0,
          limit,
          offset,
          message: 'Wallet transactions table not found. Please run migration 012_wallet_tables.sql',
        });
      }
      throw error;
    }
  }
}

// ============================================================================
// VENDOR WALLET HANDLERS
// ============================================================================

class GetVendorWalletHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;

    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }

    const wallet = await this.getOrCreateVendorWallet(vendorId);
    const transactions = await this.getRecentVendorTransactions(vendorId);

    const loyaltyCredits = transactions.filter((t) =>
      t.description?.toLowerCase().includes('loyalty') || t.description?.toLowerCase().includes('points')
    );
    const totalLoyaltyCredits = loyaltyCredits.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return this.success({
      success: true,
      data: {
        vendorId: wallet.vendor_id,
        balance: parseFloat(wallet.balance || '0'),
        currency: 'INR',
        lastUpdated: wallet.updated_at,
        recentTransactions: transactions,
        loyaltyPointsConverted: totalLoyaltyCredits,
        loyaltyTransactionsCount: loyaltyCredits.length,
      },
    });
  }

  private async getOrCreateVendorWallet(vendorId: string): Promise<any> {
    try {
      let wallets = await select('vendor_wallets', { vendor_id: vendorId });
      if (wallets.length === 0) {
        const result = await query(
          `INSERT INTO vendor_wallets (vendor_id, balance)
           VALUES ($1, 0)
           ON CONFLICT (vendor_id) DO NOTHING
           RETURNING *`,
          [vendorId]
        );
        if (result.rows.length > 0) return result.rows[0];
        wallets = await select('vendor_wallets', { vendor_id: vendorId });
      }

      if (wallets.length === 0) {
        return {
          vendor_id: vendorId,
          balance: 0,
          updated_at: new Date().toISOString(),
        };
      }

      return wallets[0];
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        return {
          vendor_id: vendorId,
          balance: 0,
          updated_at: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  private async getRecentVendorTransactions(vendorId: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT id, transaction_type, amount, balance_after, description, created_at, reference_type, reference_id
         FROM vendor_wallet_transactions
         WHERE vendor_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [vendorId]
      );
      return result.rows.map((row) => ({
        id: row.id,
        type: row.transaction_type,
        amount: parseFloat(row.amount),
        balanceAfter: parseFloat(row.balance_after),
        description: row.description,
        timestamp: row.created_at,
        referenceType: row.reference_type || null,
        referenceId: row.reference_id || null,
      }));
    } catch (_error: any) {
      return [];
    }
  }
}

class GetVendorWalletTransactionsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    const limit = parseInt(context.event.queryStringParameters?.limit || '50');
    const offset = parseInt(context.event.queryStringParameters?.offset || '0');

    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }

    try {
      const result = await query(
        `SELECT id, transaction_type, amount, balance_after, reference_type, reference_id, description, created_at
         FROM vendor_wallet_transactions
         WHERE vendor_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [vendorId, Math.min(limit, 100), offset]
      );

      const transactions = result.rows.map((row) => ({
        id: row.id,
        type: row.transaction_type,
        amount: parseFloat(row.amount),
        balanceAfter: parseFloat(row.balance_after),
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        description: row.description,
        timestamp: row.created_at,
      }));

      return this.success({
        transactions,
        count: transactions.length,
        limit,
        offset,
      });
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        return this.success({
          transactions: [],
          count: 0,
          limit,
          offset,
          message: 'Vendor wallet transactions table not found',
        });
      }
      throw error;
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerWalletEndpoints(app: Hono) {
  const getWalletHandler = new GetWalletHandler();
  const getWalletByPhoneHandler = new GetWalletByPhoneHandler();
  const creditWalletHandler = new CreditWalletHandler();
  const debitWalletHandler = new DebitWalletHandler();
  const addFundsByPhoneHandler = new AddFundsByPhoneHandler();
  const useWalletByPhoneHandler = new UseWalletByPhoneHandler();
  const getTransactionsHandler = new GetWalletTransactionsHandler();
  const getTransactionsByPhoneHandler = new GetTransactionsByPhoneHandler();
  const getVendorWalletHandler = new GetVendorWalletHandler();
  const getVendorTransactionsHandler = new GetVendorWalletTransactionsHandler();

  // =========================================================================
  // PHONE-BASED ENDPOINTS (for frontend compatibility)
  // =========================================================================

  // GET /customer/wallet?phone=... - Get wallet by phone number
  app.get('/customer/wallet', async (c) => {
    const event = createApiGatewayEvent(c);
    const context = createLambdaContext();
    const result = await getWalletByPhoneHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // GET /customer/wallet/transactions?phone=... - Get transactions by phone number
  app.get('/customer/wallet/transactions', async (c) => {
    const event = createApiGatewayEvent(c);
    const context = createLambdaContext();
    const result = await getTransactionsByPhoneHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // POST /customer/wallet/add-funds - Add funds by phone number
  app.post('/customer/wallet/add-funds', async (c) => {
    const event = createApiGatewayEvent(c);
    const context = createLambdaContext();
    const result = await addFundsByPhoneHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // POST /customer/wallet/use - Use wallet balance by phone number
  app.post('/customer/wallet/use', async (c) => {
    const event = createApiGatewayEvent(c);
    const context = createLambdaContext();
    const result = await useWalletByPhoneHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // =========================================================================
  // UUID-BASED ENDPOINTS (backwards compatible)
  // =========================================================================

  // GET /wallet/:customerId - Get wallet by customer UUID
  app.get('/wallet/:customerId', async (c) => {
    const event = createApiGatewayEvent(c);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await getWalletHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // POST /wallet/:customerId/credit - Credit wallet by customer UUID
  app.post('/wallet/:customerId/credit', async (c) => {
    const event = createApiGatewayEvent(c);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await creditWalletHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // POST /wallet/:customerId/debit - Debit wallet by customer UUID
  app.post('/wallet/:customerId/debit', async (c) => {
    const event = createApiGatewayEvent(c);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await debitWalletHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // GET /wallet/:customerId/transactions - Get transactions by customer UUID
  app.get('/wallet/:customerId/transactions', async (c) => {
    const event = createApiGatewayEvent(c);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await getTransactionsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // =========================================================================
  // VENDOR WALLET ENDPOINTS
  // =========================================================================

  // GET /vendor/wallet/:vendorId - Get vendor wallet by vendor UUID
  app.get('/vendor/wallet/:vendorId', async (c) => {
    const event = createApiGatewayEvent(c);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await getVendorWalletHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // GET /vendor/wallet/:vendorId/transactions - Get vendor wallet transactions
  app.get('/vendor/wallet/:vendorId/transactions', async (c) => {
    const event = createApiGatewayEvent(c);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await getVendorTransactionsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

/**
 * Build a Lambda-shaped event from Hono context.
 * POST/PUT bodies must come from c.env.parsedBody (set by handler/index.ts); Hono Request has no req.body object.
 */
function createApiGatewayEvent(c: any): any {
  const req = c.req;
  const contextData = c.env as { parsedBody?: Record<string, unknown> | null } | undefined;
  const parsedBody = contextData?.parsedBody;
  const bodyString =
    parsedBody != null && typeof parsedBody === 'object'
      ? JSON.stringify(parsedBody)
      : null;

  let headers: Record<string, string> = {};
  try {
    const h = req.raw?.headers ?? req.headers;
    if (h && typeof (h as Headers).forEach === 'function') {
      (h as Headers).forEach((value: string, key: string) => {
        headers[key] = value;
      });
    }
  } catch {
    headers = {};
  }

  return {
    httpMethod: req.method,
    path: req.url,
    headers,
    body: bodyString,
    pathParameters: {},
    queryStringParameters: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'wallet-handler',
    functionVersion: '$LATEST',
  };
}
