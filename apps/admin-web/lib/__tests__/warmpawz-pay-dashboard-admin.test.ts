import {
  dashboardMetricCount,
  fetchWarmpawzPayDashboard,
  isDashboardMetricAvailable,
} from '../warmpawz-pay-dashboard-admin';
import { apiClient } from '../api-client';

jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

describe('warmpawz-pay-dashboard-admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetchWarmpawzPayDashboard unwraps success envelope', async () => {
    mockedGet.mockResolvedValue({
      success: true,
      data: {
        metrics: {
          publishedMerchants: { value: 4 },
          averageDiscountPercent: { value: 8 },
          draftUnpublished: { value: 1 },
          payEnabledTiers: { value: 2 },
          payBillOrders: { value: 3 },
          customerPaid: { value: 400 },
          customerSaved: { value: 40 },
          platformRevenue: { value: 20, available: true },
        },
        generatedAt: '2026-07-23T12:00:00.000Z',
      },
    });

    const data = await fetchWarmpawzPayDashboard();

    expect(mockedGet).toHaveBeenCalledWith('/admin/warmpawz-pay/dashboard');
    expect(data.metrics.publishedMerchants.value).toBe(4);
    expect(data.metrics.payBillOrders.value).toBe(3);
    expect(data.metrics.platformRevenue).toEqual({ value: 20, available: true });
  });

  it('fetchWarmpawzPayDashboard throws on error envelope', async () => {
    mockedGet.mockResolvedValue({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    });

    await expect(fetchWarmpawzPayDashboard()).rejects.toThrow('Access denied');
  });

  it('dashboardMetricCount treats missing and non-finite values as zero', () => {
    expect(dashboardMetricCount()).toBe(0);
    expect(dashboardMetricCount({ value: null })).toBe(0);
    expect(dashboardMetricCount({ value: Number.NaN })).toBe(0);
    expect(dashboardMetricCount({ value: 12.5 })).toBe(12.5);
  });

  it('isDashboardMetricAvailable hides platform revenue when unavailable', () => {
    expect(isDashboardMetricAvailable({ available: false })).toBe(false);
    expect(isDashboardMetricAvailable({ available: true })).toBe(true);
    expect(isDashboardMetricAvailable()).toBe(true);
  });
});
