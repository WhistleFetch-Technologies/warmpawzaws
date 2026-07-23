export interface DashboardMetricValue {
  readonly value: number;
}

export interface DashboardFutureMetric {
  readonly value: null;
  readonly available: false;
  readonly phase: 'B';
}

export interface DashboardMetricsDTO {
  readonly publishedMerchants: DashboardMetricValue;
  readonly averageDiscountPercent: DashboardMetricValue;
  readonly readyMerchants: DashboardFutureMetric;
  readonly blockedMerchants: DashboardFutureMetric;
}

export interface DashboardDataDTO {
  readonly metrics: DashboardMetricsDTO;
  readonly generatedAt: string;
}

export interface DashboardSuccessResponse {
  readonly success: true;
  readonly data: DashboardDataDTO;
}
