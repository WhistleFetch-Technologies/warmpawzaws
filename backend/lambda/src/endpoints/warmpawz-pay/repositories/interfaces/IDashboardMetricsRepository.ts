export interface IDashboardMetricsRepository {
  countPublishedMerchants(): Promise<number>;
  getAverageDiscountPercent(): Promise<number>;
}
