import type { CommerceModelId } from './index';

/** FCM topic — all customer devices subscribe at POST /push/register-device. */
export const COMMERCE_SWITCH_FCM_TOPIC = 'all_customers' as const;

/** Dedicated topic for future isolation (subscribed alongside all_customers). */
export const COMMERCE_SWITCH_DEDICATED_FCM_TOPIC = 'commerce_switch_config' as const;

/** Data-only FCM payload `type` and BroadcastChannel event discriminator. */
export const COMMERCE_SWITCH_SYNC_EVENT_TYPE = 'commerce_switch_updated' as const;

/** Same-origin BroadcastChannel for admin → customer web tabs (local dev / same browser). */
export const COMMERCE_SWITCH_BROADCAST_CHANNEL = 'warmpawz-commerce-switch' as const;

/** Service worker → page postMessage type (PWA background sync). */
export const COMMERCE_SWITCH_SW_MESSAGE_TYPE = 'COMMERCE_SWITCH_SYNC' as const;

export const COMMERCE_SWITCH_SYNC = {
  FCM_TOPIC: COMMERCE_SWITCH_FCM_TOPIC,
  DEDICATED_FCM_TOPIC: COMMERCE_SWITCH_DEDICATED_FCM_TOPIC,
  DATA_TYPE: COMMERCE_SWITCH_SYNC_EVENT_TYPE,
  BROADCAST_CHANNEL: COMMERCE_SWITCH_BROADCAST_CHANNEL,
  SW_MESSAGE_TYPE: COMMERCE_SWITCH_SW_MESSAGE_TYPE,
} as const;

export type CommerceSwitchSyncPayload = {
  type: typeof COMMERCE_SWITCH_SYNC_EVENT_TYPE;
  configurationVersion: number;
  activeModelId: CommerceModelId;
  updatedAt: string;
};

/** Fallback poll when push / foreground signals are unavailable. */
export const COMMERCE_SWITCH_FALLBACK_POLL_MS = 25_000 as const;
