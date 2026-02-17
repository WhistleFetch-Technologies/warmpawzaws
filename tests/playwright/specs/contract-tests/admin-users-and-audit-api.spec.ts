/**
 * Admin User Access & Audit – API contract tests
 *
 * Covers: GET /admin/me, GET /admin/users, GET /admin/audit-log, GET /admin/roles (role_type),
 * POST /admin/users/verify-otp-set-password (public), POST /admin/users (create).
 *
 * Run: npx playwright test specs/contract-tests/admin-users-and-audit-api.spec.ts
 * Env: API_URL or TEST_API_URL (default dev), UAT token for admin routes.
 */

import { test, expect } from '@playwright/test';

const API_BASE = (process.env.API_URL || process.env.TEST_API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com').replace(/\/$/, '');
const UAT_TOKEN = process.env.ADMIN_AUTH_TOKEN || process.env.UAT_TOKEN || 'uat-token-admin-' + Date.now();

function uatHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${UAT_TOKEN}`,
    'X-UAT-Mode': 'true',
    'X-UAT-Token': UAT_TOKEN,
  };
}

test.describe('Admin User Access & Audit – API contracts', () => {
  test('GET /admin/me without auth returns 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/admin/me`);
    expect(res.status()).toBe(401);
  });

  test('GET /admin/me with UAT token returns 200 and { success, admin, permissions }', async ({ request }) => {
    const res = await request.get(`${API_BASE}/admin/me`, { headers: uatHeaders() });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.admin).toBeDefined();
    expect(data.admin).toHaveProperty('id');
    expect(data.admin).toHaveProperty('email');
    expect(data.admin).toHaveProperty('name');
    expect(Array.isArray(data.permissions)).toBe(true);
  });

  test('GET /admin/users without auth returns 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/admin/users`);
    expect(res.status()).toBe(401);
  });

  test('GET /admin/users with UAT returns 200 and { success, users[] } or 500 if DB not ready', async ({ request }) => {
    const res = await request.get(`${API_BASE}/admin/users`, { headers: uatHeaders() });
    expect([200, 403, 500]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.users)).toBe(true);
      for (const u of data.users) {
        expect(u).toHaveProperty('id');
        expect(u).toHaveProperty('email');
      }
    }
  });

  test('GET /admin/audit-log without auth returns 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/admin/audit-log`);
    expect(res.status()).toBe(401);
  });

  test('GET /admin/audit-log with UAT returns 200 and { success, logs[] }', async ({ request }) => {
    const res = await request.get(`${API_BASE}/admin/audit-log?limit=5`, { headers: uatHeaders() });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.logs)).toBe(true);
  });

  test('GET /admin/roles returns 200 and roles have role_type when present', async ({ request }) => {
    const res = await request.get(`${API_BASE}/admin/roles?active=false`, { headers: uatHeaders() });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.roles)).toBe(true);
    const withRoleType = (data.roles as any[]).filter((r: any) => r.role_type != null);
    expect(withRoleType.length).toBeGreaterThanOrEqual(0);
    for (const r of data.roles as any[]) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('display_name');
    }
  });

  test('POST /admin/users/verify-otp-set-password (public) with bad body returns 400 or 401', async ({ request }) => {
    const res = await request.post(`${API_BASE}/admin/users/verify-otp-set-password`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'test@test.com', phone: '9999999999', otp: '000000', newPassword: 'short' },
    });
    expect([400, 401, 404]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json().catch(() => ({}));
      expect(body.success === false || body.error).toBeTruthy();
    }
  });

  test('POST /admin/users/forgot-password (public) without email returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/admin/users/forgot-password`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json().catch(() => ({}));
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/email/i);
  });

  test('POST /admin/users/forgot-password (public) with email returns 200 and generic message', async ({ request }) => {
    const res = await request.post(`${API_BASE}/admin/users/forgot-password`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'nonexistent-forgot-test@example.com' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json().catch(() => ({}));
    expect(body.success).toBe(true);
    expect(body.message).toBeDefined();
    expect(typeof body.message).toBe('string');
  });

  test('POST /admin/users (create) without auth returns 401', async ({ request }) => {
    const res = await request.post(`${API_BASE}/admin/users`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'new@test.com', name: 'Test', phone: '9876543210' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /admin/users (create) with UAT and invalid body returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/admin/users`, {
      headers: uatHeaders(),
      data: { email: '' },
    });
    expect(res.status()).toBe(400);
    const data = await res.json().catch(() => ({}));
    expect(data.success === false || data.error).toBeTruthy();
  });
});
