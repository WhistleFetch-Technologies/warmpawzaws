import type { Context } from 'hono';
import * as customer_paymentmethods_getRepo from '../repos/customer_paymentmethods_get.repo';
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

export async function executecustomerPaymentmethodsGet(c: Context) {
    try {
      const phone = c.req.query('phone');

      if (!phone) {
        return c.json({ success: true, paymentMethods: [] });
      }

      const customerId = await resolveCustomerIdFromPhone(decodePhoneParam(phone));
      if (!customerId) {
        // Return empty payment methods for unregistered customers
        return c.json({ success: true, paymentMethods: [] });
      }

      let rows: any[] = [];
      try {
        const r = await customer_paymentmethods_getRepo.dbCustomerPaymentmethodsGet0(customerId)
        rows = (r.rows || []).filter((row: Record<string, unknown>) =>
          isPaymentMethodRowVisible(row)
        );
      } catch (dbError: any) {
        console.warn(
          '[PAYMENT-METHODS] Database query failed, returning empty array:',
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
      // Return empty array on error, not 500
      return c.json({ success: true, paymentMethods: [] });
    }
}