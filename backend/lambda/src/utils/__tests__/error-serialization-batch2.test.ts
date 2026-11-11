/**
 * Batch 2 — F08 shared error serialization remediation.
 */
import { HTTPException } from 'hono/http-exception';
import { SAFE_INTERNAL_ERROR_MESSAGE } from '../safe-hono-error';
import {
  getErrorMessage,
  getInternalErrorMessage,
  createSafeErrorResponse,
  serializeErrorForLogging,
} from '../error-serialization';

function assertNoSensitiveLeak(text: string) {
  const lower = text.toLowerCase();
  expect(lower).not.toMatch(/select\s+.*from|insert\s+into|update\s+|delete\s+from/);
  expect(lower).not.toMatch(/relation "|column "|sqlstate|pg_/);
  expect(lower).not.toMatch(/rds\.amazonaws|ap-south-1\.rds|db_host|password=/);
  expect(lower).not.toMatch(/akia[a-z0-9]{16}|bearer\s+[a-z0-9\-._~+/]+/i);
  expect(lower).not.toMatch(/eyj[a-z0-9_-]+\.[a-z0-9_-]+\./i);
  expect(text).not.toMatch(/otp[=:]\s*\d{4,8}/i);
  expect(lower).not.toMatch(/stack|node_modules|at object\./);
}

describe('Batch 2 getErrorMessage (client-safe)', () => {
  it('unexpected Error with SQL text → generic/approved safe message', () => {
    const msg = getErrorMessage(
      new Error('relation "vendors" does not exist — SELECT * FROM vendors WHERE id=$1'),
    );
    expect(msg).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(msg);
  });

  it('error with DB hostname does not disclose host', () => {
    const msg = getErrorMessage(
      new Error('connect ETIMEDOUT warmpawz-prod.abc123.ap-south-1.rds.amazonaws.com:5432'),
    );
    expect(msg).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(msg);
  });

  it('error with stack is not returned', () => {
    const err = new Error('boom');
    err.stack = 'Error: boom\n    at Object.<anonymous> (/app/node_modules/x.js:1:1)';
    const msg = getErrorMessage(err);
    expect(msg).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(msg);
  });

  it('error with AWS key / JWT / OTP / password does not disclose secrets', () => {
    const msg = getErrorMessage(
      new Error(
        'AWS AKIAIOSFODNN7EXAMPLE Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb otp=123456 password=supersecret',
      ),
    );
    expect(msg).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(msg);
  });

  it('arbitrary object is not serialized to client', () => {
    const msg = getErrorMessage({
      password: 'secret',
      sql: 'SELECT * FROM customers',
      host: 'db.internal',
    });
    expect(msg).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(msg);
    expect(msg).not.toContain('secret');
    expect(msg).not.toContain('SELECT');
  });

  it('null/undefined → safe generic fallback', () => {
    expect(getErrorMessage(null)).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    expect(getErrorMessage(undefined)).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
  });

  it('approved validation fallback is preserved for unexpected errors', () => {
    expect(getErrorMessage(new Error('SELECT 1'), 'Invalid request payload')).toBe(
      'Invalid request payload',
    );
  });

  it('HTTPException 4xx uses public status message when no specific fallback', () => {
    const err = new HTTPException(404, { message: 'Vendor row missing in schema xyz' });
    const msg = getErrorMessage(err);
    expect(msg).toBe('Not Found');
    assertNoSensitiveLeak(msg);
  });

  it('HTTPException 4xx preserves explicit approved fallback', () => {
    const err = new HTTPException(400, { message: 'internal sql detail' });
    expect(getErrorMessage(err, 'Missing required field: name')).toBe(
      'Missing required field: name',
    );
  });

  it('HTTPException 500 stays generic', () => {
    const err = new HTTPException(500, { message: 'SELECT * FROM secrets' });
    expect(getErrorMessage(err)).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
  });
});

describe('Batch 2 getInternalErrorMessage (server-only)', () => {
  it('extracts message for branching without JSON-serializing secrets', () => {
    const msg = getInternalErrorMessage(
      new Error('relation "cancellation_policies" does not exist'),
    );
    expect(msg).toMatch(/cancellation_policies/);
  });

  it('redacts secrets from internal diagnostic strings', () => {
    const msg = getInternalErrorMessage(
      new Error('password=hunter2 Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb'),
    );
    expect(msg.toLowerCase()).not.toContain('hunter2');
    expect(msg).not.toMatch(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.aaa\.bbb/);
  });

  it('does not dump arbitrary object properties', () => {
    const msg = getInternalErrorMessage({
      password: 'x',
      apiKey: 'y',
      nested: { token: 'z' },
    });
    expect(msg).toBe('Unknown error object');
  });
});

describe('Batch 2 createSafeErrorResponse', () => {
  it('unexpected 500 is sanitized and never echoes exception text', () => {
    const res = createSafeErrorResponse(
      new Error('column "is_immutable" of relation "prescriptions" does not exist'),
      'Internal server error',
      500,
    );
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(500);
    expect(res.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(res.error);
  });

  it('preserves caller-approved defaultMessage on 500 without exception text', () => {
    const res = createSafeErrorResponse(
      new Error('SELECT * FROM admin_users'),
      'Failed to create admin user',
      500,
    );
    expect(res.statusCode).toBe(500);
    expect(res.error).toBe('Failed to create admin user');
    assertNoSensitiveLeak(res.error);
  });

  it('intended HTTPException 4xx status is preserved', () => {
    const err = new HTTPException(403, { message: 'role check failed against rbac_tables' });
    const res = createSafeErrorResponse(err, 'Internal server error', 500);
    expect(res.statusCode).toBe(403);
    expect(res.error).toBe('Forbidden');
    assertNoSensitiveLeak(res.error);
  });

  it('explicit 4xx with approved business message stays meaningful', () => {
    const res = createSafeErrorResponse(
      new Error('ignored'),
      'Vendor ID is required',
      400,
    );
    expect(res.statusCode).toBe(400);
    expect(res.error).toBe('Vendor ID is required');
  });

  it('nested exception properties are not exposed on the response object', () => {
    const err = Object.assign(new Error('secret sql'), {
      detail: { password: 'x', stack: 'at foo' },
      cause: new Error('inner'),
    });
    const res = createSafeErrorResponse(err, 'Internal server error', 500);
    expect(Object.keys(res).sort()).toEqual(['error', 'statusCode', 'success']);
    expect(JSON.stringify(res)).not.toMatch(/password|secret sql|inner|stack/i);
  });

  it('does not return HTTP 200 for errors', () => {
    const res = createSafeErrorResponse(new Error('x'), 'Internal server error', 500);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.success).toBe(false);
  });
});

describe('Batch 2 serializeErrorForLogging', () => {
  it('redacts secrets in log serialization', () => {
    const logged = serializeErrorForLogging(
      new Error('password=supersecret otp=999999 AKIAIOSFODNN7EXAMPLE'),
    );
    expect(logged.toLowerCase()).not.toContain('supersecret');
    expect(logged).not.toMatch(/999999/);
    expect(logged).not.toMatch(/AKIAIOSFODNN7EXAMPLE/);
  });
});

describe('Batch 2 admin-advanced consumer contract', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../../endpoints/admin/endpoints/admin-advanced.ts'),
    'utf8',
  );

  it('uses getInternalErrorMessage for schema-missing branching', () => {
    expect(src).toMatch(/getInternalErrorMessage/);
    expect(src).not.toMatch(/getErrorMessage\(/);
  });

  it('FK product-create branching uses getInternalErrorMessage, not client .error', () => {
    expect(src).toMatch(
      /getInternalErrorMessage\(error\)[\s\S]{0,200}foreign key constraint/,
    );
    expect(src).not.toMatch(/errorResponse\.error\.includes\(['"]foreign key/);
  });

  it('still does not echo createSafeErrorResponse.error to clients', () => {
    expect(src).not.toMatch(/error:\s*errorResponse\.error/);
    expect(src).toMatch(/error:\s*SAFE_INTERNAL_ERROR_MESSAGE/);
  });

  it('createSafeErrorResponse remains used for statusCode plumbing', () => {
    expect(src).toMatch(/createSafeErrorResponse\(/);
  });
});
