import { useQuery } from '@tanstack/react-query';
import {
  fetchWarmpawzPayPayments,
  type WpayAdminPaymentsListData,
} from '@/lib/warmpawz-pay-payments-admin';

export const warmpawzPayPaymentsQueryKeys = {
  all: ['warmpawz-pay-payments'] as const,
  list: (page: number, pageSize: number) =>
    [...warmpawzPayPaymentsQueryKeys.all, page, pageSize] as const,
};

export function useWarmpawzPayPayments(page: number, pageSize: number) {
  const query = useQuery({
    queryKey: warmpawzPayPaymentsQueryKeys.list(page, pageSize),
    queryFn: () => fetchWarmpawzPayPayments({ page, pageSize }),
    staleTime: 30_000,
  });

  return {
    data: query.data as WpayAdminPaymentsListData | undefined,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    refresh: () => query.refetch(),
  };
}
