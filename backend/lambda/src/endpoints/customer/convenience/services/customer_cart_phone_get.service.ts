import type { Context } from 'hono';
import { resolveCustomerIdFromPhone, firstProductImageUrl } from '../repos/module-helpers.repo';
import * as customer_cart_phone_getRepo from '../repos/customer_cart_phone_get.repo';
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

export async function executecustomerCartPhoneGet(c: Context) {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ success: true, cartItems: [], totalPrice: 0 });
      }

      // products table uses price + images (JSONB); sale_price/base_price/image_url are not guaranteed
      const cartResult = await customer_cart_phone_getRepo.dbCustomerCartPhoneGet0(customerId)

      let totalPrice = 0;
      const rows = cartResult.rows || [];
      const cartItems = await Promise.all(
        rows.map(async (row: any) => {
          const unit = parseFloat(String(row.product_price ?? 0)) || 0;
          const qty = Number(row.quantity) || 1;
          totalPrice += unit * qty;
          const signedImages = await presignProductImagesJsonb(row.product_images);
          return {
            id: row.id,
            itemId: row.id,
            type: 'product' as const,
            name: String(row.product_name || 'Product'),
            price: unit,
            quantity: qty,
            photo: firstProductImageUrl(signedImages),
            vendorId: row.product_vendor_id,
            vendor_name: row.vendor_name,
          };
        }),
      );

      return c.json({
        success: true,
        cartItems,
        totalPrice,
      });
    } catch (error: any) {
      console.error('Error fetching cart by phone:', error);
      if (
        typeof error?.message === 'string' &&
        error.message.includes('does not exist') &&
        error.message.includes('relation')
      ) {
        return c.json({ success: true, cartItems: [], totalPrice: 0 });
      }
      return c.json({ success: true, cartItems: [], totalPrice: 0, _error: 'Unable to load cart' });
    }
}