import { apiClient } from '@/lib/api-client';

export const WPAY_DASHBOARD_API_BASE = '/admin/warmpawz-pay/dashboard';

export interface DashboardMetricValue {
  readonly value: number;
}

export interface DashboardOptionalMetricValue {
  readonly value: number | null;
  readonly available: boolean;
}

export interface DashboardMetrics {
  readonly publishedMerchants: DashboardMetricValue;
  readonly averageDiscountPercent: DashboardMetricValue;
  readonly draftUnpublished: DashboardMetricValue;
  readonly payEnabledTiers: DashboardMetricValue;
  readonly payBillOrders: DashboardMetricValue;
  readonly customerPaid: DashboardMetricValue;
  readonly customerSaved: DashboardMetricValue;
  readonly platformRevenue: DashboardOptionalMetricValue;
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

export function dashboardMetricCount(metric?: { value?: number | null }): number {
  const value = Number(metric?.value);
  return Number.isFinite(value) ? value : 0;
}

export function isDashboardMetricAvailable(metric?: { available?: boolean }): boolean {
  return metric?.available !== false;
}

export async function fetchWarmpawzPayDashboard(): Promise<WarmpawzPayDashboardData> {
  const response = await apiClient.get<
    SuccessEnvelope<WarmpawzPayDashboardData> | WarmpawzPayDashboardData
  >(WPAY_DASHBOARD_API_BASE);
  return assertSuccess(response);
}
