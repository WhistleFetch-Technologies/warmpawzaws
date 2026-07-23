import { useQuery } from '@tanstack/react-query';
import {
  fetchMerchantList,
  type MerchantListData,
  type MerchantListQueryParams,
} from '@/lib/warmpawz-pay-merchants-admin';

export const merchantsQueryKeys = {
  all: ['warmpawz-pay-merchants'] as const,
  list: (params: MerchantListQueryParams) =>
    [...merchantsQueryKeys.all, 'list', params] as const,
};

export interface UseMerchantsListResult {
  readonly data: MerchantListData | undefined;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly refresh: () => Promise<unknown>;
}

export function useMerchantsList(params: MerchantListQueryParams): UseMerchantsListResult {
  const query = useQuery({
    queryKey: merchantsQueryKeys.list(params),
    queryFn: () => fetchMerchantList(params),
    staleTime: 15_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    refresh: () => query.refetch(),
  };
}
