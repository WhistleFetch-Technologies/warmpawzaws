'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@warmpawz/ui';
import { PromotionCard } from '@warmpawz/promotion-management-ui';
import { MetricTable } from './MetricTable';
import { formatInr, formatNumber, formatPercent } from '@/lib/marketing-analytics/format';
import { promotionMetricToCardItem } from '@/lib/marketing-analytics/mappers';
import type { AnalyticsReport, PromotionMetricRow } from '@/lib/marketing-analytics/types';

export function PromotionsAnalyticsTab({ report }: { report: AnalyticsReport }) {
  const [selected, setSelected] = useState<PromotionMetricRow | null>(null);
  const rows = report.promotions.rows;

  return (
    <>
      <MetricTable
        rows={rows}
        searchKeys={['name', 'promotionType', 'promotionId']}
        exportFilename="promotion-analytics.csv"
        onRowClick={setSelected}
        columns={[
          { key: 'name', label: 'Promotion' },
          { key: 'promotionType', label: 'Type' },
          { key: 'owner', label: 'Owner' },
          { key: 'usageCount', label: 'Usage', render: (r) => formatNumber(r.usageCount) },
          { key: 'savingsGenerated', label: 'Savings', render: (r) => formatInr(r.savingsGenerated) },
          { key: 'revenueInfluenced', label: 'Revenue', render: (r) => formatInr(r.revenueInfluenced) },
          { key: 'averageDiscount', label: 'Avg discount', render: (r) => formatInr(r.averageDiscount) },
          { key: 'conversionRate', label: 'Conversion', render: (r) => formatPercent(r.conversionRate) },
        ]}
      />

      <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Promotion analytics</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4">
              <PromotionCard item={promotionMetricToCardItem(selected)} />
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-500">Funding cost</dt>
                <dd>{formatInr(selected.fundingCost)}</dd>
                <dt className="text-slate-500">Settlement cost</dt>
                <dd>{formatInr(selected.settlementCost)}</dd>
                <dt className="text-slate-500">Active users</dt>
                <dd>{formatNumber(selected.activeUsers)}</dd>
                <dt className="text-slate-500">ROI</dt>
                <dd>{formatPercent(selected.roi)}</dd>
              </dl>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
