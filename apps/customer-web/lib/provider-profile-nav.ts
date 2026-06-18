/**
 * Persist home-service provider profile context (sitter, behaviorist, etc.)
 * across shell child screens so back restores the profile view.
 */

import { vendorIdFromRouteKey } from '@/lib/boarding-profile-nav';

export { vendorIdFromRouteKey };

export type ProviderProfileKind = 'pet-sitter' | 'behaviorist';

const storageKey = (kind: ProviderProfileKind) => `warmpawz_provider_profile_ctx:${kind}`;

export function rememberProviderProfileContext(
  kind: ProviderProfileKind,
  vendorId: string,
): void {
  if (typeof sessionStorage === 'undefined') return;
  const vid = String(vendorId || '').trim();
  if (!vid) return;
  try {
    sessionStorage.setItem(storageKey(kind), JSON.stringify({ vendorId: vid }));
  } catch {
    /* ignore */
  }
}

export function peekProviderProfileContext(
  kind: ProviderProfileKind,
): { vendorId: string } | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { vendorId?: string };
    const vid = String(parsed?.vendorId ?? '').trim();
    if (!vid) return null;
    return { vendorId: vid };
  } catch {
    return null;
  }
}

export function clearProviderProfileContext(kind: ProviderProfileKind): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(storageKey(kind));
  } catch {
    /* ignore */
  }
}
