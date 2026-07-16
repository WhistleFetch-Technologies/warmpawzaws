import type { Context } from 'hono';
import { resolveCustomerIdFromPhone } from '../repos/module-helpers.repo';
import * as customer_phone_activewalks_getRepo from '../repos/customer_phone_activewalks_get.repo';
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

export async function executecustomerPhoneActivewalksGet(c: Context) {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ walks: [], success: true });
      }

      /**
       * Walk "live" card + Track must use booking_id for:
       * - GET /tracking/booking/:bookingId (vendor HomeServiceTrackingManager + gps_tracking_sessions)
       * - GET /customer/:bookingId/track-walk (walker_live_sessions / walker-gps)
       * Previously we exposed walker_live_sessions.id as `id`, which broke tracking APIs.
       */
      const byBooking = new Map<
        string,
        {
          bookingId: string;
          walkerName: string;
          petName: string;
          startTime: string | null;
          status: string;
          distanceCovered: number;
          currentLocation: unknown | null;
        }
      >();

      const upsert = (bookingId: string | null | undefined, row: {
        walkerName: string;
        petName: string;
        startTime: string | null;
        status: string;
        distanceCovered: number;
        currentLocation: unknown | null;
      }) => {
        if (!bookingId) return;
        const bid = String(bookingId);
        if (!byBooking.has(bid)) {
          byBooking.set(bid, {
            bookingId: bid,
            walkerName: row.walkerName,
            petName: row.petName,
            startTime: row.startTime,
            status: row.status,
            distanceCovered: row.distanceCovered,
            currentLocation: row.currentLocation,
          });
        }
      };

      // 1) Legacy walker_live_sessions + walk_routes (walker-gps.ts)
      try {
        const walkerLive = await customer_phone_activewalks_getRepo.dbCustomerPhoneActivewalksGet0(customerId)

        for (const walk of (walkerLive as any).rows || []) {
          const waypoints = walk.waypoints;
          const lastWp =
            Array.isArray(waypoints) && waypoints.length > 0
              ? waypoints[waypoints.length - 1]
              : null;
          upsert(walk.booking_id, {
            walkerName: walk.walker_name || 'Walker',
            petName: walk.pet_name || 'Pet',
            startTime: walk.started_at || null,
            status: 'in_progress',
            distanceCovered: walk.distance_km != null ? Number(walk.distance_km) : 0,
            currentLocation: lastWp,
          });
        }
      } catch (wlsErr: any) {
        console.warn('[active-walks] walker_live_sessions query skipped:', wlsErr?.message || wlsErr);
      }

      // 2) Package sessions in progress (schema varies by migration — failure must not drop other sources)
      try {
        const pkgWalks = await customer_phone_activewalks_getRepo.dbCustomerPhoneActivewalksGet1(customerId)

        for (const walk of (pkgWalks as any).rows || []) {
          upsert(walk.booking_id, {
            walkerName: walk.walker_name || 'Walker',
            petName: walk.pet_name || 'Pet',
            startTime: walk.actual_start_time || walk.scheduled_start_time || null,
            status: walk.status || 'in_progress',
            distanceCovered: 0,
            currentLocation: walk.location || null,
          });
        }
      } catch (pkgErr: any) {
        console.warn('[active-walks] package_sessions query skipped:', pkgErr?.message || pkgErr);
      }

      // 3) Vendor web walk flow: gps_tracking_sessions + HomeServiceTrackingManager (no walker_live row)
      try {
        const gpsWalks = await customer_phone_activewalks_getRepo.dbCustomerPhoneActivewalksGet2(customerId)

        for (const walk of (gpsWalks as any).rows || []) {
          upsert(walk.booking_id, {
            walkerName: walk.walker_name || 'Walker',
            petName: walk.pet_name || 'Pet',
            startTime: walk.started_at || null,
            status: 'in_progress',
            distanceCovered: walk.distance_km != null ? Number(walk.distance_km) : 0,
            currentLocation:
              walk.current_latitude != null && walk.current_longitude != null
                ? {
                    latitude: parseFloat(String(walk.current_latitude)),
                    longitude: parseFloat(String(walk.current_longitude)),
                  }
                : null,
          });
        }
      } catch (gpsErr: any) {
        console.warn('[active-walks] gps_tracking_sessions walk query skipped:', gpsErr?.message || gpsErr);
      }

      const walks = Array.from(byBooking.values()).map((w) => ({
        id: w.bookingId,
        bookingId: w.bookingId,
        walkerName: w.walkerName,
        petName: w.petName,
        startTime: w.startTime,
        status: w.status,
        distanceCovered: w.distanceCovered,
        currentLocation: w.currentLocation,
      }));

      return c.json({
        success: true,
        walks,
        count: walks.length,
      });
    } catch (error: any) {
      console.error('Error fetching active walks by phone:', error);
      return c.json({ walks: [], success: true });
    }
}