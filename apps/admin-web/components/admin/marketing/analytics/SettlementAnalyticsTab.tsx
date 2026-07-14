'use client';

import { StatCard } from '@/components/admin/shared/StatCard';
import { Wallet } from 'lucide-react';
import { FundingTrendChart } from './DiscountAnalyticsCharts';
import { MetricTable } from './MetricTable';
import { formatInr, formatNumber } from '@/lib/marketing-analytics/format';
import type { AnalyticsReport } from '@/lib/marketing-analytics/types';
import { AnalyticsEmptyState } from './AnalyticsStateViews';

export function SettlementAnalyticsTab({ report }: { report: AnalyticsReport }) {
  const settlement = report.settlement;

  if (!settlement) {
    return (
      <AnalyticsEmptyState title="No settlement preview data for this period" />
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Display-only settlement analytics from Phase 7 previews — not recalculated in UI.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Platform contribution" value={formatInr(settlement.platformContribution)} icon={Wallet} iconColor="orange" />
        <StatCard title="Vendor contribution" value={formatInr(settlement.vendorContribution)} icon={Wallet} iconColor="blue" />
        <StatCard title="Shared contribution" value={formatInr(settlement.sharedContribution)} icon={Wallet} iconColor="green" />
        <StatCard title="Settlement totals" value={formatInr(settlement.settlementTotals)} icon={Wallet} iconColor="purple" />
      </div>

      <FundingTrendChart data={settlement.fundingTrends} />

      <MetricTable
        rows={settlement.fundingBreakdown}
        searchKeys={['name', 'discountId']}
        exportFilename="funding-breakdown.csv"
        columns={[
          { key: 'name', label: 'Discount' },
          { key: 'platformShare', label: 'Platform', render: (r) => formatInr(r.platformShare) },
          { key: 'vendorShare', label: 'Vendor', render: (r) => formatInr(r.vendorShare) },
        ]}
      />

      <p className="text-xs text-slate-500">
        Preview count: {formatNumber(settlement.previewCount)}
      </p>
    </div>
  );
}
