'use client';

/**
 * Event-driven Commerce Switch synchronization coordinator.
 *
 * Primary: silent FCM data push (Capacitor / PWA service worker → page message).
 * Secondary: same-browser BroadcastChannel (admin save → customer tab).
 * Tertiary: app/tab foreground (visibility / focus).
 * Fallback: long-interval version poll (owned by CommerceConfigProvider).
 */
import {
  COMMERCE_SWITCH_FALLBACK_POLL_MS,
  COMMERCE_SWITCH_SYNC,
  DEFAULT_COMMERCE_MODEL_ID,
  type CommerceModelId,
  type CommerceSwitchSyncPayload,
} from '@warmpawz/commerce-switch-contracts';
import {
  getCommerceSwitchConfigurationVersion,
  syncCommerceSwitchConfiguration,
} from '@/lib/commerce-switch-client';

export type CommerceSwitchSyncSource = 'fcm' | 'broadcast' | 'foreground' | 'fallback' | 'sw';

export { COMMERCE_SWITCH_FALLBACK_POLL_MS };

const TRIGGER_DEDUPE_MS = 400;

let lastTriggerAt = 0;
let lastHintVersion = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncListenersAttached = false;

type SyncListener = (source: CommerceSwitchSyncSource) => void;
const syncListeners = new Set<SyncListener>();

export function subscribeCommerceSwitchSyncEvents(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

function notifySyncCompleted(source: CommerceSwitchSyncSource): void {
  for (const listener of syncListeners) {
    try {
      listener(source);
    } catch (err) {
      console.warn('[CommerceSwitchSync] listener error', err);
    }
  }
}

export function parseCommerceSwitchSyncData(
  data: Record<string, string>
): CommerceSwitchSyncPayload | null {
  if (data.type !== COMMERCE_SWITCH_SYNC.DATA_TYPE) return null;

  const configurationVersion = Number(data.configurationVersion);
  if (!Number.isFinite(configurationVersion) || configurationVersion < 1) return null;

  const activeModelId = data.activeModelId as CommerceModelId;
  const normalizedModelId =
    activeModelId === 'warmpawz_pay' || activeModelId === 'marketplace'
      ? activeModelId
      : DEFAULT_COMMERCE_MODEL_ID;

  return {
    type: COMMERCE_SWITCH_SYNC.DATA_TYPE,
    configurationVersion,
    activeModelId: normalizedModelId,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

export function handleCommerceSwitchPushData(data: Record<string, string>): void {
  const payload = parseCommerceSwitchSyncData(data);
  if (!payload) return;
  requestCommerceSwitchSync(payload, 'fcm');
}

/**
 * Broadcast saved configuration to other same-origin tabs (e.g. admin → customer in dev).
 */
export function postCommerceSwitchBroadcast(payload: CommerceSwitchSyncPayload): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(COMMERCE_SWITCH_SYNC.BROADCAST_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch (err) {
    console.warn('[CommerceSwitchSync] broadcast post failed', err);
  }
}

export function requestCommerceSwitchSync(
  hint: Partial<CommerceSwitchSyncPayload> | null,
  source: CommerceSwitchSyncSource
): void {
  const hintVersion = hint?.configurationVersion ?? 0;
  const localVersion = getCommerceSwitchConfigurationVersion();

  if (hintVersion > 0 && hintVersion <= localVersion) {
    return;
  }

  const now = Date.now();
  if (
    hintVersion > 0 &&
    hintVersion === lastHintVersion &&
    now - lastTriggerAt < TRIGGER_DEDUPE_MS
  ) {
    return;
  }

  lastTriggerAt = now;
  if (hintVersion > lastHintVersion) {
    lastHintVersion = hintVersion;
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runCommerceSwitchSync(hintVersion, source);
  }, 0);
}

async function runCommerceSwitchSync(
  hintVersion: number,
  source: CommerceSwitchSyncSource
): Promise<void> {
  try {
    const config = await syncCommerceSwitchConfiguration({
      expectedMinVersion: hintVersion > 0 ? hintVersion : undefined,
      force: true,
    });
    if (config.version >= hintVersion) {
      lastHintVersion = Math.max(lastHintVersion, config.version);
    }
    notifySyncCompleted(source);
  } catch (err) {
    console.warn('[CommerceSwitchSync] sync failed', err);
  }
}

/**
 * Attach push / broadcast / service-worker listeners once per app session.
 */
export function ensureCommerceSwitchSyncListeners(): () => void {
  if (syncListenersAttached || typeof window === 'undefined') {
    return () => undefined;
  }
  syncListenersAttached = true;

  const cleanups: Array<() => void> = [];

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(COMMERCE_SWITCH_SYNC.BROADCAST_CHANNEL);
    channel.onmessage = (event: MessageEvent<CommerceSwitchSyncPayload>) => {
      if (event.data?.type === COMMERCE_SWITCH_SYNC.DATA_TYPE) {
        requestCommerceSwitchSync(event.data, 'broadcast');
      }
    };
    cleanups.push(() => channel.close());
  }

  if ('serviceWorker' in navigator) {
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === COMMERCE_SWITCH_SYNC.SW_MESSAGE_TYPE) {
        const data = event.data?.data as Record<string, string> | undefined;
        if (data) {
          handleCommerceSwitchPushData(data);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    cleanups.push(() => navigator.serviceWorker.removeEventListener('message', onSwMessage));
  }

  const onForeground = () => {
    requestCommerceSwitchSync(null, 'foreground');
  };
  window.addEventListener('focus', onForeground);
  cleanups.push(() => window.removeEventListener('focus', onForeground));

  return () => {
    syncListenersAttached = false;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    for (const cleanup of cleanups) cleanup();
  };
}
