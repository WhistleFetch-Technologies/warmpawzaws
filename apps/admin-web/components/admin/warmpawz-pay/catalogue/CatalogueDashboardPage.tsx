'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@warmpawz/ui';
import { Plus } from 'lucide-react';
import {
  useCatalogueList,
  useDeleteCatalogueEntry,
  usePublishCatalogueEntry,
  useUnpublishCatalogueEntry,
} from '@/hooks/warmpawz-pay/useCatalogue';
import { useBulkCatalogueActions } from '@/hooks/warmpawz-pay/useBulkCatalogueActions';
import {
  useCreatePricing,
  usePricingDetail,
  useUpdatePricing,
} from '@/hooks/warmpawz-pay/usePricing';
import type { CatalogueEligibilityFilter, CatalogueListItem } from '@/lib/warmpawz-pay-catalogue-admin';
import { BulkToolbar } from './BulkToolbar';
import { CatalogueFilterBar } from './CatalogueFilterBar';
import { CatalogueTable } from './CatalogueTable';
import { ConfirmDialog } from './ConfirmDialog';
import { LoadingSkeleton } from './LoadingSkeleton';
import { Pagination } from './Pagination';
import {
  PricingFormDialog,
  type PricingFormMode,
  type PricingFormValues,
} from './PricingFormDialog';
import { WarmpawzPayShell } from '@/components/admin/warmpawz-pay/shared/WarmpawzPayShell';

type PendingAction =
  | { type: 'publish'; catalogueId: string }
  | { type: 'unpublish'; catalogueId: string }
  | { type: 'delete'; catalogueId: string }
  | { type: 'bulk-unpublish' }
  | { type: 'bulk-delete' };

const PAGE_SIZE = 20;

export function CatalogueDashboardPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [eligibilityFilter, setEligibilityFilter] =
    useState<CatalogueEligibilityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [vendorIdFilter, setVendorIdFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [pricingItem, setPricingItem] = useState<CatalogueListItem | null>(null);
  const [pricingFormOpen, setPricingFormOpen] = useState(false);

  const createPricingMutation = useCreatePricing();
  const updatePricingMutation = useUpdatePricing();
  const pricingDetailQuery = usePricingDetail(pricingItem?.vendorId ?? null);

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
      publishStatus: 'published' as const,
      q: searchQuery || undefined,
      eligibility: eligibilityFilter === 'all' ? undefined : eligibilityFilter,
      category:
        categoryFilter === 'All categories'
          ? undefined
          : categoryFilter.toLowerCase(),
      vendorId: vendorIdFilter.trim() || undefined,
    }),
    [page, searchQuery, eligibilityFilter, categoryFilter, vendorIdFilter],
  );

  const { data, isLoading, isFetching, error } = useCatalogueList(listParams);
  const publishMutation = usePublishCatalogueEntry();
  const unpublishMutation = useUnpublishCatalogueEntry();
  const deleteMutation = useDeleteCatalogueEntry();
  const { bulkUnpublish, bulkDelete, isLoading: isBulkLoading } =
    useBulkCatalogueActions();

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
    isBulkLoading ||
    createPricingMutation.isPending ||
    updatePricingMutation.isPending;

  const pricingFormMode: PricingFormMode =
    pricingItem?.pricing.configured || pricingDetailQuery.data ? 'edit' : 'create';

  const openPricingForm = (item: CatalogueListItem) => {
    setPricingItem(item);
    setPricingFormOpen(true);
  };

  const handlePricingSubmit = async (values: PricingFormValues) => {
    if (!pricingItem) {
      return;
    }

    try {
      if (pricingFormMode === 'create') {
        await createPricingMutation.mutateAsync({
          vendorId: values.vendorId,
          discountType: values.discountType,
          discountValue: values.discountValue,
          status: values.status,
          effectiveFrom: values.effectiveFrom,
          effectiveUntil: values.effectiveUntil || null,
        });
      } else {
        await updatePricingMutation.mutateAsync({
          vendorId: pricingItem.vendorId,
          payload: {
            discountType: values.discountType,
            discountValue: values.discountValue,
            status: values.status,
            effectiveFrom: values.effectiveFrom,
            effectiveUntil: values.effectiveUntil || null,
          },
        });
      }
      setPricingFormOpen(false);
      setPricingItem(null);
    } catch {
      // keep dialog open on error
    }
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((item) => item.catalogueId)));
  };

  const toggleOne = (catalogueId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(catalogueId);
      } else {
        next.delete(catalogueId);
      }
      return next;
    });
  };

  const runPendingAction = async () => {
    if (!pendingAction) {
      return;
    }

    try {
      switch (pendingAction.type) {
        case 'publish':
          setRowBusyId(pendingAction.catalogueId);
          await publishMutation.mutateAsync(pendingAction.catalogueId);
          break;
        case 'unpublish':
          setRowBusyId(pendingAction.catalogueId);
          await unpublishMutation.mutateAsync(pendingAction.catalogueId);
          break;
        case 'delete':
          setRowBusyId(pendingAction.catalogueId);
          await deleteMutation.mutateAsync(pendingAction.catalogueId);
          setSelectedIds((current) => {
            const next = new Set(current);
            next.delete(pendingAction.catalogueId);
            return next;
          });
          break;
        case 'bulk-unpublish':
          await bulkUnpublish([...selectedIds]);
          setSelectedIds(new Set());
          break;
        case 'bulk-delete':
          await bulkDelete([...selectedIds]);
          setSelectedIds(new Set());
          break;
      }
    } finally {
      setRowBusyId(null);
      setPendingAction(null);
    }
  };

  const confirmCopy = (() => {
    if (!pendingAction) {
      return { title: '', description: '' };
    }
    switch (pendingAction.type) {
      case 'publish':
        return {
          title: 'Publish catalogue entry?',
          description: 'This vendor will be marked published in the Warmpawz Pay catalogue.',
        };
      case 'unpublish':
        return {
          title: 'Save as draft?',
          description: 'The entry will return to draft and stop being published.',
        };
      case 'delete':
        return {
          title: 'Delete catalogue entry?',
          description: 'This action cannot be undone.',
          destructive: true,
        };
      case 'bulk-unpublish':
        return {
          title: `Save ${selectedIds.size} entries as draft?`,
          description: 'Selected catalogue entries will return to draft.',
        };
      case 'bulk-delete':
        return {
          title: `Delete ${selectedIds.size} entries?`,
          description: 'This action cannot be undone.',
          destructive: true,
        };
    }
  })();

  return (
    <WarmpawzPayShell
      title="Vendor Catalogue"
      subtitle="View and manage published Warmpawz Pay vendors."
      actions={
        <Button type="button" asChild>
          <Link href="/warmpawz-pay/catalogue/create">
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Link>
        </Button>
      }
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
          disabled={isLoading}
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            {isFetching ? 'Refreshing…' : `${pagination.total} published vendors`}
          </p>
          <BulkToolbar
            selectedCount={selectedIds.size}
            disabled={anyMutationPending}
            showPublish={false}
            onPublish={() => undefined}
            onUnpublish={() => setPendingAction({ type: 'bulk-unpublish' })}
            onDelete={() => setPendingAction({ type: 'bulk-delete' })}
            onClear={() => setSelectedIds(new Set())}
          />
        </div>

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
              selectedIds={selectedIds}
              rowBusyId={rowBusyId}
              disabled={anyMutationPending}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
              onPublish={(catalogueId) => setPendingAction({ type: 'publish', catalogueId })}
              onUnpublish={(catalogueId) =>
                setPendingAction({ type: 'unpublish', catalogueId })
              }
              onDelete={(catalogueId) => setPendingAction({ type: 'delete', catalogueId })}
              onEditPricing={openPricingForm}
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

      {pricingItem ? (
        <PricingFormDialog
          open={pricingFormOpen}
          mode={pricingFormMode}
          vendorId={pricingItem.vendorId}
          businessName={pricingItem.businessName}
          initial={pricingDetailQuery.data ?? null}
          loading={
            createPricingMutation.isPending ||
            updatePricingMutation.isPending ||
            pricingDetailQuery.isFetching
          }
          onOpenChange={(open) => {
            setPricingFormOpen(open);
            if (!open) {
              setPricingItem(null);
            }
          }}
          onSubmit={(values) => void handlePricingSubmit(values)}
        />
      ) : null}
    </WarmpawzPayShell>
  );
}
