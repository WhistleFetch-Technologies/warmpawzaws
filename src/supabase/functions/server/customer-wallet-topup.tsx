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

// ✅ Lambda Compatibility: Removed Deno.env.get() references
import { Hono } from 'hono';
import { cors } from "hono/cors";
// ✅ SQL: KV import removed
import { createRazorpayOrder, verifyRazorpaySignature } from './razorpay-integration';
import { getRazorpayCredentials } from './razorpay-credentials-helper';
import { getCustomersRepository, getWalletsRepository } from '../../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../../supabase/lib/db';

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
    // ✅ SQL: Get customer
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
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
    
    // ✅ SQL: Store wallet transaction
    const db = getDbClient();
    await db.from('wallet_transactions').insert({
      id: transactionId,
      customer_id: customerId,
      transaction_type: 'topup',
      amount: amount,
      bonus_amount: bonusAmount,
      total_amount: amount + bonusAmount,
      status: 'pending',
      razorpay_order_id: razorpayOrder.id,
      razorpay_amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      created_at: new Date().toISOString()
    });
    
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
      key: (await getRazorpayCredentials()).keyId // ✅ Lambda: Get from PlatformSettingsRepository
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
    // ✅ SQL: Get wallet transaction
    const db = getDbClient();
    const { data: transactionData } = await db
      .from('wallet_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();
    
    if (!transactionData) {
      return c.json({ error: 'Transaction not found' }, 404);
    }
    
    const transaction = {
      id: transactionData.id,
      customerId: transactionData.customer_id,
      amount: transactionData.amount,
      bonusAmount: transactionData.bonus_amount,
      totalAmount: transactionData.total_amount,
      status: transactionData.status,
      razorpayOrderId: transactionData.razorpay_order_id,
      razorpayAmount: transactionData.razorpay_amount,
      currency: transactionData.currency,
      createdAt: transactionData.created_at
    };
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
      // ✅ SQL: Update transaction status to failed
      await db
        .from('wallet_transactions')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: 'Invalid signature'
        })
        .eq('id', transactionId);
      
      return c.json({
        error: 'Payment verification failed',
        hint: 'Invalid payment signature'
      }, 400);
    }
    
    // ✅ SQL: Update transaction to completed
    await db
      .from('wallet_transactions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature
      })
      .eq('id', transactionId);
    
    // Update wallet balance
    // ✅ SQL: Get or create wallet
    const walletsRepo = getWalletsRepository();
    let walletData = await walletsRepo.findByCustomer(customerId);
    
    // ✅ SQL: Get or create wallet
    let wallet = walletData;
    if (!wallet) {
      wallet = await walletsRepo.findOrCreate(customerId);
    }
    
    // ✅ SQL: Create credit transaction (this will update wallet balance automatically)
    await walletsRepo.addTransaction({
      wallet_id: wallet.id,
      customer_id: customerId,
      transaction_type: 'credit',
      amount: transaction.totalAmount,
      source: 'wallet_topup',
      purpose: 'topup',
      description: `Wallet top-up via Razorpay`,
      reference_id: transactionId
    });
    
    // Get updated wallet data
    const updatedWallet = await walletsRepo.findByCustomer(customerId);
    
    // ✅ SQL: Wallet already updated via walletsRepo.credit() above
    // Transaction already stored in wallet_transactions table
    
    console.log(`✅ Wallet top-up completed: ${transactionId}, Balance: ₹${updatedWallet?.balance || 0}`);
    
    return c.json({
      success: true,
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        bonusAmount: transaction.bonusAmount,
        totalAmount: transaction.totalAmount,
        status: 'completed'
      },
      wallet: {
        balance: updatedWallet?.balance || 0,
        totalEarned: updatedWallet?.total_earned || 0
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
    // ✅ SQL: Get wallet
    const walletsRepo = getWalletsRepository();
    // ✅ SQL: Get or create wallet
    const wallet = await walletsRepo.findOrCreate(customerId);
    
    // Get recent transactions (last 5)
    // ✅ SQL: Get wallet transactions
    const db = getDbClient();
    const limit = 50; // Default limit
    const { data: transactionsData } = await db
      .from('wallet_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    const recentTransactions: Array<{
      id: string;
      type: string;
      amount: number;
      status: string;
      createdAt: string;
    }> = [];
    
    for (let i = 0; i < Math.min(5, transactionsData?.length || 0); i++) {
      // ✅ SQL: Transaction already in transactionsData array
      const txn = transactionsData?.[i];
      if (txn) {
        recentTransactions.push({
          id: txn.id,
          type: txn.transaction_type || 'unknown',
          amount: txn.amount || 0,
          status: txn.status || 'pending',
          createdAt: txn.created_at || new Date().toISOString()
        });
      }
    }
    
    console.log(`💰 [GET-WALLET] Customer ${customerId}: Balance ₹${wallet?.balance || 0}`);
    
    // Get last topup transaction
    const lastTopupTransaction = transactionsData?.find((t: any) => (t.transaction_type === 'topup' || t.purpose === 'topup') && t.status === 'completed');
    
    return c.json({
      success: true,
      wallet: {
        balance: wallet?.balance || 0,
        totalEarned: wallet?.total_earned || 0,
        totalSpent: wallet?.total_spent || 0,
        lastTopupAt: lastTopupTransaction?.created_at || null,
        lastTopupAmount: lastTopupTransaction?.total_amount || lastTopupTransaction?.amount || 0
      },
      recentTransactions,
      transactionCount: transactionsData?.length || 0
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
    
    // ✅ SQL: Get wallet transactions
    const db = getDbClient();
    let query = db
      .from('wallet_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Apply type filter if specified
    if (type) {
      query = query.eq('transaction_type', type);
    }
    
    const { data: transactionsData } = await query;
    const transactions = (transactionsData || []).map((txn: any) => ({
      id: txn.id,
      type: txn.transaction_type,
      amount: txn.amount,
      bonusAmount: txn.bonus_amount || 0,
      totalAmount: txn.total_amount,
      status: txn.status,
      createdAt: txn.created_at,
      razorpayOrderId: txn.razorpay_order_id,
      razorpayPaymentId: txn.razorpay_payment_id
    }));
    
    // Get total count for pagination
    const { count } = await db
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId);
    
    const totalCount = count || 0;
    
    console.log(`💳 [WALLET-TRANSACTIONS] Customer ${customerId}: ${transactions.length} transactions`);
    
    return c.json({
      success: true,
      transactions,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching wallet transactions:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;