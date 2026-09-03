import { runBackHandlers } from './back-handler-registry';

const SHELL_STATE_KEY = 'warmpawzShell';
const IOS_URL_RETURN_TO_SHELL_KEY = 'warmpawz_ios_url_return_to_shell';

/** Set when leaving `/` for a URL child (orders/pets/wishlist/password) so swipe-back does not pop the shell. */
export function markIosUrlReturnToShellPending(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(IOS_URL_RETURN_TO_SHELL_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearIosUrlReturnToShellPending(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(IOS_URL_RETURN_TO_SHELL_KEY);
  } catch {
    /* ignore */
  }
}

export function consumeIosUrlReturnToShellPending(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const pending = sessionStorage.getItem(IOS_URL_RETURN_TO_SHELL_KEY) === '1';
    if (pending) sessionStorage.removeItem(IOS_URL_RETURN_TO_SHELL_KEY);
    return pending;
  } catch {
    return false;
  }
}

/** True when running in Capacitor iOS WebView. */
export function isCapacitorIosPlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } })
    .Capacitor;
  return !!cap?.isNativePlatform?.() && cap.getPlatform?.() === 'ios';
}

let popstateFromGesture = false;
/** Remaining popstate events to suppress after programmatic history.back sync. */
let programmaticPopstatesToSuppress = 0;
let installed = false;

/** Reset module state between unit tests. */
export function resetIosShellHistoryForTests(): void {
  popstateFromGesture = false;
  programmaticPopstatesToSuppress = 0;
  installed = false;
  clearIosUrlReturnToShellPending();
}

function replaceIosShellHistoryState(screen: string): void {
  window.history.replaceState({ [SHELL_STATE_KEY]: screen }, '', '/');
}

/** Push a history entry so iOS edge-swipe maps to shell back on `/`. */
export function pushIosShellHistoryEntry(screen: string): void {
  if (!isCapacitorIosPlatform()) return;
  const path = window.location.pathname || '/';
  if (path !== '/' && path !== '') return;
  window.history.pushState({ [SHELL_STATE_KEY]: screen }, '', '/');
}

/** After replaceTop / overlay swap — same depth, new screen on `/`. */
export function syncIosShellScreenReplace(currentScreen: string): void {
  if (!isCapacitorIosPlatform()) return;
  const path = window.location.pathname || '/';
  if (path !== '/' && path !== '') return;
  replaceIosShellHistoryState(currentScreen);
}

/**
 * After programmatic shell pop (in-app Back), sync WebView history on iOS.
 * Skip when the pop was already driven by a swipe (`popstate`).
 */
export function syncIosHistoryAfterShellPop(steps = 1): void {
  if (!isCapacitorIosPlatform() || steps <= 0) return;
  if (popstateFromGesture) {
    popstateFromGesture = false;
    return;
  }
  programmaticPopstatesToSuppress += steps;
  for (let i = 0; i < steps; i++) {
    window.history.back();
  }
}

/** Keep WKWebView history depth aligned with shell stack on `/` (iOS swipe-back). */
export function syncIosShellStackDepth(
  prevDepth: number,
  nextDepth: number,
  currentScreen: string,
): void {
  if (!isCapacitorIosPlatform()) return;
  const path = window.location.pathname || '/';
  if (path !== '/' && path !== '') return;

  if (nextDepth > prevDepth) {
    for (let i = 0; i < nextDepth - prevDepth; i++) {
      pushIosShellHistoryEntry(currentScreen);
    }
    return;
  }

  if (nextDepth >= prevDepth) return;

  if (consumeIosPopstateGestureFlag()) return;

  syncIosHistoryAfterShellPop(prevDepth - nextDepth);
}

/** Mark next depth decrease as user swipe (do not call history.back in sync). */
export function consumeIosPopstateGestureFlag(): boolean {
  if (!popstateFromGesture) return false;
  popstateFromGesture = false;
  return true;
}

/**
 * iOS has no hardware back — WKWebView swipe triggers `popstate`.
 * Delegate to the same handler chain as Android hardware back.
 */
export function initIosShellHistoryBridge(): () => void {
  if (typeof window === 'undefined' || !isCapacitorIosPlatform() || installed) {
    return () => {};
  }
  installed = true;

  if (!window.history.state?.[SHELL_STATE_KEY]) {
    replaceIosShellHistoryState('home');
  }

  const onPopState = () => {
    const path = window.location.pathname || '/';
    if (path !== '/' && path !== '') return;
    if (programmaticPopstatesToSuppress > 0) {
      programmaticPopstatesToSuppress -= 1;
      return;
    }
    // Swipe from /pets|/wishlist|/orders|/auth/... already restored this `/` entry.
    // Do not run shell back — that would pop profile → home.
    if (consumeIosUrlReturnToShellPending()) {
      return;
    }
    popstateFromGesture = true;
    runBackHandlers();
  };

  window.addEventListener('popstate', onPopState);

  return () => {
    window.removeEventListener('popstate', onPopState);
    installed = false;
    programmaticPopstatesToSuppress = 0;
    popstateFromGesture = false;
  };
}
