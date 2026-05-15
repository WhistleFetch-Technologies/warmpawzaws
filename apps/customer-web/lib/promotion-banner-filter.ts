export interface PromotionFilterInput {
  applicable_services?: unknown;
  service_category?: string;
  serviceCategory?: string;
  target_category?: string;
  targetCategory?: string;
  metadata?: Record<string, unknown>;
}

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function parsePromotionApplicableServices(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => normalizeToken(x)).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((x) => normalizeToken(x)).filter(Boolean);
    } catch {
      return [normalizeToken(raw)].filter(Boolean);
    }
  }
  return [];
}

export function shouldIncludePromotionForService(promo: PromotionFilterInput, service: string): boolean {
  const contextService = normalizeToken(service);
  const applicable = parsePromotionApplicableServices(promo.applicable_services);
  const category = normalizeToken(
    promo.service_category ??
    promo.serviceCategory ??
    promo.target_category ??
    promo.targetCategory ??
    (promo.metadata as any)?.serviceCategory ??
    (promo.metadata as any)?.promotionTarget?.serviceCategory
  );

  if (contextService === 'all') return true;
  if (applicable.length === 0) return true;
  if (applicable.includes(contextService)) return true;
  if (category && category !== 'all' && category === contextService) return true;
  return false;
}
