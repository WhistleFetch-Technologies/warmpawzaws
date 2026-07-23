'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';
import {
  useCreatePricing,
  useDisablePricing,
  usePricingList,
  useUpdatePricing,
} from '@/hooks/warmpawz-pay/usePricing';
import type {
  PricingDiscountTypeFilter,
  PricingListItem,
  PricingStatusFilter,
} from '@/lib/warmpawz-pay-pricing-admin';
import { AnalyticsErrorState } from '@/components/admin/marketing/analytics/AnalyticsStateViews';
import { ConfirmDialog } from '@/components/admin/warmpawz-pay/catalogue/ConfirmDialog';
import { LoadingSkeleton } from '@/components/admin/warmpawz-pay/catalogue/LoadingSkeleton';
import { Pagination } from '@/components/admin/warmpawz-pay/catalogue/Pagination';
import { SearchBar } from '@/components/admin/warmpawz-pay/catalogue/SearchBar';
import { WarmpawzPayShell } from '@/components/admin/warmpawz-pay/shared/WarmpawzPayShell';
import {
  PricingFormDialog,
  type PricingFormMode,
  type PricingFormValues,
} from './PricingFormDialog';
import { PricingTable } from './PricingTable';

const PAGE_SIZE = 20;

const CATEGORY_OPTIONS = [
  'All categories',
  'Veterinary',
  'Grooming',
  'Training',
  'Walking',
  'Sitting',
  'Daycare',
  'Ambulance',
  'Other Services',
] as const;

export function PricingDashboardPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [statusFilter, setStatusFilter] = useState<PricingStatusFilter>('all');
  const [discountTypeFilter, setDiscountTypeFilter] =
    useState<PricingDiscountTypeFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<PricingFormMode>('create');
  const [selectedItem, setSelectedItem] = useState<PricingListItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'disable' | 'delete' | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const createMutation = useCreatePricing();
  const updateMutation = useUpdatePricing();
  const disableMutation = useDisablePricing();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const listParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      sortBy: 'updatedAt' as const,
      sortOrder: 'desc' as const,
      q: searchQuery || undefined,
      category:
        categoryFilter === 'All categories'
          ? undefined
          : categoryFilter.toLowerCase(),
      status: statusFilter,
      discountType: discountTypeFilter,
    }),
    [page, searchQuery, categoryFilter, statusFilter, discountTypeFilter],
  );

  const { data, isLoading, isFetching, error, refresh } = usePricingList(listParams);

  const openForm = (mode: PricingFormMode, item?: PricingListItem) => {
    setFormMode(mode);
    setSelectedItem(item ?? null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (values: PricingFormValues) => {
    try {
      if (formMode === 'create') {
        await createMutation.mutateAsync({
          vendorId: values.vendorId,
          discountType: values.discountType,
          discountValue: values.discountValue,
          status: values.status,
          effectiveFrom: values.effectiveFrom,
          effectiveUntil: values.effectiveUntil || null,
        });
      } else if (formMode === 'edit' && selectedItem) {
        await updateMutation.mutateAsync({
          vendorId: selectedItem.vendorId,
          payload: {
            discountType: values.discountType,
            discountValue: values.discountValue,
            status: values.status,
            effectiveFrom: values.effectiveFrom,
            effectiveUntil: values.effectiveUntil || null,
          },
        });
      }
      setFormOpen(false);
    } catch {
      // mutation error surfaces via dialog staying open; list refresh handled by hook
    }
  };

  const handleEnable = async (item: PricingListItem) => {
    setRowBusyId(item.vendorId);
    try {
      await updateMutation.mutateAsync({
        vendorId: item.vendorId,
        payload: { status: 'active' },
      });
    } finally {
      setRowBusyId(null);
    }
  };

  const openConfirm = (item: PricingListItem, action: 'disable' | 'delete') => {
    setSelectedItem(item);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedItem || !confirmAction) {
      return;
    }

    setRowBusyId(selectedItem.vendorId);
    try {
      if (confirmAction === 'disable') {
        await updateMutation.mutateAsync({
          vendorId: selectedItem.vendorId,
          payload: { status: 'disabled' },
        });
      } else {
        await disableMutation.mutateAsync(selectedItem.vendorId);
      }
      setConfirmOpen(false);
    } finally {
      setRowBusyId(null);
    }
  };

  const formLoading = createMutation.isPending || updateMutation.isPending;
  const items = data?.items ?? [];
  const pagination = data?.pagination ?? {
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };

  return (
    <WarmpawzPayShell
      title="Merchant Pricing"
      subtitle="Configure commercial discount terms used by the Quote Engine."
      actions={
        <Button type="button" onClick={() => openForm('create')}>
          Create Pricing
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search business names..."
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              setCategoryFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Category filter">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as PricingStatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Status filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={discountTypeFilter}
            onValueChange={(value) => {
              setDiscountTypeFilter(value as PricingDiscountTypeFilter);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Discount type filter">
              <SelectValue placeholder="Discount type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All discount types</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <AnalyticsErrorState
            message={error.message || 'Failed to load pricing configurations.'}
            onRetry={() => refresh()}
          />
        ) : isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <PricingTable
              items={items}
              rowBusyId={rowBusyId}
              disabled={isFetching || formLoading}
              onView={(item) => openForm('view', item)}
              onEdit={(item) => openForm('edit', item)}
              onEnable={handleEnable}
              onDisable={(item) => openConfirm(item, 'disable')}
              onDelete={(item) => openConfirm(item, 'delete')}
            />
            <Pagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <PricingFormDialog
        open={formOpen}
        mode={formMode}
        initial={selectedItem}
        loading={formLoading}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={confirmAction === 'delete' ? 'Delete pricing?' : 'Disable pricing?'}
        description={
          confirmAction === 'delete'
            ? `This will soft-delete pricing for ${selectedItem?.businessName ?? 'this merchant'}.`
            : `Disable pricing for ${selectedItem?.businessName ?? 'this merchant'}?`
        }
        confirmLabel={confirmAction === 'delete' ? 'Delete' : 'Disable'}
        destructive
        loading={disableMutation.isPending || updateMutation.isPending}
        onConfirm={handleConfirm}
        onOpenChange={setConfirmOpen}
      />
    </WarmpawzPayShell>
  );
}
