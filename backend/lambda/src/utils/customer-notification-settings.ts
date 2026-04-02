/**
 * Customer profile notification channel toggles (push, email, SMS, etc.)
 * Stored on customers.preferences.notificationSettings (JSONB).
 */

import { query } from '../database/rds-connection';

export const DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS = {
  push: true,
  email: false,
  sms: true,
  bookingUpdates: true,
  promotions: true,
  newServices: false,
  newsletter: false,
} as const;

export type CustomerNotificationSettings = typeof DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS;

export function normalizeCustomerNotificationSettings(raw: unknown): CustomerNotificationSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    push: Boolean(o.push ?? DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS.push),
    email: Boolean(o.email ?? DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS.email),
    sms: Boolean(o.sms ?? DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS.sms),
    bookingUpdates: Boolean(
      o.bookingUpdates ?? o.booking_updates ?? DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS.bookingUpdates
    ),
    promotions: Boolean(o.promotions ?? DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS.promotions),
    newServices: Boolean(
      o.newServices ?? o.new_services ?? DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS.newServices
    ),
    newsletter: Boolean(o.newsletter ?? DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS.newsletter),
  };
}

export async function fetchCustomerNotificationSettings(customerId: string): Promise<CustomerNotificationSettings> {
  try {
    const prefRow = await query(`SELECT preferences FROM customers WHERE id = $1 LIMIT 1`, [customerId]);
    const prefs = prefRow.rows[0]?.preferences as Record<string, unknown> | null | undefined;
    if (prefs && typeof prefs === 'object') {
      const stored = prefs.notificationSettings;
      if (stored !== undefined && stored !== null) {
        return normalizeCustomerNotificationSettings(stored);
      }
    }
  } catch (e) {
    console.warn('[notifications] Could not load notification settings:', e);
  }
  return { ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS };
}

export async function persistCustomerNotificationSettings(
  customerId: string,
  body: unknown
): Promise<CustomerNotificationSettings> {
  const merged = normalizeCustomerNotificationSettings({
    ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
    ...(typeof body === 'object' && body ? body : {}),
  });
  await query(
    `UPDATE customers SET preferences = jsonb_set(
      COALESCE(preferences, '{}'::jsonb),
      '{notificationSettings}',
      $2::jsonb,
      true
    ) WHERE id = $1`,
    [customerId, JSON.stringify(merged)]
  );
  return merged;
}
