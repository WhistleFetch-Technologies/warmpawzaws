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

function asMetricCount(value: number): { value: number } {
  return { value: Number.isFinite(value) ? value : 0 };
}

export class WarmpawzPayDashboardService {
  constructor(
    private readonly metricsRepository: IDashboardMetricsRepository = dashboardMetricsRepository,
  ) {}

  async getDashboard(): Promise<DashboardDataDTO> {
    console.info(`${WARMPAWZ_PAY_DASHBOARD_LOG_PREFIX} Loading dashboard metrics`);

    try {
      const [
        publishedMerchants,
        averageDiscountPercent,
        draftUnpublished,
        payEnabledTiers,
        moneyTotals,
        burnMode,
      ] = await Promise.all([
        this.metricsRepository.countPublishedMerchants(),
        this.metricsRepository.getAverageDiscountPercent(),
        this.metricsRepository.countDraftUnpublished(),
        this.metricsRepository.countPayEnabledTiers(),
        this.metricsRepository.getPayBillMoneyTotals(),
        this.metricsRepository.getBurnMode(),
      ]);

      return {
        metrics: {
          publishedMerchants: asMetricCount(publishedMerchants),
          averageDiscountPercent: asMetricCount(averageDiscountPercent),
          draftUnpublished: asMetricCount(draftUnpublished),
          payEnabledTiers: asMetricCount(payEnabledTiers),
          payBillOrders: asMetricCount(moneyTotals.payBillOrders),
          customerPaid: asMetricCount(moneyTotals.customerPaid),
          customerSaved: asMetricCount(moneyTotals.customerSaved),
          platformRevenue: burnMode
            ? { value: null, available: false }
            : { value: asMetricCount(moneyTotals.platformRevenue).value, available: true },
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
