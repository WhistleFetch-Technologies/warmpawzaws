type MinimalRouter = { back: () => void; replace: (href: string) => void };

type RouterWithPush = MinimalRouter & { push: (href: string) => void };

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

/** Prefer history; if there is no prior entry, go home (`/`). */
export function goBackOrHome(router: MinimalRouter): void {
  goBackOrReplace(router, '/');
}

// --- Shop: remember where to return when opening `/shop` from profile/orders (SPA same URL) ---

export const WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY = 'warmpawz_open_screen_after_nav';

/** After full-screen My Bookings (from account sidebar), reopen sheet on this tab. */
export const WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY = 'warmpawz_account_sidebar_active_view';

export type ShopReturnSpaScreen = 'order_history' | 'my-bookings';

const SHOP_BACK_INTENT_KEY = 'warmpawz_shop_back_intent';

type ShopBackIntent =
  | { kind: 'path'; path: string }
  | { kind: 'spa'; screen: ShopReturnSpaScreen };

function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('://')) return false;
  return true;
}

/** Call before `router.push('/shop')` when leaving a full route (e.g. `/orders`). Skips pinning when URL is `/` (use SPA screen instead). */
export function rememberShopBackFromCurrentUrl(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  if (!isSafeInternalPath(path) || path.startsWith('/shop')) return;
  if (path === '/' || path === '') return;
  sessionStorage.setItem(SHOP_BACK_INTENT_KEY, JSON.stringify({ kind: 'path', path } satisfies ShopBackIntent));
}

/** Call before `router.push('/shop')` from an embedded screen that shares `/` (e.g. profile → My Orders). */
export function rememberShopBackToSpaScreen(screen: ShopReturnSpaScreen): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SHOP_BACK_INTENT_KEY, JSON.stringify({ kind: 'spa', screen } satisfies ShopBackIntent));
}

/**
 * Shop page back: honor remembered path or SPA screen; else browser back / home.
 */
export function handleShopPageBack(router: RouterWithPush): void {
  if (typeof window === 'undefined') {
    router.replace('/');
    return;
  }
  const raw = sessionStorage.getItem(SHOP_BACK_INTENT_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ShopBackIntent;
      sessionStorage.removeItem(SHOP_BACK_INTENT_KEY);
      if (parsed.kind === 'path' && isSafeInternalPath(parsed.path)) {
        router.push(parsed.path);
        return;
      }
      if (parsed.kind === 'spa' && (parsed.screen === 'order_history' || parsed.screen === 'my-bookings')) {
        sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, parsed.screen);
        router.push('/');
        return;
      }
    } catch {
      sessionStorage.removeItem(SHOP_BACK_INTENT_KEY);
    }
  }
  goBackOrHome(router);
}
