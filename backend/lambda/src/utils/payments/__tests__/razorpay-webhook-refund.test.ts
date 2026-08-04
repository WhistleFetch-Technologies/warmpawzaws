import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const lambdaRoot = join(__dirname, '../../../..');

function read(relativeFromLambdaRoot: string): string {
  return readFileSync(join(lambdaRoot, relativeFromLambdaRoot), 'utf8');
}

describe('razorpay refund webhook reconciliation', () => {
  test('webhook handler delegates to reconcile helper', () => {
    const razorpay = read('src/endpoints/razorpay/endpoints/razorpay.razorpay.ts');
    expect(razorpay).toContain('reconcileRazorpayRefundWebhook');
    expect(razorpay).not.toContain("refund.status === 'processed' ? 'processed'");
  });

  test('reconcile module uses refund_amount and orders.payment_status', () => {
    const file = read('src/utils/payments/razorpay-refund-webhook-reconcile.ts');
    expect(file).toContain('SUM(refund_amount)');
    expect(file).toContain('markShopOrderPaymentRefundedIfFull');
    expect(file).toContain('mapRazorpayRefundEventStatus');
    expect(file).not.toContain('SET amount =');
  });

  test('manual ProcessRefundHandler uses schema-correct refund columns', () => {
    const file = read('src/endpoints/razorpay/endpoints/razorpay.razorpay.ts');
    expect(file).toContain('refund_amount, refund_reason');
    expect(file).toContain('mapRazorpayRefundEventStatus');
    expect(file).toContain('ACTIVE_REFUND_STATUS_FILTER');
  });

  test('payment.captured auto-refunds cancelled shop orders with no active refund', () => {
    const file = read('src/endpoints/razorpay/endpoints/razorpay.razorpay.ts');
    expect(file).toContain('cancelledShopOrderLateRefund');
    expect(file).toContain('initiateShopOrderRazorpayRefund');
    expect(file).toContain('Late payment capture on cancelled shop order');
  });

  test('reconcile helper is idempotent when refund already completed', () => {
    const file = read('src/utils/payments/shop-order-refund.ts');
    expect(file).toContain("if (row.refund_status === 'completed')");
    expect(file).toContain('applyShopRefundDbState');
  });
});
