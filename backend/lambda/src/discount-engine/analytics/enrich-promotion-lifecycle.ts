/**
 * Attach live is_active / date / published from promo tables onto analytics metric rows.
 */

import { query } from '../../database/rds-connection';
import type { PromotionAnalyticsSummary, PromotionMetricRow } from './types';

export interface PromotionLifecycleStatus {
  isActive: boolean;
  published: boolean;
  startDate: string | null;
  endDate: string | null;
}

function computeIsActiveNow(row: {
  is_active?: unknown;
  published?: unknown;
  start_date?: unknown;
  end_date?: unknown;
}): boolean {
  if (row.is_active === false || row.is_active === 'false' || row.is_active === 0) return false;
  if (row.published === false || row.published === 'false' || row.published === 0) return false;
  const now = Date.now();
  if (row.start_date) {
    const start = new Date(String(row.start_date)).getTime();
    if (!Number.isNaN(start) && now < start) return false;
  }
  if (row.end_date) {
    const end = new Date(String(row.end_date)).getTime();
    if (!Number.isNaN(end) && now > end) return false;
  }
  return true;
}

export async function loadPromotionLifecycleByIds(
  promotionIds: string[],
): Promise<Map<string, PromotionLifecycleStatus>> {
  const map = new Map<string, PromotionLifecycleStatus>();
  const ids = [...new Set(promotionIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (ids.length === 0) return map;

  const [eap, promo, vendor] = await Promise.all([
    query(
      `SELECT id::text AS id, is_active, published, start_date, end_date
       FROM ecommerce_admin_promotions
       WHERE id::text = ANY($1::text[])`,
      [ids],
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT id::text AS id, is_active, published, start_date, end_date
       FROM promotions
       WHERE id::text = ANY($1::text[])`,
      [ids],
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT id::text AS id, is_active, true AS published, start_date, end_date
       FROM vendor_promotions
       WHERE id::text = ANY($1::text[])`,
      [ids],
    ).catch(() => ({ rows: [] })),
  ]);

  for (const rows of [eap.rows ?? [], promo.rows ?? [], vendor.rows ?? []]) {
    for (const raw of rows as Record<string, unknown>[]) {
      const id = String(raw.id ?? '');
      if (!id || map.has(id)) continue;
      map.set(id, {
        isActive: computeIsActiveNow(raw),
        published: raw.published !== false && raw.published !== 'false' && raw.published !== 0,
        startDate: raw.start_date != null ? String(raw.start_date) : null,
        endDate: raw.end_date != null ? String(raw.end_date) : null,
      });
    }
  }

  return map;
}

function applyLifecycle(
  row: PromotionMetricRow,
  lifecycle: PromotionLifecycleStatus | undefined,
): PromotionMetricRow {
  if (!lifecycle) {
    return {
      ...row,
      isActive: false,
      published: false,
    };
  }
  return {
    ...row,
    isActive: lifecycle.isActive,
    published: lifecycle.published,
    startDate: lifecycle.startDate,
    expiresAt: lifecycle.endDate ?? row.expiresAt,
  };
}

export async function enrichPromotionAnalyticsLifecycle(
  summary: PromotionAnalyticsSummary,
): Promise<PromotionAnalyticsSummary> {
  const ids = [
    ...summary.rows.map((r) => r.promotionId),
    ...summary.topPromotions.map((r) => r.promotionId),
  ];
  const lifecycle = await loadPromotionLifecycleByIds(ids);

  return {
    ...summary,
    rows: summary.rows.map((r) => applyLifecycle(r, lifecycle.get(r.promotionId))),
    topPromotions: summary.topPromotions.map((r) =>
      applyLifecycle(r, lifecycle.get(r.promotionId)),
    ),
  };
}
