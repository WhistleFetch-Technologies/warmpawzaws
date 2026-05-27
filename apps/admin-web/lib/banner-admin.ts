/**
 * Admin GET /admin/banners returns DB column `type` (e.g. main, home_top, home_middle, category, checkout).
 * UI uses `position` with legacy `main` shown as `home_top`.
 */

/** Customer-web static hero asset (also used when admin saves home_top without an image). */
export const DEFAULT_HOME_HERO_BANNER_IMAGE_PATH = '/images/home/hero-pet.webp';

export function isHomeHeroBannerPosition(position: string | undefined): boolean {
  const p = String(position ?? '').toLowerCase();
  return p === 'home_top' || p === 'main';
}

export function resolveHomeHeroBannerImageUrl(imageUrl?: string | null): string {
  const trimmed = String(imageUrl ?? '').trim();
  if (trimmed) return trimmed;
  return DEFAULT_HOME_HERO_BANNER_IMAGE_PATH;
}

export function adminBannerPositionFromRow(row: { type?: string; position?: string }): string {
  const t = (row.type ?? row.position ?? 'main').toString().toLowerCase();
  if (t === 'main') return 'home_top';
  return t;
}

export function normalizeAdminBannerRow<T extends Record<string, unknown>>(row: T): T & { position: string; type: string; imageUrl?: string } {
  const t = String(row.type ?? row.position ?? 'main');
  const position = adminBannerPositionFromRow({ type: t, position: row.position as string | undefined });
  const target_state = normalizeLocationValue(row.target_state ?? row.targetState);
  const target_city = normalizeLocationValue(row.target_city ?? row.targetCity);
  const rawImage = row.image_url ?? row.imageUrl;
  const image_url =
    rawImage != null && String(rawImage).trim()
      ? String(rawImage).trim()
      : isHomeHeroBannerPosition(position)
        ? DEFAULT_HOME_HERO_BANNER_IMAGE_PATH
        : undefined;
  const imageUrl = image_url;
  return { ...row, type: t, position, target_state, target_city, image_url, imageUrl };
}

export function normalizeAdminBannersList(banners: unknown[] | null | undefined): (Record<string, unknown> & { position: string; type: string })[] {
  if (!Array.isArray(banners)) return [];
  return banners.map((b) => normalizeAdminBannerRow(b as Record<string, unknown>));
}

export function formatAdminBannerPlacementLabel(position: string | undefined): string {
  return (position || 'home_top').replace(/_/g, ' ');
}

export function normalizeLocationValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length ? normalized : null;
}

export function formatAdminBannerLocationLabel(targetState?: unknown, targetCity?: unknown): string {
  const state = normalizeLocationValue(targetState);
  const city = normalizeLocationValue(targetCity);
  if (!state && !city) return 'All locations';
  if (state && city) return `${city}, ${state}`;
  if (state) return `All cities, ${state}`;
  return `${city}`;
}
