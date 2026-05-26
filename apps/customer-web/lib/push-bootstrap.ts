/**
 * push-bootstrap.ts — customer-web
 *
 * Handles push notification permission, FCM token acquisition, and
 * device registration / unregistration with the Warmpawz backend.
 *
 * Runtime path A (Native WebView): postMessage bridge to WarmpawzCustomer
 * Runtime path B (Standalone PWA):  Notification API + Firebase Web SDK
 *
 * Fully non-fatal — failures are warned to console but never thrown.
 */

// localStorage keys — unique per app to avoid cross-app collisions
const PUSH_DEVICE_ID_KEY   = 'warmpawz_cust_push_device_id';
const PUSH_TOKEN_CACHE_KEY = 'warmpawz_cust_push_token';

// Firebase onMessage attaches a persistent handler; one listener per page load avoids
// duplicate handlers when bootstrap runs again (e.g. React Strict Mode remounts).
let _foregroundListenerActive = false;

// Message types for the native bridge protocol.
// WarmpawzCustomer native app must implement the handler for REQUEST.
export const WARMPAWZ_PUSH_MSG = {
  REQUEST:  'WARMPAWZ_PUSH_TOKEN_REQUEST',
  RESPONSE: 'WARMPAWZ_PUSH_TOKEN_RESPONSE',
} as const;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** @deprecated Not used in Capacitor architecture. Kept for safety. */
function isNativeWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as any).ReactNativeWebView?.postMessage === 'function';
}

/**
 * Returns true when running inside the Capacitor native shell (Android / iOS).
 * window.Capacitor is injected by the Capacitor runtime before the page loads.
 */
function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Returns a stable UUID for this browser session, creating one if needed.
 * Stored in localStorage so it survives tab refreshes.
 * Used as deviceId so a single user can have multiple registered devices.
 */
function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(PUSH_DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PUSH_DEVICE_ID_KEY, id);
  }
  return id;
}

// ─── Path A: Native WebView bridge ───────────────────────────────────────────

/**
 * Sends WARMPAWZ_PUSH_TOKEN_REQUEST to the native shell and waits for a
 * WARMPAWZ_PUSH_TOKEN_RESPONSE message containing { token: string }.
 * Resolves null if the native app does not reply within timeoutMs.
 */
async function getTokenFromNativeBridge(timeoutMs = 5_000): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => { detach(); resolve(null); }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      let obj: any = event.data;
      if (typeof obj === 'string') {
        try { obj = JSON.parse(obj); } catch { return; }
      }
      if (!obj || obj.type !== WARMPAWZ_PUSH_MSG.RESPONSE) return;
      detach();
      resolve(typeof obj.token === 'string' ? obj.token : null);
    };

    const detach = () => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage as EventListener);
      document.removeEventListener('message', onMessage as EventListener);
    };

    // React Native WebView fires on document; standard browser fires on window.
    // Listen on both for maximum compatibility.
    window.addEventListener('message', onMessage as EventListener);
    document.addEventListener('message', onMessage as EventListener);

    (window as any).ReactNativeWebView.postMessage(
      JSON.stringify({ type: WARMPAWZ_PUSH_MSG.REQUEST })
    );
  });
}

/**
 * Standalone browser only: register Firebase onMessage once per page load so
 * foreground pushes show a system Notification while the tab is focused.
 */
async function setupForegroundPushListener(): Promise<void> {
  if (isNativeWebView() || _foregroundListenerActive) return;

  _foregroundListenerActive = true;
  try {
    const { getMessaging, onMessage } = await import('firebase/messaging');
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      console.log('[push-bootstrap] Foreground message received');

      try {
        if (Notification.permission === 'granted') {
          const title = payload.notification?.title ?? 'Warmpawz';
          const body = payload.notification?.body ?? '';
          new Notification(title, { body });
        }
      } catch (err) {
        console.warn(
          '[push-bootstrap] foreground notification display failed:',
          err
        );
      }
    });
  } catch (err) {
    console.warn('[push-bootstrap] foreground listener setup failed (non-fatal):', err);
    // Reset so a later bootstrap attempt can retry (e.g. Firebase chunk load failed).
    _foregroundListenerActive = false;
  }
}

// ─── Path B: Standalone browser via Firebase Web SDK ─────────────────────────

/**
 * Requests permission and obtains a native FCM token via the
 * @capacitor/push-notifications plugin. Returns null on any failure.
 * Dynamic import ensures this code path never loads in the browser context.
 */
async function getTokenFromCapacitor(): Promise<string | null> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('[push-bootstrap] Capacitor push permission denied');
      return null;
    }
    await PushNotifications.register();
    return await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        PushNotifications.removeAllListeners().catch(() => {});
        resolve(null);
      }, 10_000);
      PushNotifications.addListener('registration', (token) => {
        clearTimeout(timeout);
        PushNotifications.removeAllListeners().catch(() => {});
        resolve(token.value);
      }).catch(() => { clearTimeout(timeout); resolve(null); });
      PushNotifications.addListener('registrationError', (err) => {
        clearTimeout(timeout);
        console.warn('[push-bootstrap] Capacitor registration error:', err);
        PushNotifications.removeAllListeners().catch(() => {});
        resolve(null);
      }).catch(() => { clearTimeout(timeout); resolve(null); });
    });
  } catch (err) {
    console.warn('[push-bootstrap] Capacitor token acquisition failed (non-fatal):', err);
    return null;
  }
}

// ─── Path B (original): Standalone browser via Firebase Web SDK ──────────────

/**
 * Requests Notification permission and obtains a real FCM token.
 * Firebase SDK is dynamically imported — it only loads when this path executes,
 * keeping the main bundle size unaffected.
 *
 * Requires:
 *   - firebase npm package installed
 *   - /public/firebase-messaging-sw.js present
 *   - window.__WARMPAWZ_RUNTIME_CONFIG__ containing Firebase config keys
 *   - NEXT_PUBLIC_FIREBASE_VAPID_KEY env variable set
 */
async function getTokenFromBrowser(vapidKey: string): Promise<string | null> {
  if (!('Notification' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  if (!('serviceWorker' in navigator)) return null;

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');

    const cfg = (window as any).__WARMPAWZ_RUNTIME_CONFIG__ ?? {};

    if (!getApps().length) {
      initializeApp({
        apiKey:            cfg.firebaseApiKey,
        authDomain:        cfg.firebaseAuthDomain,
        projectId:         cfg.firebaseProjectId,
        storageBucket:     cfg.firebaseStorageBucket,
        messagingSenderId: cfg.firebaseMessagingSenderId,
        appId:             cfg.firebaseAppId,
      });
    }

    const messaging = getMessaging();
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Inject Firebase config into the service worker.
    // SW runs in its own scope and cannot access window.__WARMPAWZ_RUNTIME_CONFIG__,
    // so we send it via postMessage. navigator.serviceWorker.ready resolves
    // only when a SW is fully active — safe for first install and subsequent loads.
    try {
      const readyReg = await navigator.serviceWorker.ready;
      readyReg.active?.postMessage({
        type: 'FIREBASE_CONFIG',
        config: {
          apiKey:            cfg.firebaseApiKey            ?? '',
          authDomain:        cfg.firebaseAuthDomain        ?? '',
          projectId:         cfg.firebaseProjectId         ?? '',
          storageBucket:     cfg.firebaseStorageBucket     ?? '',
          messagingSenderId: cfg.firebaseMessagingSenderId ?? '',
          appId:             cfg.firebaseAppId             ?? '',
        },
      });
    } catch (swErr) {
      console.warn('[push-bootstrap] Could not send config to SW (non-fatal):', swErr);
    }

    return await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
  } catch (err) {
    console.warn('[push-bootstrap] Firebase token acquisition failed (non-fatal):', err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface PushBootstrapOptions {
  /** Customer UUID from backend database — NOT the phone number. */
  userId: string;
  userType: 'customer';
  /** Firebase VAPID public key. Required only for the standalone browser path. */
  vapidKey?: string;
  /** Pass the apiClient imported from @/lib/api-client. */
  apiClient: { post(url: string, body: unknown): Promise<unknown> };
}

/**
 * Call once after the authenticated session is ready and userId is known.
 * Idempotent — if the same FCM token is already registered (cached in
 * localStorage), the backend call is skipped entirely.
 */
export async function bootstrapPushNotifications(
  opts: PushBootstrapOptions
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const deviceId = getOrCreateDeviceId();
    let fcmToken: string | null = null;

    if (isCapacitor()) {
      fcmToken = await getTokenFromCapacitor();
    } else if (isNativeWebView()) {
      fcmToken = await getTokenFromNativeBridge();
    } else if (opts.vapidKey) {
      fcmToken = await getTokenFromBrowser(opts.vapidKey);
    }

    if (!fcmToken) return;

    // Skip re-registration if this exact token is already registered.
    const cached = localStorage.getItem(PUSH_TOKEN_CACHE_KEY);
    if (fcmToken === cached) {
      await setupForegroundPushListener();
      return;
    }

    await opts.apiClient.post('/push/register-device', {
      userId:   opts.userId,
      userType: opts.userType,
      fcmToken,
      deviceId,
      // In WebView the token was obtained on a physical native device.
      platform: isCapacitor()
        ? (((window as any).Capacitor?.getPlatform?.() as string) ?? 'android')
        : isNativeWebView()
          ? 'android'
          : 'web',
    });

    localStorage.setItem(PUSH_TOKEN_CACHE_KEY, fcmToken);
    console.log('[push-bootstrap] customer device registered for push');

    await setupForegroundPushListener();
  } catch (err) {
    console.warn('[push-bootstrap] registration failed (non-fatal):', err);
  }
}

export interface PushTeardownOptions {
  userId: string;
  userType: 'customer';
}

/**
 * Call on logout BEFORE clearing localStorage.
 * Uses keepalive:true so the HTTP request completes even during page navigation.
 */
export async function teardownPushNotifications(
  opts: PushTeardownOptions
): Promise<void> {
  if (typeof window === 'undefined') return;
  const deviceId = localStorage.getItem(PUSH_DEVICE_ID_KEY);
  localStorage.removeItem(PUSH_TOKEN_CACHE_KEY);
  const { getApiBaseUrl } = await import('./api-client');
  const apiBaseUrl = getApiBaseUrl().replace(/\/+$/, '');
  try {
    await fetch(`${apiBaseUrl}/push/unregister-device`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        userId:   opts.userId,
        userType: opts.userType,
        ...(deviceId ? { deviceId } : {}),
      }),
    });
    console.log('[push-bootstrap] customer device unregistered from push');
  } catch (err) {
    console.warn('[push-bootstrap] unregister failed (non-fatal):', err);
  }
}
