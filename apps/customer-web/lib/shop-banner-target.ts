export type ShopBannerTargetLevel = 'informational' | 'product';

export type ShopBannerTargetMetadata = {
  targetLevel: ShopBannerTargetLevel;
  productId?: string;
  productName?: string;
  productSku?: string;
};

const SHOP_PRODUCT_CTA_RE = /^\/shop\/([0-9a-f-]{36})$/i;

export function parseShopProductIdFromCtaLink(ctaLink: unknown): string | null {
  const raw = String(ctaLink ?? '').trim();
  const match = raw.match(SHOP_PRODUCT_CTA_RE);
  return match?.[1] ?? null;
}

export function parseShopBannerTargetFromMetadata(
  metadata: unknown,
  ctaLink?: unknown
): ShopBannerTargetMetadata | null {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const raw = meta.shopBannerTarget ?? meta.shop_banner_target;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const st = raw as Record<string, unknown>;
    const levelRaw = String(st.targetLevel ?? st.target_level ?? '').trim().toLowerCase();
    if (levelRaw === 'informational') {
      return { targetLevel: 'informational' };
    }
    if (levelRaw === 'product') {
      const productId = String(st.productId ?? st.product_id ?? '').trim();
      return {
        targetLevel: 'product',
        productId: productId || undefined,
        productName: String(st.productName ?? st.product_name ?? '').trim() || undefined,
        productSku: String(st.productSku ?? st.product_sku ?? '').trim() || undefined,
      };
    }
  }

  const legacyProductId = parseShopProductIdFromCtaLink(ctaLink);
  if (legacyProductId) {
    return { targetLevel: 'product', productId: legacyProductId };
  }

  return null;
}

export function isShopInformationalTarget(
  shopTarget: ShopBannerTargetMetadata | null | undefined
): boolean {
  return !shopTarget || shopTarget.targetLevel === 'informational';
}

export function resolveShopBannerProductPath(
  shopTarget: ShopBannerTargetMetadata | null | undefined,
  ctaLink?: string
): string | null {
  if (shopTarget?.targetLevel === 'product' && shopTarget.productId) {
    return `/shop/${shopTarget.productId}`;
  }
  const legacy = parseShopProductIdFromCtaLink(ctaLink);
  return legacy ? `/shop/${legacy}` : null;
}
