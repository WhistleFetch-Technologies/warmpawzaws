type MinimalRouter = { back: () => void; replace: (href: string) => void };

/**
 * Prefer browser history (real “previous page”); if there is no prior entry, replace with fallback.
 */
export function goBackOrReplace(router: MinimalRouter, fallbackPath: string): void {
  if (typeof window === 'undefined') {
    router.replace(fallbackPath);
    return;
  }
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.replace(fallbackPath);
}
