import { WARMPAWZ_ANDROID_PUSH_CHANNEL_ID } from './push-channel';
import { navigateFromPushPayload } from './push-navigation';

/**
 * push-bootstrap.ts — vendor-web
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
const PUSH_DEVICE_ID_KEY   = 'warmpawz_vendor_push_device_id';
const PUSH_TOKEN_CACHE_KEY = 'warmpawz_vendor_push_token';
const PUSH_REGISTERED_AT_KEY = 'warmpawz_vendor_push_registered_at';
/** Last user UUID successfully upserted to device_tokens (detect account switch). */
const PUSH_REGISTERED_USER_KEY = 'warmpawz_vendor_push_registered_user_id';

/** Re-POST register-device periodically so token rotation and multi-device stay in sync. */
const PUSH_RESYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Dedupe concurrent session-start registrations (Capacitor + resume + CustomerApp). */
let registerInFlight: Promise<PushRegisterResult> | null = null;

/** Last POST /push/register-device fingerprint — avoid duplicate topic subscribe storms. */
let lastBackendRegisterKey = '';

/** Active session used when FCM fires registration after bootstrap timed out. */
let capacitorRegistrationContext: {
  userId: string;
  userType: 'vendor';
  apiClient: { post(url: string, body: unknown): Promise<unknown> };
} | null = null;

let capacitorRegistrationPipeline: Promise<void> | null = null;
let capacitorPushTapListenersAttached = false;

function extractPushDataFromAction(action: unknown): Record<string, string> {
  const envelope = action as {
    notification?: { data?: Record<string, unknown> };
  };
  const raw = envelope?.notification?.data ?? {};
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value != null) data[key] = String(value);
  }
  return data;
}

async function attachCapacitorPushTapListeners(PushNotifications: {
  addListener: (
    event: string,
    handler: (payload: unknown) => void
  ) => Promise<{ remove: () => void }>;
}): Promise<void> {
  if (capacitorPushTapListenersAttached) return;
  capacitorPushTapListenersAttached = true;

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[push-bootstrap] pushNotificationActionPerformed');
    try {
      navigateFromPushPayload(extractPushDataFromAction(action));
    } catch (err) {
      console.warn('[push-bootstrap] push tap navigation failed:', err);
      window.location.assign('/dashboard');
    }
  });

  if (isCapacitorIos()) {
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[push-bootstrap] pushNotificationReceived (iOS foreground)');
      void showIosForegroundPushToast(notification);
    });
  }

  console.log('[push-bootstrap] push tap listener attached');
}

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

function getCachedFcmToken(): string | null {
  const t = localStorage.getItem(PUSH_TOKEN_CACHE_KEY);
  if (!t || t.length < 10) return null;
  if (isCapacitorIos() && isLikelyApnsDeviceToken(t)) {
    localStorage.removeItem(PUSH_TOKEN_CACHE_KEY);
    console.warn('[push-bootstrap] cleared stale APNs hex token from cache (iOS needs FCM token)');
    return null;
  }
  return t;
}

function capacitorPlatform(): string {
  return ((window as any).Capacitor?.getPlatform?.() as string) ?? 'android';
}

function isCapacitorIos(): boolean {
  return isCapacitor() && capacitorPlatform() === 'ios';
}

/** Capacitor PushNotifications on iOS returns raw APNs hex — invalid for Firebase Admin multicast. */
function isLikelyApnsDeviceToken(token: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(token.trim());
}

function isLikelyFcmRegistrationToken(token: string): boolean {
  const t = token.trim();
  return t.length >= 20 && !isLikelyApnsDeviceToken(t);
}

function extractFirebaseNotificationData(event: unknown): Record<string, string> {
  const raw =
    (event as { notification?: { data?: Record<string, unknown> } })?.notification?.data ?? {};
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value != null) data[key] = String(value);
  }
  return data;
}

let firebaseIosPipelineAttached = false;

async function ensureFirebaseMessagingIosPipeline(): Promise<void> {
  if (firebaseIosPipelineAttached) return;
  firebaseIosPipelineAttached = true;

  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

  await FirebaseMessaging.addListener('tokenReceived', (event) => {
    const value = (event as { token?: string }).token?.trim() ?? '';
    if (!isLikelyFcmRegistrationToken(value)) {
      console.warn('[push-bootstrap] tokenReceived ignored (not FCM shape)', { len: value.length });
      return;
    }
    localStorage.setItem(PUSH_TOKEN_CACHE_KEY, value);
    console.log('[push-bootstrap] Firebase iOS FCM tokenReceived', {
      tokenPrefix: value.slice(0, 20) + '...',
      tokenLength: value.length,
    });
    const ctx = capacitorRegistrationContext;
    if (!ctx?.userId?.trim()) {
      console.warn('[push-bootstrap] FCM token before userId — cached for next bootstrap');
      return;
    }
    void postRegisterDeviceToBackend(ctx, value, 'registration-callback');
  });

  await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    console.log('[push-bootstrap] Firebase notificationActionPerformed');
    try {
      navigateFromPushPayload(extractFirebaseNotificationData(event));
    } catch (err) {
      console.warn('[push-bootstrap] Firebase tap navigation failed:', err);
      window.location.assign('/dashboard');
    }
  });

  await FirebaseMessaging.addListener('notificationReceived', (event) => {
    console.log('[push-bootstrap] Firebase notificationReceived (iOS foreground)');
    void showIosForegroundPushToast(
      (event as { notification?: unknown }).notification
    );
  });

  console.log('[push-bootstrap] Firebase Messaging iOS listeners attached');
}

async function resolveFirebaseIosPermission(
  options: CapacitorTokenOptions
): Promise<PushPermissionReceive> {
  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
  let status = await FirebaseMessaging.checkPermissions().catch(() => ({ receive: 'unknown' }));
  let receive = String(status.receive || 'unknown') as PushPermissionReceive;

  const shouldRequest =
    options.forceRequest ||
    receive === 'prompt' ||
    receive === 'prompt-with-rationale' ||
    (options.requestIfNeeded !== false && receive !== 'granted' && receive !== 'denied');

  if (shouldRequest && receive !== 'granted') {
    status = await FirebaseMessaging.requestPermissions();
    receive = String(status.receive || 'unknown') as PushPermissionReceive;
    console.log('[push-bootstrap] Firebase iOS permission after request:', receive);
  }

  return receive;
}

async function triggerFirebaseMessagingIosRegister(reason: string): Promise<void> {
  if (!isCapacitorIos()) return;
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const permission = await resolveFirebaseIosPermission({ requestIfNeeded: true });
    if (!permissionAllowsRegister(permission)) {
      console.warn('[push-bootstrap] Firebase iOS permission denied:', permission);
      return;
    }
    const { token } = await FirebaseMessaging.getToken();
    if (!token || !isLikelyFcmRegistrationToken(token)) {
      console.warn('[push-bootstrap] Firebase getToken invalid for FCM', {
        reason,
        len: token?.length ?? 0,
      });
      return;
    }
    localStorage.setItem(PUSH_TOKEN_CACHE_KEY, token);
    console.log('[push-bootstrap] Firebase getToken ok', {
      reason,
      tokenPrefix: token.slice(0, 20) + '...',
      tokenLength: token.length,
    });
    const ctx = capacitorRegistrationContext;
    if (ctx?.userId?.trim()) {
      await postRegisterDeviceToBackend(ctx, token, 'registration-callback');
    }
  } catch (err) {
    console.warn('[push-bootstrap] Firebase iOS register failed:', err);
  }
}

async function getTokenFromFirebaseMessagingIos(
  options: CapacitorTokenOptions = {}
): Promise<{ token: string | null; permission: PushPermissionReceive }> {
  try {
    const permission = await resolveFirebaseIosPermission(options);
    if (!permissionAllowsRegister(permission)) {
      return { token: null, permission };
    }

    // Always refresh from native Firebase — cached localStorage may be a dev APNs FCM token
    // after Xcode debug, while TestFlight uses production APNs (same bundle ID / WebView storage).
    const cached = getCachedFcmToken();
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const { token } = await FirebaseMessaging.getToken();
    if (!token || !isLikelyFcmRegistrationToken(token)) {
      console.warn('[push-bootstrap] Firebase getToken returned non-FCM token', {
        len: token?.length ?? 0,
      });
      return { token: null, permission };
    }
    if (cached && cached !== token) {
      console.log('[push-bootstrap] Firebase iOS FCM token changed (e.g. dev→prod APNs)', {
        cachedPrefix: cached.slice(0, 20) + '...',
        freshPrefix: token.slice(0, 20) + '...',
      });
    }
    localStorage.setItem(PUSH_TOKEN_CACHE_KEY, token);
    console.log('[push-bootstrap] Firebase iOS getToken', {
      tokenPrefix: token.slice(0, 20) + '...',
      tokenLength: token.length,
      unchangedFromCache: cached === token,
    });
    return { token, permission: permission === 'unknown' ? 'granted' : permission };
  } catch (err) {
    console.warn('[push-bootstrap] Firebase iOS token acquisition failed:', err);
    return { token: null, permission: 'unknown' };
  }
}

function extractPushNotificationContent(notification: unknown): { title: string; body: string } {
  const n = notification as {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  };
  const title = (n?.title || n?.data?.title || 'Warmpawz') as string;
  const body = (n?.body || n?.data?.body || '') as string;
  return { title: String(title), body: String(body) };
}

async function showIosForegroundPushToast(notification: unknown): Promise<void> {
  if (!isCapacitorIos()) return;
  const { title, body } = extractPushNotificationContent(notification);
  try {
    const { toast } = await import('sonner');
    toast(title, body ? { description: body } : undefined);
  } catch (err) {
    console.warn('[push-bootstrap] iOS foreground toast failed:', err);
  }
}

function clearLocalPushRegistrationMarkers(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PUSH_REGISTERED_AT_KEY);
  localStorage.removeItem(PUSH_REGISTERED_USER_KEY);
  lastBackendRegisterKey = '';
}

/**
 * Whether this device should run FCM + POST /push/register-device for userId.
 * False when the same user was synced recently (dedupe still applies on POST).
 */
export function needsPushRegistrationSync(userId: string): boolean {
  if (typeof window === 'undefined' || !userId?.trim()) return false;
  const registeredUser = localStorage.getItem(PUSH_REGISTERED_USER_KEY)?.trim();
  if (registeredUser !== userId.trim()) return true;
  if (!getCachedFcmToken()) return true;
  const at = localStorage.getItem(PUSH_REGISTERED_AT_KEY);
  if (!at) return true;
  const age = Date.now() - new Date(at).getTime();
  return !Number.isFinite(age) || age > PUSH_RESYNC_INTERVAL_MS;
}

function markPushRegisteredForUser(userId: string): void {
  localStorage.setItem(PUSH_REGISTERED_AT_KEY, new Date().toISOString());
  localStorage.setItem(PUSH_REGISTERED_USER_KEY, userId.trim());
}

async function postRegisterDeviceToBackend(
  opts: Pick<PushBootstrapOptions, 'userId' | 'userType' | 'apiClient'>,
  fcmToken: string,
  source: 'bootstrap' | 'registration-callback' | 'cached-token'
): Promise<boolean> {
  const deviceId = getOrCreateDeviceId();
  const dedupeKey = `${opts.userId}:${deviceId}:${fcmToken.slice(0, 32)}`;
  if (dedupeKey === lastBackendRegisterKey) {
    return true;
  }

  const { getApiBaseUrl } = await import('./api-client');
  const apiBaseUrl = getApiBaseUrl().replace(/\/+$/, '');
  const body = {
    userId: opts.userId,
    userType: opts.userType,
    fcmToken,
    deviceId,
    platform: capacitorPlatform(),
  };

  const res = await fetch(`${apiBaseUrl}/push/register-device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  });

  const text = await res.text().catch(() => '');
  let json: { success?: boolean; error?: string } = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (!res.ok || json.success === false) {
    console.warn('[push-bootstrap] POST /push/register-device failed', {
      source,
      status: res.status,
      error: json.error || text.slice(0, 200),
      apiBaseUrl,
    });
    return false;
  }

  lastBackendRegisterKey = dedupeKey;
  localStorage.setItem(PUSH_TOKEN_CACHE_KEY, fcmToken);
  markPushRegisteredForUser(opts.userId);
  console.log('[push-bootstrap] POST /push/register-device ok', {
    source,
    status: res.status,
    apiBaseUrl,
    deviceId: deviceId.slice(0, 8) + '...',
    userId: opts.userId.slice(0, 8) + '...',
    tokenLength: fcmToken.length,
    tokenLooksFcm: isLikelyFcmRegistrationToken(fcmToken),
  });
  return true;
}

/**
 * Persistent Capacitor `registration` listener — must exist before register() and
 * after bootstrap times out, so late FCM tokens still reach the backend.
 */
export async function ensureCapacitorPushRegistrationPipeline(
  opts: PushBootstrapOptions
): Promise<void> {
  if (!isCapacitor()) return;
  const prevUserId = capacitorRegistrationContext?.userId?.trim();
  const nextUserId = opts.userId?.trim();
  if (prevUserId && nextUserId && prevUserId !== nextUserId) {
    clearLocalPushRegistrationMarkers();
    console.log('[push-bootstrap] vendor account changed — re-registering push for new user');
  }
  capacitorRegistrationContext = {
    userId: opts.userId,
    userType: opts.userType,
    apiClient: opts.apiClient,
  };

  if (capacitorRegistrationPipeline) {
    await capacitorRegistrationPipeline.catch(() => undefined);
    if (prevUserId && nextUserId && prevUserId !== nextUserId) {
      await triggerCapacitorPushRegister('account-switch');
    }
    return;
  }

  capacitorRegistrationPipeline = (async () => {
    if (isCapacitorIos()) {
      await ensureFirebaseMessagingIosPipeline();
      await triggerFirebaseMessagingIosRegister('pipeline-init');
      return;
    }

    const mod = await importCapacitorPushModule();
    if (!mod?.PushNotifications) return;
    const { PushNotifications } = mod;

    await PushNotifications.addListener('registration', (token) => {
      const value = (token as { value?: string })?.value;
      if (!value) return;
      if (isLikelyApnsDeviceToken(value)) {
        console.warn('[push-bootstrap] ignoring APNs hex from PushNotifications (Android-only path)');
        return;
      }
      localStorage.setItem(PUSH_TOKEN_CACHE_KEY, value);
      console.log('[push-bootstrap] FCM registration event', {
        tokenPrefix: value.slice(0, 12) + '...',
      });

      const ctx = capacitorRegistrationContext;
      if (!ctx?.userId?.trim()) {
        console.warn(
          '[push-bootstrap] FCM token received before userId — cached; will register on next bootstrap'
        );
        return;
      }

      void postRegisterDeviceToBackend(ctx, value, 'registration-callback').then((ok) => {
        if (!ok) {
          console.warn('[push-bootstrap] register-device from callback did not persist — retry on next app open');
        }
      });
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('[push-bootstrap] Capacitor registrationError (persistent):', err);
    });

    await attachCapacitorPushTapListeners(PushNotifications);

    console.log('[push-bootstrap] persistent FCM registration listener attached');
    await ensureAndroidNotificationChannel();
    await triggerCapacitorPushRegister('pipeline-init');
  })();

  await capacitorRegistrationPipeline.catch(() => undefined);
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
  // Capacitor uses native FCM + OS tray; Firebase Web SDK is browser/PWA only.
  if (isCapacitor() || isNativeWebView() || _foregroundListenerActive) return;

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
/**
 * Loads @capacitor/push-notifications only in the native Capacitor shell.
 * webpackIgnore keeps Next.js from requiring this package during web dev/build.
 */
export type PushPermissionReceive =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'prompt-with-rationale'
  | 'unknown';

export interface CapacitorTokenOptions {
  /** If true, call requestPermissions when status is prompt (default true). */
  requestIfNeeded?: boolean;
  /** User tapped Enable — always try requestPermissions (won't re-prompt if already denied). */
  forceRequest?: boolean;
}

async function importCapacitorPushModule(): Promise<{
  PushNotifications: {
    checkPermissions: () => Promise<{ receive: string }>;
    requestPermissions: () => Promise<{ receive: string }>;
    register: () => Promise<void>;
    addListener: (
      event: string,
      handler: (payload: { value?: string } | unknown) => void
    ) => Promise<{ remove: () => void }>;
    removeAllListeners: () => Promise<void>;
  };
} | null> {
  /** Capacitor injects native plugins on window before the web bundle runs — prefer over dynamic import. */
  const bridged = (window as any).Capacitor?.Plugins?.PushNotifications;
  if (bridged?.register && bridged?.addListener) {
    return { PushNotifications: bridged };
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const mod = await import(/* webpackIgnore: true */ '@capacitor/push-notifications');
      if (mod?.PushNotifications) return mod;
    } catch (err) {
      console.warn('[push-bootstrap] push-notifications import attempt failed:', attempt + 1, err);
    }
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }

  const bridgedLate = (window as any).Capacitor?.Plugins?.PushNotifications;
  if (bridgedLate?.register && bridgedLate?.addListener) {
    return { PushNotifications: bridgedLate };
  }
  return null;
}

function permissionAllowsRegister(permission: PushPermissionReceive): boolean {
  return permission !== 'denied';
}

let capacitorNativeRegisterInFlight: Promise<void> | null = null;

/** Idempotent native register — safe to call from pipeline + bootstrap. */
async function ensureAndroidNotificationChannel(): Promise<void> {
  if (!isCapacitor() || capacitorPlatform() !== 'android') return;
  try {
    const mod = await importCapacitorPushModule();
    const createChannel = (mod?.PushNotifications as { createChannel?: (ch: unknown) => Promise<void> })
      ?.createChannel;
    if (!createChannel) return;
    await createChannel({
      id: WARMPAWZ_ANDROID_PUSH_CHANNEL_ID,
      name: 'Warmpawz alerts',
      description: 'Booking and campaign alerts with sound',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    console.log('[push-bootstrap] Android notification channel ready', {
      channelId: WARMPAWZ_ANDROID_PUSH_CHANNEL_ID,
    });
  } catch (err) {
    console.warn('[push-bootstrap] createChannel failed (non-fatal):', err);
  }
}

async function triggerCapacitorPushRegister(reason: string): Promise<void> {
  if (!isCapacitor()) return;
  if (isCapacitorIos()) {
    await triggerFirebaseMessagingIosRegister(reason);
    return;
  }
  if (capacitorNativeRegisterInFlight) {
    await capacitorNativeRegisterInFlight.catch(() => undefined);
    return;
  }

  capacitorNativeRegisterInFlight = (async () => {
    try {
      const mod = await importCapacitorPushModule();
      if (!mod?.PushNotifications) {
        console.warn('[push-bootstrap] cannot register — PushNotifications plugin unavailable');
        return;
      }
      await mod.PushNotifications.register();
      console.log('[push-bootstrap] PushNotifications.register() called', { reason });
    } catch (err) {
      console.warn('[push-bootstrap] PushNotifications.register() failed:', err);
    } finally {
      capacitorNativeRegisterInFlight = null;
    }
  })();

  await capacitorNativeRegisterInFlight.catch(() => undefined);
}

/** Read native notification permission (no prompt unless requestIfNeeded / forceRequest). */
export async function getCapacitorPushPermissionStatus(): Promise<PushPermissionReceive> {
  if (!isCapacitor()) return 'unknown';
  try {
    if (isCapacitorIos()) {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      const status = await FirebaseMessaging.checkPermissions();
      const receive = String(status.receive || 'unknown');
      if (
        receive === 'granted' ||
        receive === 'denied' ||
        receive === 'prompt' ||
        receive === 'prompt-with-rationale'
      ) {
        return receive;
      }
      return 'unknown';
    }
    const mod = await importCapacitorPushModule();
    if (!mod?.PushNotifications?.checkPermissions) return 'unknown';
    const status = await mod.PushNotifications.checkPermissions();
    const receive = String(status.receive || 'unknown');
    if (
      receive === 'granted' ||
      receive === 'denied' ||
      receive === 'prompt' ||
      receive === 'prompt-with-rationale'
    ) {
      return receive;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Open system app settings so the user can enable notifications after denying the prompt.
 */
export async function openAppNotificationSettings(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const platform = (window as any).Capacitor?.getPlatform?.() as string | undefined;
    if (platform === 'android') {
      const { App } = await import(/* webpackIgnore: true */ '@capacitor/app');
      const info = await App.getInfo();
      const pkg = info.id;
      await App.openUrl({
        url: `intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;package=${pkg};S:android.provider.extra.APP_PACKAGE=${pkg};end`,
      });
      return;
    }
    if (platform === 'ios') {
      const { App } = await import(/* webpackIgnore: true */ '@capacitor/app');
      await App.openUrl({ url: 'app-settings:' });
    }
  } catch (err) {
    console.warn('[push-bootstrap] openAppNotificationSettings failed:', err);
  }
}

async function resolveCapacitorPermission(
  PushNotifications: {
    checkPermissions: () => Promise<{ receive: string }>;
    requestPermissions: () => Promise<{ receive: string }>;
  },
  options: CapacitorTokenOptions
): Promise<PushPermissionReceive> {
  let status = await PushNotifications.checkPermissions().catch(() => ({ receive: 'unknown' }));
  let receive = String(status.receive || 'unknown') as PushPermissionReceive;

  const shouldRequest =
    options.forceRequest ||
    receive === 'prompt' ||
    receive === 'prompt-with-rationale' ||
    (options.requestIfNeeded !== false && receive !== 'granted' && receive !== 'denied');

  if (shouldRequest && receive !== 'granted') {
    status = await PushNotifications.requestPermissions();
    receive = String(status.receive || 'unknown') as PushPermissionReceive;
    console.log('[push-bootstrap] permission after request:', receive);
  }

  return receive;
}

async function getTokenFromCapacitor(
  options: CapacitorTokenOptions = {}
): Promise<{ token: string | null; permission: PushPermissionReceive }> {
  if (isCapacitorIos()) {
    return getTokenFromFirebaseMessagingIos(options);
  }
  try {
    const mod = await importCapacitorPushModule();
    if (!mod?.PushNotifications) return { token: null, permission: 'unknown' };
    const { PushNotifications } = mod;

    const permission = await resolveCapacitorPermission(PushNotifications, options);
    if (!permissionAllowsRegister(permission)) {
      console.warn('[push-bootstrap] Capacitor push permission denied:', permission);
      return { token: null, permission };
    }
    if (permission === 'unknown') {
      console.log(
        '[push-bootstrap] permission unknown — proceeding with register() (OS may already allow notifications)'
      );
    }

    const cached = getCachedFcmToken();
    if (cached) {
      console.log('[push-bootstrap] using cached FCM token from localStorage');
      return { token: cached, permission: permission === 'unknown' ? 'granted' : permission };
    }

    // Listeners MUST be attached before register() — token can fire immediately after register().
    const token = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        void cleanup().then(() => {
          console.warn(
            '[push-bootstrap] FCM registration wait ended (30s) — persistent listener will register when token arrives'
          );
          resolve(null);
        });
      }, 30_000);

      let regListener: { remove: () => Promise<void> } | undefined;
      let errListener: { remove: () => Promise<void> } | undefined;
      let settled = false;

      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        void cleanup().then(() => resolve(value));
      };

      const cleanup = async () => {
        clearTimeout(timeout);
        await regListener?.remove().catch(() => undefined);
        await errListener?.remove().catch(() => undefined);
      };

      void (async () => {
        try {
          regListener = await PushNotifications.addListener('registration', (t) => {
            const value = (t as { value?: string })?.value;
            if (value) localStorage.setItem(PUSH_TOKEN_CACHE_KEY, value);
            finish(value || null);
          });
          errListener = await PushNotifications.addListener('registrationError', (err) => {
            console.warn('[push-bootstrap] Capacitor registration error:', err);
            finish(null);
          });
          await triggerCapacitorPushRegister('bootstrap-wait');
        } catch (err) {
          console.warn('[push-bootstrap] Capacitor register() failed:', err);
          finish(null);
        }
      })();
    });

    return { token, permission };
  } catch (err) {
    console.warn('[push-bootstrap] Capacitor token acquisition failed (non-fatal):', err);
    return { token: null, permission: 'unknown' };
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

export type PushRegisterResult =
  | { ok: true; deviceId: string }
  | {
      ok: false;
      reason: 'permission_denied' | 'no_token' | 'not_native' | 'api_error';
      permission?: PushPermissionReceive;
    };

export interface PushBootstrapOptions {
  /** Customer UUID from backend database — NOT the phone number. */
  userId: string;
  userType: 'vendor';
  /** Firebase VAPID public key. Required only for the standalone browser path. */
  vapidKey?: string;
  /** Pass the apiClient imported from @/lib/api-client. */
  apiClient: { post(url: string, body: unknown): Promise<unknown> };
  /** Session start: only prompt when OS status is prompt (default true). */
  requestPermissionIfNeeded?: boolean;
  /** Settings / Enable button: try requestPermissions even if previously denied. */
  forcePermissionRequest?: boolean;
}

/**
 * Register device + FCM token with the API. Call at session start (login, app open, resume).
 * Always upserts to POST /push/register-device so device_tokens stays in sync with dev/prod API.
 */
export async function bootstrapPushNotifications(
  opts: PushBootstrapOptions
): Promise<PushRegisterResult> {
  if (typeof window === 'undefined') return { ok: false, reason: 'not_native' };
  if (!opts.userId?.trim()) return { ok: false, reason: 'not_native' };

  if (registerInFlight) {
    return registerInFlight.catch(() => ({ ok: false, reason: 'api_error' as const }));
  }

  registerInFlight = (async (): Promise<PushRegisterResult> => {
    try {
      const deviceId = getOrCreateDeviceId();
      const cachedToken = getCachedFcmToken();
      // iOS must always refresh FCM from native layer — WebView localStorage survives debug→TestFlight.
      if (cachedToken && !needsPushRegistrationSync(opts.userId) && !isCapacitorIos()) {
        return { ok: true, deviceId };
      }

      let fcmToken: string | null = null;
      let permission: PushPermissionReceive = 'unknown';

      if (isCapacitor()) {
        await ensureCapacitorPushRegistrationPipeline(opts);
        const cap = await getTokenFromCapacitor({
          requestIfNeeded: opts.requestPermissionIfNeeded !== false,
          forceRequest: opts.forcePermissionRequest === true,
        });
        fcmToken = cap.token;
        permission = cap.permission;
      } else if (isNativeWebView()) {
        fcmToken = await getTokenFromNativeBridge();
      } else if (opts.vapidKey) {
        fcmToken = await getTokenFromBrowser(opts.vapidKey);
      }

      if (!fcmToken) {
        // Token may arrive via persistent listener after register(); retry register once.
        await triggerCapacitorPushRegister('bootstrap-retry-no-token');
        console.warn(
          '[push-bootstrap] no FCM token yet — permission:',
          permission,
          'deviceId:',
          deviceId.slice(0, 8) + '...',
          '(persistent listener + register() active; token may POST shortly)'
        );
        return {
          ok: false,
          reason: permission === 'denied' ? 'permission_denied' : 'no_token',
          permission,
        };
      }

      const registered = await postRegisterDeviceToBackend(opts, fcmToken, 'bootstrap');
      if (!registered) {
        return { ok: false, reason: 'api_error', permission };
      }

      if (!isCapacitor() && !isNativeWebView()) {
        await setupForegroundPushListener();
      }
      return { ok: true, deviceId };
    } catch (err) {
      console.warn('[push-bootstrap] registration failed (non-fatal):', err);
      return { ok: false, reason: 'api_error' };
    } finally {
      registerInFlight = null;
    }
  })();

  return registerInFlight;
}

/** Re-run registration after vendor login — same pipeline as PushSessionRegistrar. */
export async function retryPushRegistration(opts: PushBootstrapOptions): Promise<void> {
  if (typeof window === 'undefined' || !opts.userId?.trim()) return;
  await ensureCapacitorPushRegistrationPipeline(opts);
  await bootstrapPushNotifications({ ...opts, requestPermissionIfNeeded: false });
}

/**
 * Re-register when Capacitor reports a new FCM token (token rotation).
 */
/** @deprecated Use ensureCapacitorPushRegistrationPipeline — kept for callers. */
export async function attachCapacitorPushTokenRefreshListener(
  opts: PushBootstrapOptions
): Promise<(() => void) | undefined> {
  await ensureCapacitorPushRegistrationPipeline(opts);
  return undefined;
}

export interface PushTeardownOptions {
  userId: string;
  userType: 'vendor';
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
  clearLocalPushRegistrationMarkers();
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
