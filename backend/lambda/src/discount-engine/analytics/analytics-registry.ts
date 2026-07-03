import type { AnalyticsDomainFilter, DomainAnalyticsAdapter, PromotionUsageRow, CouponUsageRow } from './types';

function inDateRange(iso: string, from?: string, to?: string): boolean {
  const t = new Date(iso).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
}

function basePromotionFilter(rows: PromotionUsageRow[], domain: AnalyticsDomainFilter): PromotionUsageRow[] {
  if (domain === 'ALL') return rows;
  if (domain === 'SERVICE') {
    return rows.filter((r) => r.promotionType === 'service' || r.promotionType === 'platform');
  }
  if (domain === 'PRODUCT') {
    return rows.filter((r) => r.promotionType === 'product');
  }
  if (domain === 'PACKAGE') {
    return rows.filter((r) => r.promotionType === 'service' && Boolean(r.bookingId));
  }
  if (domain === 'MEAL') {
    return rows.filter((r) => r.promotionType === 'service' && Boolean(r.orderId));
  }
  if (domain === 'PHARMACY') {
    return rows.filter((r) => Boolean(r.orderId));
  }
  return rows;
}

function createAdapter(domain: AnalyticsDomainFilter): DomainAnalyticsAdapter {
  return {
    domain,
    filterPromotionUsages(rows) {
      return basePromotionFilter(rows, domain);
    },
    filterCouponUsages(rows) {
      if (domain === 'ALL') return rows;
      if (domain === 'PRODUCT') return rows.filter((r) => Boolean(r.orderId));
      if (domain === 'SERVICE' || domain === 'PACKAGE') return rows.filter((r) => Boolean(r.bookingId));
      if (domain === 'MEAL' || domain === 'PHARMACY') return rows.filter((r) => Boolean(r.orderId));
      return rows;
    },
  };
}

const adapters = new Map<AnalyticsDomainFilter, DomainAnalyticsAdapter>(
  (['ALL', 'SERVICE', 'PACKAGE', 'MEAL', 'PHARMACY', 'PRODUCT'] as AnalyticsDomainFilter[]).map((d) => [
    d,
    createAdapter(d),
  ])
);

export function getDomainAdapter(domain: AnalyticsDomainFilter = 'ALL'): DomainAnalyticsAdapter {
  return adapters.get(domain) ?? createAdapter('ALL');
}

export function applyAnalyticsFilters(
  rows: PromotionUsageRow[],
  filters: { vendorId?: string; customerId?: string; from?: string; to?: string; promotionIds?: string[] }
): PromotionUsageRow[] {
  return rows.filter((r) => {
    if (filters.vendorId && r.vendorId && r.vendorId !== filters.vendorId) return false;
    if (filters.customerId && r.customerId !== filters.customerId) return false;
    if (filters.promotionIds?.length && !filters.promotionIds.includes(r.promotionId)) return false;
    if (!inDateRange(r.createdAt, filters.from, filters.to)) return false;
    return true;
  });
}

export function applyCouponFilters(
  rows: CouponUsageRow[],
  filters: { customerId?: string; from?: string; to?: string; couponIds?: string[] }
): CouponUsageRow[] {
  return rows.filter((r) => {
    if (filters.customerId && r.customerId !== filters.customerId) return false;
    if (filters.couponIds?.length && !filters.couponIds.includes(r.couponId)) return false;
    if (!inDateRange(r.usedAt, filters.from, filters.to)) return false;
    return true;
  });
}

export function listRegisteredDomains(): AnalyticsDomainFilter[] {
  return [...adapters.keys()];
}
