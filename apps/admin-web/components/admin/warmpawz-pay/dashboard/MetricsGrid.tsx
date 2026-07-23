'use client';

import { Ban, Percent, Store, UserCheck } from 'lucide-react';
import { MetricCard } from '@/components/admin/shared/MetricCard';
import type { DashboardMetrics } from '@/lib/warmpawz-pay-dashboard-admin';
import { isFutureMetric } from '@/lib/warmpawz-pay-dashboard-admin';

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
  const readyAvailability = isFutureMetric(metrics.readyMerchants)
    ? 'unavailable'
    : 'available';
  const blockedAvailability = isFutureMetric(metrics.blockedMerchants)
    ? 'unavailable'
    : 'available';

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
      <MetricCard
        title="Ready Merchants"
        value={
          readyAvailability === 'available'
            ? formatCount((metrics.readyMerchants as { value: number }).value)
            : undefined
        }
        subtitle="Ready merchants"
        icon={UserCheck}
        iconClassName="text-blue-500"
        availability={readyAvailability}
      />
      <MetricCard
        title="Blocked Merchants"
        value={
          blockedAvailability === 'available'
            ? formatCount((metrics.blockedMerchants as { value: number }).value)
            : undefined
        }
        subtitle="Blocked merchants"
        icon={Ban}
        iconClassName="text-red-500"
        availability={blockedAvailability}
      />
    </section>
  );
}
