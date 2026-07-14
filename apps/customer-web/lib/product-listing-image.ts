/**
 * Normalize storefront product image entries and pick the best list/grid URL.
 * List APIs may already flatten to thumb displayUrl; objects with thumbUrl are also supported.
 */

export function normalizeProductImageSrc(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const candidate =
      o.displayUrl ?? o.thumbUrl ?? o.url ?? o.src ?? o.image_url ?? o.imageUrl ?? '';
    return String(candidate ?? '').trim();
  }
  return '';
}

export function normalizeProductImagesList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    const one = normalizeProductImageSrc(raw);
    return one ? [one] : [];
  }
  return raw.map(normalizeProductImageSrc).filter(Boolean);
}

/** Prefer explicit thumbUrl, else first normalized image (often already a list thumb). */
export function pickShopProductListingImage(product: {
  images?: unknown[] | string[];
  thumbUrl?: string | null;
}): string {
  const thumb = typeof product.thumbUrl === 'string' ? product.thumbUrl.trim() : '';
  if (thumb) return thumb;
  const first = product.images?.[0];
  return normalizeProductImageSrc(first);
}
