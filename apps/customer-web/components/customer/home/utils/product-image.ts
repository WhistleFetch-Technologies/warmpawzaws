import { resolveCustomerPublicAssetUrl } from '@/lib/public-asset-url';

/** First product image from API row (images JSON array, string URL, etc.). */
export function extractProductImageUrl(product: Record<string, unknown>): string | undefined {
  const raw = product.image ?? product.image_url ?? product.imageUrl ?? product.images;
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
    const first = parsed[0];
    if (typeof first === 'string') return resolveCustomerPublicAssetUrl(first) ?? undefined;
    if (first && typeof first === 'object' && 'url' in first) {
      return resolveCustomerPublicAssetUrl(String((first as { url: unknown }).url)) ?? undefined;
    }
  }
  return undefined;
}
