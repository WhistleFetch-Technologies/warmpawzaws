'use client';

import { MetricTable } from './MetricTable';
import { formatInr, formatNumber } from '@/lib/marketing-analytics/format';
import type { AnalyticsReport } from '@/lib/marketing-analytics/types';

export function VendorsAnalyticsTab({ report }: { report: AnalyticsReport }) {
  return (
    <MetricTable
      rows={report.vendors.rows}
      searchKeys={['vendorId']}
      exportFilename="vendor-promo-analytics.csv"
      columns={[
        { key: 'vendorId', label: 'Vendor ID' },
        { key: 'vendorPromotions', label: 'Promotions', render: (r) => formatNumber(r.vendorPromotions) },
        { key: 'vendorCoupons', label: 'Coupons', render: (r) => formatNumber(r.vendorCoupons) },
        { key: 'totalSavings', label: 'Total savings', render: (r) => formatInr(r.totalSavings) },
        { key: 'vendorFundedDiscounts', label: 'Vendor funding', render: (r) => formatInr(r.vendorFundedDiscounts) },
        { key: 'platformFundedDiscounts', label: 'Platform funding', render: (r) => formatInr(r.platformFundedDiscounts) },
        { key: 'sharedFunding', label: 'Shared', render: (r) => formatInr(r.sharedFunding) },
        { key: 'promotionRevenue', label: 'Promo revenue', render: (r) => formatInr(r.promotionRevenue) },
        { key: 'couponRevenue', label: 'Coupon revenue', render: (r) => formatInr(r.couponRevenue) },
      ]}
    />
  );
}
