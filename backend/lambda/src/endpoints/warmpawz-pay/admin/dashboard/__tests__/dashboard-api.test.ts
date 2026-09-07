import { Hono } from 'hono';
import type { Context } from 'hono';
import { FeatureFlag } from '../../catalogue/feature-flags/feature-flags';
import { FeatureFlagService } from '../../catalogue/feature-flags/feature-flags.service';
import { requireFeatureFlag } from '../../catalogue/middleware/require-feature-flag.middleware';
import { registerDashboardAdminRoutes } from '../routes/dashboard-admin.routes';
import type { WarmpawzPayDashboardService } from '../services/warmpawz-pay-dashboard.service';
import type { DashboardSuccessResponse } from '../dto/dashboard.responses';
import type { CatalogueErrorResponse } from '../../catalogue/dto/catalogue.errors';

jest.mock('../../../../admin/admin-resolve-permissions-from-request', () => ({
  resolveAdminPermissionsFromRequest: jest.fn(),
}));

import { resolveAdminPermissionsFromRequest } from '../../../../admin/admin-resolve-permissions-from-request';

const mockedResolvePermissions = resolveAdminPermissionsFromRequest as jest.MockedFunction<
  typeof resolveAdminPermissionsFromRequest
>;

function setUserId(c: Context, userId: string): void {
  c.set('userId' as never, userId as never);
}

function createDashboardService(
  overrides: Partial<WarmpawzPayDashboardService> = {},
): WarmpawzPayDashboardService {
  return {
    getDashboard: jest.fn().mockResolvedValue({
      metrics: {
        publishedMerchants: { value: 5 },
        averageDiscountPercent: { value: 0 },
        draftUnpublished: { value: 2 },
        payEnabledTiers: { value: 3 },
        payBillOrders: { value: 8 },
        customerPaid: { value: 1200 },
        customerSaved: { value: 80 },
        platformRevenue: { value: 40, available: true },
      },
      generatedAt: '2026-07-23T12:00:00.000Z',
    }),
    ...overrides,
  } as unknown as WarmpawzPayDashboardService;
}

describe('GET /admin/warmpawz-pay/dashboard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WARMPAWZ_PAY_ENABLED = 'true';
    process.env.WARMPAWZ_PAY_ADMIN_ENABLED = 'true';
    mockedResolvePermissions.mockResolvedValue(['admin.warmpawz_pay']);
  });

  afterEach(() => {
    delete process.env.WARMPAWZ_PAY_ENABLED;
    delete process.env.WARMPAWZ_PAY_ADMIN_ENABLED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns dashboard metrics envelope', async () => {
    const appWithAuth = new Hono();
    appWithAuth.use('*', async (c, next) => {
      setUserId(c, 'uat-admin-user');
      await next();
    });
    registerDashboardAdminRoutes(appWithAuth, {
      dashboardService: createDashboardService(),
    });

    const authedRes = await appWithAuth.request('http://localhost/admin/warmpawz-pay/dashboard', {
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(authedRes.status).toBe(200);
    const body = (await authedRes.json()) as DashboardSuccessResponse;
    expect(body.success).toBe(true);
    expect(body.data.metrics.publishedMerchants).toEqual({ value: 5 });
    expect(body.data.metrics.averageDiscountPercent).toEqual({ value: 0 });
    expect(body.data.metrics.draftUnpublished).toEqual({ value: 2 });
    expect(body.data.metrics.payEnabledTiers).toEqual({ value: 3 });
    expect(body.data.metrics.payBillOrders).toEqual({ value: 8 });
    expect(body.data.metrics.customerPaid).toEqual({ value: 1200 });
    expect(body.data.metrics.customerSaved).toEqual({ value: 80 });
    expect(body.data.metrics.platformRevenue).toEqual({ value: 40, available: true });
    expect(body.data.generatedAt).toBe('2026-07-23T12:00:00.000Z');
  });

  it('returns 401 when admin is not authenticated', async () => {
    const app = new Hono();
    registerDashboardAdminRoutes(app, {
      dashboardService: createDashboardService(),
    });

    const res = await app.request('http://localhost/admin/warmpawz-pay/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns 403 when admin lacks dashboard permission', async () => {
    mockedResolvePermissions.mockResolvedValue(['admin.vendors']);

    const app = new Hono();
    app.use('*', async (c, next) => {
      setUserId(c, 'admin-user-1');
      await next();
    });
    registerDashboardAdminRoutes(app, {
      dashboardService: createDashboardService(),
    });

    const res = await app.request('http://localhost/admin/warmpawz-pay/dashboard', {
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(res.status).toBe(403);
  });

  it('returns 503 when Warmpawz Pay feature flag is disabled', async () => {
    const disabledFlags = new FeatureFlagService({
      WARMPAWZ_PAY_ENABLED: 'false',
      WARMPAWZ_PAY_ADMIN_ENABLED: 'true',
    });

    const app = new Hono();
    app.get(
      '/admin/warmpawz-pay/dashboard',
      requireFeatureFlag(FeatureFlag.WARMPAWZ_PAY_ENABLED, disabledFlags),
      (c) => c.json({ success: true }),
    );

    const res = await app.request('http://localhost/admin/warmpawz-pay/dashboard');
    expect(res.status).toBe(503);
    const body = (await res.json()) as CatalogueErrorResponse;
    expect(body.error.code).toBe('FEATURE_DISABLED');
  });

  it('returns 503 when Warmpawz Pay admin feature flag is disabled', async () => {
    const disabledFlags = new FeatureFlagService({
      WARMPAWZ_PAY_ENABLED: 'true',
      WARMPAWZ_PAY_ADMIN_ENABLED: 'false',
    });

    const app = new Hono();
    app.get(
      '/admin/warmpawz-pay/dashboard',
      requireFeatureFlag(FeatureFlag.WARMPAWZ_PAY_ADMIN_ENABLED, disabledFlags),
      (c) => c.json({ success: true }),
    );

    const res = await app.request('http://localhost/admin/warmpawz-pay/dashboard');
    expect(res.status).toBe(503);
    const body = (await res.json()) as CatalogueErrorResponse;
    expect(body.error.code).toBe('FEATURE_DISABLED');
  });
});
