/**
 * Helpers for GET /search vendor rows (photo, address, distance).
 * Distance: prefer API `distanceKm` / `distance_km` when added server-side; else haversine
 * when vendor lat/lng and user coordinates are available.
 */

const toNum = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** Build one human-readable address line from common API field names (no lat/lng). */
export function formatVendorAddressLine(parts: {
  address?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}): string {
  const line1 = [parts.address?.trim(), parts.landmark?.trim()].filter(Boolean).join(', ');
  const line2 = [parts.city?.trim(), parts.state?.trim()].filter(Boolean).join(', ');
  const tail = parts.pincode?.trim();
  const segments = [line1, line2].filter((s) => s && s.length > 0);
  let out = segments.join(' · ');
  if (tail) {
    out = out ? `${out} ${tail}` : tail;
  }
  return out.trim() || 'Address on file';
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Distance suffix for hero-style search cards (“2 km away”). */
export function formatSearchDistanceAway(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null || !Number.isFinite(Number(distanceKm))) return null;
  const d = Number(distanceKm);
  if (d < 1) return `${Math.round(d * 1000)} m away`;
  return `${Math.round(d)} km away`;
}

export function vendorInitialsFromName(name: string): string {
  const w = (name || '').trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return '?';
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}

/** Raw vendor object from GET /search (camelCase from Lambda or legacy snake_case). */
export type SearchApiVendorRow = Record<string, unknown>;

/** Only values the browser can load in <img src> (not bare S3 keys). */
export function isBrowserLoadableImageUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (t.startsWith('data:')) return true;
  if (t.startsWith('/')) return true;
  return false;
}

function normalizeProtocolRelative(url: string): string {
  if (/^\/\//.test(url)) return `https:${url}`;
  return url;
}

function pickFromMetadataUrls(v: SearchApiVendorRow): string | undefined {
  const meta = v.metadata ?? v.vendor_metadata ?? (v as any).meta;
  let obj = meta;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj) as Record<string, unknown>;
    } catch {
      obj = null;
    }
  }
  if (!obj || typeof obj !== 'object') return undefined;
  const m = obj as Record<string, unknown>;
  const keys = [
    'profileImage',
    'profile_image',
    'photoUrl',
    'photo_url',
    'picture',
    'logoUrl',
    'logo_url',
  ];
  for (const k of keys) {
    const val = m[k];
    if (typeof val === 'string' && isBrowserLoadableImageUrl(val)) {
      return normalizeProtocolRelative(val.trim());
    }
  }
  return undefined;
}

/**
 * Vendor/center avatar for search listings.
 * Prefer GET /search enriched profileImage (fresh presigned HTTPS) over stale metadata keys/URLs.
 */
export function pickProfileImageUrl(v: SearchApiVendorRow): string | undefined {
  const apiResolved = [
    v.profileImage,
    v.profile_image,
    v.vendorProfileImage,
    v.vendor_profile_image,
  ]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .find(isBrowserLoadableImageUrl);
  if (apiResolved) return normalizeProtocolRelative(apiResolved);

  const direct = [
    v.photoUrl,
    v.photo_url,
    v.imageUrl,
    v.image_url,
    v.logo_url,
    v.logoUrl,
    v.avatar_url,
    v.avatarUrl,
    v.business_logo,
    v.businessLogo,
    v.thumbnail_url,
    v.thumbnailUrl,
    v.profilePhotoUrl,
    v.profile_photo_url,
  ]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .find(isBrowserLoadableImageUrl);
  if (direct) return normalizeProtocolRelative(direct);

  const photos = v.photos;
  if (Array.isArray(photos)) {
    const first = photos.find(
      (p) => typeof p === 'string' && isBrowserLoadableImageUrl(String(p))
    );
    if (typeof first === 'string') return normalizeProtocolRelative(first.trim());
  }

  const metaUrl = pickFromMetadataUrls(v);
  if (metaUrl) return metaUrl;

  return undefined;
}

export function pickServiceListingImage(v: SearchApiVendorRow): string | undefined {
  const fromVs = [
    v.image_url,
    v.thumbnail_url,
    v.cover_image,
    v.photo_url,
    (v as any).service_image_url,
    (v as any).gallery?.[0],
  ]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .find(Boolean);
  if (!fromVs) return undefined;
  if (/^https?:\/\//i.test(fromVs) || fromVs.startsWith('data:') || fromVs.startsWith('/')) {
    return fromVs;
  }
  return undefined;
}

export function pickVendorLatLng(v: SearchApiVendorRow): { lat: number; lng: number } | null {
  const lat =
    toNum(v.latitude) ??
    toNum(v.vendorLatitude) ??
    toNum(v.vendor_latitude) ??
    toNum((v as any).lat) ??
    (v.location && typeof v.location === 'object'
      ? toNum((v.location as any).lat ?? (v.location as any).latitude)
      : null);
  const lng =
    toNum(v.longitude) ??
    toNum(v.vendorLongitude) ??
    toNum(v.vendor_longitude) ??
    toNum((v as any).lng) ??
    (v.location && typeof v.location === 'object'
      ? toNum((v.location as any).lon ?? (v.location as any).lng ?? (v.location as any).longitude)
      : null);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

export function pickDistanceKmFromApi(v: SearchApiVendorRow): number | null {
  return toNum(v.distanceKm) ?? toNum(v.distance_km);
}
