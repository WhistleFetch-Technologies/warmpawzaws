/**
 * Canonical promo-engine service slugs.
 * Checkout tokens (VET, WPAY, ECOMMERCE) map here — WPAY is a payment type, not a category.
 */

const CANONICAL_BY_TOKEN: Record<string, string> = {
  veterinary: 'veterinary',
  veterinarian: 'veterinary',
  vet: 'veterinary',
  vet_clinic: 'veterinary',
  grooming: 'grooming',
  groomer: 'grooming',
  pet_groomer: 'grooming',
  training: 'training',
  trainer: 'training',
  pet_trainer: 'training',
  behaviorist: 'behaviorist',
  behaviourist: 'behaviorist',
  pet_behaviorist: 'behaviorist',
  walker: 'walker',
  pet_walker: 'walker',
  boarding: 'boarding',
  pet_boarding: 'boarding',
  sitting: 'sitting',
  pet_sitter: 'sitting',
  pet_sitting: 'sitting',
  nutrition: 'nutrition',
  nutritionist: 'nutrition',
  pet_nutritionist: 'nutrition',
  ecommerce: 'ecommerce',
  shop: 'ecommerce',
  product: 'ecommerce',
  products: 'ecommerce',
  retail: 'ecommerce',
  marketplace: 'ecommerce',
};

function tokenKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Canonical catalogue slug, or lowered trimmed token if unknown. */
export function normalizePromoCategory(raw: unknown): string {
  const key = tokenKey(String(raw ?? ''));
  if (!key || key === 'wpay') return '';
  return CANONICAL_BY_TOKEN[key] || key;
}

/** All stored/checkout tokens that mean the same canonical slug (for SQL ANY). */
export function expandPromoCategoryAliases(raw: unknown): string[] {
  const canonical = normalizePromoCategory(raw);
  if (!canonical) return [];
  const aliases = new Set<string>([canonical]);
  for (const [token, mapped] of Object.entries(CANONICAL_BY_TOKEN)) {
    if (mapped !== canonical) continue;
    aliases.add(token);
    aliases.add(token.toUpperCase());
    aliases.add(token.replace(/_/g, '-'));
  }
  if (canonical === 'veterinary') {
    aliases.add('VET');
    aliases.add('vet');
  }
  if (canonical === 'ecommerce') {
    aliases.add('ECOMMERCE');
    aliases.add('SHOP');
  }
  return [...aliases];
}

/** Persist admin datetime-local as Asia/Kolkata (avoids treating 17:29 as UTC). */
export function persistIstDateTime(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) return s;
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(withSeconds)) return s;
  return `${withSeconds}+05:30`;
}
