/** Default when banner placement does not specify a return screen. */
export const BANNER_RETURN_HOME_SCREEN = 'home';

export type BannerNavigationPayload = Record<string, unknown>;

export function withBannerNavigationOrigin(
  data?: BannerNavigationPayload | null,
  returnScreen?: string
): BannerNavigationPayload {
  const base =
    data && typeof data === 'object' && !Array.isArray(data) ? { ...data } : {};
  const screen =
    String(returnScreen ?? base.returnScreen ?? BANNER_RETURN_HOME_SCREEN).trim() ||
    BANNER_RETURN_HOME_SCREEN;
  return {
    ...base,
    returnScreen: screen,
    fromBanner: true,
  };
}

export function isBannerNavigationPayload(
  data?: BannerNavigationPayload | null
): boolean {
  if (!data || typeof data !== 'object') return false;
  return data.fromBanner === true;
}

export function getBannerReturnScreen(
  ...contexts: Array<BannerNavigationPayload | null | undefined>
): string | null {
  for (const ctx of contexts) {
    if (!ctx || typeof ctx !== 'object') continue;
    if (ctx.fromBanner === true) {
      const rs = String(ctx.returnScreen ?? '').trim();
      if (rs) return rs;
    }
  }
  return null;
}

/** Merge nav payloads while preserving banner return screen when either side is banner-origin. */
export function mergeBannerNavigationPayload(
  prev?: BannerNavigationPayload | null,
  next?: BannerNavigationPayload | null
): BannerNavigationPayload {
  const merged = { ...(prev || {}), ...(next || {}) };
  if (isBannerNavigationPayload(prev) || isBannerNavigationPayload(next)) {
    merged.returnScreen =
      String(next?.returnScreen ?? prev?.returnScreen ?? BANNER_RETURN_HOME_SCREEN).trim() ||
      BANNER_RETURN_HOME_SCREEN;
    merged.fromBanner = true;
  }
  return merged;
}
