'use client';

type RouterLike = {
  replace: (href: string) => void;
  push?: (href: string) => void;
};

const DEFAULT_FALLBACK_MS = 500;

/** `/auth?next=…` for post-login return to a customer route. */
export function buildAuthUrlWithNext(nextPath: string): string {
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  return `/auth?next=${encodeURIComponent(next)}`;
}

/**
 * Client router redirect with hard `location.assign` fallback if still on the same URL
 * after ~500ms (WebView / static-export router stalls).
 */
export function redirectWithHardFallback(
  router: RouterLike,
  targetUrl: string,
  options?: { method?: 'replace' | 'push'; fallbackMs?: number }
): void {
  if (typeof window === 'undefined') return;

  const method = options?.method ?? 'replace';
  const fallbackMs = options?.fallbackMs ?? DEFAULT_FALLBACK_MS;
  const startHref = window.location.pathname + window.location.search;

  if (method === 'push' && router.push) {
    router.push(targetUrl);
  } else {
    router.replace(targetUrl);
  }

  window.setTimeout(() => {
    const currentHref = window.location.pathname + window.location.search;
    if (currentHref === startHref) {
      window.location.assign(targetUrl);
    }
  }, fallbackMs);
}
