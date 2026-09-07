import {
  DashboardMetricsLoadError,
  WarmpawzPayDashboardService,
} from '../services/warmpawz-pay-dashboard.service';
import type { IDashboardMetricsRepository } from '../../../repositories/interfaces/IDashboardMetricsRepository';

function createRepository(
  overrides: Partial<IDashboardMetricsRepository> = {},
): IDashboardMetricsRepository {
  return {
    countPublishedMerchants: jest.fn().mockResolvedValue(12),
    getAverageDiscountPercent: jest.fn().mockResolvedValue(0),
    countDraftUnpublished: jest.fn().mockResolvedValue(3),
    countPayEnabledTiers: jest.fn().mockResolvedValue(4),
    getPayBillMoneyTotals: jest.fn().mockResolvedValue({
      payBillOrders: 10,
      customerPaid: 900,
      customerSaved: 100,
      platformRevenue: 50,
    }),
    getBurnMode: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe('WarmpawzPayDashboardService', () => {
  it('composes dashboard metrics from repository', async () => {
    const repository = createRepository();
    const service = new WarmpawzPayDashboardService(repository);

    const result = await service.getDashboard();

    expect(result.metrics.publishedMerchants).toEqual({ value: 12 });
    expect(result.metrics.averageDiscountPercent).toEqual({ value: 0 });
    expect(result.metrics.draftUnpublished).toEqual({ value: 3 });
    expect(result.metrics.payEnabledTiers).toEqual({ value: 4 });
    expect(result.metrics.payBillOrders).toEqual({ value: 10 });
    expect(result.metrics.customerPaid).toEqual({ value: 900 });
    expect(result.metrics.customerSaved).toEqual({ value: 100 });
    expect(result.metrics.platformRevenue).toEqual({ value: 50, available: true });
    expect(result.generatedAt).toEqual(expect.any(String));
    expect(() => new Date(result.generatedAt).toISOString()).not.toThrow();
  });

  it('hides platform revenue when burn mode is active', async () => {
    const repository = createRepository({
      getBurnMode: jest.fn().mockResolvedValue(true),
    });
    const service = new WarmpawzPayDashboardService(repository);

    const result = await service.getDashboard();

    expect(result.metrics.platformRevenue).toEqual({ value: null, available: false });
    expect(result.metrics.customerPaid).toEqual({ value: 900 });
    expect(repository.getPayBillMoneyTotals).toHaveBeenCalledTimes(1);
  });

  it('loads published count and default average discount from repository', async () => {
    const repository = createRepository({
      countPublishedMerchants: jest.fn().mockResolvedValue(3),
      getAverageDiscountPercent: jest.fn().mockResolvedValue(0),
    });
    const service = new WarmpawzPayDashboardService(repository);

    await service.getDashboard();

    expect(repository.countPublishedMerchants).toHaveBeenCalledTimes(1);
    expect(repository.getAverageDiscountPercent).toHaveBeenCalledTimes(1);
    expect(repository.countDraftUnpublished).toHaveBeenCalledTimes(1);
    expect(repository.countPayEnabledTiers).toHaveBeenCalledTimes(1);
    expect(repository.getPayBillMoneyTotals).toHaveBeenCalledTimes(1);
    expect(repository.getBurnMode).toHaveBeenCalledTimes(1);
  });

  it('wraps repository failures', async () => {
    const repository = createRepository({
      countPublishedMerchants: jest.fn().mockRejectedValue(new Error('db down')),
    });
    const service = new WarmpawzPayDashboardService(repository);

    await expect(service.getDashboard()).rejects.toBeInstanceOf(DashboardMetricsLoadError);
  });
});
