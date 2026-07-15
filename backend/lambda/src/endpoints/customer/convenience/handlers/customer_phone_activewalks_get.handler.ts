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

export async function customerPhoneActivewalksGetHandler(c: Context) {
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
        const walkerLive = await query(
          `
          SELECT 
            wls.booking_id,
            wls.started_at,
            p.name AS pet_name,
            v.business_name AS walker_name,
            (COALESCE(wr.total_distance_meters, 0)::numeric / 1000.0) AS distance_km,
            wr.waypoints
          FROM walker_live_sessions wls
          LEFT JOIN bookings b ON wls.booking_id = b.id
          LEFT JOIN pets p ON b.pet_id = p.id
          LEFT JOIN vendors v ON wls.walker_id = v.id
          LEFT JOIN walk_routes wr ON wls.booking_id = wr.booking_id
          WHERE wls.customer_id = $1
          AND wls.is_active = true
        `,
          [customerId]
        );

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
        const pkgWalks = await query(
          `
          SELECT 
            ps.booking_id,
            ps.scheduled_start_time AS scheduled_start_time,
            ps.actual_start_time,
            ps.status,
            ps.location,
            p.name AS pet_name,
            s.name AS walker_name
          FROM package_sessions ps
          LEFT JOIN bookings b ON ps.booking_id = b.id
          LEFT JOIN pets p ON ps.pet_id = p.id
          LEFT JOIN staff s ON ps.staff_id = s.id
          WHERE ps.package_purchase_id IN (
            SELECT id FROM package_purchases WHERE customer_id = $1
          )
          AND ps.status = 'in_progress'
        `,
          [customerId]
        );

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
        const gpsWalks = await query(
          `
          SELECT 
            b.id AS booking_id,
            COALESCE(g.started_at, b.created_at) AS started_at,
            p.name AS pet_name,
            v.business_name AS walker_name,
            COALESCE(g.distance_km, g.distance_remaining_km, 0)::numeric AS distance_km,
            g.current_latitude,
            g.current_longitude
          FROM bookings b
          INNER JOIN gps_tracking_sessions g ON g.booking_id = b.id
          LEFT JOIN pets p ON b.pet_id = p.id
          LEFT JOIN vendors v ON b.vendor_id = v.id
          WHERE b.customer_id = $1
          AND b.status = 'in_progress'
          AND g.status IS NOT NULL
          AND LOWER(g.status::text) NOT IN ('completed', 'cancelled')
          AND (
            LOWER(COALESCE(b.service_name, '')) LIKE '%walk%'
            OR LOWER(COALESCE(b.service_type, '')) LIKE '%walk%'
            OR LOWER(COALESCE(b.service_name, '')) LIKE '%stroll%'
          )
        `,
          [customerId]
        );

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
