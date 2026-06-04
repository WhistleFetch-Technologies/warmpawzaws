/** Parse admin `metadata.bannerTarget` article destination (mirrors banner-admin). */

export function buildArticleBannerPath(slug: string): string {
  const s = String(slug ?? '').trim();
  if (!s) return '';
  return `/articles?slug=${encodeURIComponent(s)}`;
}

/** Home banner metadata: display-only, no CTA navigation (not shop checkout). */
export function parseBannerInformationalFromMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const meta = metadata as Record<string, unknown>;
  const raw = meta.bannerTarget ?? meta.banner_target;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const bt = raw as Record<string, unknown>;
  const level = String(bt.targetLevel ?? bt.target_level ?? '').trim().toLowerCase();
  return level === 'informational';
}

export function isBannerInformationalNonClickable(banner: {
  metadata?: unknown;
  isInformational?: boolean;
}): boolean {
  if (banner.isInformational) return true;
  return parseBannerInformationalFromMetadata(banner.metadata);
}

export function parseBannerArticleSlugFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const meta = metadata as Record<string, unknown>;
  const raw = meta.bannerTarget ?? meta.banner_target;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const bt = raw as Record<string, unknown>;
  const level = String(bt.targetLevel ?? bt.target_level ?? '').trim().toLowerCase();
  if (level !== 'article') return null;
  const slug = String(bt.articleSlug ?? bt.article_slug ?? '').trim();
  return slug || null;
}

export function parseArticleSlugFromBannerPath(path: unknown): string | null {
  const raw = String(path ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/\/articles\?slug=([^&#]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1].trim()) || null;
  } catch {
    return match[1].trim() || null;
  }
}

export function parseArticleSlugFromCtaLink(ctaLink: unknown): string | null {
  const raw = String(ctaLink ?? '').trim();
  if (!raw) return null;
  const fromPath = parseArticleSlugFromBannerPath(raw);
  if (fromPath) return fromPath;
  return null;
}

export function isInAppCategoryBannerTargetMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const meta = metadata as Record<string, unknown>;
  const raw = meta.bannerTarget ?? meta.banner_target;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const bt = raw as Record<string, unknown>;
  const level = String(bt.targetLevel ?? bt.target_level ?? '').trim().toLowerCase();
  if (level === 'article' || level === 'informational') return false;
  return Boolean(level);
}
