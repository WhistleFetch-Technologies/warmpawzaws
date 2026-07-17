import type { Context } from 'hono';
import { resolveCustomerIdFromPhone, decodePhoneParam, isPaymentMethodRowVisible, mapPaymentMethodRowForCustomerWeb } from '../repos/module-helpers.repo';
import * as customer_payments_phone_getRepo from '../repos/customer_payments_phone_get.repo';
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

export async function executecustomerPaymentsPhoneGet(c: Context) {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(decodePhoneParam(phone));
      if (!customerId) {
        return c.json({ paymentMethods: [], success: true });
      }

      let rows: any[] = [];
      try {
        const r = await customer_payments_phone_getRepo.dbCustomerPaymentsPhoneGet0(customerId)
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