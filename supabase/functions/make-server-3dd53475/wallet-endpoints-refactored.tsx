/**
 * ============================================================================
 * WALLET ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Wallet management endpoints:
 * - Get wallet balance and transactions
 * - Credit money to wallet (refunds, cashback, etc.)
 * - Debit money from wallet (payments)
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getWalletsRepository } from '../../lib/repositories/wallets.ts';

const app = new Hono();

// ============================================
// WALLET ENDPOINTS
// ============================================

// GET /wallet/:customerId - Get customer wallet balance and transactions
app.get('/:customerId', async (c) => {
  const { customerId } = c.req.param();

  try {
    // ✅ SQL: Get or create wallet using repository
    const walletsRepo = getWalletsRepository();
    const wallet = await walletsRepo.findOrCreate(customerId);

    // ✅ SQL: Get recent transactions
    const transactions = await walletsRepo.getTransactionsByCustomer(customerId, { limit: 50 });

    return sendSuccess(c, {
      wallet: {
        balance: wallet.balance || 0,
        totalEarned: wallet.total_earned || 0,
        totalSpent: wallet.total_spent || 0
      },
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.transaction_type,
        amount: t.amount,
        source: t.source,
        purpose: t.purpose,
        description: t.description,
        referenceId: t.reference_id,
        timestamp: t.created_at,
        balanceAfter: t.balance_after
      }))
    });
  } catch (error) {
    console.error(`❌ Error fetching wallet for customer ${customerId}:`, error);
    return sendError(c, error, 500);
  }
});

// POST /wallet/:customerId/credit - Add money to wallet (refund, cashback, etc.)
app.post('/:customerId/credit', async (c) => {
  const { customerId } = c.req.param();
  const { amount, source, description, referenceId } = await c.req.json();

  if (!amount || amount <= 0) {
    return sendError(c, 'Invalid amount', 400);
  }

  try {
    // ✅ SQL: Get or create wallet
    const walletsRepo = getWalletsRepository();
    const wallet = await walletsRepo.findOrCreate(customerId);

    // ✅ SQL: Add transaction and update balance
    const transaction = await walletsRepo.addTransaction({
      wallet_id: wallet.id,
      customer_id: customerId,
      transaction_type: 'credit',
      amount,
      source: source || 'refund', // refund, cashback, promo, etc.
      description: description || 'Amount credited to wallet',
      reference_id: referenceId || null,
    });

    // ✅ SQL: Get updated wallet
    const updatedWallet = await walletsRepo.findByCustomer(customerId);
    if (!updatedWallet) {
      throw new Error('Wallet not found after transaction');
    }

    console.log(`✅ Credited ₹${amount} to wallet ${customerId} (${source})`);

    return sendSuccess(c, {
      wallet: {
        balance: updatedWallet.balance,
        totalEarned: updatedWallet.total_earned,
        totalSpent: updatedWallet.total_spent
      },
      transaction: {
        id: transaction.id,
        type: transaction.transaction_type,
        amount: transaction.amount,
        source: transaction.source,
        description: transaction.description,
        referenceId: transaction.reference_id,
        timestamp: transaction.created_at,
        balanceAfter: transaction.balance_after
      }
    });
  } catch (error) {
    console.error(`❌ Error crediting wallet for customer ${customerId}:`, error);
    return sendError(c, error, 500);
  }
});

// POST /wallet/:customerId/debit - Deduct money from wallet (payment)
app.post('/:customerId/debit', async (c) => {
  const { customerId } = c.req.param();
  const { amount, purpose, description, referenceId } = await c.req.json();

  if (!amount || amount <= 0) {
    return sendError(c, 'Invalid amount', 400);
  }

  try {
    // ✅ SQL: Get or create wallet
    const walletsRepo = getWalletsRepository();
    const wallet = await walletsRepo.findOrCreate(customerId);

    // Check sufficient balance
    if (wallet.balance < amount) {
      return sendError(c, 'Insufficient wallet balance', 400);
    }

    // ✅ SQL: Add transaction and update balance
    const transaction = await walletsRepo.addTransaction({
      wallet_id: wallet.id,
      customer_id: customerId,
      transaction_type: 'debit',
      amount,
      purpose: purpose || 'payment', // payment, penalty, etc.
      description: description || 'Payment from wallet',
      reference_id: referenceId || null,
    });

    // ✅ SQL: Get updated wallet
    const updatedWallet = await walletsRepo.findByCustomer(customerId);
    if (!updatedWallet) {
      throw new Error('Wallet not found after transaction');
    }

    console.log(`✅ Debited ₹${amount} from wallet ${customerId} (${purpose})`);

    return sendSuccess(c, {
      wallet: {
        balance: updatedWallet.balance,
        totalEarned: updatedWallet.total_earned,
        totalSpent: updatedWallet.total_spent
      },
      transaction: {
        id: transaction.id,
        type: transaction.transaction_type,
        amount: transaction.amount,
        purpose: transaction.purpose,
        description: transaction.description,
        referenceId: transaction.reference_id,
        timestamp: transaction.created_at,
        balanceAfter: transaction.balance_after
      }
    });
  } catch (error) {
    console.error(`❌ Error debiting wallet for customer ${customerId}:`, error);
    return sendError(c, error, 500);
  }
});

console.log('✅ Wallet endpoints registered (SQL-only)');

export default app;

