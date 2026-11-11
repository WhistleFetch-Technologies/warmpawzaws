/**
 * Batch 4 — logging redaction, secure logger, correlation IDs, Sentry sanitization.
 */
import { Hono } from 'hono';
import {
  redactSecretsForLog,
  sanitizeErrorForLog,
  sanitizeValueForLog,
  sanitizeSentryEvent,
} from '../safe-hono-error';
import { secureLog, secureLogError } from '../secure-logger';
import { logSecurityEvent } from '../security-event-log';
import { redactForLog, logErrorSafe } from '../redact-for-log';
import {
  isValidCorrelationId,
  resolveCorrelationId,
  resolveRequestIdForError,
  requestCorrelationMiddleware,
  CORRELATION_HEADER,
  type WarmpawzRequestVariables,
} from '../../middleware/request-correlation-middleware';
import { setUserContext, addBreadcrumb, captureException } from '../error-tracking';
import { SAFE_INTERNAL_ERROR_MESSAGE } from '../safe-hono-error';

describe('Batch 4 redaction — secrets and PII', () => {
  it('redacts password / JWT / bearer / OTP / API keys', () => {
    const out = redactSecretsForLog(
      'password=Secret123 Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb otp=123456 api_key=sk_live_abc',
    );
    expect(out).not.toMatch(/Secret123/);
    expect(out).not.toMatch(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.aaa\.bbb/);
    expect(out).not.toMatch(/123456/);
    expect(out).not.toMatch(/sk_live_abc/);
  });

  it('redacts cookie, bank/account, card labels', () => {
    const out = redactSecretsForLog(
      'Cookie: session=abc123; account_number=123456789012 card_number=4111111111111111 cvv=123',
    );
    expect(out.toLowerCase()).not.toContain('abc123');
    expect(out).not.toMatch(/123456789012/);
    expect(out).not.toMatch(/4111111111111111/);
  });

  it('redacts DB connection string passwords', () => {
    const out = redactSecretsForLog('postgres://admin:SuperSecret@db.internal:5432/warmpawz');
    expect(out).not.toMatch(/SuperSecret/);
    expect(out).toMatch(/\[REDACTED\]/);
  });

  it('redacts phone and email in strings', () => {
    const out = redactSecretsForLog('phone=+919876543210 email=customer@example.com');
    expect(out).not.toMatch(/9876543210/);
    expect(out).not.toMatch(/customer@example\.com/);
  });

  it('hostile probe: unlabeled sk_live / bare phone / customer_mobile / notes free-text', () => {
    expect(redactSecretsForLog('gateway key sk_live_example_secret used')).not.toMatch(
      /sk_live_example_secret/,
    );
    expect(redactSecretsForLog('caller 9876543210 failed')).not.toMatch(/9876543210/);
    const obj = sanitizeValueForLog({
      customer_mobile: '+919999999999',
      notes: 'sk_live_in_notes_abc and +918888888888',
    }) as any;
    expect(obj.customer_mobile).toBe('[REDACTED]');
    expect(String(obj.notes)).not.toMatch(/sk_live_in_notes_abc/);
    expect(String(obj.notes)).not.toMatch(/\+918888888888|8888888888/);
  });

  it('does not over-redact short numeric ids / HTTP status', () => {
    expect(redactSecretsForLog('status=500 SQLSTATE 42P01 id=12345')).toMatch(/500/);
    expect(redactSecretsForLog('status=500 SQLSTATE 42P01 id=12345')).toMatch(/42P01/);
    expect(redactSecretsForLog('status=500 SQLSTATE 42P01 id=12345')).toMatch(/12345/);
  });

  it('sanitizeValueForLog redacts nested sensitive keys including medical/prescription', () => {
    const out = sanitizeValueForLog({
      password: 'x',
      phone: '+919999999999',
      email: 'a@b.com',
      prescription: { notes: 'secret diagnosis' },
      medical_record: { id: 'm1' },
      bank_details: { account_number: '999' },
      nested: [{ refresh_token: 'tok', ok: true }],
    }) as any;
    expect(out.password).toBe('[REDACTED]');
    expect(out.phone).toBe('[REDACTED]');
    expect(out.email).toBe('[REDACTED]');
    expect(out.prescription).toBe('[REDACTED]');
    expect(out.medical_record).toBe('[REDACTED]');
    expect(out.bank_details).toBe('[REDACTED]');
    expect(out.nested[0].refresh_token).toBe('[REDACTED]');
    expect(out.nested[0].ok).toBe(true);
  });

  it('handles circular references without throwing', () => {
    const a: any = { name: 'a' };
    a.self = a;
    expect(() => sanitizeValueForLog(a)).not.toThrow();
  });

  it('sanitizeErrorForLog strips secrets from message/stack', () => {
    const err = new Error('failed password=hunter2 Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb');
    err.stack = 'Error: password=hunter2\n    at Object.<anonymous> (/app/src/x.ts:1:1)';
    const safe = sanitizeErrorForLog(err);
    expect(safe.message).not.toMatch(/hunter2/);
    expect(safe.stack || '').not.toMatch(/hunter2/);
  });

  it('redactForLog / logErrorSafe do not emit raw secrets', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logErrorSafe('test', new Error('otp=999999 password=leak'));
    expect(spy).toHaveBeenCalled();
    const logged = String(spy.mock.calls[0][0]);
    expect(logged).not.toMatch(/999999/);
    expect(logged).not.toMatch(/password=leak/);
    spy.mockRestore();
  });
});

describe('Batch 4 secureLog / security events', () => {
  it('secureLogError does not print raw Error object', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    secureLogError('unit', new Error('SQLSTATE 42P01 relation users password=Secret123'), {
      requestId: 'req-1',
      phone: '+911111111111',
    });
    const line = String(spy.mock.calls[0][0]);
    expect(line).toMatch(/"level":"ERROR"/);
    expect(line).not.toMatch(/Secret123/);
    expect(line).not.toMatch(/\+911111111111/);
    expect(line).toMatch(/req-1/);
    spy.mockRestore();
  });

  it('secureLog sanitizes providerBody context', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    secureLog('error', 'provider failed', {
      providerBody: 'Authorization: Bearer secret-token otp=121212',
    });
    const line = String(spy.mock.calls[0][0]);
    expect(line).not.toMatch(/secret-token/);
    expect(line).not.toMatch(/121212/);
    spy.mockRestore();
  });

  it('logSecurityEvent emits structured event without PII keys leaking values', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logSecurityEvent({
      eventType: 'AUTHZ_DENIAL',
      outcome: 'denied',
      reasonCategory: 'FORBIDDEN',
      actorCategory: 'customer',
      actorId: '11111111-1111-4111-8111-111111111111',
      resourceCategory: 'medical_record',
      resourceId: 'rec-1',
      requestId: 'corr-1',
      path: '/medical-records/x',
      method: 'GET',
    });
    const line = String(spy.mock.calls[0][0]);
    expect(line).toMatch(/security_event:AUTHZ_DENIAL/);
    expect(line).toMatch(/corr-1/);
    spy.mockRestore();
  });
});

describe('Batch 4 correlation IDs', () => {
  it('rejects invalid / oversized / PII-like inbound IDs', () => {
    expect(isValidCorrelationId('short')).toBe(false);
    expect(isValidCorrelationId('a'.repeat(100))).toBe(false);
    expect(isValidCorrelationId('phone=+919876543210')).toBe(false);
    expect(isValidCorrelationId('Bearer abcdefghijklmnop')).toBe(false);
    expect(isValidCorrelationId('not a uuid!!')).toBe(false);
  });

  it('accepts UUID and generates when inbound invalid', () => {
    const uuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    expect(isValidCorrelationId(uuid)).toBe(true);
    expect(resolveCorrelationId(uuid)).toBe(uuid);
    const generated = resolveCorrelationId('bad');
    expect(isValidCorrelationId(generated)).toBe(true);
    expect(generated).not.toBe('bad');
  });

  it('middleware sets context and response header', async () => {
    const app = new Hono<{ Variables: WarmpawzRequestVariables }>();
    app.use('*', requestCorrelationMiddleware());
    app.get('/ping', (c) =>
      c.json({ requestId: c.get('requestId'), correlationId: c.get('correlationId') }),
    );
    const res = await app.request('http://localhost/ping', {
      headers: { [CORRELATION_HEADER]: 'not-valid' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(isValidCorrelationId(body.requestId)).toBe(true);
    expect(res.headers.get(CORRELATION_HEADER)).toBe(body.requestId);
  });

  it('middleware reuses valid inbound id', async () => {
    const app = new Hono<{ Variables: WarmpawzRequestVariables }>();
    app.use('*', requestCorrelationMiddleware());
    app.get('/ping', (c) => c.json({ requestId: c.get('requestId') }));
    const inbound = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
    const res = await app.request('http://localhost/ping', {
      headers: { [CORRELATION_HEADER]: inbound },
    });
    const body = (await res.json()) as any;
    expect(body.requestId).toBe(inbound);
    expect(res.headers.get(CORRELATION_HEADER)).toBe(inbound);
  });

  it('onError-style resolve rejects invalid/oversized/injection inbound IDs', async () => {
    const app = new Hono<{ Variables: WarmpawzRequestVariables }>();
    // Intentionally skip correlation middleware to simulate missing context.
    app.onError((_err, c) => {
      const requestId = resolveRequestIdForError(c);
      return c.json(
        { error: SAFE_INTERNAL_ERROR_MESSAGE, requestId },
        500,
        { [CORRELATION_HEADER]: requestId },
      );
    });
    app.get('/boom', () => {
      throw new Error('password=SecretBoom sk_live_boomkey otp=121212');
    });

    const bad = await app.request('http://localhost/boom', {
      headers: { [CORRELATION_HEADER]: 'phone=+919876543210;injected' },
    });
    expect(bad.status).toBe(500);
    const badBody = (await bad.json()) as any;
    expect(isValidCorrelationId(badBody.requestId)).toBe(true);
    expect(badBody.requestId).not.toMatch(/phone|9876543210|injected/i);
    expect(bad.headers.get(CORRELATION_HEADER)).toBe(badBody.requestId);

    const oversized = await app.request('http://localhost/boom', {
      headers: { [CORRELATION_HEADER]: 'a'.repeat(200) },
    });
    const oversizedBody = (await oversized.json()) as any;
    expect(isValidCorrelationId(oversizedBody.requestId)).toBe(true);
    expect(oversizedBody.requestId.length).toBeLessThanOrEqual(64);

    // Direct unit check for control-character / CRLF injection payloads
    expect(isValidCorrelationId('abc\ninjected')).toBe(false);
    expect(resolveCorrelationId('Bearer eyJ.fake.token')).not.toMatch(/Bearer|eyJ/);
  });
});

describe('Batch 4 error-tracking / Sentry hygiene', () => {
  it('setUserContext and addBreadcrumb sanitize additional data', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    setUserContext('user-1', 'admin', { password: 'nope', authorization: 'Bearer x' });
    addBreadcrumb('step', 'auth', 'info', { otp: '123456', token: 'abc' });
    const joined = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(joined).not.toMatch(/nope/);
    expect(joined).not.toMatch(/Bearer x/);
    expect(joined).not.toMatch(/123456/);
    logSpy.mockRestore();
  });

  it('captureException emits sanitized JSON (no raw password)', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    captureException(new Error('boom password=SecretXYZ'), {
      requestId: 'r1',
      authorization: 'Bearer leak',
    });
    const line = String(spy.mock.calls[0][0]);
    expect(line).toMatch(/"level":"ERROR"/);
    expect(line).not.toMatch(/SecretXYZ/);
    expect(line).not.toMatch(/Bearer leak/);
    spy.mockRestore();
  });

  it('sanitizeSentryEvent redacts headers/cookies/body', () => {
    const event = sanitizeSentryEvent({
      message: 'password=abc',
      request: {
        cookies: 'a=b',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        data: { otp: '111111', name: 'ok' },
      },
      exception: { values: [{ value: 'otp=222222' }] },
    });
    expect(event.request.cookies).toBeUndefined();
    expect(event.request.headers.Authorization).toBe('[REDACTED]');
    expect(event.request.data.otp).toBe('[REDACTED]');
    expect(event.exception.values[0].value).not.toMatch(/222222/);
  });

  it('sanitizeSentryEvent redacts independent hostile payloads', () => {
    const event = sanitizeSentryEvent({
      message: 'gateway key sk_live_example_secret used caller 9876543210',
      extra: {
        customer_mobile: '+919999999999',
        notes: 'sk_live_in_notes_abc and +918888888888',
      },
      exception: {
        values: [{ value: 'notes sk_live_boom and phone +919876543210' }],
      },
      breadcrumbs: [
        {
          message: 'otp flow sk_test_abc123',
          data: { customer_mobile: '+911234567890' },
        },
      ],
    });
    expect(event.message).not.toMatch(/sk_live_example_secret|9876543210/);
    expect(JSON.stringify(event.extra)).not.toMatch(/9999999999|sk_live_in_notes_abc|8888888888/);
    expect(event.exception.values[0].value).not.toMatch(/sk_live_boom|9876543210/);
    expect(JSON.stringify(event.breadcrumbs)).not.toMatch(/sk_test_abc123|1234567890/);
  });
});

describe('Batch 4 source contracts — high-risk modules', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const root = path.join(__dirname, '../..');

  it('handler wires correlation, typed context, and secure outer error logging', () => {
    const src = fs.readFileSync(path.join(root, 'handler/index.ts'), 'utf8');
    expect(src).toMatch(/requestCorrelationMiddleware/);
    expect(src).toMatch(/hono-variables/);
    expect(src).toMatch(/resolveRequestIdForError/);
    expect(src).toMatch(/secureLogError\(/);
    expect(src).not.toMatch(/console\.error\('Lambda handler error:', error\)/);
    expect(src).not.toMatch(/c\.req\.header\('x-request-id'\)\s*\|\|/);
    const typing = fs.readFileSync(path.join(root, 'types/hono-variables.d.ts'), 'utf8');
    expect(typing).toMatch(/interface ContextVariableMap/);
    expect(typing).toMatch(/requestId:\s*string/);
    expect(typing).toMatch(/correlationId:\s*string/);
  });

  it('auth middleware does not log token prefixes', () => {
    const src = fs.readFileSync(path.join(root, 'middleware/auth-middleware.ts'), 'utf8');
    expect(src).not.toMatch(/token\.substring\(0,\s*30\)/);
    expect(src).toMatch(/Bearer present \(len=/);
  });

  it('medical-records uses secure logging for catch and residual warns', () => {
    const src = fs.readFileSync(path.join(root, 'endpoints/medical-records.ts'), 'utf8');
    expect(src).toMatch(/secureLogError/);
    expect(src).toMatch(/secureLog\('warn'/);
    expect(src).not.toMatch(/console\.error\(['"]Error fetching medical records:/);
    expect(src).not.toMatch(/console\.warn\('[^']*',\s*(prescErr|notifError|medicalError|prescError)/);
  });
});
