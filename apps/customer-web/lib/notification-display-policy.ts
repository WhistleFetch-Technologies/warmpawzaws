/**
 * Avoid duplicate UX when a notification is sent on both push (tray) and in-app (poll).
 * On Capacitor native, tray push already surfaces the message — skip poll toast/sound.
 */

function parseChannels(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return null;
}

export function isNativeCapacitorShell(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.();
}

export function notificationUsesPushChannel(notification: {
  channels?: unknown;
  notification_type?: string;
}): boolean {
  const channels = parseChannels(notification?.channels);
  if (channels?.push === true) return true;
  return notification?.notification_type === 'campaign';
}

/** True when poll should not show toast/sound (native tray handles it). */
export function shouldSuppressPollToastForPush(notification: {
  channels?: unknown;
  notification_type?: string;
}): boolean {
  return isNativeCapacitorShell() && notificationUsesPushChannel(notification);
}
