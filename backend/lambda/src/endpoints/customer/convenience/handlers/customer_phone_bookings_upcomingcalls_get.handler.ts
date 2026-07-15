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

export async function customerPhoneBookingsUpcomingcallsGetHandler(c: Context) {
    try {
      const phone = c.req.param('phone');
      const minutes = parseInt(c.req.query('minutes') || '5', 10);
      const includeLive = c.req.query('includeLive') === 'true' || c.req.query('include_live') === 'true';

      // Get customer by phone with error handling
      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ success: true, bookings: [] });
      }

      // Joinable = upcoming (next X min) OR live (scheduled passed, status confirmed/in_progress, within 2h).
      // Completed/cancelled/no_show MUST be excluded so home cards disappear once the
      // tele-consultation is finished (the client also defends with `nextCall.status !== 'completed'`).
      const statusFilter = includeLive
        ? `AND b.status IN ('confirmed', 'scheduled', 'in_progress', 'active')`
        : `AND b.status IN ('confirmed', 'scheduled')`;
      const timeFilter = includeLive
        ? `AND (b.booking_date + b.booking_time::time) >= NOW() - INTERVAL '2 hours'
             AND (b.booking_date + b.booking_time::time) <= NOW() + ($2 || ' minutes')::interval`
        : `AND (b.booking_date + b.booking_time::time) >= NOW()
             AND (b.booking_date + b.booking_time::time) <= NOW() + ($2 || ' minutes')::interval`;

      let bookingsResult: any;
      try {
        bookingsResult = await query(
          `SELECT b.id, b.booking_date, b.booking_time, b.status,
                  (b.booking_date + b.booking_time::time) as scheduled_at,
                  COALESCE(v.business_name, s.name) as vendor_name,
                  COALESCE(v.profile_photo, s.photo) as vendor_photo,
                  sv.service_name as service_name,
                  p.name as pet_name,
                  b.video_call_meeting_id
           FROM bookings b
           LEFT JOIN vendors v ON b.vendor_id = v.id
           LEFT JOIN staff s ON b.staff_id = s.id
           LEFT JOIN vendor_services sv ON b.service_id = sv.id
           LEFT JOIN pets p ON b.pet_id = p.id
           WHERE b.customer_id = $1
             ${statusFilter}
             AND (b.service_style = 'tele' OR b.service_type = 'tele' OR b.service_type = 'online')
             ${timeFilter}
           ORDER BY (b.booking_date + b.booking_time::time) ASC
           LIMIT 10`,
          [customerId, String(minutes)]
        );
      } catch (error: any) {
        console.warn('Error fetching upcoming calls (returning empty):', error.message);
        return c.json({ success: true, bookings: [] });
      }

      return c.json({
        success: true,
        bookings: bookingsResult.rows.map((b: any) => ({
          id: b.id,
          // Expose status so the customer-web home (CustomerHomeComplete.tsx) can
          // defensively filter `nextCall.status !== 'completed'`. Without this the
          // client-side check is always-true and tele cards never go away.
          status: b.status,
          bookingDate: b.booking_date,
          scheduledAt: b.scheduled_at,
          bookingTime: b.booking_time,
          vendorName: b.vendor_name,
          vendorPhoto: b.vendor_photo,
          serviceName: b.service_name,
          petName: b.pet_name,
          meetingId: b.video_call_meeting_id
        }))
      });
    } catch (error: any) {
      console.error('Error getting upcoming calls:', error);
      return c.json({ success: true, bookings: [] });
    }
}
