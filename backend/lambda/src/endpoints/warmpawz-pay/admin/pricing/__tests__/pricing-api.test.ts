import { Hono } from 'hono';
import type { Context } from 'hono';
import { registerPricingAdminRoutes } from '../routes/pricing-admin.routes';
import type { WarmpawzPayPricingService } from '../services/warmpawz-pay-pricing.service';
import { PRICING_DISCOUNT_TYPE, PRICING_STATUS } from '../../../constants/merchant-pricing';

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

function createPricingService(
  overrides: Partial<WarmpawzPayPricingService> = {},
): WarmpawzPayPricingService {
  return {
    getPricingByMerchantId: jest.fn().mockResolvedValue({
      pricingId: 'pricing-1',
      vendorId: 'vendor-1',
      merchantName: 'Anjali',
      businessName: 'Happy Paws',
      category: 'Grooming',
      tierId: '22222222-2222-4222-8222-222222222222',
      tierName: 'Both',
      commissionRate: 20,
      discountType: PRICING_DISCOUNT_TYPE.PERCENTAGE,
      discountValue: 10,
      platformMargin: 10,
      platformWithholdPercent: 5,
      status: PRICING_STATUS.ACTIVE,
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      effectiveUntil: null,
      updatedAt: '2026-07-23T00:00:00.000Z',
      catalogueId: 'cat-1',
      createdAt: '2026-07-01T00:00:00.000Z',
      createdBy: 'admin-1',
    }),
    createPricing: jest.fn(),
    updatePricing: jest.fn(),
    disablePricing: jest.fn(),
    ...overrides,
  } as unknown as WarmpawzPayPricingService;
}

describe('Warmpawz Pay pricing admin routes', () => {
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

  it('GET /admin/warmpawz-pay/pricing/:merchantId returns detail envelope', async () => {
    const appWithAuth = new Hono();
    appWithAuth.use('*', async (c, next) => {
      setUserId(c, 'uat-admin-user');
      await next();
    });
    registerPricingAdminRoutes(appWithAuth, {
      pricingService: createPricingService(),
    });

    const res = await appWithAuth.request('http://localhost/admin/warmpawz-pay/pricing/vendor-1', {
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { businessName: string } };
    expect(body.success).toBe(true);
    expect(body.data.businessName).toBe('Happy Paws');
  });

  it('returns 401 without auth context', async () => {
    const app = new Hono();
    registerPricingAdminRoutes(app, {
      pricingService: createPricingService(),
    });

    const res = await app.request('http://localhost/admin/warmpawz-pay/pricing/vendor-1');
    expect(res.status).toBe(401);
  });
});
