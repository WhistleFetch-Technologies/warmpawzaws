/**
 * Resolve vendor photo / cover URLs from heterogeneous API shapes
 * (GET /customer/facility/:id, GET /vendor/:id, discovery payloads).
 */

function pickNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

function pushNestedStrings(target: unknown[], obj: unknown, keys: string[]) {
  if (!obj || typeof obj !== 'object') return;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    target.push(o[k]);
  }
}

/** Single gallery item → display URL (string or { url, key, … }). */
function photoUrlFromGalleryItem(item: unknown): string | undefined {
  const direct = pickNonEmptyString(item);
  if (direct) return direct;
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    return (
      pickNonEmptyString(o.url) ||
      pickNonEmptyString(o.photoUrl) ||
      pickNonEmptyString(o.photo_url) ||
      pickNonEmptyString(o.src) ||
      pickNonEmptyString(o.imageUrl) ||
      pickNonEmptyString(o.image) ||
      pickNonEmptyString(o.photo) ||
      pickNonEmptyString(o.key)
    );
  }
  return undefined;
}

function coalesceUrlArrayFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const x of value) {
    const u = photoUrlFromGalleryItem(x);
    if (u) out.push(u);
  }
  return out;
}

/**
 * Canonical key for the same S3 object across:
 * bare key `vendors/...`, virtual-hosted URL, path-style URL, presigned variants (query stripped).
 * Aligns with backend gallery shapes so one upload is not repeated as multiple slides.
 */
function mediaUrlDedupeKey(url: string): string {
  const t = url.trim();
  if (!t) return '';

  const stripQueryHash = (s: string) => s.split('?')[0].split('#')[0];
  const normalizeSlashes = (s: string) =>
    s.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');

  const lower = t.toLowerCase();
  const vendorsIdx = lower.indexOf('vendors/');
  if (vendorsIdx >= 0) {
    let rest = normalizeSlashes(stripQueryHash(t.slice(vendorsIdx)));
    try {
      return decodeURIComponent(rest).toLowerCase();
    } catch {
      return rest.toLowerCase();
    }
  }

  if (t.startsWith('http://') || t.startsWith('https://')) {
    try {
      const u = new URL(t);
      let path = normalizeSlashes(stripQueryHash(u.pathname).replace(/^\/+/, ''));
      if (path) {
        try {
          return decodeURIComponent(path).toLowerCase();
        } catch {
          return path.toLowerCase();
        }
      }
      return u.host.toLowerCase();
    } catch {
      /* continue */
    }
  }

  return normalizeSlashes(stripQueryHash(t)).toLowerCase();
}

function dedupeUrlsPreserveOrder(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const display = typeof u === 'string' ? u.trim() : '';
    if (!display) continue;
    const key = mediaUrlDedupeKey(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }
  return out;
}

/** Final pass for hero UI: non-empty strings only, same logical image once (any caller). */
export function dedupeHeroPhotoUrls(urls: string[]): string[] {
  return dedupeUrlsPreserveOrder(urls);
}

/** Avatar / logo — prefer dedicated profile fields over cover/banner. */
export function resolveVendorProfilePhotoUrl(raw: Record<string, unknown> | null | undefined): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const candidates: unknown[] = [
    raw.profilePhotoUrl,
    raw.profile_photo_url,
    raw.profilePhoto,
    raw.profile_photo,
    raw.photoUrl,
    raw.photo_url,
    raw.photo,
    raw.logoUrl,
    raw.logo_url,
    raw.logo,
    raw.vendorProfileImage,
    raw.vendor_profile_image,
    raw.profile_image,
    raw.profileImage,
    raw.businessPhoto,
    raw.business_photo,
    raw.imageUrl,
    raw.image_url,
  ];

  pushNestedStrings(candidates, raw.metadata, ['profilePhotoUrl', 'profile_photo_url', 'logoUrl', 'logo_url', 'photo']);
  pushNestedStrings(candidates, raw.application, ['profilePhotoUrl', 'profile_photo_url', 'logoUrl', 'logo_url', 'photo']);
  pushNestedStrings(candidates, raw.onboarding, ['profilePhotoUrl', 'profile_photo_url', 'logoUrl', 'logo_url']);

  for (const c of candidates) {
    const s = pickNonEmptyString(c);
    if (s) return s;
  }

  if (Array.isArray(raw.photos)) {
    for (const item of raw.photos) {
      const s = photoUrlFromGalleryItem(item);
      if (s) return s;
    }
  }
  if (Array.isArray(raw.gallery)) {
    for (const item of raw.gallery) {
      const s = photoUrlFromGalleryItem(item);
      if (s) return s;
    }
  }
  return undefined;
}

/**
 * Gallery URLs for provider profile hero — merges facility, vendor, and discovery
 * provider fields so every uploaded photo can appear (deduped by logical asset, stable order).
 */
export function getVendorHeroPhotoUrls(args: {
  /** Facility row from /customer/facility/:id (e.g. facility.photos) */
  facility?: object | null;
  /** Merged or GET /customer/vendor/:id (facilityPhotos, photoUrl, photos, …) */
  vendor?: object | null;
  /** In-app provider row (photo, photos from discovery) */
  profileProvider?: object | null;
}): string[] {
  const { facility, vendor, profileProvider } = args;
  const ordered: string[] = [];

  const f = facility && typeof facility === 'object' ? (facility as Record<string, unknown>) : null;
  ordered.push(...coalesceUrlArrayFromUnknown(f?.photos));

  if (vendor && typeof vendor === 'object') {
    const v = vendor as Record<string, unknown>;
    ordered.push(...coalesceUrlArrayFromUnknown(v.facilityPhotos ?? v.facility_photos));
    ordered.push(...coalesceUrlArrayFromUnknown(v.photos));
    ordered.push(...coalesceUrlArrayFromUnknown(v.gallery));
    const vOne =
      pickNonEmptyString(v.photoUrl) ||
      pickNonEmptyString(v.photo_url) ||
      pickNonEmptyString(v.profile_photo_url) ||
      pickNonEmptyString(v.profilePhotoUrl) ||
      pickNonEmptyString(v.profile_image) ||
      pickNonEmptyString(v.photo);
    if (vOne) ordered.push(vOne);
  }

  if (profileProvider && typeof profileProvider === 'object') {
    const p = profileProvider as Record<string, unknown>;
    ordered.push(...coalesceUrlArrayFromUnknown(p.photos));
    ordered.push(...coalesceUrlArrayFromUnknown(p.gallery));
    const pOne =
      pickNonEmptyString(p.photo) || pickNonEmptyString(p.photoUrl) || pickNonEmptyString(p.photo_url);
    if (pOne) ordered.push(pOne);
  }

  return dedupeUrlsPreserveOrder(ordered);
}

/**
 * Fill in photo-related fields from GET /customer/vendor (or discovery) when facility merge
 * omits profile headshots (common for solo walkers — photo is profile_photo_url, not facility gallery).
 */
export function mergeVendorPhotoFieldsForHero(
  base: Record<string, unknown>,
  enrichment: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!enrichment || typeof enrichment !== 'object') return base;
  const out: Record<string, unknown> = { ...base };
  const fill = (key: string) => {
    const cur = out[key];
    const has =
      (typeof cur === 'string' && cur.trim().length > 0) ||
      (Array.isArray(cur) && cur.length > 0);
    if (has) return;
    const v = enrichment[key];
    if (v !== undefined && v !== null && !(typeof v === 'string' && !v.trim())) {
      out[key] = v;
    }
  };
  fill('photoUrl');
  fill('profile_photo_url');
  fill('profilePhotoUrl');
  fill('profile_image');
  fill('logo_url');
  fill('logoUrl');
  fill('facilityPhotos');
  fill('facility_photos');
  const bPhotos = out.photos;
  const basePhotosEmpty = !Array.isArray(bPhotos) || bPhotos.length === 0;
  if (basePhotosEmpty && Array.isArray(enrichment.photos) && enrichment.photos.length > 0) {
    out.photos = enrichment.photos;
  }
  return out;
}

/**
 * Single entry for **all** service profile heroes (vet, grooming, training, boarding, home services):
 * folds discovery/list `profileProvider` photo fields into the vendor row when the API omitted them,
 * then builds the gallery (deduped). Carousel still runs {@link dedupeHeroPhotoUrls} for defense in depth.
 */
export function resolveVendorProfileHeroGallery(args: {
  facility?: object | null;
  vendor?: object | null;
  profileProvider?: object | null;
}): string[] {
  const v =
    args.vendor && typeof args.vendor === 'object'
      ? ({ ...(args.vendor as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const p =
    args.profileProvider && typeof args.profileProvider === 'object'
      ? (args.profileProvider as Record<string, unknown>)
      : null;

  const fromDiscovery: Record<string, unknown> = {};
  if (p) {
    for (const k of ['photoUrl', 'photo', 'profile_photo_url', 'profilePhotoUrl', 'photos', 'gallery'] as const) {
      const val = p[k];
      if (val !== undefined && val !== null && !(typeof val === 'string' && !String(val).trim())) {
        fromDiscovery[k] = val;
      }
    }
  }

  const enrichedVendor = mergeVendorPhotoFieldsForHero(
    v,
    Object.keys(fromDiscovery).length > 0 ? fromDiscovery : null
  );

  const combined = getVendorHeroPhotoUrls({
    facility: args.facility,
    vendor: Object.keys(enrichedVendor).length > 0 ? enrichedVendor : null,
    profileProvider: args.profileProvider,
  });
  return dedupeHeroPhotoUrls(combined);
}

/** Hero / cover — never fall back to profile avatar (callers decide placeholders). */
export function resolveVendorCoverImageUrl(raw: Record<string, unknown> | null | undefined): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const candidates: unknown[] = [
    raw.coverImageUrl,
    raw.cover_image_url,
    raw.coverImage,
    raw.cover_image,
    raw.cover,
    raw.bannerUrl,
    raw.banner_url,
    raw.banner,
    raw.heroImage,
    raw.hero_image,
    raw.facilityCoverUrl,
    raw.facility_cover_url,
  ];

  pushNestedStrings(candidates, raw.metadata, ['coverImageUrl', 'cover_image_url', 'bannerUrl', 'banner_url', 'banner']);

  for (const c of candidates) {
    const s = pickNonEmptyString(c);
    if (s) return s;
  }
  return undefined;
}

/**
 * Merge GET /customer/facility/:id payload so vendor identity + facility fields are both visible.
 * Facility is spread first; vendor fields (businessName, logoUrl, …) win.
 */
export function mergeCustomerFacilityPayload(root: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!root || typeof root !== 'object') return {};
  const vendor = root.vendor && typeof root.vendor === 'object' ? (root.vendor as Record<string, unknown>) : {};
  const facility = root.facility && typeof root.facility === 'object' ? (root.facility as Record<string, unknown>) : {};
  return { ...facility, ...vendor };
}

export function ratingFromFacilityRoot(root: Record<string, unknown> | null | undefined): {
  average?: number;
  count?: number;
} {
  const r = root?.rating;
  if (!r || typeof r !== 'object') return {};
  const o = r as Record<string, unknown>;
  let average: number | undefined;
  if (o.average != null) {
    const n = parseFloat(String(o.average));
    if (!Number.isNaN(n)) average = n;
  }
  let count: number | undefined;
  if (o.count != null) {
    const n = parseInt(String(o.count), 10);
    if (!Number.isNaN(n)) count = n;
  }
  return { average, count };
}
