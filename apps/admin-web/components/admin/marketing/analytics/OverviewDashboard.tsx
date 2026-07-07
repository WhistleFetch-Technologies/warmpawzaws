'use client';

import { Tag, Ticket, Users, PiggyBank, TrendingUp, Percent } from 'lucide-react';
import { StatCard } from '@/components/admin/shared/StatCard';
import { formatInr, formatNumber } from '@/lib/marketing-analytics/format';
import type { AnalyticsReport, PromotionStatsLegacy } from '@/lib/marketing-analytics/types';
import { PromotionCard } from '@warmpawz/promotion-management-ui';
import { promotionMetricToCardItem } from '@/lib/marketing-analytics/mappers';
import { CouponCard } from '@warmpawz/promotion-management-ui';
import type { NormalizedCouponItem } from '@warmpawz/promotion-management-ui';
import type { CouponMetricRow } from '@/lib/marketing-analytics/types';

function couponMetricToCardItem(row: CouponMetricRow): NormalizedCouponItem {
  const now = new Date().toISOString().split('T')[0];
  return {
    id: row.couponId,
    code: row.code,
    discountType: 'percentage',
    discountValue: Math.round(row.averageOrderValue ? row.savings / Math.max(row.uses, 1) : 0),
    usageCount: row.uses,
    usageLimit: row.remaining != null ? row.uses + row.remaining : undefined,
    startDate: now,
    endDate: now,
    isActive: !row.disabled && !row.expired,
    owner: row.owner,
  };
}

export function OverviewDashboard({
  report,
  legacyStats,
}: {
  report: AnalyticsReport;
  legacyStats: PromotionStatsLegacy | null;
}) {
  const topPromo = report.promotions.topPromotions[0] ?? report.promotions.rows[0];
  const topCoupon = report.coupons.mostUsed[0] ?? report.coupons.rows[0];
  const topVendor = report.vendors.topVendors[0] ?? report.vendors.rows[0];
  const totalSavingsDisplay =
    report.savings.totalSaved > 0 ? report.savings.totalSaved : legacyStats?.totalRevenue ?? 0;

  return (
    <div className="space-y-6">
      {report.savings.totalSaved <= 0 && (legacyStats?.totalConversions ?? 0) === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          No discount usage in this period yet. Active promotions:{' '}
          {formatNumber(legacyStats?.activePromotions ?? 0)}.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active promotions"
          value={formatNumber(legacyStats?.activePromotions ?? 0)}
          icon={Tag}
          iconColor="orange"
        />
        <StatCard
          title="Promotion usage"
          value={formatNumber(report.promotions.totals.usageCount)}
          icon={TrendingUp}
          iconColor="blue"
        />
        <StatCard
          title="Coupon uses"
          value={formatNumber(report.coupons.totals.uses)}
          icon={Ticket}
          iconColor="purple"
        />
        <StatCard
          title="Total customer savings"
          value={formatInr(totalSavingsDisplay)}
          icon={PiggyBank}
          iconColor="green"
        />
        <StatCard
          title="Platform savings"
          value={formatInr(report.savings.platformSavings)}
          icon={PiggyBank}
          iconColor="orange"
        />
        <StatCard
          title="Vendor savings"
          value={formatInr(report.savings.vendorSavings)}
          icon={Users}
          iconColor="blue"
        />
        <StatCard
          title="Avg promotion discount"
          value={formatInr(report.promotions.totals.averageDiscount)}
          icon={Percent}
          iconColor="purple"
        />
        <StatCard
          title="Shared funding (settlement)"
          value={formatInr(report.settlement?.sharedContribution ?? 0)}
          icon={TrendingUp}
          iconColor="green"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {topPromo ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Top promotion</p>
            <PromotionCard item={promotionMetricToCardItem(topPromo)} />
          </div>
        ) : null}
        {topCoupon ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Top coupon</p>
            <CouponCard item={couponMetricToCardItem(topCoupon)} />
          </div>
        ) : null}
        {topVendor ? (
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">Top vendor</p>
            <p className="font-mono text-xs text-slate-500">{topVendor.vendorId}</p>
            <p className="mt-2 text-2xl font-bold">{formatInr(topVendor.totalSavings)}</p>
            <p className="text-sm text-slate-600">Total savings</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
