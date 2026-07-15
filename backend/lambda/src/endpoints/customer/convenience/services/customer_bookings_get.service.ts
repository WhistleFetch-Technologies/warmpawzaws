import type { Context } from 'hono';
import * as customer_bookings_getRepo from '../repos/customer_bookings_get.repo';
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

export async function executecustomerBookingsGet(c: Context) {
    try {
      const phone = c.req.query('phone');
      const petId = c.req.query('petId');
      // Accept category as alias for serviceType (e.g. share report modal uses category=vet)
      const serviceType = (c.req.query('serviceType') || c.req.query('category')) as string | undefined;
      const status = c.req.query('status');

      if (!phone) {
        return c.json({ error: 'phone parameter is required' }, 400);
      }

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      await expirePaymentHolds({ limit: 30, requestId: randomUUID() }).catch((e) =>
        console.warn('[customer/bookings] payment hold sweep failed:', e?.message || e)
      );

      // Build query (join package_purchases for same packageDetails / isPackage as customer/:id/bookings)
      // Children of a package purchase (`is_package_session = true`) are surfaced in
      // the dedicated session tracker (/my-packages → PackageSessionTrackingPanel),
      // NOT in My Bookings — only the canonical parent row appears here.
      let bookingQuery = `
        SELECT b.*,
               ${SQL_PACKAGE_PURCHASE_SELECT.trim()},
               v.business_name as vendor_name,
               v.phone as vendor_phone,
               v.city as vendor_city,
               s.name as service_name,
               s.category as service_category
        FROM bookings b
        LEFT JOIN vendors v ON b.vendor_id = v.id
        ${SQL_PACKAGE_PURCHASE_JOIN}
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.customer_id = executecustomerBookingsGet
          AND COALESCE(b.is_package_session, false) = false
      `;

      const params: any[] = [customerId];
      let paramIndex = 2;

      if (petId) {
        bookingQuery += ` AND b.pet_id = ${paramIndex}`;
        params.push(petId);
        paramIndex++;
      }

      if (serviceType) {
        bookingQuery += ` AND (s.category ILIKE ${paramIndex} OR s.category = ${paramIndex + 1})`;
        params.push(`%${String(serviceType)}%`, String(serviceType));
        paramIndex += 2;
      }

      if (status) {
        // Handle multiple statuses (comma-separated or array)
        const statuses = status.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (statuses.length === 1) {
          bookingQuery += ` AND b.status = ${paramIndex}`;
          params.push(statuses[0]);
          paramIndex++;
        } else if (statuses.length > 1) {
          bookingQuery += ` AND b.status = ANY(${paramIndex})`;
          params.push(statuses);
          paramIndex++;
        }
      }

      bookingQuery += ` ORDER BY b.created_at DESC, b.booking_date DESC, b.booking_time DESC LIMIT 50`;

      const bookings = await customer_bookings_getRepo.dbCustomerBookingsGet0(bookingQuery, params)

      // ✅ PAYMENT RECONCILIATION (2 tiers):
      //   Tier 1 – DB: pending booking with completed payment → mark paid
      //   Tier 2 – Razorpay API: pending payment with razorpay_order_id → check Razorpay if actually paid
      await reconcileBookingPayments(bookings.rows);

      const paymentSourcesByBooking = await resolveBookingPaymentSourcesBatch(
        bookings.rows.map((b: any) => ({ id: b.id, total_amount: b.total_amount }))
      );

      const rawRows = bookings.rows || [];
      const enrichedBookings = await Promise.all(
        rawRows.map(async (b: any) => {
          let completion_otp = b.completion_otp ?? null;
          if (b.status === 'in_progress' && b.otp_verified) {
            if (!completion_otp) {
              const endRes = await customer_bookings_getRepo.dbCustomerBookingsGet1(b).catch(() => ({ rows: [] }));
              completion_otp = (endRes as any).rows?.[0]?.otp_code ?? null;
            }
            const atHome = b.service_style === 'at_home' || b.service_type === 'at_home';
            if (!completion_otp && atHome && b.otp_code) {
              const dedicated = await bookingUsesDedicatedEndSessionOtp(String(b.id));
              if (!dedicated) {
                completion_otp = b.otp_code;
              }
            }
          }
          return {
            ...b,
            completion_otp,
            paymentSources: paymentSourcesByBooking.get(b.id) || [],
            ...packageFieldsFromBookingRow(b),
          };
        })
      );

      return c.json({
        success: true,
        bookings: enrichedBookings,
        count: enrichedBookings.length,
      });
    } catch (error: any) {
      console.error('Error fetching bookings by phone:', error);
      // ✅ FIX: Return empty array instead of 500
      return c.json({ 
        success: true,
        bookings: [],
        count: 0,
        error: error.message 
      }, 200);
    }
}