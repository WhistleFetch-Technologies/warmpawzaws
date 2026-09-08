import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  getRawWebhookBody,
  parseRazorpayWebhookJson,
  verifyRazorpayWebhookRawSignature,
} from '../razorpay-webhook-hmac';

const SECRET = 'test-webhook-secret';

function sign(rawBody: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

const CAPTURED_RAW = JSON.stringify({
  id: 'evt_test_1',
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_test_1',
        order_id: 'order_test_1',
        status: 'captured',
      },
    },
  },
});

describe('verifyRazorpayWebhookRawSignature', () => {
  test('accepts HMAC over the exact raw body', () => {
    expect(verifyRazorpayWebhookRawSignature(CAPTURED_RAW, sign(CAPTURED_RAW), SECRET)).toEqual({
      ok: true,
    });
  });

  test('rejects missing signature', () => {
    expect(verifyRazorpayWebhookRawSignature(CAPTURED_RAW, undefined, SECRET)).toEqual({
      ok: false,
      reason: 'missing_signature',
    });
    expect(verifyRazorpayWebhookRawSignature(CAPTURED_RAW, '   ', SECRET)).toEqual({
      ok: false,
      reason: 'missing_signature',
    });
  });

  test('rejects invalid signature', () => {
    expect(verifyRazorpayWebhookRawSignature(CAPTURED_RAW, 'deadbeef', SECRET)).toEqual({
      ok: false,
      reason: 'invalid_signature',
    });
  });

  test('does not accept HMAC of JSON.parse then JSON.stringify', () => {
    const rawWithSpaces = '{ "event": "payment.captured", "id": "evt_1" }';
    const reSerialized = JSON.stringify(JSON.parse(rawWithSpaces));
    expect(reSerialized).not.toBe(rawWithSpaces);
    const wrong = sign(reSerialized);
    expect(verifyRazorpayWebhookRawSignature(rawWithSpaces, wrong, SECRET).ok).toBe(false);
    expect(verifyRazorpayWebhookRawSignature(rawWithSpaces, sign(rawWithSpaces), SECRET).ok).toBe(
      true
    );
  });
});

describe('parseRazorpayWebhookJson', () => {
  test('rejects malformed JSON', () => {
    expect(parseRazorpayWebhookJson('{not-json')).toEqual({ ok: false, reason: 'malformed_json' });
    expect(parseRazorpayWebhookJson('[]')).toEqual({ ok: false, reason: 'malformed_json' });
  });

  test('parses a captured event object', () => {
    const parsed = parseRazorpayWebhookJson(CAPTURED_RAW);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.body.event).toBe('payment.captured');
  });
});

describe('getRawWebhookBody', () => {
  test('returns the API Gateway string body unchanged', () => {
    expect(getRawWebhookBody({ body: CAPTURED_RAW })).toBe(CAPTURED_RAW);
  });

  test('decodes a base64 API Gateway body to the exact UTF-8 payload', () => {
    const encoded = Buffer.from(CAPTURED_RAW, 'utf8').toString('base64');
    expect(getRawWebhookBody({ body: encoded, isBase64Encoded: true })).toBe(CAPTURED_RAW);
  });
});

describe('canonical webhook route uses raw body HMAC', () => {
  const lambdaRoot = join(__dirname, '../../../..');
  const razorpay = readFileSync(
    join(lambdaRoot, 'src/endpoints/razorpay/endpoints/razorpay.razorpay.ts'),
    'utf8'
  );

  test('webhook route reads c.req.text and does not re-stringify before HMAC', () => {
    expect(razorpay).toContain("app.post('/razorpay/webhook'");
    expect(razorpay).toContain('const rawBody = await c.req.text()');
    expect(razorpay).toContain('createWebhookApiGatewayEvent');
    expect(razorpay).toContain('verifyRazorpayWebhookRawSignature');
    expect(razorpay).not.toMatch(
      /app\.post\('\/razorpay\/webhook'[\s\S]{0,400}JSON\.stringify\(body\)/
    );
  });
});
