import { useQuery } from '@tanstack/react-query';
import {
  fetchWarmpawzPayDashboard,
  type WarmpawzPayDashboardData,
} from '@/lib/warmpawz-pay-dashboard-admin';

export const warmpawzPayDashboardQueryKeys = {
  all: ['warmpawz-pay-dashboard'] as const,
  detail: () => [...warmpawzPayDashboardQueryKeys.all, 'detail'] as const,
};

export interface UseWarmpawzPayDashboardResult {
  readonly data: WarmpawzPayDashboardData | undefined;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly refresh: () => Promise<unknown>;
}

export function useWarmpawzPayDashboard(): UseWarmpawzPayDashboardResult {
  const query = useQuery({
    queryKey: warmpawzPayDashboardQueryKeys.detail(),
    queryFn: fetchWarmpawzPayDashboard,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    refresh: () => query.refetch(),
  };
}
