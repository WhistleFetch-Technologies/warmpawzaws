import { createHmac } from 'crypto';
import { RazorpayWebhookHandler } from '../razorpay.razorpay';
import { getRazorpayConfig } from '../../../../utils/payments/razorpay-client';
import {
  finalizeCapturedPayment,
  recordRazorpayWebhookEvent,
} from '../../../../utils/payments/finalize-captured-payment';
import { withTransaction } from '../../../../database/rds-connection';

jest.mock('../../../../utils/payments/razorpay-client', () => ({
  getRazorpayConfig: jest.fn(),
  getRazorpayAuthHeader: jest.fn(),
  getRazorpayClient: jest.fn(),
  razorpayRequest: jest.fn(),
}));

jest.mock('../../../../utils/payments/finalize-captured-payment', () => ({
  finalizeCapturedPayment: jest.fn(),
  recordRazorpayWebhookEvent: jest.fn(),
}));

jest.mock('../../../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn().mockResolvedValue([]),
  insert: jest.fn(),
  update: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.mock('../../../../utils/payment-lifecycle-notifications', () => ({
  ensurePostPaymentLifecycleNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../utils/audit-log', () => ({
  logBookingStatusChange: jest.fn().mockResolvedValue(undefined),
}));

const SECRET = 'test-webhook-secret';
const PAYMENT_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  pharmacy_order_id: null,
  booking_id: null,
  vendor_id: 'vendor-1',
  payment_status: 'pending',
};

function sign(rawBody: string): string {
  return createHmac('sha256', SECRET).update(rawBody, 'utf8').digest('hex');
}

function capturedRaw(overrides?: { id?: string; paymentId?: string; orderId?: string }): string {
  return JSON.stringify({
    id: overrides?.id || 'evt_captured_1',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: overrides?.paymentId || 'pay_test_1',
          order_id: overrides?.orderId || 'order_test_1',
          status: 'captured',
        },
      },
    },
  });
}

function eventFor(rawBody: string, signature?: string) {
  return {
    httpMethod: 'POST',
    path: '/razorpay/webhook',
    headers: signature ? { 'x-razorpay-signature': signature } : {},
    body: rawBody,
    isBase64Encoded: false,
  };
}

async function run(rawBody: string, signature?: string) {
  const handler = new RazorpayWebhookHandler();
  return handler.execute(eventFor(rawBody, signature) as any, {
    awsRequestId: 'test-req',
  } as any);
}

describe('RazorpayWebhookHandler payment.captured', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRazorpayConfig as jest.Mock).mockResolvedValue({
      keyId: 'rzp_test_xxx',
      keySecret: 'key-secret',
      webhookSecret: SECRET,
    });
    (withTransaction as jest.Mock).mockImplementation(async (fn: (client: any) => Promise<void>) => {
      await fn({
        query: jest.fn().mockResolvedValue({ rows: [PAYMENT_ROW] }),
      });
    });
    (finalizeCapturedPayment as jest.Mock).mockResolvedValue({
      outcome: 'fulfilled',
      paymentId: PAYMENT_ROW.id,
      entityType: 'wpay',
      entityId: null,
    });
    (recordRazorpayWebhookEvent as jest.Mock).mockResolvedValue(undefined);
  });

  test('valid payment.captured is accepted and finalized without customer return', async () => {
    const raw = capturedRaw();
    const result = await run(raw, sign(raw));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Webhook processed');
    expect(finalizeCapturedPayment).toHaveBeenCalledTimes(1);
    expect(finalizeCapturedPayment).toHaveBeenCalledWith({
      source: 'webhook',
      razorpayOrderId: 'order_test_1',
      razorpayPaymentId: 'pay_test_1',
      paymentRowId: PAYMENT_ROW.id,
    });
    expect(recordRazorpayWebhookEvent).toHaveBeenCalledWith(
      'evt_captured_1',
      'payment.captured',
      PAYMENT_ROW.id
    );
  });

  test('invalid signature is rejected and payment is not finalized', async () => {
    const result = await run(capturedRaw(), 'not-a-valid-hmac');
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error).toBe('Invalid webhook signature');
    expect(finalizeCapturedPayment).not.toHaveBeenCalled();
    expect(recordRazorpayWebhookEvent).not.toHaveBeenCalled();
  });

  test('missing signature is rejected', async () => {
    const result = await run(capturedRaw());
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error).toBe('Missing webhook signature');
    expect(finalizeCapturedPayment).not.toHaveBeenCalled();
  });

  test('duplicate payment.captured is acknowledged without a second business outcome', async () => {
    const raw = capturedRaw();
    const first = await run(raw, sign(raw));
    expect(first.statusCode).toBe(200);

    (finalizeCapturedPayment as jest.Mock).mockResolvedValue({
      outcome: 'already_final',
      paymentId: PAYMENT_ROW.id,
      entityType: 'wpay',
      entityId: null,
    });

    const second = await run(raw, sign(raw));
    expect(second.statusCode).toBe(200);
    expect(finalizeCapturedPayment).toHaveBeenCalledTimes(2);
    expect(await (finalizeCapturedPayment as jest.Mock).mock.results[1].value).toEqual(
      expect.objectContaining({ outcome: 'already_final' })
    );
    expect(recordRazorpayWebhookEvent).toHaveBeenCalledTimes(2);
  });

  test('malformed JSON is rejected after HMAC of the exact raw body', async () => {
    const raw = '{not-json';
    const result = await run(raw, sign(raw));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Invalid JSON in webhook body');
    expect(finalizeCapturedPayment).not.toHaveBeenCalled();
  });
});
