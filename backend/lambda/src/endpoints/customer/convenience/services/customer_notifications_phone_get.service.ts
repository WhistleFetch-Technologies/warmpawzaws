import type { Context } from 'hono';
import * as customer_notifications_phone_getRepo from '../repos/customer_notifications_phone_get.repo';
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

export async function executecustomerNotificationsPhoneGet(c: Context) {
    const { phone } = c.req.param();
    const limit = parseInt(c.req.query('limit') || '50', 10);

    const customerId = await resolveCustomerIdFromPhone(phone);
    if (!customerId) {
      return c.json({
        success: true,
        notifications: [],
        unreadCount: 0,
        settings: { ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS },
      });
    }

    const settings = await fetchCustomerNotificationSettings(customerId);

    try {
      const notifications = await customer_notifications_phone_getRepo.dbCustomerNotificationsPhoneGet0(customerId, limit)

      const unreadCount = await customer_notifications_phone_getRepo.dbCustomerNotificationsPhoneGet1(customerId)

      return c.json({
        success: true,
        notifications: notifications.rows,
        unreadCount: parseInt(unreadCount.rows[0]?.count || '0', 10),
        settings,
      });
    } catch (error: any) {
      console.error('[notifications] Error fetching notifications by phone:', error);
      console.error('[notifications] Error stack:', error?.stack);

      const errorMessage = error?.message || 'Unknown error';

      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        console.log('[notifications] Table does not exist, returning empty notifications');
        return c.json({
          success: true,
          notifications: [],
          unreadCount: 0,
          settings,
        });
      }

      if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
        return c.json({
          success: true,
          notifications: [],
          unreadCount: 0,
          settings,
        });
      }

      return c.json({
        success: true,
        notifications: [],
        unreadCount: 0,
        settings,
        _error: 'Unable to fetch notifications',
      });
    }
}