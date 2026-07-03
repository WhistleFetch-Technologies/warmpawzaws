'use client';

import { StatCard } from '@/components/admin/shared/StatCard';
import { PiggyBank } from 'lucide-react';
import { SavingsByMonthChart, CategoryPieChart } from './DiscountAnalyticsCharts';
import { MetricTable } from './MetricTable';
import { formatInr } from '@/lib/marketing-analytics/format';
import type { AnalyticsReport } from '@/lib/marketing-analytics/types';

export function SavingsAnalyticsTab({ report }: { report: AnalyticsReport }) {
  const { savings } = report;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total saved" value={formatInr(savings.totalSaved)} icon={PiggyBank} iconColor="green" />
        <StatCard title="Promotion savings" value={formatInr(savings.promotionSavings)} icon={PiggyBank} iconColor="orange" />
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
