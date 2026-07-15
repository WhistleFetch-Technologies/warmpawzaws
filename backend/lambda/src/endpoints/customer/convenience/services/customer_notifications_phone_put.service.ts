import type { Context } from 'hono';
import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { reconcileBookingPayments } from '../../../../utils/payments/payment-reconciliation';
import { resolveBookingPaymentSourcesBatch } from '../../../../utils/payments/booking-payment-sources';
import {
  DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
  fetchCustomerNotificationSettings,
  normalizeCustomerNotificationSettings,
  persistCustomerNotificationSettings,
} from '../../../../utils/customer-notification-settings';
import { presignProductImagesJsonb } from '../../../../utils/s3-media-presign';
import { bookingUsesDedicatedEndSessionOtp } from '../../../../lib/booking-dedicated-end-otp';
import {
  packageFieldsFromBookingRow,
  SQL_PACKAGE_PURCHASE_JOIN,
  SQL_PACKAGE_PURCHASE_SELECT,
} from '../../../../utils/customer-booking-package-fields';
import { expirePaymentHolds } from '../../../../utils/payment-hold';
import {
  seedFinitePackagesMissingSessionsForScope,
  type SqlClient,
} from '../../../../utils/package-session-sync';
import {
  sqlPackagePurchaseActiveForListing,
  sqlPackagePurchaseComputedStatus,
} from '../../../../utils/package-session-eligibility';

export async function executecustomerNotificationsPhonePut(c: Context) {
    try {
      const { phone } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      const customerId = await resolveCustomerIdFromPhone(phone);

      if (!customerId) {
        const merged = normalizeCustomerNotificationSettings({
          ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
          ...(typeof body === 'object' && body ? body : {}),
        });
        return c.json({ success: true, settings: merged, persisted: false });
      }

      try {
        const merged = await persistCustomerNotificationSettings(customerId, body);
        return c.json({ success: true, settings: merged, persisted: true });
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('column "preferences"')) {
          const merged = normalizeCustomerNotificationSettings({
            ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
            ...(typeof body === 'object' && body ? body : {}),
          });
          return c.json({ success: true, settings: merged, persisted: false });
        }
        throw err;
      }
    } catch (error: any) {
      console.error('[notifications] Error saving notification settings:', error);
      return c.json({ error: error?.message || 'Failed to save notification settings' }, 500);
    }
}
