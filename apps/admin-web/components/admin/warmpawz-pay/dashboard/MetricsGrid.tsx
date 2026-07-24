'use client';

import { Percent, Store } from 'lucide-react';
import { MetricCard } from '@/components/admin/shared/MetricCard';
import type { DashboardMetrics } from '@/lib/warmpawz-pay-dashboard-admin';

export interface MetricsGridProps {
  readonly metrics: DashboardMetrics;
}

function formatPercent(value: number): string {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${formatted}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-IN');
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <section
      aria-labelledby="warmpawz-pay-metrics-heading"
      className="grid grid-cols-1 md:grid-cols-2 gap-6"
    >
      <h2 id="warmpawz-pay-metrics-heading" className="sr-only">
        Warmpawz Pay metrics
      </h2>
      <MetricCard
        title="Published Merchants"
        value={formatCount(metrics.publishedMerchants.value)}
        subtitle="Published merchants"
        icon={Store}
        iconClassName="text-orange-500"
      />
      <MetricCard
        title="Average Discount"
        value={formatPercent(metrics.averageDiscountPercent.value)}
        subtitle="Average merchant discount"
        icon={Percent}
        iconClassName="text-green-500"
        valueClassName="text-gray-900"
      />
    </section>
  );
}
