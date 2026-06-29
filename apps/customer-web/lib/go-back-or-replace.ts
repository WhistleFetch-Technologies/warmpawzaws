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

const MEAL_PLAN_ORDERS_PATH = '/orders/meal-plans';

function isMealPlanOrdersPathname(pathname: string): boolean {
  return pathname === MEAL_PLAN_ORDERS_PATH || pathname.startsWith(`${MEAL_PLAN_ORDERS_PATH}/`);
}

/**
 * `/bookings` Back — prefer real history, but skip a stale `/orders/meal-plans` entry left when
 * the meal-plan list used `router.push('/bookings')` instead of `router.back()`.
 */
export function goBackFromBookingsPage(router: MinimalRouter): void {
  if (typeof window === 'undefined') {
    router.replace('/');
    return;
  }

  const snapshot = () => `${window.location.pathname}${window.location.search}`;
  const start = snapshot();
  if (!window.location.pathname.startsWith('/bookings')) {
    goBackOrReplace(router, '/');
    return;
  }

  router.back();

  window.setTimeout(() => {
    const after = snapshot();
    if (after === start) {
      router.replace('/');
      return;
    }
    if (isMealPlanOrdersPathname(window.location.pathname)) {
      router.back();
      window.setTimeout(() => {
        const again = snapshot();
        if (again === start || isMealPlanOrdersPathname(window.location.pathname)) {
          router.replace('/');
        }
      }, 150);
    }
  }, 150);
}

// --- Shop: remember where to return when opening `/shop` from profile/orders (SPA same URL) ---

export const WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY = 'warmpawz_open_screen_after_nav';

/** After marketplace checkout: expand this shop order on profile My Orders (`order_history`). */
export const WARMPAWZ_EXPAND_SHOP_ORDER_ID_KEY = 'warmpawz_expand_shop_order_id';

/** After full-screen My Bookings (from account sidebar), reopen sheet on this tab. */
export const WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY = 'warmpawz_account_sidebar_active_view';

const ACCOUNT_SIDEBAR_RESTORABLE_VIEWS = new Set(['bookings', 'addresses', 'help']);

/** Persist sidebar sub-view before opening a full-screen account child (e.g. Help & Support). */
export function rememberAccountSidebarActiveView(view: string): void {
  if (typeof window === 'undefined' || !ACCOUNT_SIDEBAR_RESTORABLE_VIEWS.has(view)) return;
  try {
    sessionStorage.setItem(WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY, view);
  } catch {
    /* ignore */
  }
}

/** Read once on sidebar mount — returns null when nothing stored or invalid. */
export function consumeAccountSidebarActiveView(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY);
    if (!v || !ACCOUNT_SIDEBAR_RESTORABLE_VIEWS.has(v)) return null;
    sessionStorage.removeItem(WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY);
    return v;
  } catch {
    return null;
  }
}

/**
 * Valid `setCurrentScreen` targets when resuming `/` after leaving for `/shop`, `/promotions`, etc.
 * Keep in sync with `CustomerHomeWrapper` ScreenType usage.
 */
export const WARMPAWZ_HOME_RESUME_SCREENS = new Set<string>([
  'order_history',
  'my-bookings',
  'meal-plan-orders',
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
  'vet',
  'meal-order-checkout',
]);

const MEAL_ONE_TIME_PAY_BACK_INTENT_KEY = 'warmpawz_meal_one_time_pay_back_intent';

type MealOneTimePayBackIntent =
  | { kind: 'path'; path: string }
  | { kind: 'spa'; screen: 'meal-order-checkout' | 'meal-plan-orders' };

/** Resume a home-shell screen after leaving `/meal-plans/checkout-pay`. */
export function rememberMealOneTimePayBackToSpaScreen(
  screen: 'meal-order-checkout' | 'meal-plan-orders',
): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    MEAL_ONE_TIME_PAY_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'spa', screen } satisfies MealOneTimePayBackIntent),
  );
}

/** Call before `/meal-plans/checkout-pay` from shell Checkout – Meal Plan. */
export function rememberMealOneTimePayBackFromCheckout(): void {
  rememberMealOneTimePayBackToSpaScreen('meal-order-checkout');
}

/** Call before `/meal-plans/checkout-pay` from a full route (e.g. meal plan orders retry pay). */
export function rememberMealOneTimePayBackFromPath(path: string): void {
  if (typeof window === 'undefined') return;
  if (!isSafeInternalPath(path) || path.startsWith('/meal-plans/checkout-pay')) return;
  sessionStorage.setItem(
    MEAL_ONE_TIME_PAY_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'path', path } satisfies MealOneTimePayBackIntent),
  );
}

/** Payment page Back — return to Checkout – Meal Plan or the route that opened pay. Keeps pay draft intact. */
export function navigateBackFromMealOneTimePay(router: RouterWithPush): void {
  if (typeof window === 'undefined') {
    router.replace('/');
    return;
  }

  const raw = sessionStorage.getItem(MEAL_ONE_TIME_PAY_BACK_INTENT_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as MealOneTimePayBackIntent;
      sessionStorage.removeItem(MEAL_ONE_TIME_PAY_BACK_INTENT_KEY);
      if (parsed.kind === 'path' && isSafeInternalPath(parsed.path)) {
        router.replace(parsed.path);
        return;
      }
      if (parsed.kind === 'spa' && WARMPAWZ_HOME_RESUME_SCREENS.has(parsed.screen)) {
        sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, parsed.screen);
        router.replace('/');
        return;
      }
    } catch {
      sessionStorage.removeItem(MEAL_ONE_TIME_PAY_BACK_INTENT_KEY);
    }
  }

  goBackOrReplace(router, '/');
}

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

// --- Wallet hub children (`/rewards`, `/referrals`): return to `/wallet` when opened from wallet ---

const WALLET_CHILD_BACK_INTENT_KEY = 'warmpawz_wallet_child_back_intent';

type WalletChildBackIntent =
  | { kind: 'path'; path: string }
  | { kind: 'spa'; screen: string };

/** Call before navigating to `/rewards` or `/referrals` from a real route (e.g. `/wallet`). */
export function rememberWalletChildBackFromCurrentUrl(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  if (!isSafeInternalPath(path)) return;
  if (path === '/' || path === '') return;
  sessionStorage.setItem(
    WALLET_CHILD_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'path', path } satisfies WalletChildBackIntent)
  );
}

/** Call before opening rewards/referrals from the home shell at `/` (embedded wallet screen). */
export function rememberWalletChildBackSpaScreen(screen: string): void {
  if (typeof window === 'undefined') return;
  const safe = WARMPAWZ_HOME_RESUME_SCREENS.has(screen) ? screen : 'home';
  sessionStorage.setItem(
    WALLET_CHILD_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'spa', screen: safe } satisfies WalletChildBackIntent)
  );
}

export function handleWalletChildPageBack(router: RouterWithPush, fallbackPath = '/wallet'): void {
  if (typeof window === 'undefined') {
    router.replace(fallbackPath);
    return;
  }
  const raw = sessionStorage.getItem(WALLET_CHILD_BACK_INTENT_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as WalletChildBackIntent;
      sessionStorage.removeItem(WALLET_CHILD_BACK_INTENT_KEY);
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
      sessionStorage.removeItem(WALLET_CHILD_BACK_INTENT_KEY);
    }
  }
  goBackOrReplace(router, fallbackPath);
}

// --- Subscriptions (`/subscriptions`): return to meal-plan orders (route or shell) ---

const SUBSCRIPTIONS_BACK_INTENT_KEY = 'warmpawz_subscriptions_back_intent';

type SubscriptionsBackIntent =
  | { kind: 'path'; path: string }
  | { kind: 'spa'; screen: string };

/** Call before navigating to `/subscriptions` from a real route (e.g. `/orders/meal-plans`). */
export function rememberSubscriptionsBackFromCurrentUrl(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  if (!isSafeInternalPath(path) || path.startsWith('/subscriptions')) return;
  if (path === '/' || path === '') return;
  sessionStorage.setItem(
    SUBSCRIPTIONS_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'path', path } satisfies SubscriptionsBackIntent),
  );
}

/** Call before `router.push('/subscriptions')` from the home shell (e.g. `meal-plan-orders` on `/`). */
export function rememberSubscriptionsBackSpaScreen(screen: string): void {
  if (typeof window === 'undefined') return;
  const safe = WARMPAWZ_HOME_RESUME_SCREENS.has(screen) ? screen : 'meal-plan-orders';
  sessionStorage.setItem(
    SUBSCRIPTIONS_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'spa', screen: safe } satisfies SubscriptionsBackIntent),
  );
}

export function handleSubscriptionsPageBack(router: RouterWithPush): void {
  if (typeof window === 'undefined') {
    router.replace('/orders/meal-plans');
    return;
  }
  const raw = sessionStorage.getItem(SUBSCRIPTIONS_BACK_INTENT_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SubscriptionsBackIntent;
      sessionStorage.removeItem(SUBSCRIPTIONS_BACK_INTENT_KEY);
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
      sessionStorage.removeItem(SUBSCRIPTIONS_BACK_INTENT_KEY);
    }
  }
  router.push('/orders/meal-plans');
}

/** Standalone meal-plan orders list (same screen as shell `meal-plan-orders`). */
export function mealPlanOrdersPath(phone?: string): string {
  const normalized = String(phone || '').trim();
  return normalized
    ? `/orders/meal-plans?phone=${encodeURIComponent(normalized)}`
    : '/orders/meal-plans';
}

/** After one-time meal checkout payment succeeds — land on Meal Plan Orders. */
export function navigateAfterMealOrderPlaced(
  router: RouterWithPush & { replace?: (path: string) => void },
  phone?: string,
): void {
  const path = mealPlanOrdersPath(phone);
  if (typeof router.replace === 'function') {
    router.replace(path);
  } else {
    router.push(path);
  }
}

// --- My Packages: Back reopens account profile menu (overlay), not bare home feed ---

export const MY_PACKAGES_BACK_INTENT_KEY = 'warmpawz_my_packages_back_intent';

/** Set before `router.push('/')` when My Packages Back should reopen `UserAccountSidebar`. */
export const WARMPAWZ_OPEN_ACCOUNT_MENU_KEY = 'warmpawz_open_account_menu';

type MyPackagesBackIntent =
  | { kind: 'account-menu' }
  | { kind: 'path'; path: string };

function setOpenAccountMenuAfterNav(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(WARMPAWZ_OPEN_ACCOUNT_MENU_KEY, '1');
}

/** Call before `/my-packages` from account sidebar (home `/` or profile tab overlay). */
export function rememberMyPackagesBackFromAccountMenu(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    MY_PACKAGES_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'account-menu' } satisfies MyPackagesBackIntent)
  );
}

/** Call before `/my-packages` from another standalone route (e.g. `/wallet`, `/search`). */
export function rememberMyPackagesBackFromCurrentUrl(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  if (!isSafeInternalPath(path) || path.startsWith('/my-packages')) return;
  if (path === '/' || path === '') {
    rememberMyPackagesBackFromAccountMenu();
    return;
  }
  sessionStorage.setItem(
    MY_PACKAGES_BACK_INTENT_KEY,
    JSON.stringify({ kind: 'path', path } satisfies MyPackagesBackIntent)
  );
}

/** Pick account-menu vs path intent from current URL before navigating to My Packages. */
export function rememberBeforeMyPackagesNav(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  if (path === '/' || path === '') {
    rememberMyPackagesBackFromAccountMenu();
    return;
  }
  rememberMyPackagesBackFromCurrentUrl();
}

export function navigateToMyPackages(router: RouterWithPush): void {
  rememberBeforeMyPackagesNav();
  router.push('/my-packages');
}

/** Returns true once if My Packages Back requested reopening the account menu. */
export function consumeOpenAccountMenuAfterNav(): boolean {
  if (typeof window === 'undefined') return false;
  const v = sessionStorage.getItem(WARMPAWZ_OPEN_ACCOUNT_MENU_KEY);
  if (v === '1') {
    sessionStorage.removeItem(WARMPAWZ_OPEN_ACCOUNT_MENU_KEY);
    return true;
  }
  return false;
}

/** My Packages header Back: profile menu or prior route; X still uses `router.push('/')` separately. */
export function handleMyPackagesPageBack(router: RouterWithPush): void {
  if (typeof window === 'undefined') {
    setOpenAccountMenuAfterNav();
    router.replace('/');
    return;
  }
  const raw = sessionStorage.getItem(MY_PACKAGES_BACK_INTENT_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as MyPackagesBackIntent;
      sessionStorage.removeItem(MY_PACKAGES_BACK_INTENT_KEY);
      if (parsed.kind === 'path' && isSafeInternalPath(parsed.path)) {
        router.push(parsed.path);
        return;
      }
      if (parsed.kind === 'account-menu') {
        setOpenAccountMenuAfterNav();
        router.push('/');
        return;
      }
    } catch {
      sessionStorage.removeItem(MY_PACKAGES_BACK_INTENT_KEY);
    }
  }
  setOpenAccountMenuAfterNav();
  router.push('/');
}

/** Open profile My Orders (`order_history` on `/`) and optionally expand a shop order. */
export function navigateToProfileShopOrders(
  router: RouterWithPush,
  orderId?: string
): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, 'order_history');
    if (orderId) {
      sessionStorage.setItem(WARMPAWZ_EXPAND_SHOP_ORDER_ID_KEY, orderId);
    } else {
      sessionStorage.removeItem(WARMPAWZ_EXPAND_SHOP_ORDER_ID_KEY);
    }
  }
  router.push('/');
}

/** Resolve back fallback for `/auth/set-password` from `next` / `change` query params. */
export function getSetPasswordBackFallback(): string {
  if (typeof window === 'undefined') return '/';
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  if (params.get('change') === '1') return '/profile';
  return '/';
}

/** Set-password header / hardware back — prefer history, else `next` or profile/home. */
export function handleSetPasswordPageBack(router: MinimalRouter): void {
  goBackOrReplace(router, getSetPasswordBackFallback());
}
