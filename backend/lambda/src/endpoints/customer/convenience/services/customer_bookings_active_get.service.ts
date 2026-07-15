import type { Context } from 'hono';
import * as customer_bookings_active_getRepo from '../repos/customer_bookings_active_get.repo';
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

export async function executecustomerBookingsActiveGet(c: Context) {
    try {
      const phone = c.req.query('phone');

      if (!phone) {
        return c.json({ error: 'phone parameter is required' }, 400);
      }

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        // ✅ FIX: Return empty array instead of 404 for better UX
        return c.json({ 
          success: true,
          bookings: [],
          count: 0 
        }, 200);
      }

      // Get active bookings (confirmed, in_progress, scheduled, pending)
      const bookingQuery = `
        SELECT b.*,
               v.business_name as vendor_name,
               v.phone as vendor_phone,
               v.city as vendor_city,
               s.name as service_name,
               s.category as service_category
        FROM bookings b
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.customer_id = executecustomerBookingsActiveGet
          AND b.status IN ('confirmed', 'in_progress', 'scheduled', 'pending')
        ORDER BY b.booking_date DESC, b.booking_time DESC
        LIMIT 50
      `;

      const bookings = await customer_bookings_active_getRepo.dbCustomerBookingsActiveGet0(bookingQuery)

      return c.json({
        success: true,
        bookings: bookings.rows,
        count: bookings.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching active bookings by phone:', error);
      // ✅ FIX: Return empty array on error instead of 500
      return c.json({ 
        success: true,
        bookings: [],
        count: 0,
        error: error.message 
      }, 200);
    }
}