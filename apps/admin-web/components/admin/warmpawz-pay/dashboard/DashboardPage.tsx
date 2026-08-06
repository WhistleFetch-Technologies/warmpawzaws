'use client';

import { useState } from 'react';
import { useWarmpawzPayDashboard } from '@/hooks/warmpawz-pay/useWarmpawzPayDashboard';
import { useWarmpawzPayPayments } from '@/hooks/warmpawz-pay/useWarmpawzPayPayments';
import { defaultWpayPaymentsFilters } from '@/lib/warmpawz-pay-payments-admin';
import type { WpayPaymentsFilters } from '@/lib/warmpawz-pay-payments-admin';
import { AnalyticsErrorState } from '@/components/admin/marketing/analytics/AnalyticsStateViews';
import { EmptyState } from '@/components/admin/warmpawz-pay/catalogue/EmptyState';
import { DashboardMetricsSkeleton } from './DashboardMetricsSkeleton';
import { MetricsGrid } from './MetricsGrid';
import { PaymentsFilterBar } from './PaymentsFilterBar';
import { PaymentsTable } from './PaymentsTable';

const PAYMENTS_PAGE_SIZE = 5;

export function DashboardPage() {
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsFilters, setPaymentsFilters] = useState<WpayPaymentsFilters>(
    defaultWpayPaymentsFilters,
  );
  const { data, isLoading, error, refresh } = useWarmpawzPayDashboard();
  const paymentsQuery = useWarmpawzPayPayments(
    paymentsPage,
    PAYMENTS_PAGE_SIZE,
    paymentsFilters,
  );

  const handleFiltersChange = (next: WpayPaymentsFilters) => {
    setPaymentsFilters(next);
    setPaymentsPage(1);
  };

  const isEmpty = data?.metrics.publishedMerchants.value === 0;

  return (
    <div className="space-y-8">
      {isLoading ? <DashboardMetricsSkeleton /> : null}

      {!isLoading && error ? (
        <AnalyticsErrorState
          message={error.message || 'Failed to load Warmpawz Pay dashboard.'}
          onRetry={() => void refresh()}
        />
      ) : null}

      {!isLoading && !error && isEmpty ? (
        <EmptyState title="No merchants have been published yet." />
      ) : null}

      {!isLoading && !error && data && !isEmpty ? (
        <MetricsGrid metrics={data.metrics} />
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Warmpawz Pay Orders</h2>
          <p className="text-sm text-gray-500">Orders paid via Warmpawz Pay</p>
        </div>

        <PaymentsFilterBar
          filters={paymentsFilters}
          onFiltersChange={handleFiltersChange}
          disabled={paymentsQuery.isLoading}
        />

        {paymentsQuery.isLoading ? (
          <p className="text-sm text-gray-500">Loading orders…</p>
        ) : null}

        {paymentsQuery.error ? (
          <AnalyticsErrorState
            message={paymentsQuery.error.message || 'Failed to load payments.'}
            onRetry={() => void paymentsQuery.refresh()}
          />
        ) : null}

        {!paymentsQuery.isLoading && !paymentsQuery.error && paymentsQuery.data ? (
          <PaymentsTable
            items={paymentsQuery.data.items}
            page={paymentsQuery.data.page}
            pageSize={paymentsQuery.data.pageSize}
            total={paymentsQuery.data.total}
            onPageChange={setPaymentsPage}
          />
        ) : null}
      </section>
    </div>
  );
}
