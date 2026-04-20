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
      const s = pickNonEmptyString(item);
      if (s) return s;
    }
  }
  if (Array.isArray(raw.gallery)) {
    for (const item of raw.gallery) {
      const s = pickNonEmptyString(item);
      if (s) return s;
    }
  }
  return undefined;
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
