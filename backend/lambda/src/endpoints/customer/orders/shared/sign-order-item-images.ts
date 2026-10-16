import { presignProductImagesJsonb } from '../../../../utils/s3-media-presign';

/** Shop photos stored as S3 keys or private bucket URLs cannot render until signed. */
export function orderItemImageNeedsSigning(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const value = raw.trim();
  if (!value) return false;
  if (value.startsWith('products/')) return true;
  return /amazonaws\.com/i.test(value);
}

export async function signOrderItemImages<T extends Record<string, unknown>>(
  items: T[],
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      const raw = item.product_image;
      if (!orderItemImageNeedsSigning(raw)) return item;
      const vendorRaw = item.vendor_id ?? item.vendorId;
      const vendorId = vendorRaw != null && String(vendorRaw).trim() ? String(vendorRaw) : undefined;
      try {
        const signed = await presignProductImagesJsonb(String(raw).trim(), 'detail', vendorId);
        if (typeof signed === 'string' && /^https?:\/\//i.test(signed)) {
          return { ...item, product_image: signed };
        }
      } catch {
        /* keep the stored value */
      }
      return item;
    }),
  );
}
