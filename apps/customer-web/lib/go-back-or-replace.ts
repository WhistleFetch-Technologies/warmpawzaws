type MinimalRouter = { back: () => void; replace: (href: string) => void };

type RouterWithPush = MinimalRouter & { push: (href: string) => void };

/**
 * Prefer browser history (real “previous page”). Uses `router.back()` first; if the URL does not
 * change (common when `history.length` is misleading in embedded WebViews / App Router), falls
 * back to `replace(fallbackPath)`.
 */
export function goBackOrReplace(router: MinimalRouter, fallbackPath: string): void {
  if (typeof window === 'undefined') {
    router.replace(fallbackPath);
    return;
  }

  const snapshot = () => `${window.location.pathname}${window.location.search}`;
  const pathBefore = snapshot();
  let finished = false;

  const end = () => {
    if (finished) return;
    finished = true;
    clearInterval(pollId);
    window.removeEventListener('popstate', onPopState);
  };

  const onPopState = () => {
    end();
  };

  const pollId = window.setInterval(() => {
    if (snapshot() !== pathBefore) {
      end();
    }
  }, 50);

  window.addEventListener('popstate', onPopState, { once: true });
  router.back();

  window.setTimeout(() => {
    if (!finished) {
      end();
      if (snapshot() === pathBefore) {
        router.replace(fallbackPath);
      }
    }
  }, 700);
}

/** Prefer history; if there is no prior entry, go home (`/`). */
export function goBackOrHome(router: MinimalRouter): void {
  goBackOrReplace(router, '/');
}

// --- Shop: remember where to return when opening `/shop` from profile/orders (SPA same URL) ---

export const WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY = 'warmpawz_open_screen_after_nav';

/** After full-screen My Bookings (from account sidebar), reopen sheet on this tab. */
export const WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY = 'warmpawz_account_sidebar_active_view';

/**
 * Valid `setCurrentScreen` targets when resuming `/` after leaving for `/shop`, `/promotions`, etc.
 * Keep in sync with `CustomerHomeWrapper` ScreenType usage.
 */
export const WARMPAWZ_HOME_RESUME_SCREENS = new Set<string>([
  'order_history',
  'my-bookings',
  'package-tracking',
  'shop',
  'cart',
  'wallet',
  'booking-messages',
  'home',
  'boarding',
  'rewards-loyalty',
  'referral-system',
  'support_help',
  'services',
  'integrated-services',
]);

/** @deprecated Use string; kept for call sites that passed a narrow union. */
export type ShopReturnSpaScreen = string;

const SHOP_BACK_INTENT_KEY = 'warmpawz_shop_back_intent';

/** Set when using the wishlist entry point from the full `/shop` route (see `markWishlistOpenedFromShop`). */
const WISHLIST_OPENED_FROM_SHOP_KEY = 'warmpawz_wishlist_opened_from_shop';

/** Call when navigating from `/shop` to `/wishlist` so empty wishlist “Start Shopping” can use `router.back()` without stacking a second `/shop`. */
export function markWishlistOpenedFromShop(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(WISHLIST_OPENED_FROM_SHOP_KEY, '1');
}

/**
 * Returns true once if the last hop to wishlist was from `/shop`. Clears the mark.
 * Used by empty wishlist “Start Shopping”.
 */
export function consumeWishlistOpenedFromShop(): boolean {
  if (typeof window === 'undefined') return false;
  const v = sessionStorage.getItem(WISHLIST_OPENED_FROM_SHOP_KEY);
  if (v === '1') {
    sessionStorage.removeItem(WISHLIST_OPENED_FROM_SHOP_KEY);
    return true;
  }
  return false;
}

/** Call before `router.push('/wishlist')` from routes other than `/shop` so a stale “from shop” mark does not flip Start Shopping behavior. */
export function clearWishlistOpenedFromShopMark(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(WISHLIST_OPENED_FROM_SHOP_KEY);
}

/** Clears pinned shop back target (e.g. before `router.back()` from wishlist when returning to existing `/shop`). */
export function clearShopBackIntent(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SHOP_BACK_INTENT_KEY);
}

type ShopBackIntent =
  | { kind: 'path'; path: string }
  | { kind: 'spa'; screen: string };

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
export function rememberShopBackToSpaScreen(screen: string): void {
  if (typeof window === 'undefined') return;
  const safe = WARMPAWZ_HOME_RESUME_SCREENS.has(screen) ? screen : 'home';
  sessionStorage.setItem(SHOP_BACK_INTENT_KEY, JSON.stringify({ kind: 'spa', screen: safe } satisfies ShopBackIntent));
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
      if (parsed.kind === 'spa' && WARMPAWZ_HOME_RESUME_SCREENS.has(parsed.screen)) {
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

// --- Promotions: home shell stays on `/` while embedded screen changes; history.back() would miss it ---

const PROMOTIONS_BACK_INTENT_KEY = 'warmpawz_promotions_back_intent';

type PromotionsBackIntent =
  | { kind: 'path'; path: string }
  | { kind: 'spa'; screen: string };

/** Call before navigating to `/promotions` from a real route (e.g. `/wallet`). */
export function rememberPromotionsBackFromCurrentUrl(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  if (!isSafeInternalPath(path) || path.startsWith('/promotions')) return;
  if (path === '/' || path === '') return;
  sessionStorage.setItem(
    PROMOTIONS_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'path', path } satisfies PromotionsBackIntent)
  );
}

/**
 * Call before `router.push('/promotions')` when the visible screen is embedded on `/`
 * (same URL as home — browser “back” would only return to `/` default, not shop/wallet).
 */
export function rememberPromotionsBackSpaScreen(screen: string): void {
  if (typeof window === 'undefined') return;
  const safe = WARMPAWZ_HOME_RESUME_SCREENS.has(screen) ? screen : 'home';
  sessionStorage.setItem(
    PROMOTIONS_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'spa', screen: safe } satisfies PromotionsBackIntent)
  );
}

export function handlePromotionsPageBack(router: RouterWithPush): void {
  if (typeof window === 'undefined') {
    router.replace('/shop');
    return;
  }
  const raw = sessionStorage.getItem(PROMOTIONS_BACK_INTENT_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PromotionsBackIntent;
      sessionStorage.removeItem(PROMOTIONS_BACK_INTENT_KEY);
      if (parsed.kind === 'path' && isSafeInternalPath(parsed.path)) {
        router.push(parsed.path);
        return;
      }
      if (parsed.kind === 'spa' && WARMPAWZ_HOME_RESUME_SCREENS.has(parsed.screen)) {
        sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, parsed.screen);
        router.push('/');
        return;
      }
    } catch {
      sessionStorage.removeItem(PROMOTIONS_BACK_INTENT_KEY);
    }
  }
  goBackOrReplace(router, '/shop');
}

// --- Help (`/help`): same pattern as promotions when history is shallow or unreliable ---

const HELP_BACK_INTENT_KEY = 'warmpawz_help_back_intent';

type HelpBackIntent =
  | { kind: 'path'; path: string }
  | { kind: 'spa'; screen: string };

/** Call before navigating to `/help` from a real route (e.g. `/wallet`). */
export function rememberHelpBackFromCurrentUrl(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  if (!isSafeInternalPath(path) || path.startsWith('/help')) return;
  if (path === '/' || path === '') return;
  sessionStorage.setItem(
    HELP_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'path', path } satisfies HelpBackIntent)
  );
}

/** Call before `router.push('/help')` from the home shell at `/` (embedded screen). */
export function rememberHelpBackSpaScreen(screen: string): void {
  if (typeof window === 'undefined') return;
  const safe = WARMPAWZ_HOME_RESUME_SCREENS.has(screen) ? screen : 'home';
  sessionStorage.setItem(
    HELP_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'spa', screen: safe } satisfies HelpBackIntent)
  );
}

export function handleHelpPageBack(router: RouterWithPush): void {
  if (typeof window === 'undefined') {
    router.replace('/');
    return;
  }
  const raw = sessionStorage.getItem(HELP_BACK_INTENT_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as HelpBackIntent;
      sessionStorage.removeItem(HELP_BACK_INTENT_KEY);
      if (parsed.kind === 'path' && isSafeInternalPath(parsed.path)) {
        router.push(parsed.path);
        return;
      }
      if (parsed.kind === 'spa' && WARMPAWZ_HOME_RESUME_SCREENS.has(parsed.screen)) {
        sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, parsed.screen);
        router.push('/');
        return;
      }
    } catch {
      sessionStorage.removeItem(HELP_BACK_INTENT_KEY);
    }
  }
  goBackOrReplace(router, '/');
}
