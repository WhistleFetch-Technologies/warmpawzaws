'use client';

import type { PromotionMetricRow } from '@/lib/marketing-analytics/types';
import type { NormalizedPromotionItem } from '@warmpawz/promotion-management-ui';

export function promotionMetricToCardItem(row: PromotionMetricRow): NormalizedPromotionItem {
  const now = new Date().toISOString();
  return {
    id: row.promotionId,
    kind: 'promotion',
    name: row.name,
    description: `Usage: ${row.usageCount} · Savings: ₹${Math.round(row.savingsGenerated)}`,
    promotionType: row.promotionType,
    discountType: 'percentage',
    discountValue: Math.round(row.averageDiscount || 0),
    usageCount: row.usageCount,
    startDate: now,
    endDate: row.expiresAt ?? now,
    isActive: true,
    owner: row.owner,
    raw: row as unknown as Record<string, unknown>,
  };
}
