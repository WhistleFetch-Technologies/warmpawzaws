import { BACK_HANDLER_PRIORITY, registerBackHandler, runBackHandlers } from './back-handler-registry';

export function isCapacitorNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    ?.isNativePlatform?.();
}

let teardown: (() => void) | null = null;

/**
 * Android/iOS hardware back — delegates to registered handlers (shell → URL → minimize).
 * No-op in browser dev; browser Back key still uses history natively.
 */
export async function initCapacitorHardwareBack(): Promise<() => void> {
  if (typeof window === 'undefined' || !isCapacitorNativePlatform()) {
    return () => {};
  }

  if (teardown) return teardown;

  const removeMinimize = registerBackHandler(() => {
    const path = window.location.pathname || '/';
    if (path !== '/' && path !== '') return false;
    void import(/* webpackIgnore: true */ '@capacitor/app').then(({ App }) => {
      void App.minimizeApp();
    });
    return true;
  }, BACK_HANDLER_PRIORITY.minimizeApp);

  let listenerHandle: { remove: () => Promise<void> } | null = null;

  try {
    const { App } = await import(/* webpackIgnore: true */ '@capacitor/app');
    listenerHandle = await App.addListener('backButton', () => {
      runBackHandlers();
    });
  } catch (err) {
    console.warn('[navigation] Capacitor hardware back unavailable:', err);
  }

  teardown = () => {
    removeMinimize();
    void listenerHandle?.remove();
    listenerHandle = null;
    teardown = null;
  };

  return teardown;
}
