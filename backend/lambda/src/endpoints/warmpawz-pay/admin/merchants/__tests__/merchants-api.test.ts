import { Hono } from 'hono';
import type { Context } from 'hono';
import { registerMerchantsAdminRoutes } from '../routes/merchants-admin.routes';
import type { WarmpawzPayMerchantsService } from '../services/warmpawz-pay-merchants.service';
import type { MerchantListSuccessResponse } from '../dto/merchants.responses';

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

function createMerchantsService(
  overrides: Partial<WarmpawzPayMerchantsService> = {},
): WarmpawzPayMerchantsService {
  return {
    listMerchants: jest.fn().mockResolvedValue({
      items: [
        {
          catalogueId: 'cat-1',
          vendorId: 'vendor-1',
          vendorName: 'Anjali Sharma',
          businessName: 'Happy Paws',
          city: 'Bengaluru',
          category: 'Grooming',
          businessType: 'Solo',
          platformStatus: 'Approved',
          warmpawzPayStatus: 'Published',
          customerVisible: true,
          updatedAt: '2026-07-23T12:00:00.000Z',
          readiness: {
            checks: [],
            blockersPassed: 4,
            blockersTotal: 4,
            readyForPayBill: true,
          },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    }),
    ...overrides,
  } as unknown as WarmpawzPayMerchantsService;
}

describe('GET /admin/warmpawz-pay/merchants', () => {
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

  it('returns enriched merchant list envelope', async () => {
    const appWithAuth = new Hono();
    appWithAuth.use('*', async (c, next) => {
      setUserId(c, 'uat-admin-user');
      await next();
    });
    registerMerchantsAdminRoutes(appWithAuth, {
      merchantsService: createMerchantsService(),
    });

    const res = await appWithAuth.request('http://localhost/admin/warmpawz-pay/merchants', {
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as MerchantListSuccessResponse;
    expect(body.success).toBe(true);
    expect(body.data.items[0].businessName).toBe('Happy Paws');
    expect(body.data.items[0].readiness.readyForPayBill).toBe(true);
  });

  it('returns 401 without auth context', async () => {
    const app = new Hono();
    registerMerchantsAdminRoutes(app, {
      merchantsService: createMerchantsService(),
    });

    const res = await app.request('http://localhost/admin/warmpawz-pay/merchants');
    expect(res.status).toBe(401);
  });
});
