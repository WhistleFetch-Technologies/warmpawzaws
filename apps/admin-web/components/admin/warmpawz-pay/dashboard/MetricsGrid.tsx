'use client';

import { FileText, Layers, Percent, Receipt, Store, TrendingUp, Wallet } from 'lucide-react';
import { MetricCard, metricAvailabilityFromFlag } from '@/components/admin/shared/MetricCard';
import {
  dashboardMetricCount,
  isDashboardMetricAvailable,
  type DashboardMetrics,
  type DashboardMetricValue,
} from '@/lib/warmpawz-pay-dashboard-admin';
import { formatWpayInr } from '@/lib/warmpawz-pay-payments-admin';

export interface MetricsGridProps {
  readonly metrics: DashboardMetrics;
}

function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = Number.isInteger(safe) ? String(safe) : safe.toFixed(1);
  return `${formatted}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-IN');
}

function formatMoney(metric?: DashboardMetricValue): string {
  return formatWpayInr(dashboardMetricCount(metric));
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <div className="space-y-6">
      <section
        aria-labelledby="warmpawz-pay-catalogue-metrics-heading"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
      >
        <h2 id="warmpawz-pay-catalogue-metrics-heading" className="sr-only">
          Catalogue health
        </h2>
        <MetricCard
          title="Published Merchants"
          value={formatCount(dashboardMetricCount(metrics.publishedMerchants))}
          subtitle="Published merchants"
          icon={Store}
          iconClassName="text-orange-500"
        />
        <MetricCard
          title="Average Discount"
          value={formatPercent(dashboardMetricCount(metrics.averageDiscountPercent))}
          subtitle="Average merchant discount"
          icon={Percent}
          iconClassName="text-green-500"
          valueClassName="text-gray-900"
        />
        <MetricCard
          title="Draft / Unpublished"
          value={formatCount(dashboardMetricCount(metrics.draftUnpublished))}
          subtitle="Catalogue rows not published"
          icon={FileText}
          iconClassName="text-orange-500"
        />
        <MetricCard
          title="Pay-enabled Tiers"
          value={formatCount(dashboardMetricCount(metrics.payEnabledTiers))}
          subtitle="Tiers with Warmpawz Pay enabled"
          icon={Layers}
          iconClassName="text-orange-500"
        />
      </section>

      <section
        aria-labelledby="warmpawz-pay-money-metrics-heading"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
      >
        <h2 id="warmpawz-pay-money-metrics-heading" className="sr-only">
          Pay Bill money
        </h2>
        <MetricCard
          title="Pay Bill Orders"
          value={formatCount(dashboardMetricCount(metrics.payBillOrders))}
          subtitle="Completed Pay Bill payments"
          icon={Receipt}
          iconClassName="text-orange-500"
        />
        <MetricCard
          title="Customer Paid"
          value={formatMoney(metrics.customerPaid)}
          subtitle="Sum of payable amounts"
          icon={Wallet}
          iconClassName="text-orange-500"
        />
        <MetricCard
          title="Customer Saved"
          value={formatMoney(metrics.customerSaved)}
          subtitle="Sum of customer discounts"
          icon={Percent}
          iconClassName="text-green-500"
        />
        <MetricCard
          title="Platform Revenue"
          value={
            isDashboardMetricAvailable(metrics.platformRevenue)
              ? formatWpayInr(dashboardMetricCount(metrics.platformRevenue))
              : undefined
          }
          subtitle={
            isDashboardMetricAvailable(metrics.platformRevenue)
              ? 'Sum of Warmpawz Pay revenue'
              : 'Hidden while Burn / Test mode is active'
          }
          icon={TrendingUp}
          iconClassName="text-green-500"
          availability={metricAvailabilityFromFlag(
            isDashboardMetricAvailable(metrics.platformRevenue),
          )}
          unavailableLabel="N/A"
        />
      </section>
    </div>
  );
}
