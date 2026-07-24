export interface DashboardMetricValue {
  readonly value: number;
}

export interface DashboardMetricsDTO {
  readonly publishedMerchants: DashboardMetricValue;
  readonly averageDiscountPercent: DashboardMetricValue;
}

export interface DashboardDataDTO {
  readonly metrics: DashboardMetricsDTO;
  readonly generatedAt: string;
}

export interface DashboardSuccessResponse {
  readonly success: true;
  readonly data: DashboardDataDTO;
}
