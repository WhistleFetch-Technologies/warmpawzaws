import type { Context } from 'hono';
import * as customer_phone_latestbookingbyvendor_getRepo from '../repos/customer_phone_latestbookingbyvendor_get.repo';
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

export async function executecustomerPhoneLatestbookingbyvendorGet(c: Context) {
    try {
      const { phone } = c.req.param();
      const vendorId = c.req.query('vendorId');
      if (!vendorId) {
        return c.json({ error: 'vendorId query required' }, 400);
      }
      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ booking: null, success: true });
      }
      const result = await customer_phone_latestbookingbyvendor_getRepo.dbCustomerPhoneLatestbookingbyvendorGet0(b, v)
      const row = result.rows?.[0];
      if (!row) {
        return c.json({ success: true, booking: null });
      }
      return c.json({
        success: true,
        booking: {
          bookingId: row.booking_id,
          vendorId: row.vendor_id,
          vendorName: row.vendor_name,
          vendorPhoto: row.vendor_photo,
        },
      });
    } catch (error: any) {
      console.error('Error fetching latest booking by vendor:', error);
      return c.json({ success: true, booking: null });
    }
}