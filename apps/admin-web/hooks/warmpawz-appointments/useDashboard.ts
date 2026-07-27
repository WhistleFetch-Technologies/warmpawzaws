import { useQuery } from '@tanstack/react-query';
import {
  fetchWapptBookingsList,
  fetchWapptDashboardMetrics,
} from '@/lib/warmpawz-appointments-dashboard-admin';

export const wapptDashboardQueryKeys = {
  all: ['warmpawz-appointments-dashboard'] as const,
  metrics: () => [...wapptDashboardQueryKeys.all, 'metrics'] as const,
  bookings: (page: number, pageSize: number) =>
    [...wapptDashboardQueryKeys.all, 'bookings', page, pageSize] as const,
};

export function useWapptDashboardMetrics() {
  return useQuery({
    queryKey: wapptDashboardQueryKeys.metrics(),
    queryFn: fetchWapptDashboardMetrics,
    staleTime: 15_000,
  });
}

export function useWapptBookingsList(page: number, pageSize: number) {
  return useQuery({
    queryKey: wapptDashboardQueryKeys.bookings(page, pageSize),
    queryFn: () => fetchWapptBookingsList({ page, pageSize }),
    staleTime: 15_000,
  });
}
