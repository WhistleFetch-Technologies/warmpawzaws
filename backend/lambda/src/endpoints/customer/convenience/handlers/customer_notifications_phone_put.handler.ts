import type { Context } from 'hono';
/**
 * ============================================================================
 * CUSTOMER PHONE-BASED CONVENIENCE ENDPOINTS
 * ============================================================================
 * 
 * Provides convenience endpoints that accept phone numbers instead of customer IDs
 * These endpoints resolve phone to customer ID internally and forward to main endpoints
 * 
 * Endpoints:
 * - GET /customer/bookings?phone=... - Get bookings by phone
 * - GET /customer/cart/:phone - Get cart by phone
 * - PUT /customer/cart/:phone/items/:itemId - Update cart item by phone
 * - DELETE /customer/cart/:phone/items/:itemId - Remove cart item by phone
 * - GET /customer/saved/:phone - Get saved items by phone
 * - DELETE /customer/saved/:phone/items/:itemId - Remove saved item by phone
 * - GET /customer/wallet?phone=... - Get wallet by phone
 * - GET /customer/wallet/transactions?phone=... - Get wallet transactions by phone
 * - GET /customer/notifications/:phone - Inbox + notification channel settings (preferences.notificationSettings)
 * - PUT /customer/notifications/:phone - Save notification channel settings
 * - POST /customer/payments/:phone - Create payment by phone
 * 
 * Date: 2026-01-12
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { select, query, insert } from '../../../../database/rds-connection';
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

export async function customerNotificationsPhonePutHandler(c: Context) {
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
