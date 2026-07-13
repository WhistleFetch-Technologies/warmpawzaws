/**
 * Groups flat rows from GET /customer/services/by-problem (one row per vendor_service)
 * into one object per vendor for vendor-first discovery UIs.
 */

import { pickVendorPhotoFromRow } from './resolve-display-image-url';
import { applyResolvedRatingToStoredFields } from '@/lib/resolve-vendor-rating';

export interface ByProblemServiceRow {
  serviceId?: string;
  service_id?: string;
  name?: string;
  serviceName?: string;
  vendorId?: string;
  vendor_id?: string;
  vendorName?: string;
  vendor_name?: string;
  photo?: string;
  photoUrl?: string;
  rating?: number;
  vendorRating?: number;
  reviewCount?: number;
  vendorReviews?: number;
  specializations?: string[];
  distance?: number | null;
  distanceFormatted?: string;
  price?: number;
  priceFormatted?: string;
  duration?: number;
  description?: string;
  isInstantAvailable?: boolean;
  serviceStyle?: string;
  service_style?: string;
  vendorType?: string;
  id?: string;
  nextAvailable?: string;
  /** Vendor service listing (from API) */
  serviceImageUrl?: string | null;
}

export interface VendorGroupFromProblem {
  vendorId: string;
  vendorName: string;
  photo?: string;
  rating: number;
  reviewCount: number;
  distanceFormatted: string;
  distance: number | null;
  specializations: string[];
  minPrice: number;
  serviceCount: number;
  isInstantAvailable: boolean;
  /** Original API rows for this vendor (service-level booking) */
  rows: ByProblemServiceRow[];
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && !Number.isNaN(n) ? n : fallback;
}

export function groupByProblemRowsByVendor(rows: unknown[]): VendorGroupFromProblem[] {
  const list = Array.isArray(rows) ? rows : [];
  const map = new Map<string, VendorGroupFromProblem>();

  for (const raw of list) {
    const row = raw as ByProblemServiceRow;
    const vendorId = String(row.vendorId || row.vendor_id || '').trim();
    if (!vendorId) continue;

    const price = num(row.price, 0);
    const ratingFields = applyResolvedRatingToStoredFields(
      row as Record<string, unknown>,
      vendorId
    );
    const rating = ratingFields.rating;
    const reviewCount = ratingFields.review_count;
    const vendorName = String(row.vendorName || row.vendor_name || 'Service provider').trim() || 'Service provider';
    const rowPhoto = pickVendorPhotoFromRow(row as Record<string, unknown>);
    const distRaw = row.distance;
    const dist =
      distRaw != null && String(distRaw) !== ''
        ? num(distRaw, NaN)
        : NaN;
    const distFmt =
      row.distanceFormatted ||
      (!Number.isNaN(dist)
        ? dist < 1
          ? `${Math.round(dist * 1000)} m`
          : `${dist.toFixed(1)} km`
        : 'N/A');

    if (!map.has(vendorId)) {
      map.set(vendorId, {
        vendorId,
        vendorName,
        photo: rowPhoto,
        rating,
        reviewCount,
        distanceFormatted: distFmt,
        distance: Number.isNaN(dist) ? null : dist,
        specializations: [],
        minPrice: price,
        serviceCount: 0,
        isInstantAvailable: !!row.isInstantAvailable,
        rows: [],
      });
    }
    const g = map.get(vendorId)!;
    g.rows.push(row);
    if (reviewCount > g.reviewCount || (rating > 0 && g.rating <= 0)) {
      g.reviewCount = Math.max(g.reviewCount, reviewCount);
      if (rating > 0) g.rating = rating;
    }
    g.serviceCount += 1;
    g.minPrice = Math.min(g.minPrice, price);
    if (row.isInstantAvailable) g.isInstantAvailable = true;

    for (const s of row.specializations || []) {
      if (typeof s === 'string' && s.trim() && !g.specializations.includes(s.trim())) {
        g.specializations.push(s.trim());
      }
    }

    if (!Number.isNaN(dist)) {
      if (g.distance == null || dist < g.distance) {
        g.distance = dist;
        g.distanceFormatted = distFmt;
      }
    }

    if (!g.photo && rowPhoto) {
      g.photo = rowPhoto;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const score = (v: VendorGroupFromProblem) =>
      (Number(v.rating) || 0) * 0.7 + (v.distance != null && !Number.isNaN(v.distance) ? (1 / (v.distance + 1)) * 0.3 : 0);
    return score(b) - score(a);
  });
}
