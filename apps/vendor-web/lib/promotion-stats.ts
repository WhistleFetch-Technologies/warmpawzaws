export type EffectivePromotionStatus = 'inactive' | 'scheduled' | 'live' | 'expired';

export type PromotionStatusInput = {
  is_active: boolean;
  start_date: string;
  end_date: string;
};

export function parseNumeric(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

export function sumNumeric(values: unknown[]): number {
  return values.reduce<number>((sum, v) => sum + parseNumeric(v), 0);
}

export function getEffectivePromotionStatus(
  promo: PromotionStatusInput,
  now: Date = new Date()
): EffectivePromotionStatus {
  if (!promo.is_active) return 'inactive';
  const start = new Date(promo.start_date);
  const end = new Date(promo.end_date);
  if (now < start) return 'scheduled';
  if (now > end) return 'expired';
  return 'live';
}

export function getEffectiveStatusLabel(status: EffectivePromotionStatus): string {
  switch (status) {
    case 'live':
      return 'Live';
    case 'scheduled':
      return 'Scheduled';
    case 'expired':
      return 'Expired';
    case 'inactive':
    default:
      return 'Inactive';
  }
}

export function getToggleLabel(
  promo: PromotionStatusInput,
  now: Date = new Date()
): string {
  const effective = getEffectivePromotionStatus(promo, now);
  if (!promo.is_active) return 'Inactive';
  if (effective === 'expired') return 'Active (expired)';
  if (effective === 'scheduled') return 'Active (scheduled)';
  return 'Active';
}

export function formatRevenueStat(totalRevenue: number): string {
  const n = parseNumeric(totalRevenue);
  if (n <= 0) return '₹0';
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

export function isPromotionLiveForFilter(
  promo: PromotionStatusInput,
  now: Date = new Date()
): boolean {
  return getEffectivePromotionStatus(promo, now) === 'live';
}
