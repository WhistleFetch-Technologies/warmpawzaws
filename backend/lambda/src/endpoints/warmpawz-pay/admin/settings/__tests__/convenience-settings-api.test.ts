import { Hono } from 'hono';
import type { Context } from 'hono';
import { registerConvenienceSettingsRoutes } from '../routes/convenience-settings.routes';
import type { WpayConvenienceSettingsService } from '../services/wpay-convenience-settings.service';

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

function createService(
  overrides: Partial<WpayConvenienceSettingsService> = {},
): WpayConvenienceSettingsService {
  return {
    getConvenienceSettings: jest.fn().mockResolvedValue({
      convenienceFee: 0,
      convenienceGstRate: 18,
      platformGstRate: 18,
    }),
    putConvenienceSettings: jest.fn().mockResolvedValue({
      convenienceFee: 20,
      convenienceGstRate: 18,
      platformGstRate: 18,
    }),
    ...overrides,
  } as unknown as WpayConvenienceSettingsService;
}

describe('Warmpawz Pay convenience settings admin routes', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WARMPAWZ_PAY_ENABLED = 'true';
    process.env.WARMPAWZ_PAY_ADMIN_ENABLED = 'true';
    mockedResolvePermissions.mockResolvedValue(['admin.warmpawz_pay.pricing.view']);
  });

  afterEach(() => {
    delete process.env.WARMPAWZ_PAY_ENABLED;
    delete process.env.WARMPAWZ_PAY_ADMIN_ENABLED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('GET /admin/warmpawz-pay/settings/convenience returns the envelope', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      setUserId(c, 'uat-admin-user');
      await next();
    });
    registerConvenienceSettingsRoutes(app, {
      convenienceSettingsService: createService(),
    });

    const res = await app.request('http://localhost/admin/warmpawz-pay/settings/convenience', {
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { convenienceFee: number; convenienceGstRate: number; platformGstRate: number };
    };
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      convenienceFee: 0,
      convenienceGstRate: 18,
      platformGstRate: 18,
    });
  });

  it('PUT /admin/warmpawz-pay/settings/convenience persists with write permission', async () => {
    mockedResolvePermissions.mockResolvedValue(['admin.warmpawz_pay.pricing.write']);
    const app = new Hono();
    app.use('*', async (c, next) => {
      setUserId(c, 'uat-admin-user');
      await next();
    });
    const service = createService();
    registerConvenienceSettingsRoutes(app, {
      convenienceSettingsService: service,
    });

    const res = await app.request('http://localhost/admin/warmpawz-pay/settings/convenience', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        convenienceFee: 20,
        convenienceGstRate: 18,
        platformGstRate: 18,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { convenienceFee: number } };
    expect(body.success).toBe(true);
    expect(body.data.convenienceFee).toBe(20);
    expect(service.putConvenienceSettings).toHaveBeenCalled();
  });

  it('PUT requires pricing write permission', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      setUserId(c, 'uat-admin-user');
      await next();
    });
    registerConvenienceSettingsRoutes(app, {
      convenienceSettingsService: createService(),
    });

    const res = await app.request('http://localhost/admin/warmpawz-pay/settings/convenience', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        convenienceFee: 20,
        convenienceGstRate: 18,
        platformGstRate: 18,
      }),
    });

    expect(res.status).toBe(403);
  });
});
