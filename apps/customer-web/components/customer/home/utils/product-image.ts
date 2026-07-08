import { resolveCustomerPublicAssetUrl } from '@/lib/public-asset-url';

/** First product image from API row (images JSON array, string URL, etc.). */
export function extractProductImageUrl(product: Record<string, unknown>): string | undefined {
  const raw =
    product.image ??
    product.image_url ??
    product.imageUrl ??
    product.primary_image ??
    product.images;
  if (raw == null) return undefined;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return extractFromParsedImages(parsed);
      } catch {
        return resolveCustomerPublicAssetUrl(trimmed) ?? undefined;
      }
    }
    return resolveCustomerPublicAssetUrl(trimmed) ?? undefined;
  }

  return extractFromParsedImages(raw);
}

function extractFromParsedImages(parsed: unknown): string | undefined {
  if (typeof parsed === 'string') {
    return resolveCustomerPublicAssetUrl(parsed) ?? undefined;
  }
  if (Array.isArray(parsed) && parsed.length > 0) {
    for (const entry of parsed) {
      if (typeof entry === 'string') {
        const resolved = resolveCustomerPublicAssetUrl(entry);
        if (resolved) return resolved;
        continue;
      }
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const o = entry as Record<string, unknown>;
        const rawUrl = String(o.url ?? o.src ?? o.image_url ?? '').trim();
        if (!rawUrl) continue;
        const resolved = resolveCustomerPublicAssetUrl(rawUrl);
        if (resolved) return resolved;
      }
    }
  }
  return undefined;
}
