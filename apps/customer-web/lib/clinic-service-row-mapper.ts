/**
 * Shared vendor service row mapping — mirrors ClinicListView mappers without importing the screen.
 */

import {
  isVendorServicePackageRow,
  normalizeVendorServiceRowForPackage,
} from '@/lib/vendor-package-purchase-nav';

/** One bookable row — stable identity for keys + booking */
export interface ClinicServiceRow {
  stableKey: string;
  name: string;
  price: number;
  duration: number;
  description?: string;
  category?: string;
  catalogServiceId: string | null;
  vendorServiceId: string | number;
  isPackage?: boolean;
  packageDetails?: unknown;
  metadata?: unknown;
}

/** Prefer the longest vendor-authored description (catalog vs custom vs short). */
export function pickBestVendorDescription(p: Record<string, unknown>): string {
  const candidates: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
  };
  push(p.longDescription);
  push(p.long_description);
  push(p.description);
  push(p.custom_description);
  push(p.customDescription);
  push(p.shortDescription);
  if (p.metadata && typeof p.metadata === 'object') {
    const m = p.metadata as Record<string, unknown>;
    push(m.description);
    push(m.customDescription);
    push(m.serviceDescription);
  }
  if (candidates.length === 0) return '';
  return candidates.reduce((a, b) => (b.length > a.length ? b : a), '');
}

export function mapApiServiceToRow(p: unknown, vendorId: string, index: number): ClinicServiceRow {
  const raw = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const normalized = normalizeVendorServiceRowForPackage(raw);
  const vendorServiceId =
    normalized.id ?? normalized.vendor_service_id ?? raw.vendor_service_id ?? `idx-${index}`;
  const catalogServiceId =
    (normalized.serviceId != null && String(normalized.serviceId)) ||
    (normalized.service_id != null && String(normalized.service_id)) ||
    (raw.serviceId != null && String(raw.serviceId)) ||
    (raw.service_id != null && String(raw.service_id)) ||
    null;
  const stableKey = catalogServiceId ? `cat-${catalogServiceId}` : `vs-${vendorId}-${vendorServiceId}`;
  const desc = pickBestVendorDescription(normalized);
  const priceRaw =
    normalized.price ?? normalized.custom_price ?? normalized.base_price ?? normalized.amount ?? 0;
  const priceNum = typeof priceRaw === 'string' ? parseFloat(priceRaw) : Number(priceRaw);
  const price = Number.isFinite(priceNum) && !Number.isNaN(priceNum) ? priceNum : 0;
  const durRaw = normalized.duration ?? normalized.durationMinutes ?? normalized.duration_minutes ?? 30;
  const durNum = typeof durRaw === 'string' ? parseInt(durRaw, 10) : Number(durRaw);
  const duration = Number.isFinite(durNum) && durNum > 0 ? durNum : 30;
  const category =
    (normalized.category && String(normalized.category)) ||
    (normalized.category_name && String(normalized.category_name)) ||
    (normalized.categorySlug && String(normalized.categorySlug)) ||
    undefined;
  return {
    stableKey,
    name: String(
      normalized.name ||
        normalized.service_name ||
        normalized.serviceName ||
        normalized.display_name ||
        'Service'
    ),
    price,
    duration,
    description: desc || undefined,
    category,
    catalogServiceId,
    vendorServiceId,
    isPackage: isVendorServicePackageRow(normalized),
    packageDetails: normalized.packageDetails,
    metadata: normalized.metadata,
  };
}

export function mapApiServicesToRows(services: unknown[], vendorId: string): ClinicServiceRow[] {
  return (services || []).map((s, i) => mapApiServiceToRow(s, vendorId, i));
}
