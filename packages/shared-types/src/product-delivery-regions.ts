/**
 * Product delivery region matching — city names only.
 * Empty regions = ships everywhere. Empty customer city = allow browse.
 *
 * City aliases (e.g. Bangalore ↔ Bengaluru) are resolved via resolveCityToCanonical
 * from city-aliases.ts. All alias data lives there — do not add city strings here.
 */

import { resolveCityToCanonical } from './city-aliases';

export function normalizeCity(name: string): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function parseDeliveryRegionsCsv(raw: string): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const city = String(part ?? '').trim();
    if (!city) continue;
    const key = normalizeCity(city);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(city);
  }
  return out;
}

export function normalizeDeliveryRegionsList(
  raw: unknown,
): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((r) => String(r ?? '').trim())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return normalizeDeliveryRegionsList(parsed);
      } catch {
        /* fall through */
      }
    }
    return parseDeliveryRegionsCsv(t);
  }
  return [String(raw).trim()].filter(Boolean);
}

export function isProductDeliverableToCity(
  regions: string[] | null | undefined,
  customerCity: string | null | undefined,
): boolean {
  const list = normalizeDeliveryRegionsList(regions);
  if (list.length === 0) return true;
  const city = String(customerCity ?? '').trim();
  if (!city) return true;
  // Resolve through alias map so "Bangalore" matches a stored "Bengaluru" and vice versa.
  const customerCanonical = resolveCityToCanonical(normalizeCity(city));
  return list.some((r) => resolveCityToCanonical(normalizeCity(r)) === customerCanonical);
}

export function formatDeliveryRegionsList(
  regions: string[] | null | undefined,
): string {
  const list = normalizeDeliveryRegionsList(regions);
  if (list.length === 0) return '';
  return list.join(', ');
}

export function deliveryBlockMessage(
  productName: string,
  customerCity: string,
  regions: string[] | null | undefined,
): string {
  const allowed = formatDeliveryRegionsList(regions);
  return `"${productName}" is not delivered to ${customerCity}. Delivers to: ${allowed || 'selected cities only'}.`;
}

export function deliveryRegionsLabel(
  regions: string[] | null | undefined,
): string {
  const list = normalizeDeliveryRegionsList(regions);
  if (list.length === 0) return 'Ships everywhere';
  return `Delivers to: ${list.join(', ')}`;
}
