import type { DashboardDataDTO } from '../dto/dashboard.responses';
import type { IDashboardMetricsRepository } from '../../../repositories/interfaces/IDashboardMetricsRepository';
import { dashboardMetricsRepository } from '../../../repositories/dashboard-metrics.repository';

export const WARMPAWZ_PAY_DASHBOARD_LOG_PREFIX = '[WarmpawzPayDashboard]';

export class DashboardMetricsLoadError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'DashboardMetricsLoadError';
  }
}

export class WarmpawzPayDashboardService {
  constructor(
    private readonly metricsRepository: IDashboardMetricsRepository = dashboardMetricsRepository,
  ) {}

  async getDashboard(): Promise<DashboardDataDTO> {
    console.info(`${WARMPAWZ_PAY_DASHBOARD_LOG_PREFIX} Loading dashboard metrics`);

    try {
      const [publishedMerchants, averageDiscountPercent] = await Promise.all([
        this.metricsRepository.countPublishedMerchants(),
        this.metricsRepository.getAverageDiscountPercent(),
      ]);

      return {
        metrics: {
          publishedMerchants: { value: publishedMerchants },
          averageDiscountPercent: { value: averageDiscountPercent },
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`${WARMPAWZ_PAY_DASHBOARD_LOG_PREFIX} Failed to load dashboard metrics`, error);
      throw new DashboardMetricsLoadError('Failed to load dashboard metrics', error);
    }
  }
}

export const warmpawzPayDashboardService = new WarmpawzPayDashboardService();
