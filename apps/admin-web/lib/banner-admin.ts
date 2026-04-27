/**
 * Admin GET /admin/banners returns DB column `type` (e.g. main, home_top, home_middle, category, checkout).
 * UI uses `position` with legacy `main` shown as `home_top`.
 */

export function adminBannerPositionFromRow(row: { type?: string; position?: string }): string {
  const t = (row.type ?? row.position ?? 'main').toString().toLowerCase();
  if (t === 'main') return 'home_top';
  return t;
}

export function normalizeAdminBannerRow<T extends Record<string, unknown>>(row: T): T & { position: string; type: string } {
  const t = String(row.type ?? row.position ?? 'main');
  const position = adminBannerPositionFromRow({ type: t, position: row.position as string | undefined });
  return { ...row, type: t, position };
}

export function normalizeAdminBannersList(banners: unknown[] | null | undefined): (Record<string, unknown> & { position: string; type: string })[] {
  if (!Array.isArray(banners)) return [];
  return banners.map((b) => normalizeAdminBannerRow(b as Record<string, unknown>));
}

export function formatAdminBannerPlacementLabel(position: string | undefined): string {
  return (position || 'home_top').replace(/_/g, ' ');
}
