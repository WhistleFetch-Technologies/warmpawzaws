/**
 * ============================================================================
 * CUSTOMER WALLET TOP-UP SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Add money to wallet via payment gateway
 * - Transaction tracking
 * - Wallet balance management
 * - Bonus/cashback on top-ups
 * - Transaction history
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `customer_wallets` and `wallet_transactions` tables
 * - Uses `CustomersRepository` for customer validation
 * 
 * Date: 2025-01-28
 * Migration: Batch 9 - 14 KV operations → 0
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient, withTransaction } from '../../lib/db.ts';
import { createRazorpayOrder, verifyRazorpaySignature } from './razorpay-integration.tsx';

const app = new Hono();
app.use('*', cors());

const db = getDbClient();

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
app.post('/make-server-3dd53475/customer/:customerId/wallet/topup/initiate', async (c) => {
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

    // ✅ SQL: Get customer
    const { data: customer, error: customerError } = await db
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();

    if (customerError) throw customerError;
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

    // ✅ SQL: Store transaction in platform_settings (temporary until payment is verified)
    const transactionId = generateWalletTransactionId();
    const now = new Date().toISOString();

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
      currency: razorpayOrder.currency || 'INR',
      createdAt: now
    };

    // Store in platform_settings for pending transactions
    await db
      .from('platform_settings')
      .upsert({
        setting_key: `wallet:transaction:${transactionId}`,
        setting_value: transaction,
        setting_type: 'object',
        updated_at: now
      }, {
        onConflict: 'setting_key'
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
app.post('/make-server-3dd53475/customer/:customerId/wallet/topup/verify', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const { transactionId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = await c.req.json();

    if (!transactionId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return c.json({
        error: 'Missing required fields',
        required: ['transactionId', 'razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature']
      }, 400);
    }

    // ✅ SQL: Get transaction from platform_settings
    const { data: txnData, error: txnError } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', `wallet:transaction:${transactionId}`)
      .maybeSingle();

    if (txnError) throw txnError;
    if (!txnData?.setting_value) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const transaction = txnData.setting_value;

    // Verify Razorpay signature
    const isValid = await verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      // ✅ SQL: Update transaction status to failed
      transaction.status = 'failed';
      transaction.failedAt = new Date().toISOString();
      transaction.failureReason = 'Invalid signature';

      await db
        .from('platform_settings')
        .update({
          setting_value: transaction,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', `wallet:transaction:${transactionId}`);

      return c.json({
        error: 'Payment verification failed',
        hint: 'Invalid payment signature'
      }, 400);
    }

    // ✅ SQL: Update transaction and wallet balance in transaction
    const totalAmount = transaction.totalAmount;
    const newBalance = await withTransaction(async (txClient) => {
      // Update transaction status
      transaction.status = 'completed';
      transaction.completedAt = new Date().toISOString();
      transaction.razorpayPaymentId = razorpayPaymentId;
      transaction.razorpaySignature = razorpaySignature;

      await txClient
        .from('platform_settings')
        .update({
          setting_value: transaction,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', `wallet:transaction:${transactionId}`);

      // Get or create wallet
      const { data: walletData } = await txClient
        .from('customer_wallets')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();

      const currentBalance = walletData ? parseFloat(walletData.balance.toString()) : 0;
      const newBalance = currentBalance + totalAmount;

      if (walletData) {
        // Update existing wallet
        await txClient
          .from('customer_wallets')
          .update({
            balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', walletData.id);
      } else {
        // Create new wallet
        await txClient
          .from('customer_wallets')
          .insert({
            customer_id: customerId,
            balance: newBalance
          });
      }

      // Create wallet transaction record
      await txClient
        .from('wallet_transactions')
        .insert({
          customer_id: customerId,
          transaction_type: 'credit',
          amount: totalAmount,
          balance_after: newBalance,
          reference_type: 'topup',
          description: `Wallet top-up: ₹${amount}${bonusAmount > 0 ? ` + ₹${bonusAmount} bonus` : ''}`
        });

      return newBalance;
    }, db);

    console.log(`✅ Wallet top-up completed: ${transactionId}, Balance: ₹${newBalance}`);

    return c.json({
      success: true,
      transaction: {
        id: transactionId,
        status: 'completed'
      },
      wallet: {
        balance: newBalance
      },
      message: `₹${totalAmount} added to wallet successfully`
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
app.get('/make-server-3dd53475/customer/:customerId/wallet/topup-offers', async (c) => {
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
 */
app.get('/make-server-3dd53475/customer/:customerId/wallet', async (c) => {
  try {
    const customerId = c.req.param('customerId');

    // ✅ SQL: Get wallet data
    const { data: wallet, error: walletError } = await db
      .from('customer_wallets')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (walletError) throw walletError;

    const walletData = wallet || { balance: 0 };

    // ✅ SQL: Get recent transactions (last 5)
    const { data: recentTransactions, error: txnError } = await db
      .from('wallet_transactions')
      .select('id, transaction_type, amount, balance_after, description, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (txnError) throw txnError;

    // Get total transaction count
    const { count } = await db
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId);

    console.log(`💰 [GET-WALLET] Customer ${customerId}: Balance ₹${walletData.balance}`);

    return c.json({
      success: true,
      wallet: {
        balance: parseFloat((walletData.balance || 0).toString())
      },
      recentTransactions: (recentTransactions || []).map((t: any) => ({
        id: t.id,
        type: t.transaction_type,
        amount: parseFloat((t.amount || 0).toString()),
        balanceAfter: parseFloat((t.balance_after || 0).toString()),
        description: t.description,
        createdAt: t.created_at
      })),
      transactionCount: count || 0
    });
  } catch (error) {
    console.error('❌ Error fetching wallet:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /customer/:customerId/wallet/transactions
 * Get complete wallet transaction history
 */
app.get('/make-server-3dd53475/customer/:customerId/wallet/transactions', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const type = c.req.query('type'); // Optional filter: topup, payment, refund

    // ✅ SQL: Get transactions with filter
    let query = db
      .from('wallet_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      // Map 'topup' to 'credit' for transaction_type
      const mappedType = type === 'topup' ? 'credit' : type;
      query = query.eq('transaction_type', mappedType);
    }

    const { data: transactions, error: txnError } = await query;

    if (txnError) throw txnError;

    // ✅ SQL: Get total count
    let countQuery = db
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId);

    if (type) {
      const mappedType = type === 'topup' ? 'credit' : type;
      countQuery = countQuery.eq('transaction_type', mappedType);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    console.log(`💳 [WALLET-TRANSACTIONS] Customer ${customerId}: ${transactions?.length || 0} transactions`);

    return c.json({
      success: true,
      transactions: (transactions || []).map((t: any) => ({
        id: t.id,
        type: t.transaction_type,
        amount: parseFloat((t.amount || 0).toString()),
        balanceAfter: parseFloat((t.balance_after || 0).toString()),
        description: t.description,
        referenceType: t.reference_type,
        referenceId: t.reference_id,
        createdAt: t.created_at
      })),
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching wallet transactions:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
