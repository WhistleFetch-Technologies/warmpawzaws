import { createHmac } from 'crypto';

export type RazorpayWebhookHmacResult =
  | { ok: true }
  | { ok: false; reason: 'missing_signature' | 'invalid_signature' };

/**
 * Razorpay signs the exact raw HTTP body. Never HMAC a parsed+restringified JSON object.
 */
export function verifyRazorpayWebhookRawSignature(
  rawBody: string,
  signature: string | undefined | null,
  webhookSecret: string
): RazorpayWebhookHmacResult {
  const trimmed = typeof signature === 'string' ? signature.trim() : '';
  if (!trimmed) {
    return { ok: false, reason: 'missing_signature' };
  }

  const expected = createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('hex');
  if (trimmed !== expected) {
    return { ok: false, reason: 'invalid_signature' };
  }
  return { ok: true };
}

export function parseRazorpayWebhookJson(rawBody: string):
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; reason: 'malformed_json' } {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, reason: 'malformed_json' };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, reason: 'malformed_json' };
  }
}

export function getRazorpayWebhookSignature(headers: Record<string, string | undefined>): string | undefined {
  return (
    headers['x-razorpay-signature'] ||
    headers['X-Razorpay-Signature'] ||
    headers['X-RAZORPAY-SIGNATURE']
  );
}

export function getRawWebhookBody(event: { body?: string | null; isBase64Encoded?: boolean }): string {
  if (!event.body) return '';
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf8');
  }
  return event.body;
}

export function webhookCorrelation(body: Record<string, unknown>): {
  eventId: string | null;
  eventType: string | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
} {
  const payload = (body.payload && typeof body.payload === 'object' ? body.payload : {}) as Record<
    string,
    unknown
  >;
  const payment = (payload.payment && typeof payload.payment === 'object' ? payload.payment : {}) as Record<
    string,
    unknown
  >;
  const entity = (payment.entity && typeof payment.entity === 'object' ? payment.entity : {}) as Record<
    string,
    unknown
  >;
  return {
    eventId: typeof body.id === 'string' ? body.id : null,
    eventType: typeof body.event === 'string' ? body.event : null,
    razorpayPaymentId: typeof entity.id === 'string' ? entity.id : null,
    razorpayOrderId: typeof entity.order_id === 'string' ? entity.order_id : null,
  };
}
