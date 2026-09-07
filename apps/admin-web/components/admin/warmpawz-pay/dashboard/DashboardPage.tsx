'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useWarmpawzPayDashboard } from '@/hooks/warmpawz-pay/useWarmpawzPayDashboard';
import { useWarmpawzPayPayments } from '@/hooks/warmpawz-pay/useWarmpawzPayPayments';
import {
  defaultWpayPaymentsFilters,
  settleWarmpawzPayPayments,
} from '@/lib/warmpawz-pay-payments-admin';
import type { WpayPaymentsFilters } from '@/lib/warmpawz-pay-payments-admin';
import { AnalyticsErrorState } from '@/components/admin/marketing/analytics/AnalyticsStateViews';
import { EmptyState } from '@/components/admin/warmpawz-pay/catalogue/EmptyState';
import { DashboardMetricsSkeleton } from './DashboardMetricsSkeleton';
import { MetricsGrid } from './MetricsGrid';
import { PaymentsFilterBar } from './PaymentsFilterBar';
import { PaymentsTable } from './PaymentsTable';
import { ConvenienceSettingsPanel } from './ConvenienceSettingsPanel';

const PAYMENTS_PAGE_SIZE = 5;

export function DashboardPage() {
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsFilters, setPaymentsFilters] = useState<WpayPaymentsFilters>(
    defaultWpayPaymentsFilters,
  );
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [settling, setSettling] = useState(false);
  const { data, isLoading, error, refresh } = useWarmpawzPayDashboard();
  const paymentsQuery = useWarmpawzPayPayments(
    paymentsPage,
    PAYMENTS_PAGE_SIZE,
    paymentsFilters,
  );

  const handleFiltersChange = (next: WpayPaymentsFilters) => {
    setPaymentsFilters(next);
    setPaymentsPage(1);
    setSelectedPaymentIds(new Set());
  };

  const handlePageChange = (page: number) => {
    setPaymentsPage(page);
    setSelectedPaymentIds(new Set());
  };

  const selectedPendingCount = useMemo(() => {
    const items = paymentsQuery.data?.items ?? [];
    let count = 0;
    for (const id of selectedPaymentIds) {
      const row = items.find((item) => item.paymentId === id);
      if (row?.payoutStatus === 'pending') count += 1;
    }
    return count;
  }, [paymentsQuery.data?.items, selectedPaymentIds]);

  const handleSettle = async () => {
    const paymentIds = [...selectedPaymentIds];
    if (paymentIds.length === 0) return;
    if (
      !window.confirm(
        `Mark ${paymentIds.length} payout(s) as settled? This cannot be undone.`,
      )
    ) {
      return;
    }
    setSettling(true);
    try {
      const result = await settleWarmpawzPayPayments(paymentIds);
      toast.success(
        result.settledCount > 0
          ? `Settled ${result.settledCount} payout(s)`
          : 'No payouts were settled',
      );
      if (result.skipped.length > 0) {
        toast.message(`${result.skipped.length} skipped (already settled or unavailable)`);
      }
      setSelectedPaymentIds(new Set());
      await paymentsQuery.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to settle payouts');
    } finally {
      setSettling(false);
    }
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

      {!isLoading && !error && data ? <MetricsGrid metrics={data.metrics} /> : null}

      <ConvenienceSettingsPanel />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Warmpawz Pay Orders</h2>
          <p className="text-sm text-gray-500">
            Orders paid via Warmpawz Pay · mark vendor payouts settled after offline transfer
          </p>
        </div>

        <PaymentsFilterBar
          filters={paymentsFilters}
          onFiltersChange={handleFiltersChange}
          disabled={paymentsQuery.isLoading || settling}
          settleDisabled={selectedPendingCount === 0}
          settleLabel={
            selectedPendingCount > 0
              ? `Settle selected (${selectedPendingCount})`
              : 'Settle selected'
          }
          settling={settling}
          onSettle={() => void handleSettle()}
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
            onPageChange={handlePageChange}
            selectedPaymentIds={selectedPaymentIds}
            onSelectedPaymentIdsChange={setSelectedPaymentIds}
          />
        ) : null}
      </section>
    </div>
  );
}
