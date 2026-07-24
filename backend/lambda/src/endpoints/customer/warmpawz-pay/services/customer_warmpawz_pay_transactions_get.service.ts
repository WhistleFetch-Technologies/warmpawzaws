import type { Context } from 'hono';
import { resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import { resolveMerchantDisplayName } from '../../../warmpawz-pay/shared/merchant/merchant-display-name.resolver';
import { dbWpayTransactionsPage } from '../repos/wpay-payment.repo';
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

function parseLimit(raw: string | undefined): number {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, n);
}

export async function executeCustomerWarmpawzPayTransactionsGet(c: Context) {
  try {
    const phone = String(c.req.query('phone') ?? '').trim();
    if (!phone) {
      return c.json({ success: false, error: 'Phone is required' }, 400);
    }

    const customerId = await resolveCustomerIdFromPhone(phone);
    if (!customerId) {
      return c.json({ success: true, transactions: [], total: 0, nextCursor: null });
    }

    const limit = parseLimit(c.req.query('limit'));
    const cursor = c.req.query('cursor')?.trim() || null;
    const page = await dbWpayTransactionsPage({ customerId, limit, cursor });

    const transactions = page.rows.map((row) => ({
      paymentId: row.payment_id,
      vendorId: row.vendor_id,
      vendorName: resolveMerchantDisplayName({
        businessName: row.business_name,
        ownerName: row.owner_name,
        vendorType: row.vendor_type,
        isSoloProvider: String(row.vendor_type ?? '').toLowerCase() === 'solo',
      }),
      originalAmount: Number(row.original_amount ?? 0),
      discountPercent: Number(row.discount_percent ?? 0),
      discountAmount: Number(row.discount_amount ?? 0),
      payableAmount: Number(row.payable_amount ?? 0),
      paidAt: row.paid_at,
    }));
    return c.json({
      success: true,
      transactions,
      total: transactions.length,
      nextCursor: page.nextCursor,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load transactions';
    console.error('[customer/warmpawz-pay/transactions]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
