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

export async function customerCartPhoneGetHandler(c: Context) {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ success: true, cartItems: [], totalPrice: 0 });
      }

      // products table uses price + images (JSONB); sale_price/base_price/image_url are not guaranteed
      const cartResult = await query(
        `SELECT ci.id,
                ci.customer_id,
                ci.product_id,
                ci.quantity,
                ci.created_at,
                ci.updated_at,
                p.name AS product_name,
                p.price AS product_price,
                p.images AS product_images,
                p.vendor_id AS product_vendor_id,
                v.business_name AS vendor_name
         FROM cart_items ci
         LEFT JOIN products p ON ci.product_id = p.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE ci.customer_id = $1
         ORDER BY ci.created_at DESC`,
        [customerId]
      );

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
