'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@warmpawz/ui';
import {
  useBulkDeleteCatalogue,
  useBulkPublishCatalogue,
  useBulkUnpublishCatalogue,
  useBulkUpdateCatalogueFee,
  useCatalogueList,
  useDeleteCatalogueEntry,
  usePublishCatalogueEntry,
  useServiceCategories,
  useUnpublishCatalogueEntry,
  useUpdateCatalogueFee,
} from '@/hooks/warmpawz-appointments/useCatalogue';
import type {
  CatalogueEligibilityFilter,
  CatalogueListItem,
  CataloguePublishStatusFilter,
} from '@/lib/warmpawz-appointments-catalogue-admin';
import {
  createCatalogueEntry,
  fetchCatalogueList,
  updateCatalogueFee,
} from '@/lib/warmpawz-appointments-catalogue-admin';
import { WarmpawzAppointmentsShell } from '@/components/admin/warmpawz-appointments/shared/WarmpawzAppointmentsShell';
import { BulkFeeModal } from './BulkFeeModal';
import { CatalogueFilterBar } from './CatalogueFilterBar';
import { CatalogueTable } from './CatalogueTable';
import { ConfirmDialog } from './ConfirmDialog';
import { LoadingSkeleton } from './LoadingSkeleton';
import { Pagination } from './Pagination';

type PendingAction =
  | { type: 'unpublish'; item: CatalogueListItem }
  | { type: 'delete'; item: CatalogueListItem }
  | { type: 'bulk-publish' }
  | { type: 'bulk-unpublish' }
  | { type: 'bulk-delete' };

const PAGE_SIZE = 20;

async function ensureCatalogueId(
  item: CatalogueListItem,
  appointmentFee?: number,
): Promise<string> {
  if (item.catalogueId) {
    return item.catalogueId;
  }

  try {
    const created = await createCatalogueEntry(item.vendorId, appointmentFee);
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
  const [selectedCatalogueIds, setSelectedCatalogueIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [bulkFeeOpen, setBulkFeeOpen] = useState(false);

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
  const updateFeeMutation = useUpdateCatalogueFee();
  const publishMutation = usePublishCatalogueEntry();
  const unpublishMutation = useUnpublishCatalogueEntry();
  const deleteMutation = useDeleteCatalogueEntry();
  const bulkPublishMutation = useBulkPublishCatalogue();
  const bulkUnpublishMutation = useBulkUnpublishCatalogue();
  const bulkDeleteMutation = useBulkDeleteCatalogue();
  const bulkFeeMutation = useBulkUpdateCatalogueFee();

  const items = data?.items ?? [];
  const pagination = data?.pagination ?? {
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };

  useEffect(() => {
    const visibleIds = new Set(
      items
        .map((item) => item.catalogueId)
        .filter((id): id is string => Boolean(id)),
    );
    setSelectedCatalogueIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const selectedCount = selectedCatalogueIds.size;
  const selectedIds = useMemo(() => [...selectedCatalogueIds], [selectedCatalogueIds]);

  const anyMutationPending =
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    deleteMutation.isPending ||
    updateFeeMutation.isPending ||
    bulkPublishMutation.isPending ||
    bulkUnpublishMutation.isPending ||
    bulkDeleteMutation.isPending ||
    bulkFeeMutation.isPending ||
    rowBusyVendorId !== null;

  const saveFee = async (item: CatalogueListItem, appointmentFee: number) => {
    const catalogueId = await ensureCatalogueId(item, appointmentFee);
    await updateCatalogueFee(catalogueId, appointmentFee);
    return catalogueId;
  };

  const handleSaveFee = async (item: CatalogueListItem, appointmentFee: number) => {
    setRowBusyVendorId(item.vendorId);
    try {
      await saveFee(item, appointmentFee);
      await refetch();
      toast.success(`Appointment fee saved for ${item.businessName}.`);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Failed to save appointment fee';
      toast.error(message);
    } finally {
      setRowBusyVendorId(null);
    }
  };

  const handlePublish = async (item: CatalogueListItem, appointmentFee: number) => {
    setRowBusyVendorId(item.vendorId);
    try {
      const catalogueId = await saveFee(item, appointmentFee);
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

    try {
      if (pendingAction.type === 'unpublish') {
        const { item } = pendingAction;
        if (!item.catalogueId) {
          return;
        }
        setRowBusyVendorId(item.vendorId);
        await unpublishMutation.mutateAsync(item.catalogueId);
      } else if (pendingAction.type === 'delete') {
        const { item } = pendingAction;
        if (!item.catalogueId) {
          return;
        }
        setRowBusyVendorId(item.vendorId);
        await deleteMutation.mutateAsync(item.catalogueId);
      } else if (pendingAction.type === 'bulk-publish') {
        await bulkPublishMutation.mutateAsync(selectedIds);
        setSelectedCatalogueIds(new Set());
      } else if (pendingAction.type === 'bulk-unpublish') {
        await bulkUnpublishMutation.mutateAsync(selectedIds);
        setSelectedCatalogueIds(new Set());
      } else if (pendingAction.type === 'bulk-delete') {
        await bulkDeleteMutation.mutateAsync(selectedIds);
        setSelectedCatalogueIds(new Set());
      }
      await refetch();
    } finally {
      setRowBusyVendorId(null);
      setPendingAction(null);
    }
  };

  const handleBulkFeeConfirm = async (appointmentFee: number) => {
    try {
      await bulkFeeMutation.mutateAsync({
        catalogueIds: selectedIds,
        appointmentFee,
      });
      setBulkFeeOpen(false);
      setSelectedCatalogueIds(new Set());
      await refetch();
    } catch {
      // toast handled in mutation hook
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
            'This removes the Warmpawz Appointments catalogue entry. The vendor will remain in this list.',
          destructive: true,
        };
      case 'bulk-publish':
        return {
          title: 'Publish selected entries?',
          description: `Publish ${selectedCount} selected catalogue entries for customer appointments.`,
        };
      case 'bulk-unpublish':
        return {
          title: 'Unpublish selected entries?',
          description: `Return ${selectedCount} selected entries to draft.`,
        };
      case 'bulk-delete':
        return {
          title: 'Delete selected entries?',
          description: `Remove ${selectedCount} catalogue entries. Vendors will remain in this list.`,
          destructive: true,
        };
    }
  })();

  return (
    <WarmpawzAppointmentsShell
      title="Vendor Catalogue"
      subtitle="Manage approved vendors, appointment fees, and Warmpawz Appointments publish status."
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

        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
            <span className="text-sm font-medium text-gray-900">
              {selectedCount} selected
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={anyMutationPending}
              onClick={() => setBulkFeeOpen(true)}
            >
              Set fee
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={anyMutationPending}
              onClick={() => setPendingAction({ type: 'bulk-publish' })}
            >
              Publish
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={anyMutationPending}
              onClick={() => setPendingAction({ type: 'bulk-unpublish' })}
            >
              Unpublish
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={anyMutationPending}
              className="text-red-600 hover:text-red-700"
              onClick={() => setPendingAction({ type: 'bulk-delete' })}
            >
              Delete
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={anyMutationPending}
              onClick={() => setSelectedCatalogueIds(new Set())}
            >
              Clear
            </Button>
          </div>
        ) : null}

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
              selectedCatalogueIds={selectedCatalogueIds}
              onSelectionChange={setSelectedCatalogueIds}
              rowBusyVendorId={rowBusyVendorId}
              disabled={anyMutationPending}
              onSaveFee={handleSaveFee}
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

      <BulkFeeModal
        open={bulkFeeOpen}
        selectedCount={selectedCount}
        loading={bulkFeeMutation.isPending}
        onOpenChange={setBulkFeeOpen}
        onConfirm={(appointmentFee) => void handleBulkFeeConfirm(appointmentFee)}
      />
    </WarmpawzAppointmentsShell>
  );
}
