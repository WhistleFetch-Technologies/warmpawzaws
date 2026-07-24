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
    expect(result.generatedAt).toEqual(expect.any(String));
    expect(() => new Date(result.generatedAt).toISOString()).not.toThrow();
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
  });

  it('wraps repository failures', async () => {
    const repository = createRepository({
      countPublishedMerchants: jest.fn().mockRejectedValue(new Error('db down')),
    });
    const service = new WarmpawzPayDashboardService(repository);

    await expect(service.getDashboard()).rejects.toBeInstanceOf(DashboardMetricsLoadError);
  });
});
