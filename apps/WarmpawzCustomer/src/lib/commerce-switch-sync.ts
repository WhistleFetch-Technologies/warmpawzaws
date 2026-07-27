/**
 * Event-driven Commerce Switch sync for standalone React Native (WarmpawzCustomer).
 * Capacitor customer-web uses apps/customer-web/lib/commerce-switch-sync.ts instead.
 */
import { AppState, type AppStateStatus } from 'react-native';
import {
  COMMERCE_SWITCH_FALLBACK_POLL_MS,
  COMMERCE_SWITCH_SYNC,
  DEFAULT_COMMERCE_MODEL_ID,
  type CommerceModelId,
  type CommerceSwitchSyncPayload,
} from '@warmpawz/commerce-switch-contracts';
import {
  getCommerceSwitchConfigurationVersion,
  refreshCommerceSwitchConfiguration,
} from './commerce-switch-client';

export type CommerceSwitchSyncSource = 'fcm' | 'foreground' | 'fallback';

const TRIGGER_DEDUPE_MS = 400;
let lastTriggerAt = 0;
let lastHintVersion = 0;
let syncInflight: Promise<void> | null = null;
let listenersAttached = false;

export function parseCommerceSwitchSyncData(
  data: Record<string, string>
): CommerceSwitchSyncPayload | null {
  if (data.type !== COMMERCE_SWITCH_SYNC.DATA_TYPE) return null;
  const configurationVersion = Number(data.configurationVersion);
  if (!Number.isFinite(configurationVersion) || configurationVersion < 1) return null;
  const activeModelId = data.activeModelId as CommerceModelId;
  return {
    type: COMMERCE_SWITCH_SYNC.DATA_TYPE,
    configurationVersion,
    activeModelId:
      activeModelId === 'warmpawz_pay' || activeModelId === 'marketplace'
        ? activeModelId
        : DEFAULT_COMMERCE_MODEL_ID,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

export function handleCommerceSwitchPushData(data: Record<string, string>): void {
  const payload = parseCommerceSwitchSyncData(data);
  if (payload) requestCommerceSwitchSync(payload, 'fcm');
}

export function requestCommerceSwitchSync(
  hint: Partial<CommerceSwitchSyncPayload> | null,
  _source: CommerceSwitchSyncSource
): void {
  const hintVersion = hint?.configurationVersion ?? 0;
  if (hintVersion > 0 && hintVersion <= getCommerceSwitchConfigurationVersion()) return;

  const now = Date.now();
  if (
    hintVersion > 0 &&
    hintVersion === lastHintVersion &&
    now - lastTriggerAt < TRIGGER_DEDUPE_MS
  ) {
    return;
  }
  lastTriggerAt = now;
  if (hintVersion > lastHintVersion) lastHintVersion = hintVersion;

  if (syncInflight) return;
  syncInflight = refreshCommerceSwitchConfiguration()
    .then((config) => {
      lastHintVersion = Math.max(lastHintVersion, config.version);
    })
    .catch(() => undefined)
    .finally(() => {
      syncInflight = null;
    });
}

export function ensureCommerceSwitchSyncListeners(): () => void {
  if (listenersAttached) return () => undefined;
  listenersAttached = true;

  const onAppState = (state: AppStateStatus) => {
    if (state === 'active') requestCommerceSwitchSync(null, 'foreground');
  };
  const subscription = AppState.addEventListener('change', onAppState);
  const fallbackTimer = setInterval(() => {
    requestCommerceSwitchSync(null, 'fallback');
  }, COMMERCE_SWITCH_FALLBACK_POLL_MS);

  return () => {
    listenersAttached = false;
    subscription.remove();
    clearInterval(fallbackTimer);
  };
}
