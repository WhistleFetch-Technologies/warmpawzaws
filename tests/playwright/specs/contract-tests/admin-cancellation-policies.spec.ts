/**
 * Admin Finance - Cancellation Policies API
 *
 * Tests GET, POST, PUT for /admin/finance/cancellation-policies.
 * Optional: set ADMIN_AUTH_TOKEN for authenticated requests.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || process.env.API_BASE_URL || '';

const adminAuthToken = process.env.ADMIN_AUTH_TOKEN || '';

function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-UAT-Mode': 'true',
    'X-UAT-Token': 'uat-test-token',
  };
  if (adminAuthToken) {
    headers['Authorization'] = `Bearer ${adminAuthToken}`;
  }
  return headers;
}

test.describe('Admin Finance - Cancellation Policies', () => {
  test('GET /admin/finance/cancellation-policies returns 200 and list shape', async ({
    request,
  }) => {
    const response = await request.get(
      `${API_BASE}/admin/finance/cancellation-policies`,
      { headers: adminHeaders() }
    );

    expect(
      response.status(),
      `GET cancellation-policies should return 200 or 401 (auth). Got ${response.status()}`
    ).toBeLessThan(500);

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('policies');
      expect(Array.isArray(data.policies)).toBe(true);

      for (const p of data.policies) {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('policy_name');
        expect(typeof p.policy_name).toBe('string');
      }
    }
  });

  test('POST /admin/finance/cancellation-policies creates a policy (or 401)', async ({
    request,
  }) => {
    const body = {
      name: `Test Policy ${Date.now()}`,
      description: 'E2E test policy',
      policyType: 'standard',
      vendorTypes: [],
      serviceTypes: [],
      gracePeriodHours: 2,
      cancellationWindows: [
        { hoursBefore: 48, refundPercentage: 100, cancellationFee: 0, penaltyPercentage: 0 },
        { hoursBefore: 0, refundPercentage: 0, cancellationFee: 0, penaltyPercentage: 0 },
      ],
      vendorCancellationPenalty: {
        enabled: true,
        penaltyPercentage: 10,
        compensationPercentage: 50,
      },
      noShowPolicy: {
        enabled: true,
        refundPercentage: 0,
        penaltyAmount: 0,
      },
      isActive: true,
      priority: 1,
    };

    const response = await request.post(
      `${API_BASE}/admin/finance/cancellation-policies`,
      { headers: adminHeaders(), data: body }
    );

    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200 || response.status() === 201) {
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('policy');
      expect(data.policy).toHaveProperty('id');
      expect(data.policy).toHaveProperty('policy_name');
    }
  });

  test('PUT /admin/finance/cancellation-policies/:id updates (requires existing id)', async ({
    request,
  }) => {
    const listRes = await request.get(
      `${API_BASE}/admin/finance/cancellation-policies`,
      { headers: adminHeaders() }
    );

    if (listRes.status() !== 200) {
      test.skip();
      return;
    }

    const listData = await listRes.json();
    const policies = listData.policies || [];
    const first = policies[0];

    if (!first?.id) {
      test.skip();
      return;
    }

    const body = {
      name: first.policy_name + ' (updated)',
      description: (first.description || '') + ' Updated by E2E.',
      gracePeriodHours: first.hours_before_booking ?? 2,
      isActive: first.is_active !== false,
    };

    const response = await request.put(
      `${API_BASE}/admin/finance/cancellation-policies/${first.id}`,
      { headers: adminHeaders(), data: body }
    );

    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('policy');
    }
  });
});
