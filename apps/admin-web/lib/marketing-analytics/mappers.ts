'use client';

import type { PromotionMetricRow } from '@/lib/marketing-analytics/types';
import type { NormalizedPromotionItem } from '@warmpawz/promotion-management-ui';

export function promotionMetricToCardItem(row: PromotionMetricRow): NormalizedPromotionItem {
  const now = new Date().toISOString();
  const startDate = row.startDate ?? now;
  const endDate = row.expiresAt ?? now;
  return {
    id: row.promotionId,
    kind: 'promotion',
    name: row.name,
    description: `Usage: ${row.usageCount} · Savings: ₹${Math.round(row.savingsGenerated)}`,
    promotionType: row.promotionType,
    discountType: 'percentage',
    discountValue: Math.round(row.averageDiscount || 0),
    usageCount: row.usageCount,
    startDate,
    endDate,
    isActive: row.isActive === true,
    published: row.published,
    owner: row.owner,
    raw: row as unknown as Record<string, unknown>,
  };
}
