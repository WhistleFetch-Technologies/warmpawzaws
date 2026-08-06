import { useQuery } from '@tanstack/react-query';
import {
  fetchWarmpawzPayPayments,
  type WpayAdminPaymentsListData,
  type WpayPaymentsFilters,
} from '@/lib/warmpawz-pay-payments-admin';
import { areWpayPaymentsFiltersReady } from '@/lib/warmpawz-pay-payments-export';

export const warmpawzPayPaymentsQueryKeys = {
  all: ['warmpawz-pay-payments'] as const,
  list: (page: number, pageSize: number, filters: WpayPaymentsFilters) =>
    [...warmpawzPayPaymentsQueryKeys.all, page, pageSize, filters] as const,
};

export function useWarmpawzPayPayments(
  page: number,
  pageSize: number,
  filters: WpayPaymentsFilters,
) {
  const query = useQuery({
    queryKey: warmpawzPayPaymentsQueryKeys.list(page, pageSize, filters),
    queryFn: () => fetchWarmpawzPayPayments({ page, pageSize, filters }),
    staleTime: 30_000,
    enabled: areWpayPaymentsFiltersReady(filters),
  });

  return {
    data: query.data as WpayAdminPaymentsListData | undefined,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    refresh: () => query.refetch(),
  };
}
