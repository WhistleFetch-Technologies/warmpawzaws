'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@warmpawz/ui';
import { toast } from 'sonner';
import { catalogueQueryKeys, useVendorCandidates } from '@/hooks/warmpawz-pay/useCatalogue';
import { pricingQueryKeys } from '@/hooks/warmpawz-pay/usePricing';
import type { CatalogueEligibilityFilter } from '@/lib/warmpawz-pay-catalogue-admin';
import {
  createCatalogueEntry,
  publishCatalogueEntry,
} from '@/lib/warmpawz-pay-catalogue-admin';
import { createPricing } from '@/lib/warmpawz-pay-pricing-admin';
import { CatalogueFilterBar } from './CatalogueFilterBar';
import { LoadingSkeleton } from './LoadingSkeleton';
import { Pagination } from './Pagination';
import { VendorCandidateTable } from './VendorCandidateTable';
import { WarmpawzPayShell } from '@/components/admin/warmpawz-pay/shared/WarmpawzPayShell';

const PAGE_SIZE = 20;

export function CatalogueCreatePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [platformStatusFilter, setPlatformStatusFilter] = useState('all');
  const [eligibilityFilter, setEligibilityFilter] =
    useState<CatalogueEligibilityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [vendorIdFilter, setVendorIdFilter] = useState('');
  const [busyVendorId, setBusyVendorId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const resetPage = () => setPage(1);

  const candidateParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      q: searchQuery || undefined,
      status: platformStatusFilter === 'all' ? undefined : platformStatusFilter,
      eligibility: eligibilityFilter === 'all' ? undefined : eligibilityFilter,
      category:
        categoryFilter === 'All categories'
          ? undefined
          : categoryFilter.toLowerCase(),
      vendorId: vendorIdFilter.trim() || undefined,
    }),
    [
      page,
      searchQuery,
      platformStatusFilter,
      eligibilityFilter,
      categoryFilter,
      vendorIdFilter,
    ],
  );

  const { data, isLoading, error, refetch } = useVendorCandidates(candidateParams);
  const items = data?.items ?? [];
  const pagination = data?.pagination ?? {
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };

  const anyPending = busyVendorId !== null;

  const invalidateCatalogueData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: catalogueQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: pricingQueryKeys.all }),
    ]);
  };

  const createCatalogueWithPricing = async (
    vendorId: string,
    discountValue: number,
  ): Promise<{ catalogueId: string; businessName: string }> => {
    const created = await createCatalogueEntry(vendorId);
    await createPricing({
      vendorId,
      discountType: 'percentage',
      discountValue,
      status: 'active',
      effectiveFrom: new Date().toISOString(),
      effectiveUntil: null,
    });
    return {
      catalogueId: created.catalogueId,
      businessName: created.businessName,
    };
  };

  const handleSaveDraft = async (vendorId: string, discountValue: number) => {
    setBusyVendorId(vendorId);
    try {
      await createCatalogueWithPricing(vendorId, discountValue);
      await invalidateCatalogueData();
      toast.success('Vendor saved as draft with Warmpawz Pay discount.');
      await refetch();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Failed to save draft catalogue entry';
      toast.error(message);
    } finally {
      setBusyVendorId(null);
    }
  };

  const handlePublish = async (vendorId: string, discountValue: number) => {
    setBusyVendorId(vendorId);
    try {
      const { catalogueId, businessName } = await createCatalogueWithPricing(
        vendorId,
        discountValue,
      );
      await publishCatalogueEntry(catalogueId);
      await invalidateCatalogueData();
      toast.success(`${businessName} published to Warmpawz Pay.`);
      await refetch();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Failed to publish catalogue entry';
      toast.error(message);
    } finally {
      setBusyVendorId(null);
    }
  };

  return (
    <WarmpawzPayShell
      title="Add Catalogue Entry"
      subtitle="Search eligible vendors, set a Warmpawz Pay discount, and save or publish."
      actions={
        <Button type="button" variant="outline" onClick={() => router.push('/warmpawz-pay/catalogue')}>
          Back to catalogue
        </Button>
      }
    >
      <div className="space-y-6">
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
          platformStatusFilter={platformStatusFilter}
          onPlatformStatusFilterChange={(value) => {
            setPlatformStatusFilter(value);
            resetPage();
          }}
          showPlatformStatus
          disabled={anyPending || isLoading}
          searchPlaceholder="Search business name…"
        />

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error instanceof Error ? error.message : 'Failed to load vendor candidates.'}
          </div>
        ) : null}

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <VendorCandidateTable
              items={items}
              disabled={anyPending}
              busyVendorId={busyVendorId}
              onSaveDraft={handleSaveDraft}
              onPublish={handlePublish}
            />
            <Pagination
              pagination={pagination}
              disabled={anyPending}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </WarmpawzPayShell>
  );
}
