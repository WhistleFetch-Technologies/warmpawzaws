const LEGACY_CATEGORIES = new Set([
  'general',
  'technical',
  'billing',
  'account',
  'service',
  'other',
]);

const EXTENDED_CATEGORIES = new Set([
  ...LEGACY_CATEGORIES,
  'cancellation',
  'delivery',
  'wrong_items',
  'quality',
]);

/** Map new UI categories to legacy DB values when migration 1034 is not applied yet. */
const LEGACY_CATEGORY_FALLBACK: Record<string, string> = {
  cancellation: 'service',
  delivery: 'service',
  wrong_items: 'other',
  quality: 'service',
};

export function normalizeSupportTicketCategory(category: string | null | undefined): string {
  const raw = String(category || '').trim().toLowerCase();
  if (!raw) return 'general';
  if (EXTENDED_CATEGORIES.has(raw)) return raw;
  return LEGACY_CATEGORY_FALLBACK[raw] || 'other';
}

export function isExtendedSupportCategory(category: string): boolean {
  return EXTENDED_CATEGORIES.has(category) && !LEGACY_CATEGORIES.has(category);
}
