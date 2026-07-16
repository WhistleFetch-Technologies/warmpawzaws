import type { Context } from 'hono';
import { resolveCustomerIdFromPhone } from '../repos/module-helpers.repo';
import * as customer_phone_bookings_upcomingcalls_getRepo from '../repos/customer_phone_bookings_upcomingcalls_get.repo';
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

export async function executecustomerPhoneBookingsUpcomingcallsGet(c: Context) {
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
        bookingsResult = await customer_phone_bookings_upcomingcalls_getRepo.dbCustomerPhoneBookingsUpcomingcallsGet0(customerId, minutes, statusFilter, timeFilter)
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