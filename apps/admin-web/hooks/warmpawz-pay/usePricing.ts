import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPricing,
  disablePricing,
  fetchPricingDetail,
  fetchPricingList,
  updatePricing,
  type CreatePricingPayload,
  type PricingDetail,
  type PricingListData,
  type PricingListQueryParams,
  type UpdatePricingPayload,
} from '@/lib/warmpawz-pay-pricing-admin';

export const pricingQueryKeys = {
  all: ['warmpawz-pay-pricing'] as const,
  list: (params: PricingListQueryParams) =>
    [...pricingQueryKeys.all, 'list', params] as const,
  detail: (vendorId: string) => [...pricingQueryKeys.all, 'detail', vendorId] as const,
};

export interface UsePricingListResult {
  readonly data: PricingListData | undefined;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly refresh: () => Promise<unknown>;
}

export function usePricingList(params: PricingListQueryParams): UsePricingListResult {
  const query = useQuery({
    queryKey: pricingQueryKeys.list(params),
    queryFn: () => fetchPricingList(params),
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

export function usePricingDetail(vendorId: string | null) {
  return useQuery({
    queryKey: pricingQueryKeys.detail(vendorId ?? ''),
    queryFn: () => fetchPricingDetail(vendorId as string),
    enabled: Boolean(vendorId),
    staleTime: 15_000,
  });
}

export function useCreatePricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePricingPayload) => createPricing(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pricingQueryKeys.all });
    },
  });
}

export function useUpdatePricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      vendorId,
      payload,
    }: {
      vendorId: string;
      payload: UpdatePricingPayload;
    }) => updatePricing(vendorId, payload),
    onSuccess: (_data: PricingDetail, variables) => {
      queryClient.invalidateQueries({ queryKey: pricingQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: pricingQueryKeys.detail(variables.vendorId),
      });
    },
  });
}

export function useDisablePricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vendorId: string) => disablePricing(vendorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pricingQueryKeys.all });
    },
  });
}
