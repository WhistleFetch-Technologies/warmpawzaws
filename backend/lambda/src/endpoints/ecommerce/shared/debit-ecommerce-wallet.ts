import { withTransaction } from '../../../database/rds-connection';
import { consumePromoCashbackForDebit } from '../../../discount-engine/promo-engine';

export async function debitEcommerceWallet(opts: {
  customerId: string;
  amount: number;
  orderId: string;
  orderNumber: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const amount = Math.round((opts.amount || 0) * 100) / 100;
  if (amount <= 0) return { ok: true };

  try {
    await withTransaction(async (client) => {
      const { computeSpendableWalletBalance } = await import(
        '../../../discount-engine/promo-engine'
      );
      const scoped = await computeSpendableWalletBalance(opts.customerId, 'ecommerce');
      if (amount > scoped.spendable + 0.009) {
        throw new Error(
          `Insufficient spendable wallet for shop (spendable ₹${scoped.spendable.toFixed(2)}, locked ₹${scoped.lockedPromoCashback.toFixed(2)})`,
        );
      }

      const wallet = await client.query(
        `SELECT id, balance FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`,
        [opts.customerId],
      );
      if (!wallet.rows.length) throw new Error('Wallet not found');
      const balance = Number(wallet.rows[0].balance || 0);
      if (balance + 0.009 < amount) {
        throw new Error(`Insufficient wallet balance. Available: ₹${balance.toFixed(2)}`);
      }

      await client.query(
        `UPDATE customer_wallets
         SET balance = GREATEST(0, balance - $1::numeric), updated_at = NOW()
         WHERE customer_id = $2::uuid`,
        [amount, opts.customerId],
      );
      await client.query(
        `INSERT INTO wallet_transactions
           (customer_id, wallet_id, transaction_type, amount, description, reference_type, reference_id, created_at)
         VALUES ($1::uuid, $2, 'debit', $3, $4, 'order', $5::uuid, NOW())`,
        [
          opts.customerId,
          wallet.rows[0].id,
          amount,
          `Applied to order ${opts.orderNumber}`,
          opts.orderId,
        ],
      );
      await consumePromoCashbackForDebit(client, {
        customerId: opts.customerId,
        amount,
        serviceCategory: 'ecommerce',
      });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Wallet debit failed' };
  }
}
