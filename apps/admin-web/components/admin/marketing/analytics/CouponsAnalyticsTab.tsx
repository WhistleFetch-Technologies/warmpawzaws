'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@warmpawz/ui';
import { CouponCard } from '@warmpawz/promotion-management-ui';
import { MetricTable } from './MetricTable';
import { formatInr, formatNumber, formatPercent } from '@/lib/marketing-analytics/format';
import type { AnalyticsReport, CouponMetricRow } from '@/lib/marketing-analytics/types';
import type { NormalizedCouponItem } from '@warmpawz/promotion-management-ui';

function couponMetricToCardItem(row: CouponMetricRow): NormalizedCouponItem {
  const now = new Date().toISOString().split('T')[0];
  return {
    id: row.couponId,
    code: row.code,
    discountType: 'percentage',
    discountValue: 0,
    usageCount: row.uses,
    usageLimit: row.remaining != null ? row.uses + row.remaining : undefined,
    startDate: now,
    endDate: now,
    isActive: !row.disabled && !row.expired,
    owner: row.owner,
  };
}

export function CouponsAnalyticsTab({ report }: { report: AnalyticsReport }) {
  const [selected, setSelected] = useState<CouponMetricRow | null>(null);

  return (
    <>
      <MetricTable
        rows={report.coupons.rows}
        searchKeys={['code', 'couponId']}
        exportFilename="coupon-analytics.csv"
        onRowClick={setSelected}
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'owner', label: 'Owner' },
          { key: 'uses', label: 'Uses', render: (r) => formatNumber(r.uses) },
          { key: 'remaining', label: 'Remaining', render: (r) => (r.remaining != null ? formatNumber(r.remaining) : '—') },
          { key: 'savings', label: 'Savings', render: (r) => formatInr(r.savings) },
          { key: 'revenueInfluenced', label: 'Revenue', render: (r) => formatInr(r.revenueInfluenced) },
          {
            key: 'expired',
            label: 'Status',
            render: (r) => (r.expired ? 'Expired' : r.disabled ? 'Disabled' : 'Active'),
          },
        ]}
      />

      <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Coupon analytics</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4">
              <CouponCard item={couponMetricToCardItem(selected)} />
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-500">Avg order value</dt>
                <dd>{formatInr(selected.averageOrderValue)}</dd>
                <dt className="text-slate-500">Conversion</dt>
                <dd>{formatPercent(selected.conversionRate)}</dd>
              </dl>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
