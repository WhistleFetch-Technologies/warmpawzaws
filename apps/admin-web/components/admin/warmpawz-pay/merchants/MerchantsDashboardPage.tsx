'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmpawz/ui';
import { useMerchantsList } from '@/hooks/warmpawz-pay/useMerchants';
import type {
  BusinessTypeFilter,
  CustomerVisibleFilter,
  PlatformStatusFilter,
  WarmpawzPayStatusFilter,
} from '@/lib/warmpawz-pay-merchants-admin';
import { AnalyticsErrorState } from '@/components/admin/marketing/analytics/AnalyticsStateViews';
import { LoadingSkeleton } from '@/components/admin/warmpawz-pay/catalogue/LoadingSkeleton';
import { Pagination } from '@/components/admin/warmpawz-pay/catalogue/Pagination';
import { SearchBar } from '@/components/admin/warmpawz-pay/catalogue/SearchBar';
import { WarmpawzPayShell } from '@/components/admin/warmpawz-pay/shared/WarmpawzPayShell';
import { MerchantsTable } from './MerchantsTable';

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

export function MerchantsDashboardPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [businessTypeFilter, setBusinessTypeFilter] =
    useState<BusinessTypeFilter>('all');
  const [platformStatusFilter, setPlatformStatusFilter] =
    useState<PlatformStatusFilter>('all');
  const [warmpawzPayStatusFilter, setWarmpawzPayStatusFilter] =
    useState<WarmpawzPayStatusFilter>('all');
  const [customerVisibleFilter, setCustomerVisibleFilter] =
    useState<CustomerVisibleFilter>('all');

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
      businessType: businessTypeFilter,
      platformStatus: platformStatusFilter,
      warmpawzPayStatus: warmpawzPayStatusFilter,
      customerVisible: customerVisibleFilter,
    }),
    [
      page,
      searchQuery,
      categoryFilter,
      businessTypeFilter,
      platformStatusFilter,
      warmpawzPayStatusFilter,
      customerVisibleFilter,
    ],
  );

  const { data, isLoading, isFetching, error, refresh } = useMerchantsList(listParams);

  return (
    <WarmpawzPayShell
      title="Merchant Management"
      subtitle="Operational view of Warmpawz Pay merchants, readiness, and visibility."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-6">
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
            value={businessTypeFilter}
            onValueChange={(value) => {
              setBusinessTypeFilter(value as BusinessTypeFilter);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Business type filter">
              <SelectValue placeholder="Business type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All business types</SelectItem>
              <SelectItem value="solo">Solo</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="center">Center</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={platformStatusFilter}
            onValueChange={(value) => {
              setPlatformStatusFilter(value as PlatformStatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Platform status filter">
              <SelectValue placeholder="Platform status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platform statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={warmpawzPayStatusFilter}
            onValueChange={(value) => {
              setWarmpawzPayStatusFilter(value as WarmpawzPayStatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Warmpawz Pay status filter">
              <SelectValue placeholder="Warmpawz Pay status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pay statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select
            value={customerVisibleFilter}
            onValueChange={(value) => {
              setCustomerVisibleFilter(value as CustomerVisibleFilter);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Customer visible filter">
              <SelectValue placeholder="Customer visible" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All visibility</SelectItem>
              <SelectItem value="visible">Visible</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
          {isFetching && !isLoading ? (
            <p className="self-center text-sm text-gray-500">Refreshing…</p>
          ) : null}
        </div>

        {isLoading ? <LoadingSkeleton /> : null}

        {!isLoading && error ? (
          <AnalyticsErrorState
            message={error.message || 'Failed to load merchants.'}
            onRetry={() => void refresh()}
          />
        ) : null}

        {!isLoading && !error && data ? (
          <>
            <MerchantsTable items={data.items} />
            <Pagination
              page={data.pagination.page}
              pageSize={data.pagination.pageSize}
              total={data.pagination.total}
              totalPages={data.pagination.totalPages}
              onPageChange={setPage}
            />
          </>
        ) : null}
      </div>
    </WarmpawzPayShell>
  );
}
