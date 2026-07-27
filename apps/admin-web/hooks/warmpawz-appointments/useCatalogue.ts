import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  bulkDeleteCatalogue,
  bulkPublishCatalogue,
  bulkUnpublishCatalogue,
  bulkUpdateCatalogueFee,
  createCatalogueEntry,
  deleteCatalogueEntry,
  fetchCatalogueDetail,
  fetchCatalogueList,
  fetchServiceCategories,
  fetchVendorCandidates,
  publishCatalogueEntry,
  unpublishCatalogueEntry,
  updateCatalogueFee,
  type BulkOperationResponse,
  type CatalogueDetail,
  type CatalogueListQueryParams,
  type VendorCandidatesQueryParams,
} from '@/lib/warmpawz-appointments-catalogue-admin';

export const catalogueQueryKeys = {
  all: ['warmpawz-appointments-catalogue'] as const,
  list: (params: CatalogueListQueryParams) =>
    [...catalogueQueryKeys.all, 'list', params] as const,
  detail: (catalogueId: string) =>
    [...catalogueQueryKeys.all, 'detail', catalogueId] as const,
  vendorCandidates: (params: VendorCandidatesQueryParams) =>
    [...catalogueQueryKeys.all, 'vendor-candidates', params] as const,
  serviceCategories: () => [...catalogueQueryKeys.all, 'service-categories'] as const,
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

function toastBulkResult(action: string, result: BulkOperationResponse): void {
  if (result.failed === 0) {
    toast.success(`${action}: ${result.succeeded} succeeded.`);
    return;
  }
  if (result.succeeded === 0) {
    toast.error(`${action} failed for all ${result.failed} entries.`);
    return;
  }
  toast.warning(`${action}: ${result.succeeded} succeeded, ${result.failed} failed.`);
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

export function useServiceCategories() {
  return useQuery({
    queryKey: catalogueQueryKeys.serviceCategories(),
    queryFn: () => fetchServiceCategories(),
    staleTime: 60_000,
  });
}

export function useCreateCatalogueEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vendorId, appointmentFee }: { vendorId: string; appointmentFee?: number }) =>
      createCatalogueEntry(vendorId, appointmentFee),
    onSuccess: (data: CatalogueDetail) => {
      invalidateCatalogueQueries(queryClient);
      toast.success(`Added ${data.businessName} to the catalogue.`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create catalogue entry');
    },
  });
}

export function useUpdateCatalogueFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      catalogueId,
      appointmentFee,
    }: {
      catalogueId: string;
      appointmentFee: number;
    }) => updateCatalogueFee(catalogueId, appointmentFee),
    onSuccess: (data) => {
      invalidateCatalogueQueries(queryClient, data.catalogueId ?? undefined);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update appointment fee');
    },
  });
}

export function useBulkUpdateCatalogueFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      catalogueIds,
      appointmentFee,
    }: {
      catalogueIds: readonly string[];
      appointmentFee: number;
    }) => bulkUpdateCatalogueFee(catalogueIds, appointmentFee),
    onSuccess: (result) => {
      invalidateCatalogueQueries(queryClient);
      toastBulkResult('Bulk fee update', result);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update fees in bulk');
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
      invalidateCatalogueQueries(queryClient, data.catalogueId ?? undefined);
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
      invalidateCatalogueQueries(queryClient, data.catalogueId ?? undefined);
      toast.success(`${data.businessName} unpublished.`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unpublish catalogue entry');
    },
  });
}

export function useBulkPublishCatalogue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (catalogueIds: readonly string[]) => bulkPublishCatalogue(catalogueIds),
    onSuccess: (result) => {
      invalidateCatalogueQueries(queryClient);
      toastBulkResult('Bulk publish', result);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to bulk publish');
    },
  });
}

export function useBulkUnpublishCatalogue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (catalogueIds: readonly string[]) => bulkUnpublishCatalogue(catalogueIds),
    onSuccess: (result) => {
      invalidateCatalogueQueries(queryClient);
      toastBulkResult('Bulk unpublish', result);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to bulk unpublish');
    },
  });
}

export function useBulkDeleteCatalogue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (catalogueIds: readonly string[]) => bulkDeleteCatalogue(catalogueIds),
    onSuccess: (result) => {
      invalidateCatalogueQueries(queryClient);
      toastBulkResult('Bulk delete', result);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to bulk delete');
    },
  });
}
