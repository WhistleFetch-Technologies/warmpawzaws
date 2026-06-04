/** Parse admin `metadata.bannerTarget` external URL destination (mirrors banner-admin). */
export function parseBannerExternalUrlFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const meta = metadata as Record<string, unknown>;
  const raw = meta.bannerTarget ?? meta.banner_target;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const bt = raw as Record<string, unknown>;
  const level = String(bt.targetLevel ?? bt.target_level ?? '').trim().toLowerCase();
  if (level !== 'external_url') return null;
  const url = String(bt.externalUrl ?? bt.external_url ?? '').trim();
  return url || null;
}

export function isHttpBannerUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith('//');
}

export function normalizeHttpBannerUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}
