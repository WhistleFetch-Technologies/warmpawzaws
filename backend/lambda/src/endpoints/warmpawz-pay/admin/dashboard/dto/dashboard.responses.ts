export interface DashboardMetricValue {
  readonly value: number;
}

/** Money metric that can be hidden (e.g. platform revenue in burn/test mode). */
export interface DashboardOptionalMetricValue {
  readonly value: number | null;
  readonly available: boolean;
}

export interface DashboardMetricsDTO {
  readonly publishedMerchants: DashboardMetricValue;
  readonly averageDiscountPercent: DashboardMetricValue;
  readonly draftUnpublished: DashboardMetricValue;
  readonly payEnabledTiers: DashboardMetricValue;
  readonly payBillOrders: DashboardMetricValue;
  readonly customerPaid: DashboardMetricValue;
  readonly customerSaved: DashboardMetricValue;
  readonly platformRevenue: DashboardOptionalMetricValue;
}

export interface DashboardDataDTO {
  readonly metrics: DashboardMetricsDTO;
  readonly generatedAt: string;
}

export interface DashboardSuccessResponse {
  readonly success: true;
  readonly data: DashboardDataDTO;
}
