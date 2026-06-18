/** Persist boarding vendor profile context across shell child screens (packages, booking wizards). */

export const WARMPAWZ_BOARDING_PROFILE_CTX_KEY = 'warmpawz_boarding_profile_ctx';

export type BoardingProfileContext = {
  vendorId: string;
  slug: string | null;
};

export function vendorIdFromRouteKey(key?: string | null): string | null {
  if (!key?.startsWith('vendor:')) return null;
  const id = key.slice('vendor:'.length).trim();
  return id || null;
}

export function rememberBoardingProfileContext(vendorId: string, slug: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  const vid = String(vendorId || '').trim();
  if (!vid) return;
  try {
    sessionStorage.setItem(
      WARMPAWZ_BOARDING_PROFILE_CTX_KEY,
      JSON.stringify({ vendorId: vid, slug: slug ?? null } satisfies BoardingProfileContext),
    );
  } catch {
    /* ignore */
  }
}

export function peekBoardingProfileContext(): BoardingProfileContext | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(WARMPAWZ_BOARDING_PROFILE_CTX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoardingProfileContext;
    const vid = String(parsed?.vendorId ?? '').trim();
    if (!vid) return null;
    return { vendorId: vid, slug: parsed.slug ?? null };
  } catch {
    return null;
  }
}

export function clearBoardingProfileContext(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(WARMPAWZ_BOARDING_PROFILE_CTX_KEY);
  } catch {
    /* ignore */
  }
}
