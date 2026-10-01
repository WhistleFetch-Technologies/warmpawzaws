import { useQuery } from '@tanstack/react-query';
import {
  fetchWarmpawzPayDashboard,
  type WarmpawzPayDashboardData,
} from '@/lib/warmpawz-pay-dashboard-admin';
import {
  areWpayPaymentsFiltersReady,
  type WpayPaymentsFilters,
} from '@/lib/warmpawz-pay-payments-export';

export const warmpawzPayDashboardQueryKeys = {
  all: ['warmpawz-pay-dashboard'] as const,
  detail: (filters: Pick<WpayPaymentsFilters, 'mode' | 'yearMonth' | 'fromDate' | 'toDate'>) =>
    [...warmpawzPayDashboardQueryKeys.all, 'detail', filters] as const,
};

export interface UseWarmpawzPayDashboardResult {
  readonly data: WarmpawzPayDashboardData | undefined;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly refresh: () => Promise<unknown>;
}

export function useWarmpawzPayDashboard(
  filters: WpayPaymentsFilters,
): UseWarmpawzPayDashboardResult {
  const dateKey = {
    mode: filters.mode,
    yearMonth: filters.yearMonth,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
  };
  const query = useQuery({
    queryKey: warmpawzPayDashboardQueryKeys.detail(dateKey),
    queryFn: () => fetchWarmpawzPayDashboard(dateKey),
    staleTime: 30_000,
    enabled: areWpayPaymentsFiltersReady(filters),
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    refresh: () => query.refetch(),
  };
}
