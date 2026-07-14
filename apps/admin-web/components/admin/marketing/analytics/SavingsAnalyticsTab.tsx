'use client';

import { StatCard } from '@/components/admin/shared/StatCard';
import { PiggyBank } from 'lucide-react';
import { SavingsByMonthChart, CategoryPieChart } from './DiscountAnalyticsCharts';
import { MetricTable } from './MetricTable';
import { formatInr } from '@/lib/marketing-analytics/format';
import type { AnalyticsReport } from '@/lib/marketing-analytics/types';

export function SavingsAnalyticsTab({
  report,
  legacyStats,
}: {
  report: AnalyticsReport;
  legacyStats?: { totalRevenue?: number; totalConversions?: number } | null;
}) {
  const { savings } = report;
  const totalSaved =
    savings.totalSaved > 0 ? savings.totalSaved : legacyStats?.totalRevenue ?? 0;
  const promotionSavings =
    savings.promotionSavings > 0
      ? savings.promotionSavings
      : legacyStats?.totalRevenue ?? 0;
  const hasUsageData = savings.totalSaved > 0 || (legacyStats?.totalConversions ?? 0) > 0;

  return (
    <div className="space-y-6">
      {!hasUsageData ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          No discount usage recorded in this date range yet. Savings appear after completed
          bookings/orders with promotions or coupons applied.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total saved" value={formatInr(totalSaved)} icon={PiggyBank} iconColor="green" />
        <StatCard title="Promotion savings" value={formatInr(promotionSavings)} icon={PiggyBank} iconColor="orange" />
        <StatCard title="Coupon savings" value={formatInr(savings.couponSavings)} icon={PiggyBank} iconColor="purple" />
        <StatCard title="Platform share" value={formatInr(savings.platformSavings)} icon={PiggyBank} iconColor="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SavingsByMonthChart data={savings.byMonth} />
        <CategoryPieChart data={savings.byCategory} />
      </div>

      <MetricTable
        rows={savings.topOffersUsed}
        searchKeys={['name', 'id']}
        exportFilename="top-offers-savings.csv"
        columns={[
          { key: 'name', label: 'Offer' },
          { key: 'kind', label: 'Kind' },
          { key: 'amount', label: 'Savings', render: (r) => formatInr(r.amount) },
        ]}
      />
    </div>
  );
}
