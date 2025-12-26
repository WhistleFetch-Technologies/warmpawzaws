/**
 * ============================================================================
 * CUSTOMER WALLET TOP-UP SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Add money to wallet via payment gateway
 * - Transaction tracking
 * - Wallet balance management
 * - Bonus/cashback on top-ups
 * - Transaction history
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - Wallet operations use `customer_wallets` and `wallet_transactions` tables
 * - Customer data from `customers` table
 * 
 * Date: 2025-01-27
 * Migration: Batch 8 Phase 1 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getWalletsRepository } from '../../lib/repositories/wallets.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getDbClient } from '../../lib/db.ts';
import { createRazorpayOrder, verifyRazorpaySignature } from './razorpay-integration.tsx';

const app = new Hono();
app.use('*', cors());

const db = getDbClient();

// Helper: Generate wallet transaction ID (for reference_id)
function generateWalletTransactionId() {
  return `wallet_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==========================================================================
// WALLET TOP-UP FLOW
// ==========================================================================

/**
 * POST /customer/:customerId/wallet/topup/initiate
 * Initiate wallet top-up transaction
 */
app.post('/customer/:customerId/wallet/topup/initiate', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const { amount, bonusOffer } = await c.req.json();
    
    if (!amount || amount < 100) {
      return c.json({
        error: 'Invalid amount',
        hint: 'Minimum top-up amount is ₹100'
      }, 400);
    }
    
    if (amount > 10000) {
      return c.json({
        error: 'Amount exceeds limit',
        hint: 'Maximum top-up amount is ₹10,000'
      }, 400);
    }
    
    // ✅ SQL: Get customer from customers table
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(customerId) || await customersRepo.findById(customerId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // Calculate bonus (if applicable)
    let bonusAmount = 0;
    if (bonusOffer && bonusOffer.enabled) {
      bonusAmount = Math.floor((amount * bonusOffer.percentage) / 100);
    }
    
    // Create Razorpay order
    const razorpayOrder = await createRazorpayOrder(amount, undefined, `wallet_topup_${customerId}`);
    
    // ✅ SQL: Create wallet transaction record in wallet_transactions table
    const transactionId = generateWalletTransactionId();
    const walletsRepo = getWalletsRepository();
    const wallet = await walletsRepo.findOrCreate(customer.id);
    
    // Store transaction metadata in a temporary table or use wallet_transactions with additional fields
    // For now, we'll store the pending transaction data in wallet_transactions with status in description
    const transactionData = {
      id: transactionId,
      customerId: customer.id,
      type: 'topup',
      amount,
      bonusAmount,
      totalAmount: amount + bonusAmount,
      status: 'pending',
      razorpayOrderId: razorpayOrder.id,
      razorpayAmount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      createdAt: new Date().toISOString()
    };
    
    // Store pending transaction in wallet_transactions with status='pending' in description
    const { data: transaction, error: insertError } = await db
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        customer_id: customer.id,
        transaction_type: 'credit',
        amount: amount + bonusAmount,
        balance_after: wallet.balance, // Will be updated when verified
        reference_id: razorpayOrder.id,
        purpose: 'topup',
        description: JSON.stringify({
          status: 'pending',
          transactionId,
          bonusAmount,
          razorpayOrderId: razorpayOrder.id,
          razorpayAmount: razorpayOrder.amount,
          currency: razorpayOrder.currency
        })
      })
      .select()
      .single();
    
    if (insertError || !transaction) {
      console.error('Error creating wallet transaction:', insertError);
      return c.json({ error: 'Failed to create transaction' }, 500);
    }
    
    console.log(`💰 Wallet top-up initiated: ${transactionId} for ₹${amount}`);
    
    return c.json({
      success: true,
      transaction: {
        id: transactionId,
        amount,
        bonusAmount,
        totalAmount: amount + bonusAmount
      },
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      },
      key: Deno.env.get('RAZORPAY_KEY_ID')
    });
    
  } catch (error) {
    console.error('Error initiating wallet top-up:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /customer/:customerId/wallet/topup/verify
 * Verify and complete wallet top-up
 */
app.post('/customer/:customerId/wallet/topup/verify', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const { transactionId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = await c.req.json();
    
    if (!transactionId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return c.json({
        error: 'Missing required fields',
        required: ['transactionId', 'razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature']
      }, 400);
    }
    
    // ✅ SQL: Get customer
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(customerId) || await customersRepo.findById(customerId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Find pending transaction by reference_id (razorpayOrderId)
    const { data: transactions, error: findError } = await db
      .from('wallet_transactions')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('reference_id', razorpayOrderId)
      .eq('purpose', 'topup')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (findError || !transactions || transactions.length === 0) {
      return c.json({ error: 'Transaction not found' }, 404);
    }
    
    const pendingTransaction = transactions[0];
    const transactionDesc = JSON.parse(pendingTransaction.description || '{}');
    
    if (transactionDesc.status !== 'pending') {
      return c.json({ error: 'Transaction already processed' }, 400);
    }
    
    // Verify Razorpay signature
    const isValid = await verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    
    if (!isValid) {
      // ✅ SQL: Update transaction status to failed
      await db
        .from('wallet_transactions')
        .update({
          description: JSON.stringify({
            ...transactionDesc,
            status: 'failed',
            failedAt: new Date().toISOString(),
            failureReason: 'Invalid signature'
          })
        })
        .eq('id', pendingTransaction.id);
      
      return c.json({
        error: 'Payment verification failed',
        hint: 'Invalid payment signature'
      }, 400);
    }
    
    // ✅ SQL: Update wallet balance
    const walletsRepo = getWalletsRepository();
    const wallet = await walletsRepo.findOrCreate(customer.id);
    
    const totalAmount = pendingTransaction.amount; // Includes bonus
    const newBalance = wallet.balance + totalAmount;
    const newTotalEarned = (wallet.total_earned || 0) + totalAmount;
    
    // Update wallet balance
    await walletsRepo.updateBalance(wallet.id, newBalance, newTotalEarned, wallet.total_spent);
    
    // ✅ SQL: Update transaction status to completed
    await db
      .from('wallet_transactions')
      .update({
        balance_after: newBalance,
        description: JSON.stringify({
          ...transactionDesc,
          status: 'completed',
          completedAt: new Date().toISOString(),
          razorpayPaymentId,
          razorpaySignature
        })
      })
      .eq('id', pendingTransaction.id);
    
    // Get updated wallet
    const updatedWallet = await walletsRepo.findByCustomer(customer.id);
    
    console.log(`✅ Wallet top-up completed: ${transactionId}, Balance: ₹${updatedWallet?.balance || 0}`);
    
    return c.json({
      success: true,
      transaction: {
        id: transactionId,
        amount: transactionDesc.amount || pendingTransaction.amount,
        bonusAmount: transactionDesc.bonusAmount || 0,
        totalAmount: pendingTransaction.amount,
        status: 'completed'
      },
      wallet: {
        balance: updatedWallet?.balance || 0,
        totalEarned: updatedWallet?.total_earned || 0
      },
      message: `₹${pendingTransaction.amount} added to wallet successfully`
    });
    
  } catch (error) {
    console.error('Error verifying wallet top-up:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /customer/:customerId/wallet/topup-offers
 * Get current top-up bonus offers
 */
app.get('/customer/:customerId/wallet/topup-offers', async (c) => {
  try {
    // Get active offers
    const offers = [
      {
        id: 'offer_100',
        minAmount: 500,
        bonusPercentage: 5,
        maxBonus: 50,
        description: 'Add ₹500+ and get 5% bonus (up to ₹50)'
      },
      {
        id: 'offer_200',
        minAmount: 1000,
        bonusPercentage: 10,
        maxBonus: 200,
        description: 'Add ₹1000+ and get 10% bonus (up to ₹200)'
      },
      {
        id: 'offer_300',
        minAmount: 2000,
        bonusPercentage: 15,
        maxBonus: 500,
        description: 'Add ₹2000+ and get 15% bonus (up to ₹500)'
      }
    ];
    
    return c.json({
      success: true,
      offers
    });
    
  } catch (error) {
    console.error('Error fetching top-up offers:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /customer/:customerId/wallet
 * Get wallet balance and information
 * 
 * P0 CRITICAL - Required for wallet display
 */
app.get('/customer/:customerId/wallet', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    // ✅ SQL: Get customer
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(customerId) || await customersRepo.findById(customerId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Get wallet data
    const walletsRepo = getWalletsRepository();
    const wallet = await walletsRepo.findOrCreate(customer.id);
    
    // ✅ SQL: Get recent transactions (last 5)
    const transactions = await walletsRepo.getTransactionsByCustomer(customer.id, { limit: 5 });
    
    const recentTransactions = transactions.map((txn: any) => {
      const desc = typeof txn.description === 'string' ? JSON.parse(txn.description || '{}') : (txn.description || {});
      return {
        id: desc.transactionId || txn.id,
        type: txn.transaction_type,
        amount: txn.amount,
        status: desc.status || 'completed',
        createdAt: txn.created_at
      };
    });
    
    console.log(`💰 [GET-WALLET] Customer ${customerId}: Balance ₹${wallet.balance}`);
    
    return c.json({
      success: true,
      wallet: {
        balance: wallet.balance,
        totalEarned: wallet.total_earned || 0,
        totalSpent: wallet.total_spent || 0,
        lastTopupAt: recentTransactions.find((t: any) => t.type === 'credit')?.createdAt,
        lastTopupAmount: recentTransactions.find((t: any) => t.type === 'credit')?.amount || 0
      },
      recentTransactions,
      transactionCount: transactions.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching wallet:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /customer/:customerId/wallet/transactions
 * Get complete wallet transaction history
 * 
 * P0 CRITICAL - Required for transaction history display
 */
app.get('/customer/:customerId/wallet/transactions', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const type = c.req.query('type'); // Optional filter: topup, payment, refund
    
    // ✅ SQL: Get customer
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(customerId) || await customersRepo.findById(customerId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Get transactions
    const walletsRepo = getWalletsRepository();
    const allTransactions = await walletsRepo.getTransactionsByCustomer(customer.id, { limit: 1000 }); // Get all, then filter
    
    // Apply type filter if specified
    let filteredTransactions = allTransactions;
    if (type) {
      filteredTransactions = allTransactions.filter((txn: any) => {
        const desc = typeof txn.description === 'string' ? JSON.parse(txn.description || '{}') : (txn.description || {});
        if (type === 'topup') return txn.purpose === 'topup';
        if (type === 'payment') return txn.transaction_type === 'debit';
        if (type === 'refund') return txn.transaction_type === 'credit' && txn.purpose === 'refund';
        return true;
      });
    }
    
    // Apply pagination
    const transactions = filteredTransactions.slice(offset, offset + limit);
    
    // Format transactions
    const formattedTransactions = transactions.map((txn: any) => {
      const desc = typeof txn.description === 'string' ? JSON.parse(txn.description || '{}') : (txn.description || {});
      return {
        id: desc.transactionId || txn.id,
        type: txn.purpose || txn.transaction_type,
        amount: txn.amount,
        status: desc.status || 'completed',
        balanceAfter: txn.balance_after,
        razorpayOrderId: desc.razorpayOrderId,
        razorpayPaymentId: desc.razorpayPaymentId,
        createdAt: txn.created_at
      };
    });
    
    console.log(`💳 [WALLET-TRANSACTIONS] Customer ${customerId}: ${formattedTransactions.length} transactions`);
    
    return c.json({
      success: true,
      transactions: formattedTransactions,
      pagination: {
        total: filteredTransactions.length,
        limit,
        offset,
        hasMore: (offset + limit) < filteredTransactions.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching wallet transactions:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
