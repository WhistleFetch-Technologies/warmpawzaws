import type { Context } from 'hono';
import { resolveWpayAuthenticatedCustomer } from '../shared/wpay-authenticated-customer';
import { dbWpayPaymentByIdForCustomer } from '../repos/wpay-payment.repo';
import { reconcileWpayRazorpayCapture } from '../shared/reconcile-wpay-razorpay-capture';
import { wpayVerifyResponse } from '../shared/fulfill-wpay-captured-payment';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function executeCustomerWarmpawzPayReconcilePost(c: Context) {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      paymentId?: string;
      phone?: string;
    };

    const paymentId = String(body.paymentId ?? '').trim();
    const phone = String(body.phone ?? c.req.query('phone') ?? '').trim();
    if (!UUID_RE.test(paymentId)) {
      return c.json({ success: false, error: 'Invalid payment id' }, 400);
    }
    if (!phone) {
      return c.json({ success: false, error: 'Phone is required' }, 400);
    }

    const identity = await resolveWpayAuthenticatedCustomer(c, phone);
    if (!identity.ok) {
      return c.json({ success: false, error: identity.error }, identity.status);
    }

    const existing = await dbWpayPaymentByIdForCustomer(paymentId, identity.customerId);
    if (!existing) {
      return c.json({ success: false, error: 'Payment not found' }, 404);
    }

    const completed = await reconcileWpayRazorpayCapture(existing, identity.customerId);
    if (!completed) {
      return c.json({ success: false, pending: true, error: 'Payment not captured yet' }, 409);
    }

    return c.json(wpayVerifyResponse(completed));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reconcile payment';
    console.error('[customer/warmpawz-pay/reconcile]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
