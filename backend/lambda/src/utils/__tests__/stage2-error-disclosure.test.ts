/**
 * Stage 2 P0 — client stack traces removed; wallet diagnostic gated; safe messages.
 */
import type { Context } from 'hono';
import { SAFE_INTERNAL_ERROR_MESSAGE } from '../safe-hono-error';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(async () => ({ rows: [{ ok: 1 }], rowCount: 1 })),
}));

jest.mock('../error-tracking', () => ({
  captureException: jest.fn(),
}));

import { registerWalletDiagnosticEndpoints } from '../../endpoints/wallet-diagnostic';
import { Hono } from 'hono';

function withRole(role?: string): Context {
  const store: Record<string, unknown> = {};
  if (role) {
    store.userRole = role;
    store.userGroups = [role];
  }
  return {
    get: (k: string) => store[k],
    set: (k: string, v: unknown) => {
      store[k] = v;
    },
  } as unknown as Context;
}

describe('Stage 2 wallet diagnostic authorization', () => {
  const customerId = '11111111-1111-4111-8111-111111111111';

  function buildApp() {
    const app = new Hono();
    app.use('*', async (c, next) => {
      const role = c.req.header('x-test-role');
      if (role) {
        (c as any).set('userRole', role);
        (c as any).set('userGroups', [role]);
      }
      await next();
    });
    registerWalletDiagnosticEndpoints(app);
    return app;
  }

  it('denies unauthenticated (no role) without financial fields', async () => {
    const app = buildApp();
    const res = await app.request(`http://localhost/wallet/${customerId}/diagnostic`);
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(JSON.stringify(body)).not.toMatch(/balance|transactions|loyalty/i);
    expect(body.stack).toBeUndefined();
  });

  it('denies customer role without financial fields', async () => {
    const app = buildApp();
    const res = await app.request(`http://localhost/wallet/${customerId}/diagnostic`, {
      headers: { 'x-test-role': 'customer' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.wallet).toBeUndefined();
    expect(body.transactions).toBeUndefined();
    expect(body.stack).toBeUndefined();
  });

  it('denies vendor role without financial fields', async () => {
    const app = buildApp();
    const res = await app.request(`http://localhost/wallet/${customerId}/diagnostic`, {
      headers: { 'x-test-role': 'vendor' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.balance).toBeUndefined();
    expect(body.stack).toBeUndefined();
  });

  it('allows admin minimal summary without raw rows or stack', async () => {
    const app = buildApp();
    const res = await app.request(`http://localhost/wallet/${customerId}/diagnostic`, {
      headers: { 'x-test-role': 'admin' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.walletExists).toBeDefined();
    expect(body.transactionCount).toBeDefined();
    expect(body.wallet).toBeUndefined();
    expect(body.transactions).toBeUndefined();
    expect(body.loyaltyTransactions).toBeUndefined();
    expect(body.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/SELECT \*|password|stack/i);
  });
});

describe('Stage 2 stack-trace response hygiene (source contracts)', () => {
  const fs = require('fs');
  const path = require('path');

  const files = [
    'endpoints/pharmacy-orders.ts',
    'endpoints/orders/endpoint/pharmacy-orders.ts',
    'endpoints/referrals.ts',
    'endpoints/wallet-diagnostic.ts',
    'endpoints/admin/endpoints/admin.controller.ts',
    'endpoints/customer/discovery/services/debug-at-center-vendors.service.ts',
  ];

  it.each(files)('%s does not return stack: error.stack to clients', (rel) => {
    const full = path.join(__dirname, '../..', rel);
    const src = fs.readFileSync(full, 'utf8');
    expect(src).not.toMatch(/return c\.json\([^)]*stack:\s*error\.stack/);
    expect(src).not.toMatch(/stack:\s*error\.stack\s*\n?\s*\}, 500/);
  });

  it('SAFE_INTERNAL_ERROR_MESSAGE has no SQL markers', () => {
    expect(SAFE_INTERNAL_ERROR_MESSAGE).toBe('Internal Server Error');
    expect(SAFE_INTERNAL_ERROR_MESSAGE).not.toMatch(/SQL|relation|column/i);
  });
});

describe('isAdminRole helper used by wallet diagnostic', () => {
  it('recognizes admin', async () => {
    const { isAdminRole } = await import('../security-ownership');
    expect(isAdminRole(withRole('admin'))).toBe(true);
    expect(isAdminRole(withRole('customer'))).toBe(false);
    expect(isAdminRole(withRole(undefined as any))).toBe(false);
  });
});
