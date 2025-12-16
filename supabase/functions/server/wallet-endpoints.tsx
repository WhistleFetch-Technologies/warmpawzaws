import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// ============================================
// WALLET ENDPOINTS
// ============================================

// GET /wallet/:customerId - Get customer wallet balance and transactions
app.get('/:customerId', async (c) => {
  const { customerId } = c.req.param();

  try {
    // Get wallet data
    const wallet = await kv.get(`wallet:${customerId}`) || {
      customerId,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      transactions: []
    };

    // Get recent transactions (last 50)
    const transactions = wallet.transactions?.slice(-50).reverse() || [];

    return c.json({
      success: true,
      wallet: {
        balance: wallet.balance || 0,
        totalEarned: wallet.totalEarned || 0,
        totalSpent: wallet.totalSpent || 0
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
    // Get current wallet
    const wallet = await kv.get(`wallet:${customerId}`) || {
      customerId,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      transactions: []
    };

    // Create transaction
    const transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'credit',
      amount,
      source: source || 'refund', // refund, cashback, promo, etc.
      description: description || 'Amount credited to wallet',
      referenceId: referenceId || null,
      timestamp: new Date().toISOString(),
      balanceAfter: (wallet.balance || 0) + amount
    };

    // Update wallet
    wallet.balance = (wallet.balance || 0) + amount;
    wallet.totalEarned = (wallet.totalEarned || 0) + amount;
    wallet.transactions = [...(wallet.transactions || []), transaction];

    // Save wallet
    await kv.set(`wallet:${customerId}`, wallet);

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
    // Get current wallet
    const wallet = await kv.get(`wallet:${customerId}`) || {
      customerId,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      transactions: []
    };

    // Check sufficient balance
    if (wallet.balance < amount) {
      return c.json({ error: 'Insufficient wallet balance' }, 400);
    }

    // Create transaction
    const transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'debit',
      amount,
      purpose: purpose || 'payment', // payment, penalty, etc.
      description: description || 'Payment from wallet',
      referenceId: referenceId || null,
      timestamp: new Date().toISOString(),
      balanceAfter: wallet.balance - amount
    };

    // Update wallet
    wallet.balance -= amount;
    wallet.totalSpent = (wallet.totalSpent || 0) + amount;
    wallet.transactions = [...(wallet.transactions || []), transaction];

    // Save wallet
    await kv.set(`wallet:${customerId}`, wallet);

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
