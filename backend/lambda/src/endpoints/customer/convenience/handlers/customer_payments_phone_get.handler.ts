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

export async function customerPaymentsPhoneGetHandler(c: Context) {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(decodePhoneParam(phone));
      if (!customerId) {
        return c.json({ paymentMethods: [], success: true });
      }

      let rows: any[] = [];
      try {
        const r = await query(
          `SELECT * FROM customer_payment_methods
           WHERE customer_id = $1
           ORDER BY is_default DESC NULLS LAST, created_at DESC NULLS LAST`,
          [customerId]
        );
        rows = (r.rows || []).filter((row: Record<string, unknown>) =>
          isPaymentMethodRowVisible(row)
        );
      } catch (dbError: any) {
        console.warn(
          '[PAYMENTS/:phone] Database query failed, returning empty array:',
          dbError?.message
        );
      }

      return c.json({
        success: true,
        paymentMethods: rows.map((row) =>
          mapPaymentMethodRowForCustomerWeb(row as Record<string, unknown>)
        ),
      });
    } catch (error: any) {
      console.error('Error getting payment methods:', error);
      return c.json({ success: true, paymentMethods: [] });
    }
}
