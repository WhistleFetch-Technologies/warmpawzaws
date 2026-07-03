import type {
  PromotionUsageRow,
  CouponUsageRow,
  PromotionMetricRow,
  CouponMetricRow,
  VendorAnalyticsRow,
  SavingsAnalyticsSummary,
} from './types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

export function aggregatePromotionMetrics(usages: PromotionUsageRow[]): PromotionMetricRow[] {
  const grouped = groupBy(usages, (u) => u.promotionId);
  const rows: PromotionMetricRow[] = [];

  for (const [promotionId, list] of grouped) {
    const savings = list.reduce((s, u) => s + (u.discountAmount || 0), 0);
    const revenueInfluenced = list.reduce(
      (s, u) => s + (u.originalAmount ?? u.finalAmount ?? 0),
      0
    );
    const customers = new Set(list.map((u) => u.customerId).filter(Boolean));
    const owner = list[0]?.promotionType === 'product' || list[0]?.promotionType === 'service' ? 'vendor' : 'platform';

    rows.push({
      promotionId,
      name: list[0]?.promotionName ?? promotionId,
      promotionType: list[0]?.promotionType ?? 'unknown',
      owner,
      usageCount: list.length,
      conversionRate: null,
      savingsGenerated: round2(savings),
      revenueInfluenced: round2(revenueInfluenced),
      fundingCost: round2(owner === 'platform' ? savings : 0),
      settlementCost: round2(owner === 'vendor' ? savings : 0),
      averageDiscount: list.length ? round2(savings / list.length) : 0,
      activeUsers: customers.size,
      expiresAt: null,
      roi: null,
    });
  }

  return rows.sort((a, b) => b.savingsGenerated - a.savingsGenerated);
}

export function aggregateCouponMetrics(usages: CouponUsageRow[]): CouponMetricRow[] {
  const grouped = groupBy(usages, (u) => u.couponId);
  const now = Date.now();
  const rows: CouponMetricRow[] = [];

  for (const [couponId, list] of grouped) {
    const savings = list.reduce((s, u) => s + (u.discountAmount ?? 0), 0);
    const uses = list.length;
    const maxUses = list[0]?.maxUses ?? null;
    const remaining = maxUses != null ? Math.max(0, maxUses - uses) : null;
    const expired = list[0]?.endDate ? new Date(list[0].endDate!).getTime() < now : false;

    rows.push({
      couponId,
      code: list[0]?.code ?? couponId,
      owner: 'platform',
      uses,
      remaining,
      savings: round2(savings),
      revenueInfluenced: 0,
      averageOrderValue: uses ? round2(savings / uses) : 0,
      conversionRate: null,
      expired,
      disabled: !list[0]?.isActive,
    });
  }

  return rows.sort((a, b) => b.uses - a.uses);
}

export function aggregateVendorMetrics(
  promotionUsages: PromotionUsageRow[]
): VendorAnalyticsRow[] {
  const withVendor = promotionUsages.filter((u) => u.vendorId);
  const grouped = groupBy(withVendor, (u) => u.vendorId!);
  const rows: VendorAnalyticsRow[] = [];

  for (const [vendorId, list] of grouped) {
    const promoIds = new Set(list.map((u) => u.promotionId));
    const savings = list.reduce((s, u) => s + (u.discountAmount || 0), 0);
    const vendorFunded = list
      .filter((u) => u.promotionType === 'service' || u.promotionType === 'product')
      .reduce((s, u) => s + (u.discountAmount || 0), 0);
    const platformFunded = list
      .filter((u) => u.promotionType === 'platform')
      .reduce((s, u) => s + (u.discountAmount || 0), 0);

    const byPromo = aggregatePromotionMetrics(list).slice(0, 5);

    rows.push({
      vendorId,
      vendorPromotions: promoIds.size,
      vendorCoupons: 0,
      vendorFundedDiscounts: round2(vendorFunded),
      platformFundedDiscounts: round2(platformFunded),
      sharedFunding: 0,
      totalSavings: round2(savings),
      promotionRevenue: round2(
        list.reduce((s, u) => s + (u.originalAmount ?? 0), 0)
      ),
      couponRevenue: 0,
      topOffers: byPromo.map((p) => ({ id: p.promotionId, name: p.name, savings: p.savingsGenerated })),
    });
  }

  return rows.sort((a, b) => b.totalSavings - a.totalSavings);
}

export function aggregateSavings(
  promotionUsages: PromotionUsageRow[],
  couponUsages: CouponUsageRow[]
): SavingsAnalyticsSummary {
  const promotionSavings = promotionUsages.reduce((s, u) => s + (u.discountAmount || 0), 0);
  const couponSavings = couponUsages.reduce((s, u) => s + (u.discountAmount ?? 0), 0);
  const vendorSavings = promotionUsages
    .filter((u) => u.promotionType === 'service' || u.promotionType === 'product')
    .reduce((s, u) => s + (u.discountAmount || 0), 0);
  const platformSavings = promotionUsages
    .filter((u) => u.promotionType === 'platform')
    .reduce((s, u) => s + (u.discountAmount || 0), 0);

  const byCategoryMap = new Map<string, number>();
  for (const u of promotionUsages) {
    const cat = u.promotionType || 'other';
    byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + (u.discountAmount || 0));
  }

  const byMonthMap = new Map<string, number>();
  for (const u of promotionUsages) {
    const month = u.createdAt.slice(0, 7);
    byMonthMap.set(month, (byMonthMap.get(month) ?? 0) + (u.discountAmount || 0));
  }
  for (const u of couponUsages) {
    const month = u.usedAt.slice(0, 7);
    byMonthMap.set(month, (byMonthMap.get(month) ?? 0) + (u.discountAmount ?? 0));
  }

  const promoTop = aggregatePromotionMetrics(promotionUsages)
    .slice(0, 10)
    .map((p) => ({
      id: p.promotionId,
      name: p.name,
      amount: p.savingsGenerated,
      kind: 'promotion' as const,
    }));

  const couponTop = aggregateCouponMetrics(couponUsages)
    .slice(0, 10)
    .map((c) => ({
      id: c.couponId,
      name: c.code,
      amount: c.savings,
      kind: 'coupon' as const,
    }));

  const topOffersUsed = [...promoTop, ...couponTop]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return {
    totalSaved: round2(promotionSavings + couponSavings),
    promotionSavings: round2(promotionSavings),
    couponSavings: round2(couponSavings),
    vendorSavings: round2(vendorSavings),
    platformSavings: round2(platformSavings),
    byCategory: [...byCategoryMap.entries()].map(([category, amount]) => ({
      category,
      amount: round2(amount),
    })),
    byMonth: [...byMonthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount: round2(amount) })),
    topOffersUsed,
  };
}

export function promotionTotals(rows: PromotionMetricRow[]) {
  const usageCount = rows.reduce((s, r) => s + r.usageCount, 0);
  const savingsGenerated = rows.reduce((s, r) => s + r.savingsGenerated, 0);
  return {
    usageCount,
    savingsGenerated: round2(savingsGenerated),
    averageDiscount: usageCount ? round2(savingsGenerated / usageCount) : 0,
  };
}

export function couponTotals(rows: CouponMetricRow[]) {
  const uses = rows.reduce((s, r) => s + r.uses, 0);
  const savings = rows.reduce((s, r) => s + r.savings, 0);
  return {
    uses,
    savings: round2(savings),
    averageOrderValue: uses ? round2(savings / uses) : 0,
  };
}
