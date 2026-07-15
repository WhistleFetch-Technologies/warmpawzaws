import type { Context } from 'hono';
import * as customer_saved_phone_getRepo from '../repos/customer_saved_phone_get.repo';
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

export async function executecustomerSavedPhoneGet(c: Context) {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const savedResult = await customer_saved_phone_getRepo.dbCustomerSavedPhoneGet0(w, p)

      const savedItems = (savedResult.rows || []).map((row: any) => ({
        itemId: row.id,
        type: 'product' as const,
        name: row.name || 'Product',
        savedAt: row.created_at,
        product_id: row.product_id,
        price: row.price != null ? parseFloat(String(row.price)) : 0,
      }));

      return c.json({
        success: true,
        savedItems,
      });
    } catch (error: any) {
      console.error('Error fetching saved items by phone:', error);
      return c.json({ error: error.message }, 500);
    }
}