import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  bulkDeleteCatalogue,
  bulkPublishCatalogue,
  bulkUnpublishCatalogue,
  type BulkOperationResponse,
} from '@/lib/warmpawz-pay-catalogue-admin';
import { catalogueQueryKeys } from './useCatalogue';

function toastBulkResult(action: string, result: BulkOperationResponse): void {
  if (result.failed === 0) {
    toast.success(`${action} completed for ${result.succeeded} item(s).`);
    return;
  }
  if (result.succeeded === 0) {
    toast.error(`${action} failed for all ${result.failed} item(s).`);
    return;
  }
  toast.warning(
    `${action}: ${result.succeeded} succeeded, ${result.failed} failed.`,
  );
}

export function useBulkCatalogueActions() {
  const queryClient = useQueryClient();

  const invalidateCatalogueList = () => {
    queryClient.invalidateQueries({ queryKey: catalogueQueryKeys.all });
  };

  const bulkPublishMutation = useMutation({
    mutationFn: (catalogueIds: readonly string[]) => bulkPublishCatalogue(catalogueIds),
    onSuccess: (result) => {
      invalidateCatalogueList();
      toastBulkResult('Bulk publish', result);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Bulk publish failed');
    },
  });

  const bulkUnpublishMutation = useMutation({
    mutationFn: (catalogueIds: readonly string[]) => bulkUnpublishCatalogue(catalogueIds),
    onSuccess: (result) => {
      invalidateCatalogueList();
      toastBulkResult('Bulk unpublish', result);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Bulk unpublish failed');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (catalogueIds: readonly string[]) => bulkDeleteCatalogue(catalogueIds),
    onSuccess: (result) => {
      invalidateCatalogueList();
      toastBulkResult('Bulk delete', result);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Bulk delete failed');
    },
  });

  return {
    bulkPublish: bulkPublishMutation.mutateAsync,
    bulkUnpublish: bulkUnpublishMutation.mutateAsync,
    bulkDelete: bulkDeleteMutation.mutateAsync,
    isLoading:
      bulkPublishMutation.isPending ||
      bulkUnpublishMutation.isPending ||
      bulkDeleteMutation.isPending,
  };
}
