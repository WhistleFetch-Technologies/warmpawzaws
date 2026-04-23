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

async function buildPackageSessionsResponse(packagePurchaseId: string) {
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

  const sessions = result.rows;
  const completedCount = sessions.filter((s: any) => s.status === 'completed').length;
  const scheduledCount = sessions.filter((s: any) => s.status === 'scheduled').length;
  const pendingCount = sessions.filter((s: any) => s.status === 'pending').length;
  const totalSessions = pkg?.total_sessions != null ? Number(pkg.total_sessions) : sessions.length;
  const denom = totalSessions > 0 ? totalSessions : 1;

  return {
    success: true,
    package: pkg,
    sessions,
    summary: {
      total: totalSessions,
      completed: completedCount,
      scheduled: scheduledCount,
      pending: pendingCount,
      remaining: pkg?.remaining_sessions != null ? Number(pkg.remaining_sessions) : pendingCount,
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

      let packageQuery = `
        SELECT 
          pp.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.city as vendor_city,
          (pp.total_sessions - pp.remaining_sessions) as sessions_used,
          CASE 
            WHEN pp.expires_at IS NOT NULL AND pp.expires_at < NOW() THEN 'expired'
            WHEN pp.remaining_sessions <= 0 AND pp.unlimited_usage = false THEN 'exhausted'
            ELSE pp.status
          END as computed_status
        FROM package_purchases pp
        LEFT JOIN vendors v ON pp.vendor_id = v.id
        WHERE pp.customer_id = $1
        AND pp.status = 'active'
        AND (pp.expires_at IS NULL OR pp.expires_at > NOW())
        AND (pp.remaining_sessions > 0 OR pp.unlimited_usage = true)
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

      // Verify package is active and has sessions
      const packageResult = await query(`
        SELECT * FROM package_purchases
        WHERE id = $1 AND customer_id = $2
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (remaining_sessions > 0 OR unlimited_usage = true)
      `, [packagePurchaseId, customerId]);

      if (packageResult.rows.length === 0) {
        return c.json({ 
          error: 'Package not found, expired, or has no remaining sessions' 
        }, 400);
      }

      const pkg = packageResult.rows[0];

      // Calculate next session number
      const sessionsUsed = pkg.total_sessions - pkg.remaining_sessions;
      const nextSessionNumber = sessionsUsed + 1;

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

      // Deduct session from package
      if (!pkg.unlimited_usage) {
        await update('package_purchases', 
          { id: packagePurchaseId },
          { 
            remaining_sessions: pkg.remaining_sessions - 1,
            updated_at: new Date().toISOString()
          }
        );
      }

      // Log package usage
      await insert('package_usage_log', {
        package_purchase_id: packagePurchaseId,
        booking_id: booking.id,
        session_number: nextSessionNumber,
        action: 'session_used',
        sessions_before: pkg.remaining_sessions,
        sessions_after: pkg.unlimited_usage ? pkg.remaining_sessions : pkg.remaining_sessions - 1,
        created_at: new Date().toISOString()
      });

      // Update or create scheduled session record
      await query(`
        INSERT INTO package_scheduled_sessions (
          package_purchase_id, session_number, scheduled_date, scheduled_time,
          booking_id, status
        ) VALUES ($1, $2, $3, $4, $5, 'scheduled')
        ON CONFLICT (package_purchase_id, session_number) 
        DO UPDATE SET 
          scheduled_date = EXCLUDED.scheduled_date,
          scheduled_time = EXCLUDED.scheduled_time,
          booking_id = EXCLUDED.booking_id,
          status = 'scheduled',
          updated_at = NOW()
      `, [packagePurchaseId, nextSessionNumber, scheduledDate, scheduledTime, booking.id]);

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
          remainingSessions: pkg.unlimited_usage ? 'unlimited' : pkg.remaining_sessions - 1
        },
        package: {
          id: packagePurchaseId,
          remainingSessions: pkg.unlimited_usage ? 'unlimited' : pkg.remaining_sessions - 1,
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
        const regularPrice = (trialBooking?.total_amount || pkg.price / pkg.total_sessions) * pkg.total_sessions;
        const savings = regularPrice - pkg.price;
        const savingsPercent = Math.round((savings / regularPrice) * 100);

        return {
          ...pkg,
          pricePerSession: Math.round(pkg.price / pkg.total_sessions),
          regularPrice,
          savings: savings > 0 ? savings : 0,
          savingsPercent: savingsPercent > 0 ? savingsPercent : 0,
          isRecommended: pkg.total_sessions >= 5 && pkg.total_sessions <= 10
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
        purchaseId, packageId, customerId, pkg.vendor_id,
        pkg.name, pkg.service_type || 'general', pkg.price,
        pkg.total_sessions, pkg.unlimited_usage || false,
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

      // Create scheduled session placeholders
      const sessionsToCreate = [];
      for (let i = 1; i <= pkg.total_sessions; i++) {
        const schedule = sessionSchedule.find((s: any) => s.sessionNumber === i);
        sessionsToCreate.push({
          package_purchase_id: purchase.id,
          session_number: i,
          scheduled_date: schedule?.date || null,
          scheduled_time: schedule?.time || null,
          status: schedule ? 'scheduled' : 'pending'
        });
      }

      for (const session of sessionsToCreate) {
        await insert('package_scheduled_sessions', session);
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
        message: `Package purchased! ${pkg.total_sessions} sessions available.`
      });
    } catch (error: any) {
      console.error('Error converting trial to package:', error);
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

      // Check for active packages with each provider
      const providersWithPackages = await Promise.all(
        result.rows.map(async (provider: any) => {
          const packageResult = await query(`
            SELECT id, package_name, remaining_sessions, expires_at
            FROM package_purchases
            WHERE customer_id = $1 AND vendor_id = $2
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > NOW())
            AND (remaining_sessions > 0 OR unlimited_usage = true)
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
        AND (pp.remaining_sessions > 0 OR pp.unlimited_usage = true)
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

      // Verify package exists and is active
      const packageResult = await query(`
        SELECT * FROM package_purchases
        WHERE id = $1
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (remaining_sessions > 0 OR unlimited_usage = true)
      `, [packagePurchaseId]);

      if (packageResult.rows.length === 0) {
        return c.json({ 
          error: 'Package not found, expired, or has no remaining sessions' 
        }, 400);
      }

      const pkg = packageResult.rows[0];
      const sessionsUsed = pkg.total_sessions - pkg.remaining_sessions;
      const nextSessionNumber = sessionsUsed + 1;

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

      // Decrement remaining sessions (if not unlimited)
      if (!pkg.unlimited_usage) {
        await query(`
          UPDATE package_purchases
          SET remaining_sessions = remaining_sessions - 1,
              updated_at = NOW()
          WHERE id = $1
        `, [packagePurchaseId]);
      }

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
