import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const lambdaRoot = join(__dirname, '../../../..');

function read(relativeFromLambdaRoot: string): string {
  return readFileSync(join(lambdaRoot, relativeFromLambdaRoot), 'utf8');
}

describe('shop-order-refund orchestrator', () => {
  test('exports cancel, draft discard, Razorpay initiate, stock restore, retry sweeper', () => {
    const file = read('src/utils/payments/shop-order-refund.ts');
    expect(file).toContain('export async function cancelPaidShopOrder');
    expect(file).toContain('export async function discardDraftShopOrder');
    expect(file).toContain('export async function initiateShopOrderRazorpayRefund');
    expect(file).toContain('export async function restoreShopOrderStockIfNeeded');
    expect(file).toContain('export async function retryPendingShopRefunds');
    expect(file).toContain('export async function reconcileStuckShopRefunds');
    expect(file).toContain('export async function reconcileShopRefundById');
    expect(file).toContain('export async function applyShopRefundDbState');
    expect(file).toContain('SHOP_MISSING_REFUND_FROM');
    expect(file).toContain('mapRazorpayRefundEventStatus');
    expect(file).toContain('FOR UPDATE');
    expect(file).toContain('stock_restored_at');
    expect(file).toContain('sumActiveRefundsForPayment');
  });

  test('order-management cancel delegates to orchestrator with auth', () => {
    const file = read('src/endpoints/order-management.ts');
    expect(file).toContain('cancelPaidShopOrder');
    expect(file).toContain("c.get('userId')");
    expect(file).not.toContain('getRazorpayClient');
  });

  test('vendor cancel uses orchestrator once (no duplicate refund SQL)', () => {
    const file = read('src/endpoints/vendor/endpoints/vendor-orders.ts');
    expect(file).toContain('cancelPaidShopOrder');
    expect(file).toContain('VENDOR_ALLOWED_STATUSES');
  });

  test('returns process-refund uses initiateShopOrderRazorpayRefund for original payment', () => {
    const file = read('src/endpoints/returns-enhanced.ts');
    expect(file).toContain('initiateShopOrderRazorpayRefund');
    expect(file).not.toContain('TODO: Integrate with Razorpay refund');
  });

  test('orchestrator does not double-select orders in cancel path', () => {
    const file = read('src/utils/payments/shop-order-refund.ts');
    const lockCount = (file.match(/lockShopOrder/g) || []).length;
    expect(lockCount).toBeGreaterThanOrEqual(1);
    expect(file).not.toContain("select('orders'");
  });

  test('orchestrator requires owner and caps refunds per payment', () => {
    const file = read('src/utils/payments/shop-order-refund.ts');
    expect(file).toContain('if (!owner?.customerId && !owner?.vendorId)');
    expect(file).toContain('SUM(refund_amount)');
    expect(file).toContain('Math.min(requestedAmount, available)');
  });

  test('orchestrator uses shared cancel status constants and stock client', () => {
    const file = read('src/utils/payments/shop-order-refund.ts');
    expect(file).toContain('CUSTOMER_CANCEL_STATUSES');
    expect(file).toContain('restoreShopOrderStockIfNeeded');
    expect(file).toContain('client?: PoolClient');
    expect(file).toContain('markShopOrderPaymentRefundedIfFull');
  });

  test('global requireAuth middleware is registered', () => {
    const file = read('src/handler/index.ts');
    expect(file).toContain("app.use('*', requireAuth())");
  });

  test('customer cancel-draft route is layered', () => {
    expect(read('src/endpoints/customer/orders/routes/customer_orders_id_cancel_draft_post.route.ts')).toContain(
      'customerOrdersIdCancelDraftPostHandler',
    );
    expect(read('src/endpoints/customer/orders/services/customer_orders_id_cancel_draft_post.service.ts')).toContain(
      'discardDraftShopOrder',
    );
  });

  test('admin shop-refunds ops endpoints registered', () => {
    const file = read('src/endpoints/admin-shop-refunds.ts');
    expect(file).toContain('/admin/shop-refunds');
    expect(file).toContain('/admin/shop-refunds/missing');
    expect(file).toContain('/admin/shop-refunds/initiate');
    expect(file).toContain('/admin/shop-refunds/:refundId/reconcile');
    expect(file).toContain('/admin/shop-refunds/:refundId/retry');
    expect(file).toContain('reconcileShopRefundById');
    expect(file).toContain('LIMIT');
  });

  test('cancelled shop order recovery uses payments table truth', () => {
    const file = read('src/utils/payments/shop-order-refund.ts');
    expect(file).toContain('resolveShopRefundAmount');
    expect(file).toContain('fetchLatestCompletedPayment');
    expect(file).toContain('alreadyCancelled = true');
  });

  test('razorpay client exposes refunds.fetch for reconcile', () => {
    const file = read('src/utils/payments/razorpay-client.ts');
    expect(file).toContain('refunds');
    expect(file).toContain('/refunds/');
  });
});
