import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createCatalogueEntry,
  deleteCatalogueEntry,
  fetchCatalogueDetail,
  fetchCatalogueList,
  fetchVendorCandidates,
  publishCatalogueEntry,
  unpublishCatalogueEntry,
  type CatalogueDetail,
  type CatalogueListQueryParams,
  type VendorCandidatesQueryParams,
} from '@/lib/warmpawz-pay-catalogue-admin';

export const catalogueQueryKeys = {
  all: ['warmpawz-pay-catalogue'] as const,
  list: (params: CatalogueListQueryParams) =>
    [...catalogueQueryKeys.all, 'list', params] as const,
  detail: (catalogueId: string) =>
    [...catalogueQueryKeys.all, 'detail', catalogueId] as const,
  vendorCandidates: (params: VendorCandidatesQueryParams) =>
    [...catalogueQueryKeys.all, 'vendor-candidates', params] as const,
};

function invalidateCatalogueQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  catalogueId?: string,
): void {
  queryClient.invalidateQueries({ queryKey: catalogueQueryKeys.all });
  if (catalogueId) {
    queryClient.invalidateQueries({
      queryKey: catalogueQueryKeys.detail(catalogueId),
    });
  }
}

export function useCatalogueList(params: CatalogueListQueryParams) {
  return useQuery({
    queryKey: catalogueQueryKeys.list(params),
    queryFn: () => fetchCatalogueList(params),
    staleTime: 15_000,
  });
}

export function useCatalogueDetail(catalogueId: string) {
  return useQuery({
    queryKey: catalogueQueryKeys.detail(catalogueId),
    queryFn: () => fetchCatalogueDetail(catalogueId),
    enabled: catalogueId.length > 0,
    staleTime: 15_000,
  });
}

export function useVendorCandidates(params: VendorCandidatesQueryParams) {
  return useQuery({
    queryKey: catalogueQueryKeys.vendorCandidates(params),
    queryFn: () => fetchVendorCandidates(params),
    staleTime: 15_000,
  });
}

export function useCreateCatalogueEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vendorId: string) => createCatalogueEntry(vendorId),
    onSuccess: (data: CatalogueDetail) => {
      invalidateCatalogueQueries(queryClient);
      toast.success(`Added ${data.businessName} to the catalogue.`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create catalogue entry');
    },
  });
}

export function useDeleteCatalogueEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (catalogueId: string) => deleteCatalogueEntry(catalogueId),
    onSuccess: (_data, catalogueId) => {
      invalidateCatalogueQueries(queryClient, catalogueId);
      toast.success('Catalogue entry deleted.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete catalogue entry');
    },
  });
}

export function usePublishCatalogueEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (catalogueId: string) => publishCatalogueEntry(catalogueId),
    onSuccess: (data) => {
      invalidateCatalogueQueries(queryClient, data.catalogueId);
      toast.success(`${data.businessName} published.`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to publish catalogue entry');
    },
  });
}

export function useUnpublishCatalogueEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (catalogueId: string) => unpublishCatalogueEntry(catalogueId),
    onSuccess: (data) => {
      invalidateCatalogueQueries(queryClient, data.catalogueId);
      toast.success(`${data.businessName} unpublished.`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unpublish catalogue entry');
    },
  });
}
