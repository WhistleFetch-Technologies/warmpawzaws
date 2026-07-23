'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';
import {
  useCreateCatalogueEntry,
  useVendorCandidates,
} from '@/hooks/warmpawz-pay/useCatalogue';
import {
  customerVisibleFromCandidate,
  eligibilityWarningsFromCandidate,
  type VendorCandidateDTO,
} from '@/lib/warmpawz-pay-catalogue-admin';
import { EligibilityBadge } from './EligibilityBadge';
import { EligibilityWarnings } from './EligibilityWarnings';
import { LoadingSkeleton } from './LoadingSkeleton';
import { Pagination } from './Pagination';
import { SearchBar } from './SearchBar';
import { VendorCandidateTable } from './VendorCandidateTable';
import { WarmpawzPayCatalogueShell } from './WarmpawzPayCatalogueShell';

const PAGE_SIZE = 20;

export function CatalogueCreatePage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  const createMutation = useCreateCatalogueEntry();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const candidateParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      q: searchQuery || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, searchQuery, statusFilter],
  );

  const { data, isLoading, error } = useVendorCandidates(candidateParams);
  const items = data?.items ?? [];
  const pagination = data?.pagination ?? {
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };

  const selectedCandidate: VendorCandidateDTO | null =
    items.find((item) => item.vendorId === selectedVendorId) ?? null;

  const previewEligibility = selectedCandidate
    ? {
        payBillEnabled: selectedCandidate.payBillEnabled,
        bankVerified: selectedCandidate.bankVerified,
        vendorStatus: selectedCandidate.status,
        customerVisible: customerVisibleFromCandidate(selectedCandidate),
      }
    : null;

  const previewWarnings = selectedCandidate
    ? eligibilityWarningsFromCandidate(selectedCandidate)
    : [];

  const handleCreate = async () => {
    if (!selectedVendorId) {
      return;
    }
    const created = await createMutation.mutateAsync(selectedVendorId);
    router.push(`/warmpawz-pay/catalogue/${created.catalogueId}`);
  };

  return (
    <WarmpawzPayCatalogueShell
      title="Add Catalogue Entry"
      subtitle="Search eligible vendors and create a draft catalogue entry."
      actions={
        <Button type="button" variant="outline" onClick={() => router.push('/warmpawz-pay/catalogue')}>
          Back to catalogue
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search vendor candidates…"
            disabled={isLoading || createMutation.isPending}
          />
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44 bg-white">
              <SelectValue placeholder="Vendor status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
              selectedVendorId={selectedVendorId}
              disabled={createMutation.isPending}
              onSelect={setSelectedVendorId}
            />
            <Pagination
              pagination={pagination}
              disabled={createMutation.isPending}
              onPageChange={setPage}
            />
          </>
        )}

        {selectedCandidate && previewEligibility ? (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedCandidate.businessName}
                </h2>
                <p className="text-sm text-gray-600">
                  Customer visibility preview for Pay Bill discovery
                </p>
              </div>
              <EligibilityBadge customerVisible={previewEligibility.customerVisible} />
            </div>
            <EligibilityWarnings
              eligibility={previewEligibility}
              warnings={previewWarnings}
            />
            <Button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => void handleCreate()}
            >
              {createMutation.isPending ? 'Creating…' : 'Create catalogue entry'}
            </Button>
          </div>
        ) : null}
      </div>
    </WarmpawzPayCatalogueShell>
  );
}
