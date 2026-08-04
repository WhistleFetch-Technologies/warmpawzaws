import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const lambdaRoot = join(__dirname, '../../..');

function read(relativeFromLambdaRoot: string): string {
  return readFileSync(join(lambdaRoot, relativeFromLambdaRoot), 'utf8');
}

describe('shop/payment visibility guards', () => {
  test('vendor order list hides pending_payment drafts and unpaid rows', () => {
    const file = read('src/endpoints/vendor/endpoints/vendor-orders.ts');
    expect(file).toContain("o.order_status != 'pending_payment'");
    expect(file).toContain('SQL_SHOP_ORDER_VENDOR_VISIBLE');
    expect(file).toContain("IN ('paid', 'completed')");
    expect(file).toContain("IN ('cod', 'cash_on_delivery')");
  });

  test('vendor stats require payment confirmed or COD', () => {
    const file = read('src/endpoints/vendor/endpoints/vendor-orders.ts');
    expect(file).toContain("AND order_status != 'pending_payment'");
    expect(file).toContain("LOWER(COALESCE(payment_status, '')) IN ('paid', 'completed')");
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
    expect(file).toContain('assertShopCheckoutPaymentAllowed');
  });

  test('customer orders create rejects disabled shop COD/wallet at API gate', () => {
    const file = read('src/endpoints/customer/orders/services/order-base-handlers.service.ts');
    expect(file).toContain('assertShopCheckoutPaymentAllowed');
  });

  test('razorpay paths promote pending_payment on pay; hold-aware discard on fail', () => {
    const file = read('src/endpoints/razorpay/endpoints/razorpay.razorpay.ts');
    expect(file).toContain('discardUnpaidShopOrder');
    expect(file).toContain("WHEN order_status = 'pending_payment' THEN 'pending'");
    expect(file).toContain('PAYMENT_HOLD_EXPIRED');
    expect(file).toContain('isShopOrderPaymentHoldActive');
    expect(file).toContain('hold still active');
    expect(file).toContain('SHOP_HOLD_EXPIRY_CANCEL_REASON');
    expect(file).toContain('reconcileShopOrderPayment');
    expect(file).toContain('isPaymentAbandonCancellationReason');
  });

  test('meal vendor fetch uses payment-confirmed visibility only', () => {
    const file = read('src/utils/fetch-vendor-meal-orders.ts');
    expect(file).toContain('SQL_MEAL_ORDER_VENDOR_VISIBLE');
    expect(file).not.toContain("'cancelled', 'failed'");
  });

  test('shop notifications skip vendor cancel for payment abandon', () => {
    const file = read('src/utils/shop-order-notifications.ts');
    expect(file).toContain('isPaymentAbandonCancellationReason');
    expect(file).toContain('isShopOrderVendorVisible');
  });

  test('customer order list exposes pending_payment and payment-resume', () => {
    const file = read('src/endpoints/customer/orders/services/order-base-handlers.service.ts');
    expect(file).toContain('expireShopPaymentHolds');
    expect(file).toContain('reconcilePendingShopPayments');
    expect(file).toContain('buildShopOrderPaymentResumeContext');
    expect(file).toContain('retryPendingShopRefunds');
    expect(file).toContain('ShopOrderPaymentReconcileHandler');
  });

  test('shop cancel/refund orchestrator wired in order-management and vendor-orders', () => {
    expect(read('src/endpoints/order-management.ts')).toContain('shop-order-refund');
    expect(read('src/endpoints/vendor/endpoints/vendor-orders.ts')).toContain('shop-order-refund');
    expect(read('src/utils/shop-payment-hold.ts')).toContain('cancelled_by');
  });

  test('customer cancel rejects non-customer non-vendor roles', () => {
    const file = read('src/endpoints/order-management.ts');
    expect(file).toContain("return c.json({ error: 'Forbidden' }, 403)");
  });

  test('PUT order status cancel delegates to cancelPaidShopOrder with customer status cap', () => {
    const file = read('src/endpoints/order-management.ts');
    expect(file).toContain("if (status === 'cancelled')");
    expect(file).toContain('CUSTOMER_CANCEL_STATUSES');
    expect(file).not.toContain("if (status === 'cancelled') {\n        updateData.cancelled_at");
  });

  test('shop order cancel resolves real customer UUID for UAT opaque tokens', () => {
    const orderMgmt = read('src/endpoints/order-management.ts');
    const cancelDraft = read(
      'src/endpoints/customer/orders/services/customer_orders_id_cancel_draft_post.service.ts',
    );
    expect(orderMgmt).toContain('resolveCustomerIdFromHonoContext');
    expect(cancelDraft).toContain('resolveCustomerIdFromHonoContext');
    expect(read('src/utils/customer-id-from-auth.ts')).toContain('resolvePostgresCustomerIdFromAuthHeaders');
  });

  test('shop order updates do not write delivery_status on orders table', () => {
    const vendorOrders = read('src/endpoints/vendor/endpoints/vendor-orders.ts');
    const shipmentSync = read('src/utils/logistics/shipment-order-sync.ts');
    expect(vendorOrders).not.toContain('delivery_status');
    expect(shipmentSync).not.toContain('delivery_status');
    expect(vendorOrders).toContain('syncShipmentDeliveredForOrder');
  });
});
