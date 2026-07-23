'use client';

import { useWarmpawzPayDashboard } from '@/hooks/warmpawz-pay/useWarmpawzPayDashboard';
import { AnalyticsErrorState } from '@/components/admin/marketing/analytics/AnalyticsStateViews';
import { EmptyState } from '@/components/admin/warmpawz-pay/catalogue/EmptyState';
import { DashboardMetricsSkeleton } from './DashboardMetricsSkeleton';
import { MetricsGrid } from './MetricsGrid';

export function DashboardPage() {
  const { data, isLoading, error, refresh } = useWarmpawzPayDashboard();

  const isEmpty = data?.metrics.publishedMerchants.value === 0;

  return (
    <>
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
    </>
  );
}
