import { promotionCategoriesMatch } from '@/lib/promotion-banner-filter';

export type { PromotionFilterInput } from '@/lib/promotion-banner-filter';

export function parseCouponApplicableServices(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      return [raw.trim()].filter(Boolean);
    }
  }
  return [];
}

export function couponOfferMatchesService(
  row: {
    applicable_services?: unknown;
    service_category?: string;
    applicable_to?: string;
  },
  serviceCategory?: string
): boolean {
  if (!serviceCategory || serviceCategory === 'all') return true;
  const bucket = serviceCategory.trim().toLowerCase();
  const applicable = parseCouponApplicableServices(row.applicable_services);
  const category = String(row.service_category ?? '').trim().toLowerCase();
  if (applicable.length === 0 && (!category || category === 'all')) return true;
  if (applicable.some((token) => promotionCategoriesMatch(bucket, token))) return true;
  if (category && category !== 'all' && promotionCategoriesMatch(bucket, category)) return true;
  return false;
}
