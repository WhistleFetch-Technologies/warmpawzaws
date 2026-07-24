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

function isPricingNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('pricing_not_found') ||
    message.includes('pricing not found') ||
    message.includes('404')
  );
}

export async function fetchPricingDetailOrNull(vendorId: string): Promise<PricingDetail | null> {
  try {
    return await fetchPricingDetail(vendorId);
  } catch (error) {
    if (isPricingNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export function usePricingDetail(vendorId: string | null) {
  return useQuery({
    queryKey: pricingQueryKeys.detail(vendorId ?? ''),
    queryFn: () => fetchPricingDetailOrNull(vendorId as string),
    enabled: Boolean(vendorId),
    staleTime: 15_000,
    retry: false,
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
