import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import type { NutritionVendorCardModel } from '@/components/customer/nutrition/NutritionVendorDetailsCard';

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Extract positive prices from a vendor service row (marketplace or tele). */
export function priceFromVendorServiceRow(row: Record<string, unknown>): number | null {
  return (
    num(row.price) ??
    num(row.custom_price) ??
    num(row.customPrice) ??
    num(row.base_price) ??
    num(row.basePrice) ??
    null
  );
}

/** Min/max from discover-services provider row when present. */
export function priceRangeFromDiscoveryRow(
  row: Record<string, unknown> | null | undefined
): { priceMin?: number; priceMax?: number } {
  if (!row || typeof row !== 'object') return {};
  const priceMin = num(row.priceMin) ?? num(row.price_min);
  const priceMax = num(row.priceMax) ?? num(row.price_max);
  if (priceMin != null || priceMax != null) {
    return {
      ...(priceMin != null ? { priceMin } : {}),
      ...(priceMax != null ? { priceMax: priceMax ?? priceMin } : {}),
    };
  }

  if (Array.isArray(row.services) && row.services.length > 0) {
    const prices = (row.services as Record<string, unknown>[])
      .map((s) => priceFromVendorServiceRow(s))
      .filter((p): p is number => p != null);
    if (prices.length > 0) {
      return { priceMin: Math.min(...prices), priceMax: Math.max(...prices) };
    }
  }

  const single = num(row.basePrice) ?? num(row.base_price) ?? num(row.price) ?? num(row.startingPrice);
  if (single != null) return { priceMin: single, priceMax: single };

  return {};
}

function hasDisplayPrice(v: NutritionVendorCardModel): boolean {
  const min = num(v.priceMin);
  const max = num(v.priceMax);
  return min != null || max != null;
}

/** Tele vendor services are not stripped under warmpawz_pay — canonical nutrition consultation catalog. */
async function priceRangeFromTeleServices(
  vendorId: string
): Promise<{ priceMin?: number; priceMax?: number }> {
  try {
    const res = (await apiClient.get(
      `/customer/vendor/${encodeURIComponent(vendorId)}/services?serviceStyle=tele`
    )) as { services?: unknown[]; packages?: unknown[] };
    const rows = [...(Array.isArray(res?.services) ? res.services : []), ...(Array.isArray(res?.packages) ? res.packages : [])];
    const prices = rows
      .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
      .map((r) => priceFromVendorServiceRow(r))
      .filter((p): p is number => p != null);
    if (prices.length === 0) return {};
    return { priceMin: Math.min(...prices), priceMax: Math.max(...prices) };
  } catch {
    return {};
  }
}

/** WAPPT appointment fee when marketplace list prices are omitted. */
async function appointmentFeeForVendor(
  vendorId: string,
  serviceStyle: string
): Promise<number | null> {
  try {
    const qs = new URLSearchParams({
      category: 'nutrition',
      serviceStyle,
    });
    const res = (await apiClient.get(
      `/customer/warmpawz-appointments/vendors/${encodeURIComponent(vendorId)}/fee?${qs}`
    )) as { appointmentFee?: number };
    const fee = num(res?.appointmentFee);
    return fee;
  } catch {
    return null;
  }
}

/**
 * Resolve display price for nutrition vendor cards when discover-services omits pricing.
 * Uses tele consultation catalog (same as Pet Nutrition → Diet Consultation).
 */
export async function resolveNutritionVendorDisplayPrice(
  vendor: NutritionVendorCardModel,
  opts?: { serviceStyle?: string }
): Promise<NutritionVendorCardModel> {
  if (hasDisplayPrice(vendor)) return vendor;

  const vendorId = String(vendor.vendorId ?? vendor.id ?? '').trim();
  if (!vendorId) return vendor;

  const teleRange = await priceRangeFromTeleServices(vendorId);
  if (teleRange.priceMin != null) {
    return {
      ...vendor,
      priceMin: teleRange.priceMin,
      priceMax: teleRange.priceMax ?? teleRange.priceMin,
    };
  }

  const style = opts?.serviceStyle?.trim() || 'tele';
  const fee = await appointmentFeeForVendor(vendorId, style);
  if (fee != null) {
    return { ...vendor, priceMin: fee, priceMax: vendor.priceMax ?? fee };
  }

  return vendor;
}

/** Batch-enrich nutrition vendor cards (parallel, deduped by vendor id). */
export async function enrichNutritionVendorPrices(
  vendors: NutritionVendorCardModel[],
  opts?: { serviceStyle?: string }
): Promise<NutritionVendorCardModel[]> {
  return Promise.all(vendors.map((v) => resolveNutritionVendorDisplayPrice(v, opts)));
}

/** Min positive price from mapped vendor service rows. */
export function minPriceFromServiceRows(rows: unknown[]): number | null {
  const prices = rows
    .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
    .map((r) => priceFromVendorServiceRow(r))
    .filter((p): p is number => p != null);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export async function fetchNutritionAppointmentFee(
  vendorId: string,
  serviceStyle: string
): Promise<number | null> {
  return appointmentFeeForVendor(vendorId, serviceStyle);
}

/** Load vendor tele services — same catalog as Diet Consultation / shell nutritionist-booking. */
export async function fetchNutritionTeleVendorServices(vendorId: string): Promise<unknown[]> {
  try {
    const res = (await apiClient.get(
      `/customer/vendor/${encodeURIComponent(vendorId)}/services?serviceStyle=tele`
    )) as { services?: unknown[]; packages?: unknown[]; success?: boolean };
    if (!res?.success && !res?.services) return [];
    return mergeCustomerVendorServicesPayload(res);
  } catch {
    return [];
  }
}

export function priceRangeFromServiceRows(rows: unknown[]): { priceMin?: number; priceMax?: number } {
  const prices = rows
    .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
    .map((r) => priceFromVendorServiceRow(r))
    .filter((p): p is number => p != null);
  if (prices.length === 0) return {};
  return { priceMin: Math.min(...prices), priceMax: Math.max(...prices) };
}
