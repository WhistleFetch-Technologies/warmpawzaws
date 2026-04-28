/**
 * ============================================================================
 * PACKAGE BOOKING ENDPOINTS
 * ============================================================================
 * 
 * Handles package-aware booking flows:
 * - Check active packages before booking
 * - Book using package credits
 * - Convert trial to package
 * - Schedule package sessions
 * - Track package usage
 * 
 * Date: 2026-01-15
 * ============================================================================
 */

import type { Context } from 'hono';
import { Hono } from 'hono';
import { query, insert, update, select } from '../database/rds-connection';
import { resolvePostgresCustomerIdFromAuthHeaders } from './customer/customerEndpoint/customer-password';
import { resolveVendorsTableIdFromAuthHeaders } from './vendor/vendor-auth-password';
import {
  seedPackageScheduledSessionsIfMissing,
  seedFinitePackagesMissingSessionsForScope,
  seedFinitePackagesMissingSessionsForVendor,
  reconcileRemainingSessionsForFinitePackage,
  pickNextPendingSessionNumber,
  pickNextUnlimitedPackageSessionNumber,
  linkPackageScheduledSessionToBooking,
  type SqlClient,
} from '../utils/package-session-sync';
import {
  sqlPackagePurchaseActiveForListing,
  sqlPackagePurchaseComputedStatus,
  sqlPackagePurchaseHasBookableSlot,
} from '../utils/package-session-eligibility';
import {
  isServicePackageUnlimited,
  resolveFiniteSessionCountFromServicePackage,
  resolveServicePackageDisplayName,
} from '../utils/service-package-sessions';
import { resolveVendorId } from '../utils/vendor-resolve';
import { getRazorpayConfig } from '../utils/payments/razorpay-client';
import {
  computeVendorPackagePurchase,
  insertVendorServiceCatalogPackage,
  insertPackagePurchaseRows,
  createRazorpayOrderForVendorPackage,
  verifyRazorpayPaymentSignature,
  vendorPackagePurchaseIdForRazorpayOrder,
} from '../utils/vendor-package-razorpay-flow';

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function resolveCustomerUuidForPackage(customerRef: string): Promise<string | null> {
  const ref = String(customerRef || '').trim();
  if (!ref) return null;
  const r = await query(
    `SELECT id FROM customers
     WHERE id::text = $1
        OR LOWER(REGEXP_REPLACE(TRIM(phone), '\\s', '', 'g')) = LOWER(REGEXP_REPLACE(TRIM($1), '\\s', '', 'g'))
     LIMIT 1`,
    [ref]
  ).catch(() => ({ rows: [] as any[] }));
  return r.rows?.[0]?.id ? String(r.rows[0].id) : null;
}

function isLikelyCustomerUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

function mapSessionRow(s: any) {
  const st = String(s.status || '');
  const bst = s.booking_status != null ? String(s.booking_status) : '';
  let displayStatus = st;
  if (st === 'scheduled' && bst === 'in_progress') {
    displayStatus = 'in_progress';
  } else if (st === 'scheduled' && bst === 'completed') {
    displayStatus = 'completed';
  }
  return {
    id: s.id,
    session_number: s.session_number,
    sessionNumber: s.session_number,
    status: st,
    display_status: displayStatus,
    scheduled_date: s.scheduled_date,
    scheduledDate: s.scheduled_date,
    scheduled_time: s.scheduled_time,
    scheduledTime: s.scheduled_time,
    booking_id: s.booking_id,
    bookingId: s.booking_id,
    booking_status: bst || undefined,
    booking_date: s.booking_date,
    bookingDate: s.booking_date,
    booking_time: s.booking_time,
    bookingTime: s.booking_time,
    completed_at: s.completed_at,
    completedAt: s.completed_at,
  };
}

/** Standard read model for customer, vendor, and admin UIs. */
export async function buildPackageSessionsResponse(packagePurchaseId: string) {
  const db = { query } as SqlClient;
  await seedPackageScheduledSessionsIfMissing(db, packagePurchaseId);
  await reconcileRemainingSessionsForFinitePackage(db, packagePurchaseId);

  const result = await query(
    `
        SELECT 
          pss.*,
          b.status as booking_status,
          b.booking_date,
          b.booking_time,
          b.completed_at
        FROM package_scheduled_sessions pss
        LEFT JOIN bookings b ON pss.booking_id = b.id
        WHERE pss.package_purchase_id = $1
        ORDER BY pss.session_number ASC
      `,
    [packagePurchaseId]
  );

  const packageResult = await query(
    `
        SELECT pp.*, v.business_name as vendor_name
        FROM package_purchases pp
        LEFT JOIN vendors v ON pp.vendor_id = v.id
        WHERE pp.id = $1
      `,
    [packagePurchaseId]
  );

  const pkg = packageResult.rows[0];
  if (!pkg) return null;

  const rawSessions = result.rows;
  const sessions = rawSessions.map(mapSessionRow);
  const completedCount = sessions.filter((s: any) => s.display_status === 'completed' || s.status === 'completed').length;
  const inProgressCount = sessions.filter((s: any) => s.display_status === 'in_progress' || s.status === 'in_progress').length;
  const scheduledCount = sessions.filter((s: any) => s.status === 'scheduled').length;
  const pendingCount = sessions.filter((s: any) => s.status === 'pending').length;
  const totalSessions = pkg?.total_sessions != null ? Number(pkg.total_sessions) : rawSessions.length;
  const denom = totalSessions > 0 ? totalSessions : 1;
  const remainingSessions =
    pkg?.remaining_sessions != null ? Number(pkg.remaining_sessions) : Math.max(0, totalSessions - completedCount);

  return {
    success: true,
    package: pkg,
    sessions,
    summary: {
      total: totalSessions,
      completed: completedCount,
      in_progress: inProgressCount,
      scheduled: scheduledCount,
      pending: pendingCount,
      remaining: remainingSessions,
      progressPercent: Math.round((completedCount / denom) * 100),
    },
  };
}

async function packageSessionsAuthForRequest(
  c: Context,
  pkg: { customer_id?: string; vendor_id?: string }
): Promise<'ok' | 'anonymous' | 'forbidden'> {
  const authRaw = c.req.header('Authorization') || c.req.header('authorization') || '';
  if (!authRaw.trim()) return 'anonymous';

  const headers: Record<string, string | undefined> = {
    authorization: authRaw,
    'x-uat-mode': c.req.header('x-uat-mode') || c.req.header('X-UAT-Mode'),
    'X-UAT-Mode': c.req.header('X-UAT-Mode') || c.req.header('x-uat-mode'),
  };

  const [custId, vendId] = await Promise.all([
    resolvePostgresCustomerIdFromAuthHeaders(headers),
    resolveVendorsTableIdFromAuthHeaders(headers),
  ]);

  const custOk =
    custId &&
    pkg.customer_id != null &&
    String(custId).toLowerCase() === String(pkg.customer_id).toLowerCase();
  const vendOk =
    vendId &&
    pkg.vendor_id != null &&
    String(vendId).toLowerCase() === String(pkg.vendor_id).toLowerCase();
  if (custOk || vendOk) return 'ok';
  return 'forbidden';
}

export function registerPackageBookingEndpoints(app: Hono) {
  
  /**
   * GET /customer/:customerId/packages/active
   * Get customer's active packages, optionally filtered by vendor/service type
   */
  app.get("/customer/:customerId/packages/active", async (c) => {
    try {
      const { customerId } = c.req.param();
      const vendorId = c.req.query('vendorId');
      const serviceType = c.req.query('serviceType');

      await seedFinitePackagesMissingSessionsForScope({ query } as SqlClient, {
        customerId,
        ...(vendorId ? { vendorId } : {}),
      });

      let packageQuery = `
        SELECT 
          pp.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.city as vendor_city,
          (pp.total_sessions - pp.remaining_sessions) as sessions_used,
          ${sqlPackagePurchaseComputedStatus('pp')} as computed_status
        FROM package_purchases pp
        LEFT JOIN vendors v ON pp.vendor_id = v.id
        WHERE pp.customer_id = $1
        AND pp.status = 'active'
        AND (pp.expires_at IS NULL OR pp.expires_at > NOW())
        AND (${sqlPackagePurchaseActiveForListing('pp')})
      `;

      const params: any[] = [customerId];
      let paramIndex = 2;

      if (vendorId) {
        packageQuery += ` AND pp.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (serviceType) {
        packageQuery += ` AND pp.package_type = $${paramIndex}`;
        params.push(serviceType);
        paramIndex++;
      }

      packageQuery += ` ORDER BY pp.expires_at ASC NULLS LAST, pp.created_at DESC`;

      const result = await query(packageQuery, params);

      // Get scheduled sessions for each package
      const packagesWithSessions = await Promise.all(
        result.rows.map(async (pkg: any) => {
          const sessionsResult = await query(`
            SELECT * FROM package_scheduled_sessions
            WHERE package_purchase_id = $1
            ORDER BY session_number ASC
          `, [pkg.id]);

          return {
            ...pkg,
            scheduledSessions: sessionsResult.rows,
            nextSession: sessionsResult.rows.find((s: any) => s.status === 'pending' || s.status === 'scheduled')
          };
        })
      );

      return c.json({
        success: true,
        packages: packagesWithSessions,
        total: packagesWithSessions.length,
        hasActivePackages: packagesWithSessions.length > 0
      });
    } catch (error: any) {
      console.error('Error fetching active packages:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Note: GET /packages/check-for-booking is now in packages.ts
   * to avoid route conflicts with /packages/:packageId
   */

  /**
   * POST /bookings/create-from-package
   * Create a booking using package credits instead of new payment
   */
  app.post("/bookings/create-from-package", async (c) => {
    try {
      const body = await c.req.json();
      const {
        packagePurchaseId,
        customerId,
        vendorId,
        petId,
        serviceId,
        scheduledDate,
        scheduledTime,
        serviceType = 'at_center',
        notes,
        address
      } = body;

      if (!packagePurchaseId || !customerId || !vendorId) {
        return c.json({ 
          error: 'packagePurchaseId, customerId, and vendorId are required' 
        }, 400);
      }

      // ✅ FIX GAP-11.1: Check for active subscription first (zero payment)
      let isSubscriptionBooking = false;
      let subscriptionId = null;
      let finalAmount = 0;

      try {
        const subscriptionCheck = await query(
          `SELECT cs.id, cs.subscription_type, cs.is_unlimited, cs.usage_limit, cs.end_date
           FROM customer_subscriptions cs
           WHERE cs.customer_id = $1
             AND cs.status = 'active'
             AND (cs.end_date IS NULL OR cs.end_date > NOW())
             AND (cs.is_unlimited = true OR (cs.usage_limit IS NOT NULL AND cs.used_count < cs.usage_limit))
           ORDER BY cs.created_at DESC
           LIMIT 1`,
          [customerId]
        );

        if (subscriptionCheck.rows.length > 0) {
          const subscription = subscriptionCheck.rows[0];
          subscriptionId = subscription.id;
          isSubscriptionBooking = true;
          finalAmount = 0; // Zero payment for active subscription
          console.log(`[PACKAGE-BOOKING] ✅ Active subscription found: ${subscriptionId}. Setting amount to ₹0.`);
        }
      } catch (subError: any) {
        console.warn('[PACKAGE-BOOKING] Subscription check failed, proceeding with package:', subError);
      }

      const db = { query } as SqlClient;

      await seedPackageScheduledSessionsIfMissing(db, packagePurchaseId);

      // Verify package is active and has a bookable session slot (pending slot or unlimited)
      const packageResult = await query(`
        SELECT * FROM package_purchases
        WHERE id = $1 AND customer_id = $2
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (${sqlPackagePurchaseHasBookableSlot('package_purchases')})
      `, [packagePurchaseId, customerId]);

      if (packageResult.rows.length === 0) {
        return c.json({ 
          error: 'Package not found, expired, or has no remaining sessions' 
        }, 400);
      }

      const pkg = packageResult.rows[0];

      let nextSessionNumber: number;
      if (pkg.unlimited_usage) {
        nextSessionNumber = await pickNextUnlimitedPackageSessionNumber(db, packagePurchaseId);
      } else {
        const slot = await pickNextPendingSessionNumber(db, packagePurchaseId);
        if (slot == null) {
          return c.json(
            { error: 'No package session slots available', code: 'NO_SESSION_SLOTS' },
            400
          );
        }
        nextSessionNumber = slot;
      }

      // Check for slot conflicts
      const conflictCheck = await query(`
        SELECT id FROM bookings
        WHERE vendor_id = $1
        AND booking_date = $2
        AND booking_time = $3
        AND status NOT IN ('cancelled', 'rejected')
      `, [vendorId, scheduledDate, scheduledTime]);

      if (conflictCheck.rows.length > 0) {
        return c.json({ 
          error: 'This time slot is already booked',
          code: 'SLOT_CONFLICT'
        }, 409);
      }

      // Create the booking
      const bookingResult = await query(`
        INSERT INTO bookings (
          customer_id, vendor_id, pet_id, service_id,
          booking_date, booking_time, service_type,
          notes, address,
          package_purchase_id, is_package_session, package_session_number,
          subscription_id, subscription_booking,
          status, payment_status, total_amount
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9,
          $10, true, $11,
          $12, $13,
          'confirmed', $14, $15
        )
        RETURNING *
      `, [
        customerId, vendorId, petId, serviceId,
        scheduledDate, scheduledTime, serviceType,
        notes, address ? JSON.stringify(address) : null,
        packagePurchaseId, nextSessionNumber,
        subscriptionId, isSubscriptionBooking,
        isSubscriptionBooking ? 'paid' : 'completed', // ✅ Mark as paid for subscription
        finalAmount // ✅ Zero payment for subscription
      ]);

      const booking = bookingResult.rows[0];

      if (!pkg.unlimited_usage) {
        const linked = await linkPackageScheduledSessionToBooking(db, {
          packagePurchaseId,
          sessionNumber: nextSessionNumber,
          bookingId: booking.id,
          bookingDate: String(scheduledDate),
          bookingTime: String(scheduledTime),
        });
        if (!linked) {
          await query(`DELETE FROM bookings WHERE id = $1::uuid`, [booking.id]);
          return c.json(
            { error: 'Could not reserve package session slot', code: 'PACKAGE_SESSION_LINK_FAILED' },
            409
          );
        }
      }

      // Update customer provider history
      await query(`
        INSERT INTO customer_provider_history (
          customer_id, vendor_id, service_type, total_bookings,
          last_booking_id, last_booking_date
        ) VALUES ($1, $2, $3, 1, $4, NOW())
        ON CONFLICT (customer_id, vendor_id, service_type)
        DO UPDATE SET
          total_bookings = customer_provider_history.total_bookings + 1,
          last_booking_id = EXCLUDED.last_booking_id,
          last_booking_date = NOW(),
          updated_at = NOW()
      `, [customerId, vendorId, pkg.package_type || 'general', booking.id]);

      return c.json({
        success: true,
        booking: {
          id: booking.id,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          status: booking.status,
          isPackageSession: true,
          sessionNumber: nextSessionNumber,
          remainingSessions: pkg.unlimited_usage ? 'unlimited' : Number(pkg.remaining_sessions ?? 0)
        },
        package: {
          id: packagePurchaseId,
          remainingSessions: pkg.unlimited_usage ? 'unlimited' : Number(pkg.remaining_sessions ?? 0),
          totalSessions: pkg.total_sessions
        },
        message: `Booking created using package session ${nextSessionNumber}/${pkg.total_sessions}`
      });
    } catch (error: any) {
      console.error('Error creating booking from package:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /packages/post-trial-offers
   * Get package offers to show after a trial/first session
   */
  app.get("/packages/post-trial-offers", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const serviceType = c.req.query('serviceType');
      const bookingId = c.req.query('bookingId');

      if (!vendorId) {
        return c.json({ error: 'vendorId required' }, 400);
      }

      // Get vendor's available packages
      const packagesResult = await query(`
        SELECT 
          sp.*,
          v.business_name as vendor_name,
          v.rating as vendor_rating
        FROM service_packages sp
        LEFT JOIN vendors v ON sp.vendor_id = v.id
        WHERE sp.vendor_id = $1
        AND sp.is_active = true
        ORDER BY sp.total_sessions ASC, sp.price ASC
      `, [vendorId]);

      // Get booking details if provided
      let trialBooking = null;
      if (bookingId) {
        const bookingResult = await query(`
          SELECT b.*, s.name as service_name, v.business_name as vendor_name
          FROM bookings b
          LEFT JOIN services s ON b.service_id = s.id
          LEFT JOIN vendors v ON b.vendor_id = v.id
          WHERE b.id = $1
        `, [bookingId]);
        trialBooking = bookingResult.rows[0] || null;
      }

      // Calculate savings for each package
      const packagesWithSavings = packagesResult.rows.map((pkg: any) => {
        const ts = resolveFiniteSessionCountFromServicePackage(pkg);
        const denom = ts > 0 ? ts : 1;
        const regularPrice = (trialBooking?.total_amount || pkg.price / denom) * denom;
        const savings = regularPrice - pkg.price;
        const savingsPercent = Math.round((savings / regularPrice) * 100);

        return {
          ...pkg,
          total_sessions: ts,
          totalSessions: ts,
          pricePerSession: Math.round(Number(pkg.price) / denom),
          regularPrice,
          savings: savings > 0 ? savings : 0,
          savingsPercent: savingsPercent > 0 ? savingsPercent : 0,
          isRecommended: ts >= 5 && ts <= 10
        };
      });

      return c.json({
        success: true,
        packages: packagesWithSavings,
        trialBooking,
        vendorName: packagesResult.rows[0]?.vendor_name,
        message: packagesWithSavings.length > 0 
          ? 'Save with a package!' 
          : 'No packages available from this vendor'
      });
    } catch (error: any) {
      console.error('Error fetching post-trial offers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /packages/convert-from-trial
   * Convert a trial booking to a package purchase
   */
  app.post("/packages/convert-from-trial", async (c) => {
    try {
      const body = await c.req.json();
      const {
        trialBookingId,
        packageId, // service_packages.id
        customerId,
        preferSameProvider = true,
        paymentMethodId,
        scheduleAllSessions = false,
        sessionSchedule = [] // Array of {sessionNumber, date, time}
      } = body;

      if (!packageId || !customerId) {
        return c.json({ error: 'packageId and customerId required' }, 400);
      }

      const resolvedCustomerId =
        (await resolveCustomerUuidForPackage(String(customerId))) ||
        (isLikelyCustomerUuid(String(customerId)) ? String(customerId).trim() : null);
      if (!resolvedCustomerId) {
        return c.json({ error: 'Customer not found for this account' }, 404);
      }

      // Get package details
      const packageResult = await query(`
        SELECT sp.*, v.business_name as vendor_name
        FROM service_packages sp
        LEFT JOIN vendors v ON sp.vendor_id = v.id
        WHERE sp.id = $1 AND sp.is_active = true
      `, [packageId]);

      if (packageResult.rows.length === 0) {
        return c.json({ error: 'Package not found or inactive' }, 404);
      }

      const pkg = packageResult.rows[0];

      const unlimitedPurchase = isServicePackageUnlimited(pkg);
      const finiteSessions = resolveFiniteSessionCountFromServicePackage(pkg);
      const totalSessionsForPurchase = unlimitedPurchase ? 0 : finiteSessions;
      const packageDisplayName = resolveServicePackageDisplayName(pkg);

      // Get trial booking details if provided
      let trialBooking = null;
      let staffId = null;
      if (trialBookingId) {
        const bookingResult = await query(`
          SELECT * FROM bookings WHERE id = $1
        `, [trialBookingId]);
        trialBooking = bookingResult.rows[0];
        staffId = trialBooking?.staff_id;
      }

      // Calculate expiry date
      const expiresAt = new Date();
      if (pkg.validity_days) {
        expiresAt.setDate(expiresAt.getDate() + pkg.validity_days);
      } else if (pkg.validity_months) {
        expiresAt.setMonth(expiresAt.getMonth() + pkg.validity_months);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 3); // Default 3 months
      }

      // Create package purchase
      const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const purchaseResult = await query(`
        INSERT INTO package_purchases (
          purchase_id, package_id, customer_id, vendor_id,
          package_name, package_type, package_price,
          total_sessions, remaining_sessions, unlimited_usage,
          amount, payment_status, status,
          preferred_vendor_id, preferred_staff_id, auto_assign_same_provider,
          expires_at, activated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $8, $9,
          $7, 'completed', 'active',
          $10, $11, $12,
          $13, NOW()
        )
        RETURNING *
      `, [
        purchaseId, packageId, resolvedCustomerId, pkg.vendor_id,
        packageDisplayName,
        ['bundle', 'time_based', 'appointment', 'membership', 'subscription'].includes(
          String(pkg.service_type || '').toLowerCase()
        )
          ? String(pkg.service_type).toLowerCase()
          : 'bundle',
        pkg.price,
        totalSessionsForPurchase, unlimitedPurchase,
        preferSameProvider ? pkg.vendor_id : null,
        preferSameProvider ? staffId : null,
        preferSameProvider,
        expiresAt.toISOString()
      ]);

      const purchase = purchaseResult.rows[0];

      // Mark trial as converted if provided
      if (trialBookingId) {
        await update('bookings',
          { id: trialBookingId },
          { converted_to_package_id: purchase.id }
        );
      }

      const db = { query } as SqlClient;
      await seedPackageScheduledSessionsIfMissing(db, purchase.id);
      for (const sched of sessionSchedule || []) {
        const sn = Number((sched as any).sessionNumber);
        if (!Number.isFinite(sn) || sn < 1) continue;
        await query(
          `UPDATE package_scheduled_sessions
           SET scheduled_date = $1::date,
               scheduled_time = $2::time,
               status = 'scheduled',
               updated_at = NOW()
           WHERE package_purchase_id = $3::uuid AND session_number = $4`,
          [(sched as any).date || null, (sched as any).time || null, purchase.id, sn]
        );
      }

      return c.json({
        success: true,
        purchase: {
          id: purchase.id,
          purchaseId: purchase.purchase_id,
          packageName: purchase.package_name,
          totalSessions: purchase.total_sessions,
          remainingSessions: purchase.remaining_sessions,
          expiresAt: purchase.expires_at,
          vendorName: pkg.vendor_name,
          preferSameProvider: purchase.auto_assign_same_provider
        },
        sessionsScheduled: sessionSchedule.length,
        message: unlimitedPurchase
          ? 'Package purchased! Unlimited sessions for this plan.'
          : `Package purchased! ${finiteSessions} sessions available.`
      });
    } catch (error: any) {
      console.error('Error converting trial to package:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /packages/purchase-from-vendor-service
   * Create service_packages + package_purchases + package_scheduled_sessions from a vendor_services
   * row that has metadata.isPackage + metadata.packageDetails (custom walker/training bundles).
   */
  app.post('/packages/purchase-from-vendor-service', async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId: customerRef,
        vendorId: vendorRef,
        vendorServiceId,
        preferSameProvider = true,
        sessionSchedule = [] as Array<{ sessionNumber?: number; date?: string; time?: string }>,
        razorpay_order_id: razorpayOrderIdRaw,
        razorpay_payment_id: razorpayPaymentIdRaw,
        razorpay_signature: razorpaySignatureRaw,
        paymentId: paymentIdRaw,
      } = body;

      if (!customerRef || !vendorRef || !vendorServiceId) {
        return c.json(
          { error: 'customerId, vendorId, and vendorServiceId are required' },
          400
        );
      }

      const resolvedPurchaseCustomer =
        (await resolveCustomerUuidForPackage(String(customerRef))) ||
        (isLikelyCustomerUuid(String(customerRef)) ? String(customerRef).trim() : null);
      if (!resolvedPurchaseCustomer) {
        return c.json({ error: 'Customer not found' }, 404);
      }
      const customerId = resolvedPurchaseCustomer;

      const computed = await computeVendorPackagePurchase({
        customerId,
        vendorIdRaw: String(vendorRef),
        vendorServiceId: String(vendorServiceId),
      });
      if (!computed.ok) {
        return c.json({ error: computed.error }, computed.status as 400 | 403 | 404);
      }
      const comp = computed.comp;

      const razorpayOrderId = String(razorpayOrderIdRaw || '').trim();
      const razorpayPaymentId = String(razorpayPaymentIdRaw || '').trim();
      const razorpaySignature = String(razorpaySignatureRaw || '').trim();
      const hasRazorpayProof = Boolean(razorpayOrderId && razorpayPaymentId && razorpaySignature);
      const anyRazorpayField = Boolean(razorpayOrderId || razorpayPaymentId || razorpaySignature);
      if (anyRazorpayField && !hasRazorpayProof) {
        return c.json(
          {
            error:
              'To confirm payment, send razorpay_order_id, razorpay_payment_id, and razorpay_signature together',
          },
          400
        );
      }

      const unlimitedPurchase = comp.unlimitedPurchase;
      const finiteSessions = unlimitedPurchase ? 0 : comp.finiteSessions;

      const purchaseJson = (purchase: Record<string, unknown>, catalogPackageId: string) => ({
        success: true,
        purchase: {
          id: purchase.id,
          purchaseId: purchase.purchase_id,
          packageName: purchase.package_name,
          totalSessions: purchase.total_sessions,
          remainingSessions: purchase.remaining_sessions,
          expiresAt: purchase.expires_at,
          servicePackageId: catalogPackageId,
          vendorServiceId: String(vendorServiceId),
        },
        message: unlimitedPurchase
          ? 'Package purchased! Unlimited sessions for this plan.'
          : `Package purchased! ${finiteSessions} sessions available.`,
      });

      if (comp.priceNum > 0 && !hasRazorpayProof) {
        try {
          const order = await createRazorpayOrderForVendorPackage({
            customerId,
            vendorId: comp.vendorId,
            vendorServiceId: String(vendorServiceId),
            amount: comp.priceNum,
          });
          return c.json({
            success: true,
            requiresPayment: true,
            razorpayOrderId: order.orderId,
            razorpayKeyId: order.keyId,
            amount: order.amount,
            currency: order.currency,
            paymentId: order.paymentId,
            vendorId: comp.vendorId,
            vendorServiceId: String(vendorServiceId),
          });
        } catch (e: any) {
          console.error('vendor package Razorpay create-order:', e);
          return c.json({ error: e?.message || 'Failed to start payment' }, 502);
        }
      }

      if (comp.priceNum > 0 && hasRazorpayProof) {
        const cfg = await getRazorpayConfig();
        if (!cfg?.keySecret) {
          return c.json({ error: 'Razorpay is not configured' }, 500);
        }
        if (
          !verifyRazorpayPaymentSignature(
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            cfg.keySecret
          )
        ) {
          return c.json({ error: 'Invalid Razorpay signature' }, 400);
        }

        const deterministicPurchaseId = vendorPackagePurchaseIdForRazorpayOrder(razorpayOrderId);
        const existing = await query(
          `SELECT pp.* FROM package_purchases pp WHERE pp.purchase_id = $1 LIMIT 1`,
          [deterministicPurchaseId]
        );
        if (existing.rows[0]?.id) {
          const purchase = existing.rows[0] as Record<string, unknown>;
          const catId = String(purchase.package_id || '');
          await query(
            `UPDATE payments SET payment_status = 'completed', razorpay_payment_id = $2, razorpay_signature = $3,
                 completed_at = NOW(), updated_at = NOW()
             WHERE razorpay_order_id = $1 AND customer_id = $4::uuid`,
            [razorpayOrderId, razorpayPaymentId, razorpaySignature, customerId]
          );
          return c.json(purchaseJson(purchase, catId));
        }

        let payRow: Record<string, unknown> | undefined;
        if (paymentIdRaw && isLikelyCustomerUuid(String(paymentIdRaw))) {
          const pr = await query(
            `SELECT * FROM payments WHERE id = $1::uuid AND customer_id = $2::uuid LIMIT 1`,
            [String(paymentIdRaw).trim(), customerId]
          );
          payRow = pr.rows[0] as Record<string, unknown> | undefined;
        }
        if (!payRow) {
          const pr2 = await query(
            `SELECT * FROM payments WHERE razorpay_order_id = $1 AND customer_id = $2::uuid
             ORDER BY created_at DESC NULLS LAST LIMIT 1`,
            [razorpayOrderId, customerId]
          );
          payRow = pr2.rows[0] as Record<string, unknown> | undefined;
        }
        if (!payRow?.id) {
          return c.json({ error: 'Payment record not found for this order' }, 404);
        }
        if (String(payRow.vendor_id || '').toLowerCase() !== String(comp.vendorId).toLowerCase()) {
          return c.json({ error: 'Payment does not match this vendor' }, 400);
        }
        const paidAmt = Number(payRow.amount);
        if (!Number.isFinite(paidAmt) || Math.abs(paidAmt - comp.priceNum) > 0.02) {
          return c.json({ error: 'Payment amount mismatch' }, 400);
        }

        const catalogPackageId = await insertVendorServiceCatalogPackage(comp);
        const { purchase } = await insertPackagePurchaseRows(comp, catalogPackageId, {
          paymentStatus: 'completed',
          preferSameProvider: Boolean(preferSameProvider),
          sessionSchedule,
          razorpayOrderId,
          paymentId: String(payRow.id),
        });

        await query(
          `UPDATE payments SET payment_status = 'completed', razorpay_payment_id = $2, razorpay_signature = $3,
               completed_at = NOW(), updated_at = NOW()
           WHERE id = $1::uuid`,
          [payRow.id, razorpayPaymentId, razorpaySignature]
        );

        return c.json(purchaseJson(purchase as Record<string, unknown>, catalogPackageId));
      }

      const catalogPackageId = await insertVendorServiceCatalogPackage(comp);
      const { purchase } = await insertPackagePurchaseRows(comp, catalogPackageId, {
        paymentStatus: 'completed',
        preferSameProvider: Boolean(preferSameProvider),
        sessionSchedule,
      });

      return c.json(purchaseJson(purchase as Record<string, unknown>, catalogPackageId));
    } catch (error: any) {
      console.error('Error in purchase-from-vendor-service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /packages/:packagePurchaseId/schedule-sessions
   * Bulk schedule multiple sessions for a package
   */
  app.post("/packages/:packagePurchaseId/schedule-sessions", async (c) => {
    try {
      const { packagePurchaseId } = c.req.param();
      const body = await c.req.json();
      const { sessions } = body; // Array of {sessionNumber, date, time}

      if (!sessions || !Array.isArray(sessions)) {
        return c.json({ error: 'sessions array required' }, 400);
      }

      // Verify package exists
      const packageResult = await query(`
        SELECT * FROM package_purchases WHERE id = $1
      `, [packagePurchaseId]);

      if (packageResult.rows.length === 0) {
        return c.json({ error: 'Package not found' }, 404);
      }

      const pkg = packageResult.rows[0];
      const scheduledSessions = [];

      for (const session of sessions) {
        const { sessionNumber, date, time } = session;

        if (sessionNumber > pkg.total_sessions) {
          continue; // Skip invalid session numbers
        }

        const result = await query(`
          INSERT INTO package_scheduled_sessions (
            package_purchase_id, session_number, scheduled_date, scheduled_time, status
          ) VALUES ($1, $2, $3, $4, 'scheduled')
          ON CONFLICT (package_purchase_id, session_number)
          DO UPDATE SET
            scheduled_date = EXCLUDED.scheduled_date,
            scheduled_time = EXCLUDED.scheduled_time,
            status = 'scheduled',
            updated_at = NOW()
          RETURNING *
        `, [packagePurchaseId, sessionNumber, date, time]);

        scheduledSessions.push(result.rows[0]);
      }

      return c.json({
        success: true,
        scheduledSessions,
        totalScheduled: scheduledSessions.length,
        message: `${scheduledSessions.length} sessions scheduled`
      });
    } catch (error: any) {
      console.error('Error scheduling sessions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/packages/:packagePurchaseId/sessions
   * Staff view of all scheduled sessions for a purchase (vendor must own the package).
   */
  app.get('/vendor/packages/:packagePurchaseId/sessions', async (c) => {
    try {
      const { packagePurchaseId } = c.req.param();
      const headers: Record<string, string | undefined> = {
        authorization: c.req.header('Authorization') || c.req.header('authorization'),
        'x-uat-mode': c.req.header('x-uat-mode') || c.req.header('X-UAT-Mode'),
        'X-UAT-Mode': c.req.header('X-UAT-Mode') || c.req.header('x-uat-mode'),
      };
      const vendId = await resolveVendorsTableIdFromAuthHeaders(headers);
      if (!vendId) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
      }
      const body = await buildPackageSessionsResponse(packagePurchaseId);
      if (!body) {
        return c.json({ error: 'Package not found' }, 404);
      }
      const pkg = body.package as { vendor_id?: string };
      if (!pkg?.vendor_id || String(pkg.vendor_id).toLowerCase() !== String(vendId).toLowerCase()) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
      return c.json(body);
    } catch (error: any) {
      console.error('Error fetching vendor package sessions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/package-purchases/lookup/sessions
   * Resolve package purchase by id or by latest row for customer+vendor; same JSON as sessions read model.
   */
  app.get('/admin/package-purchases/lookup/sessions', async (c) => {
    try {
      const packagePurchaseId = c.req.query('packagePurchaseId')?.trim();
      const customerId = c.req.query('customerId')?.trim();
      const vendorId = c.req.query('vendorId')?.trim();
      let id = packagePurchaseId || '';
      if (!id && customerId && vendorId) {
        const r = await query(
          `SELECT id FROM package_purchases
           WHERE customer_id = $1::uuid AND vendor_id = $2::uuid
           ORDER BY created_at DESC NULLS LAST
           LIMIT 1`,
          [customerId, vendorId]
        );
        id = r.rows?.[0]?.id || '';
      }
      if (!id) {
        return c.json(
          { error: 'Provide packagePurchaseId or both customerId and vendorId' },
          400
        );
      }
      const body = await buildPackageSessionsResponse(id);
      if (!body) {
        return c.json({ error: 'Package not found' }, 404);
      }
      return c.json(body);
    } catch (error: any) {
      console.error('Error in admin package session lookup:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/package-purchases/:packagePurchaseId/sessions
   * Read-only session list (same payload as customer/vendor); requires admin auth via /admin/* middleware.
   */
  app.get('/admin/package-purchases/:packagePurchaseId/sessions', async (c) => {
    try {
      const { packagePurchaseId } = c.req.param();
      const body = await buildPackageSessionsResponse(packagePurchaseId);
      if (!body) {
        return c.json({ error: 'Package not found' }, 404);
      }
      return c.json(body);
    } catch (error: any) {
      console.error('Error fetching admin package sessions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /packages/:packagePurchaseId/sessions
   * Get all sessions for a package purchase.
   * When Authorization is sent, customer or vendor must own the row; unauthenticated calls remain allowed for backward compatibility.
   */
  app.get("/packages/:packagePurchaseId/sessions", async (c) => {
    try {
      const { packagePurchaseId } = c.req.param();

      const body = await buildPackageSessionsResponse(packagePurchaseId);
      if (!body) {
        return c.json({ error: 'Package not found' }, 404);
      }

      const pkg = body.package as { customer_id?: string; vendor_id?: string };
      const authz = await packageSessionsAuthForRequest(c, pkg);
      if (authz === 'forbidden') {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }

      return c.json(body);
    } catch (error: any) {
      console.error('Error fetching package sessions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/previous-providers
   * Get customer's previous service providers for quick rebooking.
   * customerId can be UUID or phone number (frontend often passes phone).
   */
  app.get("/customer/:customerId/previous-providers", async (c) => {
    try {
      let { customerId: rawId } = c.req.param();
      const serviceType = c.req.query('serviceType');

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
      let customerId = rawId;
      if (!isUUID) {
        const normalizedPhone = rawId.replace(/\D/g, '').slice(-10);
        const custResult = await query(
          `SELECT id FROM customers WHERE phone = $1 OR phone = $2 OR phone LIKE $3 LIMIT 1`,
          [rawId, normalizedPhone, `%${normalizedPhone}`]
        );
        if (!custResult.rows?.length) {
          return c.json({ success: true, providers: [], total: 0 });
        }
        customerId = custResult.rows[0].id;
      }

      let providerQuery = `
        SELECT 
          cph.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.address,
          v.city,
          v.rating as vendor_rating,
          (
            SELECT COUNT(*) FROM reviews r 
            WHERE r.vendor_id = v.id AND r.is_approved = true
          ) as review_count
        FROM customer_provider_history cph
        LEFT JOIN vendors v ON cph.vendor_id = v.id
        WHERE cph.customer_id = $1
        AND v.is_active = true
      `;

      const params: any[] = [customerId];
      if (serviceType) {
        providerQuery += ` AND cph.service_type = $2`;
        params.push(serviceType);
      }

      providerQuery += ` ORDER BY cph.last_booking_date DESC LIMIT 10`;

      const result = await query(providerQuery, params);

      await seedFinitePackagesMissingSessionsForScope({ query } as SqlClient, { customerId });

      // Check for active packages with each provider
      const providersWithPackages = await Promise.all(
        result.rows.map(async (provider: any) => {
          const packageResult = await query(`
            SELECT id, package_name, remaining_sessions, expires_at
            FROM package_purchases
            WHERE customer_id = $1 AND vendor_id = $2
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > NOW())
            AND (${sqlPackagePurchaseActiveForListing('package_purchases')})
            LIMIT 1
          `, [customerId, provider.vendor_id]);

          return {
            ...provider,
            profile_image_url: provider.profile_image_url ?? null,
            hasActivePackage: packageResult.rows.length > 0,
            activePackage: packageResult.rows[0] || null
          };
        })
      );

      return c.json({
        success: true,
        providers: providersWithPackages,
        total: providersWithPackages.length
      });
    } catch (error: any) {
      console.error('Error fetching previous providers:', error);
      // Return 200 with empty list so customer home loads gracefully (non-critical)
      return c.json({ success: true, providers: [], total: 0 });
    }
  });

  /**
   * GET /vendor/:vendorId/package-customers
   * Get vendor's customers who have active packages
   */
  app.get("/vendor/:vendorId/package-customers", async (c) => {
    try {
      const { vendorId } = c.req.param();

      await seedFinitePackagesMissingSessionsForVendor({ query } as SqlClient, vendorId);

      const result = await query(`
        SELECT 
          pp.*,
          c.name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email,
          c.profile_image_url as customer_image,
          (pp.total_sessions - pp.remaining_sessions) as sessions_used,
          (
            SELECT json_agg(json_build_object(
              'id', pss.id,
              'sessionNumber', pss.session_number,
              'scheduledDate', pss.scheduled_date,
              'scheduledTime', pss.scheduled_time,
              'status', pss.status
            ) ORDER BY pss.session_number)
            FROM package_scheduled_sessions pss
            WHERE pss.package_purchase_id = pp.id
            AND pss.status IN ('pending', 'scheduled')
          ) as upcoming_sessions
        FROM package_purchases pp
        LEFT JOIN customers c ON pp.customer_id = c.id
        WHERE pp.vendor_id = $1
        AND pp.status = 'active'
        AND (pp.expires_at IS NULL OR pp.expires_at > NOW())
        AND (${sqlPackagePurchaseActiveForListing('pp')})
        ORDER BY pp.expires_at ASC NULLS LAST
      `, [vendorId]);

      return c.json({
        success: true,
        customers: result.rows,
        total: result.rows.length
      });
    } catch (error: any) {
      console.error('Error fetching package customers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /package-sessions
   * Create a new package session (used when booking with package)
   */
  app.post("/package-sessions", async (c) => {
    try {
      const body = await c.req.json();
      const {
        packagePurchaseId,
        scheduledStartTime,
        petId,
        staffId,
        location,
        notes
      } = body;

      if (!packagePurchaseId || !scheduledStartTime) {
        return c.json({ 
          error: 'packagePurchaseId and scheduledStartTime are required' 
        }, 400);
      }

      const pdb = { query } as SqlClient;

      await seedPackageScheduledSessionsIfMissing(pdb, packagePurchaseId);

      // Verify package exists and is active (bookable = unlimited or pending slot)
      const packageResult = await query(`
        SELECT * FROM package_purchases
        WHERE id = $1
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (${sqlPackagePurchaseHasBookableSlot('package_purchases')})
      `, [packagePurchaseId]);

      if (packageResult.rows.length === 0) {
        return c.json({ 
          error: 'Package not found, expired, or has no remaining sessions' 
        }, 400);
      }

      const pkg = packageResult.rows[0];
      let nextSessionNumber: number;
      if (pkg.unlimited_usage) {
        nextSessionNumber = await pickNextUnlimitedPackageSessionNumber(pdb, packagePurchaseId);
      } else {
        const slot = await pickNextPendingSessionNumber(pdb, packagePurchaseId);
        if (slot == null) {
          return c.json({ error: 'No package session slots available' }, 400);
        }
        nextSessionNumber = slot;
      }

      // Parse scheduled start time
      const scheduledDate = new Date(scheduledStartTime);
      if (isNaN(scheduledDate.getTime())) {
        return c.json({ error: 'Invalid scheduledStartTime format' }, 400);
      }

      // Create package session
      const sessionResult = await query(`
        INSERT INTO package_sessions (
          package_purchase_id,
          scheduled_start_time,
          pet_id,
          staff_id,
          location,
          notes,
          status,
          session_number
        ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7)
        RETURNING *
      `, [
        packagePurchaseId,
        scheduledDate.toISOString(),
        petId || null,
        staffId || null,
        location ? JSON.stringify(location) : null,
        notes || null,
        nextSessionNumber
      ]);

      const session = sessionResult.rows[0];

      return c.json({
        success: true,
        session: {
          id: session.id,
          packagePurchaseId: session.package_purchase_id,
          scheduledStartTime: session.scheduled_start_time,
          status: session.status,
          sessionNumber: session.session_number
        }
      });
    } catch (error: any) {
      console.error('Error creating package session:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Package booking endpoints registered');
}
