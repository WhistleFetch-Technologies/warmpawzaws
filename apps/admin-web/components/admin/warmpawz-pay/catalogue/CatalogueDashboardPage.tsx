'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useCatalogueList,
  useDeleteCatalogueEntry,
  usePublishCatalogueEntry,
  useServiceCategories,
  useUnpublishCatalogueEntry,
} from '@/hooks/warmpawz-pay/useCatalogue';
import { useCreatePricing, useUpdatePricing } from '@/hooks/warmpawz-pay/usePricing';
import type { WarmpawzPayPricingFormValues } from '@/lib/warmpawz-pay-pricing-admin';
import type {
  CatalogueEligibilityFilter,
  CatalogueListItem,
  CataloguePublishStatusFilter,
} from '@/lib/warmpawz-pay-catalogue-admin';
import { createCatalogueEntry, fetchCatalogueList } from '@/lib/warmpawz-pay-catalogue-admin';
import { CatalogueFilterBar } from './CatalogueFilterBar';
import { CatalogueTable } from './CatalogueTable';
import { ConfirmDialog } from './ConfirmDialog';
import { LoadingSkeleton } from './LoadingSkeleton';
import { Pagination } from './Pagination';
import { WarmpawzPayShell } from '@/components/admin/warmpawz-pay/shared/WarmpawzPayShell';

type PendingAction =
  | { type: 'unpublish'; item: CatalogueListItem }
  | { type: 'delete'; item: CatalogueListItem };

const PAGE_SIZE = 20;

async function ensureCatalogueId(item: CatalogueListItem): Promise<string> {
  if (item.catalogueId) {
    return item.catalogueId;
  }

  try {
    const created = await createCatalogueEntry(item.vendorId);
    if (!created.catalogueId) {
      throw new Error('Failed to create catalogue entry');
    }
    return created.catalogueId;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '';
    if (message.toLowerCase().includes('duplicate')) {
      const list = await fetchCatalogueList({
        vendorId: item.vendorId,
        page: 1,
        pageSize: 1,
      });
      const existing = list.items.find((entry) => entry.vendorId === item.vendorId);
      if (existing?.catalogueId) {
        return existing.catalogueId;
      }
    }
    throw cause;
  }
}

export function CatalogueDashboardPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [eligibilityFilter, setEligibilityFilter] =
    useState<CatalogueEligibilityFilter>('all');
  const [publishStatusFilter, setPublishStatusFilter] =
    useState<CataloguePublishStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [vendorIdFilter, setVendorIdFilter] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [rowBusyVendorId, setRowBusyVendorId] = useState<string | null>(null);

  const createPricingMutation = useCreatePricing();
  const updatePricingMutation = useUpdatePricing();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const resetPage = () => setPage(1);

  const listParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      sortBy: 'updatedAt' as const,
      sortOrder: 'desc' as const,
      publishStatus:
        publishStatusFilter === 'all' ? undefined : publishStatusFilter,
      q: searchQuery || undefined,
      eligibility: eligibilityFilter === 'all' ? undefined : eligibilityFilter,
      serviceCategory: categoryFilter === 'all' ? undefined : categoryFilter,
      vendorId: vendorIdFilter.trim() || undefined,
    }),
    [page, searchQuery, eligibilityFilter, publishStatusFilter, categoryFilter, vendorIdFilter],
  );

  const { data, isLoading, isFetching, error, refetch } = useCatalogueList(listParams);
  const { data: serviceCategories = [] } = useServiceCategories();
  const publishMutation = usePublishCatalogueEntry();
  const unpublishMutation = useUnpublishCatalogueEntry();
  const deleteMutation = useDeleteCatalogueEntry();

  const items = data?.items ?? [];
  const pagination = data?.pagination ?? {
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };

  const anyMutationPending =
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    deleteMutation.isPending ||
    createPricingMutation.isPending ||
    updatePricingMutation.isPending ||
    rowBusyVendorId !== null;

  const savePricing = async (item: CatalogueListItem, values: WarmpawzPayPricingFormValues) => {
    const catalogueId = await ensureCatalogueId(item);
    const pricingFields = {
      tierId: values.tierId,
      discountType: 'percentage' as const,
      discountValue: values.discountValue,
      status: 'active' as const,
      effectiveFrom: new Date().toISOString(),
      effectiveUntil: null,
    };

    if (item.pricing.configured) {
      await updatePricingMutation.mutateAsync({
        vendorId: item.vendorId,
        payload: pricingFields,
      });
    } else {
      await createPricingMutation.mutateAsync({
        vendorId: item.vendorId,
        ...pricingFields,
      });
    }

    return catalogueId;
  };

  const handleSaveDiscount = async (
    item: CatalogueListItem,
    values: WarmpawzPayPricingFormValues,
  ) => {
    setRowBusyVendorId(item.vendorId);
    try {
      await savePricing(item, values);
      await refetch();
      toast.success(`Pricing saved for ${item.businessName}.`);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Failed to save discount';
      toast.error(message);
    } finally {
      setRowBusyVendorId(null);
    }
  };

  const handlePublish = async (
    item: CatalogueListItem,
    values: WarmpawzPayPricingFormValues,
  ) => {
    setRowBusyVendorId(item.vendorId);
    try {
      const catalogueId = await savePricing(item, values);
      await publishMutation.mutateAsync(catalogueId);
      await refetch();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Failed to publish catalogue entry';
      toast.error(message);
    } finally {
      setRowBusyVendorId(null);
    }
  };

  const runPendingAction = async () => {
    if (!pendingAction) {
      return;
    }

    const { item } = pendingAction;
    if (!item.catalogueId) {
      setPendingAction(null);
      return;
    }

    setRowBusyVendorId(item.vendorId);
    try {
      if (pendingAction.type === 'unpublish') {
        await unpublishMutation.mutateAsync(item.catalogueId);
      } else {
        await deleteMutation.mutateAsync(item.catalogueId);
      }
      await refetch();
    } finally {
      setRowBusyVendorId(null);
      setPendingAction(null);
    }
  };

  const confirmCopy = (() => {
    if (!pendingAction) {
      return { title: '', description: '' };
    }
    switch (pendingAction.type) {
      case 'unpublish':
        return {
          title: 'Save as draft?',
          description: 'The entry will return to draft and stop being published.',
        };
      case 'delete':
        return {
          title: 'Delete catalogue entry?',
          description:
            'This removes the Warmpawz Pay catalogue entry. The vendor will remain in this list.',
          destructive: true,
        };
    }
  })();

  return (
    <WarmpawzPayShell
      title="Vendor Catalogue"
      subtitle="Manage approved vendors, discounts, and Warmpawz Pay publish status."
    >
      <div className="space-y-4">
        <CatalogueFilterBar
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={(value) => {
            setCategoryFilter(value);
            resetPage();
          }}
          serviceCategoryOptions={serviceCategories}
          eligibilityFilter={eligibilityFilter}
          onEligibilityFilterChange={(value) => {
            setEligibilityFilter(value);
            resetPage();
          }}
          vendorIdFilter={vendorIdFilter}
          onVendorIdFilterChange={(value) => {
            setVendorIdFilter(value);
            resetPage();
          }}
          publishStatusFilter={publishStatusFilter}
          onPublishStatusFilterChange={(value) => {
            setPublishStatusFilter(value);
            resetPage();
          }}
          showPublishStatus
          disabled={isLoading}
        />

        <p className="text-sm text-gray-600">
          {isFetching ? 'Refreshing…' : `${pagination.total} approved vendors`}
        </p>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error instanceof Error ? error.message : 'Failed to load catalogue entries.'}
          </div>
        ) : null}

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <CatalogueTable
              items={items}
              rowBusyVendorId={rowBusyVendorId}
              disabled={anyMutationPending}
              onSaveDiscount={handleSaveDiscount}
              onPublish={handlePublish}
              onUnpublish={(item) => setPendingAction({ type: 'unpublish', item })}
              onDelete={(item) => setPendingAction({ type: 'delete', item })}
            />
            <Pagination
              pagination={pagination}
              disabled={isFetching || anyMutationPending}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={confirmCopy.title}
        description={confirmCopy.description}
        destructive={'destructive' in confirmCopy && confirmCopy.destructive === true}
        loading={anyMutationPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
        onConfirm={() => void runPendingAction()}
      />
    </WarmpawzPayShell>
  );
}
