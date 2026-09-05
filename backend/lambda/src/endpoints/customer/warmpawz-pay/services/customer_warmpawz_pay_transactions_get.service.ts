import type { Context } from 'hono';
import { resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import { resolveMerchantDisplayName } from '../../../warmpawz-pay/shared/merchant/merchant-display-name.resolver';
import {
  dbWpayPendingForCustomer,
  dbWpayTransactionsPage,
  type WpayTransactionDbRow,
} from '../repos/wpay-payment.repo';
import { reconcileWpayRazorpayCapture } from '../shared/reconcile-wpay-razorpay-capture';
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

function asMeta(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

function metaNumber(meta: Record<string, unknown> | null, key: string): number {
  const n = Number(meta?.[key]);
  return Number.isFinite(n) ? n : 0;
}

/** Pass through stored checkout snapshot — do not recompute fees. */
export function mapWpayCustomerHistoryCard(row: WpayTransactionDbRow) {
  const meta = asMeta(row.metadata);
  return {
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
    servicePayableAmount: metaNumber(meta, 'servicePayableAmount'),
    platformFee: metaNumber(meta, 'platformFee'),
    platformFeeGstAmount: metaNumber(meta, 'platformFeeGstAmount'),
    platformFeeGstRate: metaNumber(meta, 'platformFeeGstRateSnapshot'),
    convenienceFee: metaNumber(meta, 'convenienceFee'),
    convenienceGstAmount: metaNumber(meta, 'convenienceGstAmount'),
    convenienceGstRate: metaNumber(meta, 'convenienceGstRateSnapshot'),
    payableAmount: Number(row.payable_amount ?? 0),
    commercialModel: String(meta?.commercialModel ?? '').trim() || null,
    paidAt: row.paid_at,
  };
}

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
    const pending = await dbWpayPendingForCustomer(customerId, 3);
    for (const row of pending) {
      await reconcileWpayRazorpayCapture(row, customerId).catch((error) => {
        console.error('[customer/warmpawz-pay/transactions] reconcile failed', error);
      });
    }
    const page = await dbWpayTransactionsPage({ customerId, limit, cursor });

    const transactions = page.rows.map(mapWpayCustomerHistoryCard);
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
