import { createHmac } from 'crypto';
import { insert } from '../database/rds-connection';
import { getRazorpayConfig, razorpayRequest } from './payments/razorpay-client';

export function verifyWpayRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  keySecret: string,
): boolean {
  const text = `${razorpayOrderId}|${razorpayPaymentId}`;
  const generated = createHmac('sha256', keySecret).update(text).digest('hex');
  return generated === String(razorpaySignature || '').trim();
}

export async function createWpayRazorpayOrder(params: {
  customerId: string;
  vendorId: string;
  payableAmount: number;
  quote: {
    originalAmount: number;
    discountAmount: number;
    discountPercent: number;
  };
}): Promise<{
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  paymentId: string;
}> {
  const { customerId, vendorId, payableAmount, quote } = params;
  const config = await getRazorpayConfig();
  if (!config?.keyId || !config?.keySecret) {
    throw new Error('Razorpay is not configured');
  }

  const amt = Math.round(Number(payableAmount) * 100) / 100;
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error('Invalid payable amount');
  }

  const receipt = `wpay_${String(Date.now())}`.slice(0, 40);
  const orderData = {
    amount: Math.round(amt * 100),
    currency: 'INR',
    receipt,
    notes: {
      type: 'warmpawz_pay',
      customerId: String(customerId),
      vendorId: String(vendorId),
    },
  };

  const razorpayOrder = (await razorpayRequest('/orders', 'POST', orderData, 20000)) as {
    id?: string;
    amount?: number;
    currency?: string;
  };
  if (!razorpayOrder?.id) {
    throw new Error('Failed to create Razorpay order');
  }

  const payRows = await insert('payments', {
    booking_id: null,
    customer_id: customerId,
    vendor_id: vendorId,
    razorpay_order_id: razorpayOrder.id,
    amount: amt,
    currency: 'INR',
    payment_method: 'razorpay',
    payment_status: 'pending',
    payment_source: 'warmpawz_pay',
    metadata: {
      quotedOriginalAmount: quote.originalAmount,
      quotedDiscountAmount: quote.discountAmount,
      quotedDiscountPercent: quote.discountPercent,
    },
  });

  const row = Array.isArray(payRows) ? payRows[0] : payRows;
  const paymentId = row?.id != null ? String(row.id) : '';
  if (!paymentId) {
    throw new Error('Failed to create payment row');
  }

  return {
    orderId: razorpayOrder.id,
    amount: (razorpayOrder.amount ?? Math.round(amt * 100)) / 100,
    currency: razorpayOrder.currency || 'INR',
    keyId: config.keyId,
    paymentId,
  };
}
