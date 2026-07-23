import { apiClient } from '@/lib/api-client';

export const WPAY_DASHBOARD_API_BASE = '/admin/warmpawz-pay/dashboard';

export interface DashboardMetricValue {
  readonly value: number;
}

export interface DashboardFutureMetric {
  readonly value: null;
  readonly available: false;
  readonly phase: string;
}

export type DashboardMetric = DashboardMetricValue | DashboardFutureMetric;

export interface DashboardMetrics {
  readonly publishedMerchants: DashboardMetricValue;
  readonly averageDiscountPercent: DashboardMetricValue;
  readonly readyMerchants: DashboardMetric;
  readonly blockedMerchants: DashboardMetric;
}

export interface WarmpawzPayDashboardData {
  readonly metrics: DashboardMetrics;
  readonly generatedAt: string;
}

interface SuccessEnvelope<T> {
  readonly success: true;
  readonly data: T;
}

interface ErrorEnvelope {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

function assertSuccess<T>(response: SuccessEnvelope<T> | ErrorEnvelope | T): T {
  if (response && typeof response === 'object' && 'success' in response) {
    if (response.success === true && 'data' in response) {
      return response.data;
    }
    if (response.success === false && 'error' in response) {
      throw new Error(response.error.message || 'Request failed');
    }
  }
  return response as T;
}

export function isFutureMetric(metric: DashboardMetric): metric is DashboardFutureMetric {
  return 'available' in metric && metric.available === false;
}

export async function fetchWarmpawzPayDashboard(): Promise<WarmpawzPayDashboardData> {
  const response = await apiClient.get<
    SuccessEnvelope<WarmpawzPayDashboardData> | WarmpawzPayDashboardData
  >(WPAY_DASHBOARD_API_BASE);
  return assertSuccess(response);
}
