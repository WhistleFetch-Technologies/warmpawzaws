import { notifyWpayPaymentCompleted } from '../../../../utils/wpay-notifications';
import {
  dbWpayCompleteFromCapture,
  dbWpayPaymentById,
  type WpayPaymentRow,
} from '../repos/wpay-payment.repo';
import { accrueWpaySettlement } from './accrue-wpay-settlement';

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

function readMetadataNumber(meta: Record<string, unknown> | null, key: string): number | null {
  if (!meta) return null;
  const n = Number(meta[key]);
  return Number.isFinite(n) ? n : null;
}

export function quoteAmountsFromWpayPayment(payment: WpayPaymentRow): {
  originalAmount: number;
  discountAmount: number;
} {
  const meta = asMeta(payment.metadata);
  const originalAmount =
    Number(payment.original_amount ?? NaN) ||
    readMetadataNumber(meta, 'quotedOriginalAmount') ||
    readMetadataNumber(meta, 'quotedAmount') ||
    Number(payment.amount ?? 0);
  const discountAmount =
    Number(payment.discount_amount ?? NaN) ||
    readMetadataNumber(meta, 'quotedDiscountAmount') ||
    0;
  return { originalAmount, discountAmount };
}

export function wpayVerifyResponse(payment: WpayPaymentRow) {
  const { originalAmount, discountAmount } = quoteAmountsFromWpayPayment(payment);
  return {
    success: true as const,
    paymentId: payment.id,
    originalAmount,
    discountAmount,
    payableAmount: Number(payment.amount ?? 0),
    savedAmount: discountAmount,
  };
}

export async function fulfillWpayCapturedPayment(params: {
  paymentId: string;
  razorpayPaymentId: string;
  customerId?: string;
}): Promise<WpayPaymentRow | null> {
  const existing = await dbWpayPaymentById(params.paymentId);
  if (!existing) return null;
  if (params.customerId && String(existing.customer_id) !== params.customerId) return null;

  const { originalAmount, discountAmount } = quoteAmountsFromWpayPayment(existing);
  const completed =
    (await dbWpayCompleteFromCapture({
      paymentId: params.paymentId,
      razorpayPaymentId: params.razorpayPaymentId,
      originalAmount,
      discountAmount,
      customerId: params.customerId,
    })) ?? existing;

  if (String(completed.payment_status).toLowerCase() !== 'completed') return null;

  try {
    await accrueWpaySettlement(completed);
  } catch (error) {
    console.error('[wpay-fulfill] settlement accrual failed', error);
  }
  void notifyWpayPaymentCompleted(params.paymentId).catch((error) => {
    console.error('[wpay-fulfill] vendor notify failed', error);
  });
  return completed;
}
