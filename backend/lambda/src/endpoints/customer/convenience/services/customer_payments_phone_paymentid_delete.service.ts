import type { Context } from 'hono';
import * as customer_payments_phone_paymentid_deleteRepo from '../repos/customer_payments_phone_paymentid_delete.repo';
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

export async function executecustomerPaymentsPhonePaymentidDelete(c: Context) {
    try {
      const { phone, paymentId } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(decodePhoneParam(phone));
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Delete the payment method
      await customer_payments_phone_paymentid_deleteRepo.dbCustomerPaymentsPhonePaymentidDelete0(paymentId, customerId).catch((error) => {
        // Expected: notification may fail, but don't fail the main operation
        console.warn('[CUSTOMER-PHONE] Error sending notification:', error instanceof Error ? error.message : 'Unknown error');
      });

      return c.json({
        success: true,
        message: 'Payment method removed successfully'
      });
    } catch (error: any) {
      console.error('Error deleting payment method:', error);
      return c.json({ error: error.message }, 500);
    }
}