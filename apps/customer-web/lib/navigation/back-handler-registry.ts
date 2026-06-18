export type BackHandler = () => boolean;

type RegisteredHandler = {
  handler: BackHandler;
  priority: number;
};

const handlers: RegisteredHandler[] = [];

/** Higher priority runs first. Return true when the back press is consumed. */
export function registerBackHandler(handler: BackHandler, priority = 0): () => void {
  const entry: RegisteredHandler = { handler, priority };
  handlers.push(entry);
  handlers.sort((a, b) => b.priority - a.priority);

  return () => {
    const idx = handlers.indexOf(entry);
    if (idx >= 0) handlers.splice(idx, 1);
  };
}

export function runBackHandlers(): boolean {
  for (const { handler } of handlers) {
    try {
      if (handler()) return true;
    } catch (err) {
      console.warn('[navigation] back handler error:', err);
    }
  }
  return false;
}

export function clearBackHandlers(): void {
  handlers.length = 0;
}

/** Registry priorities — higher runs first. */
export const BACK_HANDLER_PRIORITY = {
  /** Multi-step booking routers (datetime/pet steps) before shell stack pop. */
  shellWizardStep: 105,
  /** URL /checkout step back — same priority as wizard; runs before generic URL fallback. */
  checkoutUrl: 105,
  shellOverlay: 100,
  urlHistory: 50,
  minimizeApp: 10,
} as const;

/** Active marketplace checkout page only (not /checkout/success). */
export function isCheckoutFlowPath(pathname: string): boolean {
  const path = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return path === '/checkout';
}

/**
 * Register CheckoutProvider.goBack for Capacitor hardware back on /checkout.
 * CheckoutFlow must call this on mount; cleanup on unmount.
 */
export function registerCheckoutUrlBackHandler(goBack: () => void): () => void {
  return registerBackHandler(() => {
    if (typeof window === 'undefined') return false;
    if (!isCheckoutFlowPath(window.location.pathname)) return false;
    goBack();
    return true;
  }, BACK_HANDLER_PRIORITY.checkoutUrl);
}

/** Order success page only — not active checkout steps. */
export function isCheckoutSuccessPath(pathname: string): boolean {
  const path = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return path === '/checkout/success';
}

/**
 * Register success-page back (hardware / swipe). Must not return to /checkout or /cart.
 * EcommerceOrderSuccessScreen calls on mount.
 */
export function registerCheckoutSuccessBackHandler(onBack: () => void): () => void {
  return registerBackHandler(() => {
    if (typeof window === 'undefined') return false;
    if (!isCheckoutSuccessPath(window.location.pathname)) return false;
    onBack();
    return true;
  }, BACK_HANDLER_PRIORITY.checkoutUrl);
}
