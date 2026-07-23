import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPricing,
  disablePricing,
  fetchPricingDetail,
  updatePricing,
  type CreatePricingPayload,
  type PricingDetail,
  type UpdatePricingPayload,
} from '@/lib/warmpawz-pay-pricing-admin';
import { catalogueQueryKeys } from '@/hooks/warmpawz-pay/useCatalogue';

export const pricingQueryKeys = {
  all: ['warmpawz-pay-pricing'] as const,
  detail: (vendorId: string) => [...pricingQueryKeys.all, 'detail', vendorId] as const,
};

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
      queryClient.invalidateQueries({ queryKey: catalogueQueryKeys.all });
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
      queryClient.invalidateQueries({ queryKey: catalogueQueryKeys.all });
    },
  });
}

export function useDisablePricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vendorId: string) => disablePricing(vendorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pricingQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: catalogueQueryKeys.all });
    },
  });
}
