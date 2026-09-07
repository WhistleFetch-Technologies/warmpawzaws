export interface WpayDashboardMoneyTotals {
  readonly payBillOrders: number;
  readonly customerPaid: number;
  readonly customerSaved: number;
  readonly platformRevenue: number;
}

export interface IDashboardMetricsRepository {
  countPublishedMerchants(): Promise<number>;
  getAverageDiscountPercent(): Promise<number>;
  countDraftUnpublished(): Promise<number>;
  countPayEnabledTiers(): Promise<number>;
  getPayBillMoneyTotals(): Promise<WpayDashboardMoneyTotals>;
  getBurnMode(): Promise<boolean>;
}
