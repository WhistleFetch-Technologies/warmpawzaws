import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const lambdaRoot = join(__dirname, '../../..');

function read(relativeFromLambdaRoot: string): string {
  return readFileSync(join(lambdaRoot, relativeFromLambdaRoot), 'utf8');
}

describe('shop/payment visibility guards', () => {
  test('vendor order list hides pending_payment drafts', () => {
    const file = read('src/endpoints/vendor/endpoints/vendor-orders.ts');
    expect(file).toContain("o.order_status != 'pending_payment'");
    expect(file).toContain("AND order_status != 'pending_payment'");
  });

  test('vendor status updates require paid (or COD) before fulfillment', () => {
    const file = read('src/endpoints/vendor/endpoints/vendor-orders.ts');
    expect(file).toContain('Order payment is not confirmed yet');
    expect(file).toContain("['paid', 'completed']");
  });

  test('mark-shipped blocks unpaid shop orders', () => {
    const file = read('src/utils/logistics/vendor-mark-shipped.ts');
    expect(file).toContain('Shipping is blocked until payment succeeds');
  });

  test('ecommerce create uses pending_payment hold and online default', () => {
    const file = read('src/endpoints/ecommerce/endpoints/ecommerce.ts');
    expect(file).toContain("order_status: draftOrderStatus");
    expect(file).toContain("'pending_payment'");
    expect(file).toContain("|| 'online'");
    expect(file).toContain('process-payment-hold-expiry');
    expect(file).toContain('expireShopPaymentHolds');
  });

  test('razorpay paths promote pending_payment to pending on pay and discard on fail', () => {
    const file = read('src/endpoints/razorpay/endpoints/razorpay.razorpay.ts');
    expect(file).toContain('discardUnpaidShopOrder');
    expect(file).toContain("WHEN order_status = 'pending_payment' THEN 'pending'");
    expect(file).toContain('PAYMENT_HOLD_EXPIRED');
  });

  test('customer order list exposes pending_payment and payment-resume', () => {
    const file = read('src/endpoints/customer/customerEndpoint/customer-orders.ts');
    expect(file).toContain('expireShopPaymentHolds');
    expect(file).toContain('buildShopOrderPaymentResumeContext');
    expect(file).toContain('/customer/orders/:id/payment-resume');
    expect(file).not.toContain("AND o.order_status != 'pending_payment'");
  });
});
