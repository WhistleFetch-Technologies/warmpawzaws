import { runBackHandlers } from './back-handler-registry';

const SHELL_STATE_KEY = 'warmpawzShell';

/** True when running in Capacitor iOS WebView. */
export function isCapacitorIosPlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } })
    .Capacitor;
  return !!cap?.isNativePlatform?.() && cap.getPlatform?.() === 'ios';
}

let popstateFromGesture = false;
let programmaticHistorySyncInProgress = false;
let installed = false;

/** Reset module state between unit tests. */
export function resetIosShellHistoryForTests(): void {
  popstateFromGesture = false;
  programmaticHistorySyncInProgress = false;
  installed = false;
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
  programmaticHistorySyncInProgress = true;
  try {
    for (let i = 0; i < steps; i++) {
      window.history.back();
    }
  } finally {
    queueMicrotask(() => {
      programmaticHistorySyncInProgress = false;
    });
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

  if (nextDepth === 1) {
    replaceIosShellHistoryState(currentScreen);
    return;
  }

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
    if (programmaticHistorySyncInProgress) {
      programmaticHistorySyncInProgress = false;
      return;
    }
    popstateFromGesture = true;
    runBackHandlers();
  };

  window.addEventListener('popstate', onPopState);

  return () => {
    window.removeEventListener('popstate', onPopState);
    installed = false;
    programmaticHistorySyncInProgress = false;
    popstateFromGesture = false;
  };
}
