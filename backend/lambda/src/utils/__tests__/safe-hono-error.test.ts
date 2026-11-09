import { HTTPException } from 'hono/http-exception';
import {
  SAFE_INTERNAL_ERROR_MESSAGE,
  clientErrorBodyLooksUnsafe,
  mapHonoThrownErrorToClientResponse,
  publicMessageForHttpStatus,
  redactSecretsForLog,
  sanitizeErrorForLog,
  sanitizeSentryEvent,
  sanitizeValueForLog,
} from '../safe-hono-error';

function assertNotContainsSecret(haystack: unknown, secret: string) {
  expect(JSON.stringify(haystack)).not.toContain(secret);
}

function assertSafeBody(body: unknown) {
  expect(clientErrorBodyLooksUnsafe(body)).toBe(false);
  const s = JSON.stringify(body);
  expect(s).not.toMatch(/stack/i);
  expect(s).not.toMatch(/SQLSTATE/i);
  expect(s).not.toMatch(/DB_HOST/i);
  expect(s).not.toMatch(/security group/i);
  expect(s).not.toMatch(/VPC/i);
  expect(s).not.toContain('secret-token-value');
  expect(s).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
}

describe('mapHonoThrownErrorToClientResponse — generic / DB exceptions', () => {
  it('returns generic 500 for Error', () => {
    const res = mapHonoThrownErrorToClientResponse(new Error('boom'), '/api/anything');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: SAFE_INTERNAL_ERROR_MESSAGE });
    assertSafeBody(res.body);
  });

  it('returns generic 500 for PostgreSQL-like errors without SQL details', () => {
    const err = new Error(
      'error: relation "medical_records" does not exist — SQLSTATE 42P01 SELECT * FROM medical_records',
    );
    (err as any).code = '42P01';
    const res = mapHonoThrownErrorToClientResponse(err, '/medical-records/x');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: SAFE_INTERNAL_ERROR_MESSAGE });
    assertSafeBody(res.body);
    expect(JSON.stringify(res.body)).not.toContain('medical_records');
    expect(JSON.stringify(res.body)).not.toContain('42P01');
  });

  it('returns generic 500 for missing column errors without column name', () => {
    const err = new Error('column "is_immutable" does not exist');
    const res = mapHonoThrownErrorToClientResponse(err, '/medical-records/abc');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('is_immutable');
    assertSafeBody(res.body);
  });

  it('returns generic 500 for connection/pool errors without infrastructure details', () => {
    const err = new Error(
      'Database connection acquisition timed out. Check VPC/security group. DB_HOST=warmpawz-dev-cluster.xxx',
    );
    const res = mapHonoThrownErrorToClientResponse(err, '/wallet/balance');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/VPC|DB_HOST|security group/i);
    assertSafeBody(res.body);
  });

  it('does not leak secrets/tokens present in Error.message', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const err = new Error(`Auth failed Bearer ${jwt} secret-token-value`);
    const res = mapHonoThrownErrorToClientResponse(err, '/auth/me');
    expect(res.status).toBe(500);
    assertSafeBody(res.body);
  });

  it('does not include stack in response for errors with stack', () => {
    const err = new Error('fail');
    err.stack = 'Error: fail\n    at Object.<anonymous> (/var/task/handler.js:1:1)';
    const res = mapHonoThrownErrorToClientResponse(err, '/x');
    expect(JSON.stringify(res.body)).not.toMatch(/handler\.js|stack/i);
    assertSafeBody(res.body);
  });

  it('handles unknown non-Error throws safely', () => {
    const res = mapHonoThrownErrorToClientResponse({ weird: true }, '/x');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: SAFE_INTERNAL_ERROR_MESSAGE });
    assertSafeBody(res.body);
  });
});

describe('HTTPException status preservation', () => {
  const cases: Array<[number, string]> = [
    [400, 'Bad Request'],
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
    [404, 'Not Found'],
    [405, 'Method Not Allowed'],
  ];

  it.each(cases)('HTTPException %i stays %i with safe public message', (status, msg) => {
    const err = new HTTPException(status as any, {
      message: `internal leak: relation "secret_table" SQLSTATE 42P01`,
    });
    const res = mapHonoThrownErrorToClientResponse(err, '/protected');
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error: msg });
    expect(JSON.stringify(res.body)).not.toContain('secret_table');
    expect(JSON.stringify(res.body)).not.toContain('SQLSTATE');
    assertSafeBody(res.body);
  });

  it('HTTPException 500 becomes generic Internal Server Error', () => {
    const err = new HTTPException(500, { message: 'column "password_hash" leaked' });
    const res = mapHonoThrownErrorToClientResponse(err, '/x');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: SAFE_INTERNAL_ERROR_MESSAGE });
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });
});

describe('degraded path responses do not embed raw exception text', () => {
  it('profile/unified degraded has no raw error', () => {
    const err = new Error('relation "customers" does not exist SQLSTATE 42P01');
    const res = mapHonoThrownErrorToClientResponse(err, '/customer/profile/unified');
    expect(res.status).toBe(200);
    expect(res.body._degraded).toBe(true);
    expect(res.body.profile).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('customers');
    expect(JSON.stringify(res.body)).not.toContain('42P01');
    expect(res.body.error).toBeUndefined();
    assertSafeBody(res.body);
  });

  it('appointments list degraded has no raw error', () => {
    const err = new Error('column "foo" does not exist');
    const res = mapHonoThrownErrorToClientResponse(err, '/customer/appointments');
    expect(res.status).toBe(200);
    expect(res.body._degraded).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('foo');
    expect(res.body.error).toBeUndefined();
  });

  it('appointment detail degraded 404 has no raw message', () => {
    const err = new Error('DB_HOST=prod-cluster VPC failure');
    const res = mapHonoThrownErrorToClientResponse(err, '/appointment/abc-123');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Appointment not found', _degraded: true });
    expect(JSON.stringify(res.body)).not.toMatch(/DB_HOST|VPC/);
  });

  it('categories degraded uses generic message', () => {
    const err = new Error('operator does not exist: uuid = text');
    const res = mapHonoThrownErrorToClientResponse(err, '/service-catalog/categories');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Service categories temporarily unavailable');
    expect(JSON.stringify(res.body)).not.toContain('uuid = text');
  });
});

describe('Stage 1.1 redactSecretsForLog coverage matrix', () => {
  const longJwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
  const shortJwt = 'eyJhbGciOiJIUzI1NiJ9.test.signature';

  it('redacts long JWT', () => {
    const out = redactSecretsForLog(`token=${longJwt}`);
    expect(out).not.toContain(longJwt);
    expect(out).toContain('[REDACTED_JWT]');
  });

  it('redacts short JWT-like token', () => {
    const out = redactSecretsForLog(shortJwt);
    expect(out).not.toContain(shortJwt);
    expect(out).toBe('[REDACTED_JWT]');
  });

  it('redacts Bearer token', () => {
    const out = redactSecretsForLog('Bearer secret-token-123');
    expect(out).not.toContain('secret-token-123');
    expect(out).toBe('Bearer [REDACTED]');
  });

  it('redacts Authorization header', () => {
    const out = redactSecretsForLog('Authorization: Bearer secret123');
    expect(out).not.toContain('secret123');
  });

  it('redacts refresh_token', () => {
    const out = redactSecretsForLog('refresh_token=refresh-secret-123');
    expect(out).not.toContain('refresh-secret-123');
  });

  it('redacts refreshToken camelCase', () => {
    const out = redactSecretsForLog('refreshToken: refresh-secret-123');
    expect(out).not.toContain('refresh-secret-123');
  });

  it('redacts JSON password', () => {
    const out = redactSecretsForLog('"password":"MySecretPassword123"');
    expect(out).not.toContain('MySecretPassword123');
  });

  it('redacts Password with different casing', () => {
    const out = redactSecretsForLog('PASSWORD=MySecretPassword123');
    expect(out).not.toContain('MySecretPassword123');
  });

  it('redacts five-digit OTP', () => {
    const out = redactSecretsForLog('otp=12345');
    expect(out).not.toContain('12345');
  });

  it('redacts six-digit OTP', () => {
    const out = redactSecretsForLog('otp: 123456');
    expect(out).not.toContain('123456');
  });

  it('redacts API key', () => {
    const out = redactSecretsForLog('api_key=sk_test_secret123');
    expect(out).not.toContain('sk_test_secret123');
  });

  it('redacts AWS access key', () => {
    const outField = redactSecretsForLog('AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE');
    expect(outField).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(outField).toMatch(/\[REDACTED/);
    const outBare = redactSecretsForLog('key material AKIAIOSFODNN7EXAMPLE in log');
    expect(outBare).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(outBare).toContain('[REDACTED_AWS_KEY]');
  });

  it('redacts AWS secret key field', () => {
    const secret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    const out = redactSecretsForLog(`aws_secret_access_key=${secret}`);
    expect(out).not.toContain(secret);
  });

  it('redacts AWS session token field', () => {
    const tok = 'FwoGZXIvYXdzEH4AEXAMPLESESSIONTOKENVALUE123';
    const out = redactSecretsForLog(`aws_session_token=${tok}`);
    expect(out).not.toContain(tok);
  });

  it('redacts PostgreSQL URL password', () => {
    const out = redactSecretsForLog(
      'postgresql://user:SecretPass99@warmpawz-dev.cluster-xxx.ap-south-1.rds.amazonaws.com:5432/warmpawz',
    );
    expect(out).not.toContain('SecretPass99');
    expect(out).toContain('postgresql://user:[REDACTED]@');
  });

  it('redacts encoded DB password', () => {
    const out = redactSecretsForLog('postgres://u:p%40ss%21word@host:5432/db');
    expect(out).not.toContain('p%40ss%21word');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts phone number when identified as PII', () => {
    const out = redactSecretsForLog('phone=+919876543210');
    expect(out).not.toContain('9876543210');
  });

  it('redacts email address', () => {
    const out = redactSecretsForLog('email=customer.test@example.com');
    expect(out).not.toContain('customer.test@example.com');
    expect(out).toContain('[REDACTED_EMAIL]');
  });

  it('redacts JWT inside stack', () => {
    const stack = `Error: bad\n    at Object.<anonymous> (/var/task/handler.js:12:3)\n token ${shortJwt}`;
    const out = redactSecretsForLog(stack);
    expect(out).not.toContain(shortJwt);
    expect(out).toContain('/var/task/handler.js:12:3');
  });

  it('redacts DB credentials inside stack', () => {
    const stack =
      'Error: connect ECONNREFUSED\n    at connect (postgres://admin:SuperSecret99@db.host/warmpawz)';
    const out = redactSecretsForLog(stack);
    expect(out).not.toContain('SuperSecret99');
    expect(out).toContain('ECONNREFUSED');
  });
});

describe('sanitizeErrorForLog nested cause', () => {
  it('redacts nested error cause without mutating original', () => {
    const cause = new Error('password=NestedSecret99');
    const err = new Error(`Bearer tok-abc-999 postgresql://u:DbPass1@h/db`);
    (err as Error & { cause?: unknown }).cause = cause;
    err.stack = `Error: Bearer tok-abc-999\n    at run (/var/task/handler.js:9:1)`;

    const sanitized = sanitizeErrorForLog(err);
    expect(sanitized.message).not.toContain('tok-abc-999');
    expect(sanitized.message).not.toContain('DbPass1');
    expect(sanitized.stack).not.toContain('tok-abc-999');
    expect(JSON.stringify(sanitized.cause)).not.toContain('NestedSecret99');
    // original untouched
    expect(err.message).toContain('tok-abc-999');
    expect(cause.message).toContain('NestedSecret99');
  });
});

describe('sanitizeSentryEvent', () => {
  it('redacts exception message, stack frames, headers, breadcrumbs, extra/context', () => {
    const secretJwt = 'eyJhbGciOiJIUzI1NiJ9.test.signature';
    const event = {
      message: `boom ${secretJwt}`,
      request: {
        headers: {
          Authorization: 'Bearer sentry-secret-token',
          'X-UAT-Token': 'uat-leak',
          'content-type': 'application/json',
        },
        query_string: 'phone=9876543210&otp=654321',
        cookies: { session: 'cookie-secret' },
        data: { password: 'SentryPass99', ok: true },
      },
      user: { email: 'customer.test@example.com', id: 'user-1' },
      extra: { api_key: 'sk_extra_secret', statusCode: 500 },
      contexts: { custom: { refresh_token: 'refresh-secret-xyz' } },
      breadcrumbs: [
        { message: `otp=112233`, data: { authorization: 'Bearer crumb-secret' } },
      ],
      exception: {
        values: [
          {
            type: 'Error',
            value: `failed password=SentryPass99 ${secretJwt}`,
            stacktrace: {
              frames: [
                {
                  filename: '/var/task/handler.js',
                  function: 'onError',
                  lineno: 42,
                  context_line: `throw new Error("Bearer stack-secret-99")`,
                  vars: { token: secretJwt, password: 'frame-pass' },
                },
              ],
            },
          },
        ],
      },
      tags: { errorType: 'Error', path: '/orders' },
    };

    const out = sanitizeSentryEvent(event);
    const blob = JSON.stringify(out);
    assertNotContainsSecret(out, secretJwt);
    assertNotContainsSecret(out, 'sentry-secret-token');
    assertNotContainsSecret(out, 'uat-leak');
    assertNotContainsSecret(out, 'SentryPass99');
    assertNotContainsSecret(out, '9876543210');
    assertNotContainsSecret(out, '654321');
    assertNotContainsSecret(out, 'customer-secret');
    assertNotContainsSecret(out, 'sk_extra_secret');
    assertNotContainsSecret(out, 'refresh-secret-xyz');
    assertNotContainsSecret(out, 'customer-secret');
    assertNotContainsSecret(out, 'stack-secret-99');
    assertNotContainsSecret(out, 'frame-pass');
    assertNotContainsSecret(out, 'customer.test@example.com');
    expect(out.request.cookies).toBeUndefined();
    // safe diagnostics retained
    expect(blob).toContain('500');
    expect(blob).toContain('/var/task/handler.js');
    expect(blob).toContain('onError');
    expect(out.exception.values[0].type).toBe('Error');
  });

  it('falls back safely when sanitization input is corrupt', () => {
    const bad: any = {};
    Object.defineProperty(bad, 'message', {
      get() {
        throw new Error('cannot read');
      },
    });
    const out = sanitizeSentryEvent(bad);
    expect(out.message).toMatch(/sanitized/i);
  });
});

describe('false-positive preservation', () => {
  it('preserves HTTP status, SQLSTATE, request IDs, timestamps, paths', () => {
    const input =
      'status=500 SQLSTATE=42P01 requestId=req-abc-123 awsRequestId=λ-inv-9 at onError (/var/task/handler.js:100:5) 2026-11-09T08:00:00.000Z';
    const out = redactSecretsForLog(input);
    expect(out).toContain('500');
    expect(out).toContain('42P01');
    expect(out).toContain('req-abc-123');
    expect(out).toContain('λ-inv-9');
    expect(out).toContain('/var/task/handler.js:100:5');
    expect(out).toContain('2026-11-09T08:00:00.000Z');
    expect(out).toContain('onError');
  });

  it('sanitizeValueForLog keeps safe numbers and redacts sensitive keys', () => {
    const out = sanitizeValueForLog({
      statusCode: 403,
      sqlstate: '23505',
      password: 'ShouldNotAppear',
      nested: { otp: '998877', path: '/customer/x' },
    }) as any;
    expect(out.statusCode).toBe(403);
    expect(out.sqlstate).toBe('23505');
    expect(out.password).toBe('[REDACTED]');
    expect(out.nested.otp).toBe('[REDACTED]');
    expect(out.nested.path).toBe('/customer/x');
  });
});

describe('publicMessageForHttpStatus', () => {
  it('maps common statuses', () => {
    expect(publicMessageForHttpStatus(401)).toBe('Unauthorized');
    expect(publicMessageForHttpStatus(500)).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
  });
});

describe('Hono onError integration (mini app)', () => {
  it('app.onError returns sanitized 500 and preserves CORS + request id header', async () => {
    const { Hono } = await import('hono');
    const app = new Hono();
    app.onError((err, c) => {
      const mapped = mapHonoThrownErrorToClientResponse(err, c.req.path, {
        method: c.req.method,
      });
      const headers: Record<string, string> = {
        'access-control-allow-origin': 'https://example.com',
        'access-control-allow-credentials': 'true',
      };
      const rid = c.req.header('x-request-id');
      if (rid) headers['x-request-id'] = rid;
      return c.json(mapped.body, mapped.status as any, headers);
    });
    app.get('/boom', () => {
      throw new Error('relation "orders" does not exist SQLSTATE 42P01');
    });
    app.get('/denied', () => {
      throw new HTTPException(403, { message: 'secret column password_hash' });
    });

    const r1 = await app.request('http://localhost/boom', {
      headers: { 'x-request-id': 'req-test-1', origin: 'https://example.com' },
    });
    expect(r1.status).toBe(500);
    const b1 = await r1.json();
    expect(b1).toEqual({ error: SAFE_INTERNAL_ERROR_MESSAGE });
    assertSafeBody(b1);
    expect(r1.headers.get('access-control-allow-origin')).toBe('https://example.com');
    expect(r1.headers.get('x-request-id')).toBe('req-test-1');

    const r2 = await app.request('http://localhost/denied');
    expect(r2.status).toBe(403);
    const b2 = await r2.json();
    expect(b2).toEqual({ error: 'Forbidden' });
    expect(JSON.stringify(b2)).not.toContain('password_hash');
  });

  it('notFound-style body remains generic 404', async () => {
    const { Hono } = await import('hono');
    const app = new Hono();
    app.notFound((c) =>
      c.json(
        { error: 'Not Found' },
        404,
        { 'access-control-allow-origin': 'https://example.com' },
      ),
    );
    const r = await app.request('http://localhost/no-such-route');
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: 'Not Found' });
    expect(r.headers.get('access-control-allow-origin')).toBe('https://example.com');
  });
});

describe('Lambda boundary body contract (documented)', () => {
  it('matches generic sanitized Lambda catch payload', () => {
    const lambdaBody = { error: 'Internal Server Error' };
    expect(lambdaBody).toEqual({ error: SAFE_INTERNAL_ERROR_MESSAGE });
    assertSafeBody(lambdaBody);
  });
});
