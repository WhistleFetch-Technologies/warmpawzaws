/**
 * CUSTOMER WALLET TOP-UP SYSTEM
 * 
 * Features:
 * - Add money to wallet via payment gateway
 * - Transaction tracking
 * - Wallet balance management
 * - Bonus/cashback on top-ups
 * - Transaction history
 * 
 * Status: ✅ P1 IMPLEMENTATION
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';
import { createRazorpayOrder, verifyRazorpaySignature } from './razorpay-integration.tsx';

const app = new Hono();
app.use('*', cors());

// Helper: Generate wallet transaction ID
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
    
    // Get customer
    const customer = await kv.get(`customer:${customerId}`);
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
    
    // Create wallet transaction record
    const transactionId = generateWalletTransactionId();
    const transaction = {
      id: transactionId,
      customerId,
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
    
    await kv.set(`wallet:transaction:${transactionId}`, transaction);
    
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
    
    // Get transaction
    const transaction = await kv.get(`wallet:transaction:${transactionId}`);
    if (!transaction) {
      return c.json({ error: 'Transaction not found' }, 404);
    }
    
    // Verify Razorpay signature
    const isValid = await verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    
    if (!isValid) {
      transaction.status = 'failed';
      transaction.failedAt = new Date().toISOString();
      transaction.failureReason = 'Invalid signature';
      await kv.set(`wallet:transaction:${transactionId}`, transaction);
      
      return c.json({
        error: 'Payment verification failed',
        hint: 'Invalid payment signature'
      }, 400);
    }
    
    // Update transaction
    transaction.status = 'completed';
    transaction.completedAt = new Date().toISOString();
    transaction.razorpayPaymentId = razorpayPaymentId;
    transaction.razorpaySignature = razorpaySignature;
    
    await kv.set(`wallet:transaction:${transactionId}`, transaction);
    
    // Update wallet balance
    const wallet = await kv.get(`wallet:${customerId}`) || {
      balance: 0,
      totalEarned: 0,
      totalSpent: 0
    };
    
    wallet.balance += transaction.totalAmount;
    wallet.totalEarned += transaction.totalAmount;
    wallet.lastTopupAt = new Date().toISOString();
    wallet.lastTopupAmount = transaction.totalAmount;
    
    await kv.set(`wallet:${customerId}`, wallet);
    
    // Add to transaction history
    const transactions = await kv.get(`wallet:${customerId}:transactions`) || [];
    transactions.unshift(transactionId);
    await kv.set(`wallet:${customerId}:transactions`, transactions);
    
    console.log(`✅ Wallet top-up completed: ${transactionId}, Balance: ₹${wallet.balance}`);
    
    return c.json({
      success: true,
      transaction,
      wallet: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned
      },
      message: `₹${transaction.totalAmount} added to wallet successfully`
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
    
    // Get wallet data
    const wallet = await kv.get(`wallet:${customerId}`) || {
      balance: 0,
      totalEarned: 0,
      totalSpent: 0
    };
    
    // Get recent transactions (last 5)
    const transactionIds = await kv.get(`wallet:${customerId}:transactions`) || [];
    const recentTransactions = [];
    
    for (let i = 0; i < Math.min(5, transactionIds.length); i++) {
      const txn = await kv.get(`wallet:transaction:${transactionIds[i]}`);
      if (txn) {
        recentTransactions.push({
          id: txn.id,
          type: txn.type,
          amount: txn.amount,
          status: txn.status,
          createdAt: txn.createdAt
        });
      }
    }
    
    console.log(`💰 [GET-WALLET] Customer ${customerId}: Balance ₹${wallet.balance}`);
    
    return c.json({
      success: true,
      wallet: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned || 0,
        totalSpent: wallet.totalSpent || 0,
        lastTopupAt: wallet.lastTopupAt,
        lastTopupAmount: wallet.lastTopupAmount || 0
      },
      recentTransactions,
      transactionCount: transactionIds.length
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
    
    // Get transaction IDs
    const transactionIds = await kv.get(`wallet:${customerId}:transactions`) || [];
    
    // Get full transaction details
    const transactions = [];
    const startIdx = offset;
    const endIdx = Math.min(offset + limit, transactionIds.length);
    
    for (let i = startIdx; i < endIdx; i++) {
      const txn = await kv.get(`wallet:transaction:${transactionIds[i]}`);
      if (txn) {
        // Apply type filter if specified
        if (!type || txn.type === type) {
          transactions.push(txn);
        }
      }
    }
    
    console.log(`💳 [WALLET-TRANSACTIONS] Customer ${customerId}: ${transactions.length} transactions`);
    
    return c.json({
      success: true,
      transactions,
      pagination: {
        total: transactionIds.length,
        limit,
        offset,
        hasMore: endIdx < transactionIds.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching wallet transactions:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;