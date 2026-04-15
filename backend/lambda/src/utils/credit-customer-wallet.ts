import { query } from '../database/rds-connection';

/**
 * Credits the canonical customer wallet (`customer_wallets`) and appends a ledger row
 * (`wallet_transactions`). Also bumps `customers.wallet_balance` for any legacy readers.
 */
export async function creditCustomerWalletForBookingRefund(params: {
  customerId: string;
  bookingId: string;
  refundAmount: number;
  refundPercentage: number;
  /** e.g. "booking" vs "appointment" — only affects description text */
  label?: 'booking' | 'appointment';
}): Promise<{ newBalance: number }> {
  const { customerId, bookingId, refundAmount, refundPercentage } = params;
  const label = params.label ?? 'booking';
  if (!customerId || !bookingId || !Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new Error('creditCustomerWalletForBookingRefund: invalid parameters');
  }

  const description =
    label === 'appointment'
      ? `Refund for cancelled appointment (${refundPercentage}%)`
      : `Refund for cancelled booking (${refundPercentage}%)`;

  const upsert = await query(
    `INSERT INTO customer_wallets (customer_id, balance, currency)
     VALUES ($1::uuid, $2::numeric, 'INR')
     ON CONFLICT (customer_id) DO UPDATE SET
       balance = customer_wallets.balance + EXCLUDED.balance,
       updated_at = NOW()
     RETURNING balance::text`,
    [customerId, refundAmount]
  );

  const balanceAfter = parseFloat(String(upsert.rows?.[0]?.balance ?? '0')) || 0;

  await query(
    `INSERT INTO wallet_transactions (
       customer_id,
       transaction_type,
       amount,
       balance_after,
       booking_id,
       reference_type,
       reference_id,
       description
     ) VALUES (
       $1::uuid,
       'credit',
       $2::numeric,
       $3::numeric,
       $4::uuid,
       'booking_refund',
       $4::uuid,
       $5
     )`,
    [customerId, refundAmount, balanceAfter, bookingId, description]
  );

  await query(
    `UPDATE customers SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2`,
    [refundAmount, customerId]
  ).catch(() => null);

  return { newBalance: balanceAfter };
}
