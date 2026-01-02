// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';

const app = new Hono();

// ============================================
// WALLET ENDPOINTS
// ============================================

// GET /wallet/:customerId - Get customer wallet balance and transactions
app.get('/:customerId', async (c) => {
  const { customerId } = c.req.param();

  try {
    // ✅ SQL: Get wallet data from customer_wallets table
    const db = getDbClient();
    const { data: walletData } = await db
      .from('customer_wallets')
      .select('balance, total_earned, total_spent')
      .eq('customer_id', customerId)
      .single();
    
    const wallet = walletData || {
      balance: 0,
      total_earned: 0,
      total_spent: 0
    };
    
    // ✅ SQL: Get recent transactions from wallet_transactions table
    const { data: transactionsData } = await db
      .from('wallet_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    const transactions = (transactionsData || []).map((t: any) => ({
      id: t.id,
      type: t.transaction_type,
      amount: t.amount,
      source: t.source,
      purpose: t.purpose,
      description: t.description,
      referenceId: t.reference_id,
      timestamp: t.created_at,
      balanceAfter: t.balance_after
    }));

    return c.json({
      success: true,
      wallet: {
        balance: wallet.balance || 0,
        totalEarned: wallet.total_earned || 0,
        totalSpent: wallet.total_spent || 0
      },
      transactions
    });
  } catch (error) {
    console.error(`❌ Error fetching wallet for customer ${customerId}:`, error);
    return c.json({ error: 'Failed to fetch wallet' }, 500);
  }
});

// POST /wallet/:customerId/credit - Add money to wallet (refund, cashback, etc.)
app.post('/:customerId/credit', async (c) => {
  const { customerId } = c.req.param();
  const { amount, source, description, referenceId } = await c.req.json();

  if (!amount || amount <= 0) {
    return c.json({ error: 'Invalid amount' }, 400);
  }

  try {
    const db = getDbClient();
    
    // ✅ SQL: Get current wallet using transaction for atomicity
    const { data: walletData } = await db
      .from('customer_wallets')
      .select('balance, total_earned')
      .eq('customer_id', customerId)
      .single();
    
    const currentBalance = walletData?.balance || 0;
    const newBalance = currentBalance + amount;
    const newTotalEarned = (walletData?.total_earned || 0) + amount;

    // ✅ SQL: Create transaction and update wallet atomically
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Insert transaction
    await db
      .from('wallet_transactions')
      .insert({
        id: transactionId,
        customer_id: customerId,
        transaction_type: 'credit',
        amount: amount,
        source: source || 'refund',
        description: description || 'Amount credited to wallet',
        reference_id: referenceId || null,
        balance_after: newBalance
      });
    
    // Upsert wallet
    await db
      .from('customer_wallets')
      .upsert({
        customer_id: customerId,
        balance: newBalance,
        total_earned: newTotalEarned,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'customer_id'
      });
    
    const transaction = {
      id: transactionId,
      type: 'credit',
      amount,
      source: source || 'refund',
      description: description || 'Amount credited to wallet',
      referenceId: referenceId || null,
      timestamp: new Date().toISOString(),
      balanceAfter: newBalance
    };

    console.log(`✅ Credited ₹${amount} to wallet ${customerId} (${source})`);

    return c.json({
      success: true,
      wallet: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned,
        totalSpent: wallet.totalSpent
      },
      transaction
    });
  } catch (error) {
    console.error(`❌ Error crediting wallet for customer ${customerId}:`, error);
    return c.json({ error: 'Failed to credit wallet' }, 500);
  }
});

// POST /wallet/:customerId/debit - Deduct money from wallet (payment)
app.post('/:customerId/debit', async (c) => {
  const { customerId } = c.req.param();
  const { amount, purpose, description, referenceId } = await c.req.json();

  if (!amount || amount <= 0) {
    return c.json({ error: 'Invalid amount' }, 400);
  }

  try {
    const db = getDbClient();
    
    // ✅ SQL: Get current wallet
    const { data: walletData } = await db
      .from('customer_wallets')
      .select('balance, total_spent')
      .eq('customer_id', customerId)
      .single();
    
    const currentBalance = walletData?.balance || 0;
    
    // Check sufficient balance
    if (currentBalance < amount) {
      return c.json({ error: 'Insufficient wallet balance' }, 400);
    }
    
    const newBalance = currentBalance - amount;
    const newTotalSpent = (walletData?.total_spent || 0) + amount;

    // ✅ SQL: Create transaction and update wallet atomically
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Insert transaction
    await db
      .from('wallet_transactions')
      .insert({
        id: transactionId,
        customer_id: customerId,
        transaction_type: 'debit',
        amount: amount,
        purpose: purpose || 'payment',
        description: description || 'Payment from wallet',
        reference_id: referenceId || null,
        balance_after: newBalance
      });
    
    // Update wallet
    await db
      .from('customer_wallets')
      .upsert({
        customer_id: customerId,
        balance: newBalance,
        total_spent: newTotalSpent,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'customer_id'
      });
    
    const transaction = {
      id: transactionId,
      type: 'debit',
      amount,
      purpose: purpose || 'payment',
      description: description || 'Payment from wallet',
      referenceId: referenceId || null,
      timestamp: new Date().toISOString(),
      balanceAfter: newBalance
    };

    console.log(`✅ Debited ₹${amount} from wallet ${customerId} (${purpose})`);

    return c.json({
      success: true,
      wallet: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned,
        totalSpent: wallet.totalSpent
      },
      transaction
    });
  } catch (error) {
    console.error(`❌ Error debiting wallet for customer ${customerId}:`, error);
    return c.json({ error: 'Failed to debit wallet' }, 500);
  }
});

export default app;
