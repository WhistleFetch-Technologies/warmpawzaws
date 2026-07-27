import { apiClient } from '@/lib/api-client';

export const WAPPT_DASHBOARD_API_BASE = '/admin/warmpawz-appointments';

export interface WapptDashboardMetrics {
  readonly publishedVendorCount: number;
  readonly averageAppointmentFee: number;
  readonly totalRevenue: number;
}

export interface WapptAdminBookingRow {
  readonly bookingId: string;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly merchantDisplayName: string;
  readonly bookingDate: string;
  readonly bookingTime: string;
  readonly baseFeePaid: number;
  readonly createdAt: string;
}

export interface WapptBookingsListResponse {
  readonly rows: readonly WapptAdminBookingRow[];
  readonly total: number;
}

type SuccessEnvelope<T> = { success: true; data: T };

export async function fetchWapptDashboardMetrics(): Promise<WapptDashboardMetrics> {
  const res = await apiClient.get<SuccessEnvelope<WapptDashboardMetrics>>(
    `${WAPPT_DASHBOARD_API_BASE}/dashboard`,
  );
  return res.data;
}

export async function fetchWapptBookingsList(params: {
  page: number;
  pageSize: number;
}): Promise<WapptBookingsListResponse> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  const res = await apiClient.get<SuccessEnvelope<WapptBookingsListResponse>>(
    `${WAPPT_DASHBOARD_API_BASE}/bookings?${qs.toString()}`,
  );
  return res.data;
}
