/**
 * ============================================================================
 * INSTANT TELE QUEUE ENDPOINTS - VENDOR-ONLY (No Staff)
 * ============================================================================
 *
 * Handles instant tele consultation queue for real-time video consultations.
 * All providers are vendors – no staff table involvement.
 *
 * Customer endpoints:
 *   GET  /customer/tele/available-providers   – list vendors with published tele services
 *   POST /customer/tele/join-queue            – join queue for a vendor
 *   DELETE /customer/tele/leave-queue/:queueId
 *   GET  /customer/tele/queue-status/:queueId
 *   GET  /customer/tele/queue-stream/:queueId – SSE real-time updates
 *
 * Vendor endpoints:
 *   GET  /vendor/:vendorId/tele-queue                       – view queue
 *   POST /vendor/:vendorId/tele-queue/:queueId/accept       – accept & create booking
 *   POST /vendor/:vendorId/tele-queue/:queueId/skip         – skip / remove
 *   GET  /vendor/:vendorId/tele-queue-stream                – SSE real-time updates
 *
 * Utility:
 *   GET  /bookings/:bookingId/queue-position
 *
 * Date: 2026-03-03  (rewritten – vendor-only, no staff)
 * ============================================================================
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { query, insert, select } from '../../../database/rds-connection';
import { CATEGORY_ROLES, VET_ROLE_NAMES } from '../../customer/constants';

// Queue configuration
const QUEUE_TIMEOUT_MINUTES = 15;
const MAX_QUEUE_SIZE = 20;

export function registerInstantTeleQueueEndpoints(app: Hono) {

  // ============================================
  // CUSTOMER: AVAILABLE PROVIDERS (vendor-only)
  // ============================================

  /**
   * GET /customer/tele/available-providers
   * List vendors with published tele services, optionally filtered by role/category.
   */
  app.get('/customer/tele/available-providers', async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const category = c.req.query('category');
      const serviceId = c.req.query('serviceId');

      // ── Resolve role names ──
      let roleNames: string[] = [];

      if (roleId) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId);
        if (isUUID) {
          const roleResult = await query('SELECT name FROM roles WHERE id = $1::uuid', [roleId]);
          if (roleResult.rows.length > 0) roleNames = [roleResult.rows[0].name];
        } else {
          roleNames = CATEGORY_ROLES[roleId.toLowerCase()] || [roleId];
        }
      }

      if (category && roleNames.length === 0) {
        roleNames = CATEGORY_ROLES[category.toLowerCase()] || [];
      }

      // If still empty after category/roleId resolution, default to vet
      if (roleNames.length === 0 && !roleId && !category) {
        roleNames = VET_ROLE_NAMES;
      }

      // ── Build query ──
      const params: any[] = [];
      let paramIdx = 1;

      let roleFilter = '';
      if (roleNames.length > 0) {
        roleFilter = ` AND LOWER(r.name) = ANY(SELECT LOWER(unnest($${paramIdx}::text[])))`;
        params.push(roleNames);
        paramIdx++;
      }

      let serviceFilter = '';
      if (serviceId) {
        const isServiceUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
        if (isServiceUUID) {
          // serviceId could be vs.id (PK) or vs.service_id (FK to service catalog) — match either
          serviceFilter = ` AND (vs.id = $${paramIdx}::uuid OR vs.service_id = $${paramIdx}::uuid)`;
        } else {
          serviceFilter = ` AND (vs.service_name ILIKE $${paramIdx} OR vs.service_name ILIKE '%' || $${paramIdx} || '%')`;
        }
        params.push(serviceId);
        paramIdx++;
      }

      const vendorQuery = `
        SELECT DISTINCT ON (v.id)
          v.id                              AS vendor_id,
          COALESCE(v.business_name, v.owner_name, 'Provider') AS vendor_name,
          v.owner_name,
          v.phone,
          v.city,
          v.address,
          v.profile_photo_url,
          r.name                            AS role_name,
          r.display_name                    AS role_display_name,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) AS avg_rating,
          COALESCE((SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id), 0)    AS review_count,
          COALESCE((SELECT COUNT(*) FROM tele_queue WHERE vendor_id = v.id AND status = 'waiting'), 0) AS queue_count
        FROM vendors v
        LEFT JOIN vendor_identity vi ON vi.vendor_id = v.id
        LEFT JOIN roles r ON r.id = COALESCE(vi.selected_role_id, v.role_id)
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE v.is_active = true
          AND (v.status IN ('approved','active') OR (v.status = 'pending' AND v.vendor_type = 'solo'))
          AND vs.service_style = 'tele'
          AND vs.is_enabled = true
          AND COALESCE(vs.publish_status, 'published') IN ('published','auto_published')
          ${roleFilter}
          ${serviceFilter}
        ORDER BY v.id, queue_count ASC
      `;

      console.log('[available-providers] query params:', { roleNames, serviceId, params });

      const result = await query(vendorQuery, params).catch((err) => {
        console.error('[available-providers] query error:', err);
        return { rows: [] };
      });

      console.log('[available-providers] found', (result as any).rows?.length || 0, 'vendors');

      // Fetch tele services per vendor
      const providers = await Promise.all(
        result.rows.map(async (v: any) => {
          let services: any[] = [];
          try {
            const svcRes = await query(`
              SELECT vs.id, vs.service_name AS name, vs.price, vs.duration_minutes AS duration
              FROM vendor_services vs
              WHERE vs.vendor_id = $1
                AND vs.service_style = 'tele'
                AND vs.is_enabled = true
                AND COALESCE(vs.publish_status, 'published') IN ('published','auto_published')
            `, [v.vendor_id]);
            services = svcRes.rows.map((s: any) => ({
              id: s.id,
              name: s.name,
              price: Number(s.price) || 0, // ✅ Convert to number
              duration: Number(s.duration) || 30, // ✅ Convert to number
            }));
          } catch (e) {
            console.error('[available-providers] service fetch error:', e);
          }

          // Get photo from onboarding docs if profile_photo_url is null
          let photo = v.profile_photo_url;
          if (!photo) {
            try {
              const photoRes = await query(`
                SELECT doc->>'url' AS url
                FROM vendor_onboarding_applications voa,
                     jsonb_array_elements(voa.uploaded_documents) AS doc
                WHERE voa.vendor_identity_id = (
                  SELECT id FROM vendor_identity WHERE vendor_id = $1 LIMIT 1
                )
                AND doc->>'type' = 'profilePhoto'
                LIMIT 1
              `, [v.vendor_id]);
              if (photoRes.rows.length > 0) photo = photoRes.rows[0].url;
            } catch (_) { /* ignore */ }
          }

          return {
            providerId: v.vendor_id,
            vendorId: v.vendor_id,
            providerType: 'vendor' as const,
            name: v.vendor_name,
            photo,
            role: v.role_display_name || v.role_name || 'Provider',
            businessName: v.vendor_name,
            rating: v.avg_rating ? parseFloat(v.avg_rating).toFixed(1) : null,
            reviewCount: parseInt(v.review_count) || 0,
            queueCount: parseInt(v.queue_count) || 0,
            estimatedWaitMinutes: (parseInt(v.queue_count) || 0) * 10,
            services,
            isAvailable: true,
            isSoloProvider: true,
          };
        })
      );

      return c.json({
        success: true,
        providers,
        total: providers.length,
      });
    } catch (error: any) {
      console.error('[available-providers] error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // CUSTOMER: QUEUE OPERATIONS
  // ============================================

  /**
   * POST /customer/tele/join-queue
   * Customer joins instant tele consultation queue for a vendor.
   * Body: { customerId, vendorId, petId, serviceId, symptoms?, urgency?, notes? }
   */
  app.post('/customer/tele/join-queue', async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        vendorId,
        petId,
        serviceId,
        symptoms,
        urgency = 'normal',
        notes,
      } = body;

      if (!customerId || !vendorId || !serviceId) {
        return c.json({
          error: 'customerId, vendorId, and serviceId are required',
        }, 400);
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(vendorId)) {
        return c.json({ error: 'Invalid vendorId format. Expected UUID.', received: vendorId }, 400);
      }

      console.log('[TELE-QUEUE] Join queue request:', { vendorId, customerId, petId, serviceId });

      // ── Resolve serviceId to platform service_id (FK to services table) ──
      // tele_queue.service_id must reference services.id, not vendor_services.id
      let resolvedServiceId = serviceId;
      if (!uuidRegex.test(serviceId)) {
        // If not a UUID, find first tele service for this vendor
        const serviceResolve = await query(`
          SELECT service_id FROM vendor_services
          WHERE vendor_id = $1 AND service_style = 'tele' AND is_enabled = true
            AND COALESCE(publish_status, 'published') IN ('published', 'auto_published')
          LIMIT 1
        `, [vendorId]);

        if (serviceResolve.rows.length > 0) {
          resolvedServiceId = serviceResolve.rows[0].service_id; // ✅ Use service_id (FK to services)
        } else {
          return c.json({ error: `Service not found: ${serviceId}` }, 404);
        }
      } else {
        // If serviceId is a UUID, check if it's vendor_services.id or vendor_services.service_id
        // Always resolve to vendor_services.service_id (platform service catalog ID)
        const serviceResolve = await query(`
          SELECT service_id FROM vendor_services
          WHERE vendor_id = $1
            AND (id = $2::uuid OR service_id = $2::uuid)
            AND service_style = 'tele'
            AND is_enabled = true
            AND COALESCE(publish_status, 'published') IN ('published', 'auto_published')
          LIMIT 1
        `, [vendorId, serviceId]);

        if (serviceResolve.rows.length > 0) {
          resolvedServiceId = serviceResolve.rows[0].service_id; // ✅ Always use service_id (FK to services)
        } else {
          // If not found in vendor_services, check if it's already a services.id
          const servicesCheck = await query(`
            SELECT id FROM services WHERE id = $1::uuid
          `, [serviceId]);

          if (servicesCheck.rows.length > 0) {
            resolvedServiceId = serviceId; // Already a valid services.id
          } else {
            return c.json({ error: `Service not found: ${serviceId}` }, 404);
          }
        }
      }

      // Verify vendor is active with tele services
      const vendorCheck = await query(`
        SELECT v.id FROM vendors v
        WHERE v.id = $1 AND v.is_active = true
          AND (v.status IN ('approved','active') OR (v.status = 'pending' AND v.vendor_type = 'solo'))
          AND EXISTS (
            SELECT 1 FROM vendor_services vs
            WHERE vs.vendor_id = v.id AND vs.service_style = 'tele'
              AND vs.is_enabled = true
              AND COALESCE(vs.publish_status, 'published') IN ('published', 'auto_published')
          )
      `, [vendorId]);

      if (vendorCheck.rows.length === 0) {
        return c.json({
          error: 'Provider is not currently available for instant consultations',
          providerOffline: true,
        }, 400);
      }

      // Check if customer already in queue for this vendor
      const existingQueue = await query(`
        SELECT id, position, status FROM tele_queue
        WHERE customer_id = $1 AND vendor_id = $2 AND status = 'waiting'
      `, [customerId, vendorId]);

      if (existingQueue.rows.length > 0) {
        return c.json({
          success: true,
          alreadyInQueue: true,
          queueEntry: {
            id: existingQueue.rows[0].id,
            position: existingQueue.rows[0].position,
            status: existingQueue.rows[0].status,
          },
          message: 'You are already in queue for this provider',
        });
      }

      // Check for stale accepted entries with completed/old bookings and expire them
      const staleAcceptedQueue = await query(`
        SELECT tq.id, tq.booking_id, b.status AS booking_status, b.payment_status, b.created_at AS booking_created_at
        FROM tele_queue tq
        LEFT JOIN bookings b ON tq.booking_id = b.id
        WHERE tq.customer_id = $1 
          AND tq.vendor_id = $2 
          AND tq.status = 'accepted'
          AND (
            b.status IN ('completed', 'cancelled') 
            OR b.id IS NULL 
            OR (b.status = 'confirmed' AND b.payment_status = 'paid' AND b.created_at < NOW() - INTERVAL '24 hours')
          )
      `, [customerId, vendorId]);

      if (staleAcceptedQueue.rows.length > 0) {
        const staleIds = staleAcceptedQueue.rows.map((r: any) => r.id);
        await query(`
          UPDATE tele_queue 
          SET status = 'expired', updated_at = NOW()
          WHERE id = ANY($1::uuid[])
        `, [staleIds]);
        console.log(`[join-queue] Expired ${staleIds.length} stale accepted queue entries for customer ${customerId}`);
      }

      // Get next position
      const posResult = await query(`
        SELECT COALESCE(MAX(position), 0) + 1 AS next_position
        FROM tele_queue
        WHERE vendor_id = $1 AND status = 'waiting'
      `, [vendorId]);
      const position = posResult.rows[0].next_position;

      if (position > MAX_QUEUE_SIZE) {
        return c.json({ error: 'Queue is full. Please try again later.', queueFull: true }, 400);
      }

      //Get service details
      const svcRes = await query(`
        SELECT price, duration_minutes, service_name
        FROM vendor_services
        WHERE vendor_id = $1 AND service_style = 'tele' AND is_enabled = true
          AND COALESCE(publish_status, 'published') IN ('published', 'auto_published')
        LIMIT 1
      `, [vendorId]);
      const serviceDetails = svcRes.rows[0] || {};

      //Calculate expiry
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + QUEUE_TIMEOUT_MINUTES);

      //Insert queue entry
      const queueEntry = await query(`
        INSERT INTO tele_queue (
          customer_id, staff_id, vendor_id, pet_id, service_id,
          position, status, symptoms, urgency, notes,
          price, service_name, duration_minutes,
          expires_at, created_at, updated_at
        ) VALUES (
          $1, NULL, $2, $3, $4, $5, 'waiting', $6, $7, $8,
          $9, $10, $11, $12, NOW(), NOW()
        )
        RETURNING *
      `, [
        customerId,
        vendorId,
        petId ?? null,
        resolvedServiceId,
        position,
        symptoms || null,
        urgency,
        notes || null,
        serviceDetails.price || 0,
        serviceDetails.service_name || 'Tele-Consultation',
        serviceDetails.duration_minutes || 30,
        expiresAt,
      ]);

      return c.json({
        success: true,
        queueEntry: {
          id: queueEntry.rows[0].id,
          position,
          status: 'waiting',
          expiresAt,
          estimatedWaitMinutes: position * 10,
        },
        service: {
          name: serviceDetails.service_name || 'Tele-Consultation',
          price: serviceDetails.price || 0,
          durationMinutes: serviceDetails.duration_minutes || 30,
        },
        vendorId,
        message: `You are #${position} in queue. Estimated wait: ${position * 10} minutes.`,
      });
    } catch (error: any) {
      console.error('[join-queue] error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /customer/tele/leave-queue/:queueId
   */
  app.delete('/customer/tele/leave-queue/:queueId', async (c) => {
    try {
      const { queueId } = c.req.param();
      await query(`
        UPDATE tele_queue SET status = 'cancelled', resolved_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status = 'waiting'
      `, [queueId]);
      return c.json({ success: true, message: 'You have left the queue' });
    } catch (error: any) {
      console.error('[leave-queue] error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/tele/queue-status/:queueId
   */
  app.get('/customer/tele/queue-status/:queueId', async (c) => {
    try {
      const { queueId } = c.req.param();

      //Fetche queue entry with vendor info
      const result = await query(`
        SELECT
          tq.*,
          COALESCE(v.owner_name, v.business_name, 'Provider') AS provider_name,
          v.profile_photo_url                                  AS provider_photo,
          v.phone                                              AS provider_phone,
          (
            SELECT COUNT(*) FROM tele_queue
            WHERE vendor_id = tq.vendor_id AND status = 'waiting' AND position < tq.position
          ) AS ahead_in_queue
        FROM tele_queue tq
        LEFT JOIN vendors v ON tq.vendor_id = v.id
        WHERE tq.id = $1
      `, [queueId]);

      if (result.rows.length === 0) {
        return c.json({ error: 'Queue entry not found' }, 404);
      }

      const teleQueueEntry = result.rows[0];

      // Expire if past due
      if (teleQueueEntry.status === 'waiting' && new Date(teleQueueEntry.expires_at) < new Date()) {
        await query(`UPDATE tele_queue SET status = 'expired', resolved_at = NOW(), updated_at = NOW() WHERE id = $1`, [queueId]);
        teleQueueEntry.status = 'expired';
      }

      // Resolve meetingId from tele_queue or video_call_sessions fallback
      let resolvedMeetingId = teleQueueEntry.meeting_id || null;
      let bookingStatus: string | null = null;
      let bookingPaymentStatus: string | null = null;

      if (teleQueueEntry.booking_id && teleQueueEntry.status === 'accepted') {
        try {
          const bookingRes = await query(
            `SELECT status, payment_status, created_at FROM bookings WHERE id = $1 LIMIT 1`,
            [teleQueueEntry.booking_id]
          );
          if (bookingRes.rows.length > 0) {
            bookingStatus = bookingRes.rows[0].status;
            bookingPaymentStatus = bookingRes.rows[0].payment_status;
            
            // Mark as expired if booking is completed, cancelled, or older than 24 hours
            const bookingCreatedAt = new Date(bookingRes.rows[0].created_at);
            const hoursSinceBooking = (Date.now() - bookingCreatedAt.getTime()) / (1000 * 60 * 60);
            
            if (bookingStatus === 'completed' || bookingStatus === 'cancelled' || hoursSinceBooking > 24) {
              await query(`
                UPDATE tele_queue 
                SET status = 'expired', updated_at = NOW() 
                WHERE id = $1
              `, [queueId]);
              teleQueueEntry.status = 'expired';
              bookingStatus = null;
              bookingPaymentStatus = null;
            }
          }
        } catch (e) { /* ignore */ }

        if (!resolvedMeetingId) {
          try {
            const vcsRes = await query(`SELECT meeting_id, id FROM video_call_sessions WHERE booking_id = $1 LIMIT 1`, [teleQueueEntry.booking_id]);
            if (vcsRes.rows.length > 0) {
              resolvedMeetingId = vcsRes.rows[0].meeting_id || vcsRes.rows[0].id;
            }
          } catch (e) { /* ignore */ }
        }
      }

      return c.json({
        success: true,
        queueEntry: {
          id: teleQueueEntry.id,
          position: teleQueueEntry.position,
          aheadInQueue: parseInt(teleQueueEntry.ahead_in_queue) || 0,
          status: teleQueueEntry.status,
          expiresAt: teleQueueEntry.expires_at,
          estimatedWaitMinutes: (parseInt(teleQueueEntry.ahead_in_queue) || 0) * 10,
          service: { name: teleQueueEntry.service_name, price: teleQueueEntry.price, durationMinutes: teleQueueEntry.duration_minutes },
          provider: { id: teleQueueEntry.vendor_id, type: 'vendor', name: teleQueueEntry.provider_name, photo: teleQueueEntry.provider_photo },
          staff: { id: teleQueueEntry.vendor_id, name: teleQueueEntry.provider_name, photo: teleQueueEntry.provider_photo },
          bookingId: teleQueueEntry.booking_id,
          meetingId: resolvedMeetingId,
          bookingStatus,         // 'pending_payment' | 'confirmed' | 'cancelled' | null
          bookingPaymentStatus,  // 'pending' | 'paid' | null
        },
      });
    } catch (error: any) {
      console.error('[queue-status] error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // VENDOR: QUEUE MANAGEMENT
  // ============================================

  /**
   * GET /vendor/:vendorId/tele-queue
   */
  app.get('/vendor/:vendorId/tele-queue', async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Expire old entries
      await query(`
        UPDATE tele_queue SET status = 'expired', resolved_at = NOW(), updated_at = NOW()
        WHERE vendor_id = $1 AND status = 'waiting' AND expires_at < NOW()
      `, [vendorId]);

      //get tele queue entries
      const result = await query(`
        SELECT
          tq.*,
          COALESCE(c.full_name, 'Customer') AS customer_name, 
          c.phone AS customer_phone, 
          c.profile_photo_url AS customer_photo,
          p.name AS pet_name, p.species AS pet_type, p.breed AS pet_breed, p.age_years AS pet_age
        FROM tele_queue tq
        INNER JOIN customers c ON tq.customer_id = c.id
        INNER JOIN pets p ON tq.pet_id = p.id
        WHERE tq.vendor_id = $1 AND tq.status = 'waiting'
        ORDER BY tq.urgency DESC, tq.position ASC
      `, [vendorId]);

      //map tele queue entries to response
      const queue = result.rows.map((q: any) => ({
        id: q.id,
        position: q.position,
        customer: { id: q.customer_id, name: q.customer_name, phone: q.customer_phone, photo: q.customer_photo },
        pet: { id: q.pet_id, name: q.pet_name, type: q.pet_type, breed: q.pet_breed, age: q.pet_age },
        service: { id: q.service_id, name: q.service_name, price: q.price, durationMinutes: q.duration_minutes },
        symptoms: q.symptoms,
        urgency: q.urgency,
        notes: q.notes,
        waitingSince: q.created_at,
        expiresAt: q.expires_at,
        timeInQueue: Math.floor((Date.now() - new Date(q.created_at).getTime()) / 60000),
      }));

      //return response
      return c.json({ success: true, queue, total: queue.length });
    } catch (error: any) {
      console.error('[vendor-tele-queue] error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/tele-queue/:queueId/accept
   * Vendor accepts customer – creates booking with status pending_payment.
   */
  app.post('/vendor/:vendorId/tele-queue/:queueId/accept', async (c) => {
    try {
      const { vendorId, queueId } = c.req.param();

      // find the queue entry by queueId and vendorId
      const queueResult = await query(`
        SELECT * FROM tele_queue WHERE id = $1 AND vendor_id = $2 AND status = 'waiting'
      `, [queueId, vendorId]);
      if (queueResult.rows.length === 0) {
        return c.json({ error: 'Queue entry not found or already processed' }, 404);
      }
      const queueEntry = queueResult.rows[0];

      // check if the queue entry has expired
      if (new Date(queueEntry.expires_at) < new Date()) {
        await query(`UPDATE tele_queue SET status = 'expired', resolved_at = NOW() WHERE id = $1`, [queueId]);
        return c.json({ error: 'Queue entry has expired' }, 400);
      }

      // Create booking pending_payment
      const bookingPrice = Number(queueEntry.price) || 0;
      const bookingResult = await query(`
        INSERT INTO bookings (
          customer_id, vendor_id, staff_id, service_id, pet_id,
          service_type, booking_date, booking_time,
          base_price, total_amount, status, payment_status, notes,
          created_at, updated_at
        ) VALUES (
          $1, $2, NULL, $3, $4,
          'tele', CURRENT_DATE, CURRENT_TIME,
          $5, $5, 'pending_payment', 'pending', $6,
          NOW(), NOW()
        )
        RETURNING *
      `, [
        queueEntry.customer_id,
        vendorId,
        queueEntry.service_id,
        queueEntry.pet_id,
        bookingPrice,
        queueEntry.symptoms || queueEntry.notes,
      ]);
      const booking = bookingResult.rows[0];

      // Create video call session FIRST (need meetingId for queue update)
      let meetingId: string | null = null;
      try {
        const meetingRes = await insert('video_call_sessions', {
          booking_id: booking.id,
          customer_id: queueEntry.customer_id,
          vendor_id: vendorId,
          staff_id: null,
          status: 'waiting',
          created_at: new Date().toISOString(),
        }).catch(() => []);
        if (meetingRes && meetingRes.length > 0) {
          meetingId = meetingRes[0].meeting_id || meetingRes[0].id;
        }
      } catch (e) {
        console.warn('[vendor-accept] video session creation failed:', e);
      }

      //Update queue with booking_id (and meeting_id if column exists)
      await query(`
        UPDATE tele_queue SET status = 'accepted', booking_id = $1, resolved_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [booking.id, queueId]);

      // Try to also store meeting_id on queue entry (column may not exist in all schemas)
      if (meetingId) {
        try {
          await query(`UPDATE tele_queue SET meeting_id = $1 WHERE id = $2`, [meetingId, queueId]);
        } catch (e) {
          console.warn('[vendor-accept] meeting_id column may not exist on tele_queue, skipping:', (e as any).message);
        }
      }

      // Shift remaining positions
      await query(`
        UPDATE tele_queue SET position = position - 1, updated_at = NOW()
        WHERE vendor_id = $1 AND status = 'waiting' AND position > $2
      `, [vendorId, queueEntry.position]);

      // Vendor name for notification
      const vendorResult = await select('vendors', { id: vendorId });
      const vendorName = vendorResult[0]?.business_name || vendorResult[0]?.owner_name || 'Provider';

      // Notify customer
      try {
        await insert('notifications', {
          recipient_id: queueEntry.customer_id,
          recipient_type: 'customer',
          type: 'tele_queue_accepted',
          title: 'Consultation Accepted!',
          message: `${vendorName} has accepted your consultation. Please complete payment to start the video call.`,
          data: JSON.stringify({
            booking_id: booking.id,
            meeting_id: meetingId,
            vendor_id: vendorId,
            vendor_name: vendorName,
            total_amount: booking.total_amount,
            action: 'complete_payment',
          }),
          is_read: false,
          requires_action: true,
          action_url: `/video/${booking.id}`,
          created_at: new Date(),
        });
      } catch (e) {
        console.warn('[vendor-accept] notification failed:', e);
      }

      return c.json({
        success: true,
        booking: {
          id: booking.id,
          customerId: booking.customer_id,
          petId: booking.pet_id,
          serviceId: booking.service_id,
          status: booking.status,
          totalAmount: booking.total_amount,
          meetingId,
        },
        meetingId,
        message: 'Customer accepted. Booking created with pending_payment. Customer must pay before call can start.',
      });
    } catch (error: any) {
      console.error('[vendor-accept] error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/tele-queue/:queueId/skip
   */
  app.post('/vendor/:vendorId/tele-queue/:queueId/skip', async (c) => {
    try {
      const { vendorId, queueId } = c.req.param();
      const body = await c.req.json();
      const { reason, removeFromQueue = false } = body;

      if (removeFromQueue) {
        await query(`
          UPDATE tele_queue SET status = 'skipped', skip_reason = $1, resolved_at = NOW(), updated_at = NOW()
          WHERE id = $2 AND vendor_id = $3
        `, [reason, queueId, vendorId]);
      } else {
        const maxPos = await query(`
          SELECT COALESCE(MAX(position), 0) + 1 AS next_position
          FROM tele_queue WHERE vendor_id = $1 AND status = 'waiting'
        `, [vendorId]);
        await query(`
          UPDATE tele_queue SET position = $1, updated_at = NOW()
          WHERE id = $2 AND vendor_id = $3
        `, [maxPos.rows[0].next_position, queueId, vendorId]);
      }

      return c.json({
        success: true,
        message: removeFromQueue ? 'Customer removed from queue' : 'Customer moved to end of queue',
      });
    } catch (error: any) {
      console.error('[vendor-skip] error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // REAL-TIME QUEUE UPDATES (SSE)
  // ============================================

  /**
   * GET /customer/tele/queue-stream/:queueId
   * SSE stream – customer receives position / acceptance updates.
   */
  app.get('/customer/tele/queue-stream/:queueId', async (c) => {
    const queueId = c.req.param('queueId');
    if (!queueId) return c.json({ error: 'Queue ID is required' }, 400);

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
      let isActive = true;
      let lastStatus = '';
      let lastPosition = -1;

      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
      let pollInterval: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        isActive = false;
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      };

      try {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'connected', message: 'Queue stream connected', timestamp: new Date().toISOString() }),
          event: 'connection',
        });
      } catch {
        cleanup();
        return;
      }

      heartbeatInterval = setInterval(async () => {
        if (!isActive) return;
        try {
          await stream.writeSSE({
            data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
            event: 'heartbeat',
          });
        } catch { isActive = false; }
      }, 30000);

      pollInterval = setInterval(async () => {
        if (!isActive) { cleanup(); return; }
        try {
          const result = await query(`
            SELECT
              tq.*,
              COALESCE(v.owner_name, v.business_name, 'Provider') AS vendor_name,
              (
                SELECT COUNT(*) FROM tele_queue
                WHERE vendor_id = tq.vendor_id AND status = 'waiting' AND position < tq.position
              ) AS ahead_in_queue
            FROM tele_queue tq
            LEFT JOIN vendors v ON tq.vendor_id = v.id
            WHERE tq.id = $1
          `, [queueId]);

          if (result.rows.length === 0) {
            await stream.writeSSE({
              data: JSON.stringify({ type: 'error', message: 'Queue entry not found' }),
              event: 'error',
            });
            isActive = false;
            return;
          }

          const q = result.rows[0];
          const currentPosition = parseInt(q.ahead_in_queue) + 1;

          // ✅ Resolve meetingId from tele_queue or video_call_sessions fallback
          let resolvedMeetingId = q.meeting_id || null;
          if (!resolvedMeetingId && q.booking_id && q.status === 'accepted') {
            try {
              const vcsRes = await query(`SELECT meeting_id, id FROM video_call_sessions WHERE booking_id = $1 LIMIT 1`, [q.booking_id]);
              if (vcsRes.rows.length > 0) {
                resolvedMeetingId = vcsRes.rows[0].meeting_id || vcsRes.rows[0].id;
              }
            } catch (e) { /* ignore */ }
          }

          if (q.status !== lastStatus || currentPosition !== lastPosition) {
            lastStatus = q.status;
            lastPosition = currentPosition;

            await stream.writeSSE({
              data: JSON.stringify({
                type: 'queue_update',
                queueEntry: {
                  id: q.id,
                  position: currentPosition,
                  aheadInQueue: parseInt(q.ahead_in_queue) || 0,
                  status: q.status,
                  expiresAt: q.expires_at,
                  estimatedWaitMinutes: (parseInt(q.ahead_in_queue) || 0) * 10,
                  bookingId: q.booking_id,
                  meetingId: resolvedMeetingId,
                  vendorName: q.vendor_name,
                },
                timestamp: new Date().toISOString(),
              }),
              event: 'queue_update',
            });

            if (q.status === 'accepted' && q.booking_id) {
              await stream.writeSSE({
                data: JSON.stringify({
                  type: 'accepted',
                  bookingId: q.booking_id,
                  meetingId: resolvedMeetingId,
                  message: 'Your consultation has been accepted!',
                  timestamp: new Date().toISOString(),
                }),
                event: 'accepted',
              });
              setTimeout(() => { isActive = false; }, 5000);
            }

            if (['expired', 'cancelled', 'skipped', 'provider_offline'].includes(q.status)) {
              await stream.writeSSE({
                data: JSON.stringify({
                  type: 'ended',
                  reason: q.status,
                  message: q.status === 'expired'
                    ? 'Queue entry expired. Please try again.'
                    : q.status === 'provider_offline'
                      ? 'Provider went offline. Please try another provider.'
                      : 'Queue entry ended.',
                  timestamp: new Date().toISOString(),
                }),
                event: 'ended',
              });
              isActive = false;
            }
          }
        } catch (error: any) {
          console.error('[customer-queue-stream] poll error:', error);
        }
      }, 2000);

      c.req.raw.signal?.addEventListener('abort', cleanup);
      stream.onAbort?.(() => cleanup());
    });
  });

  /**
   * GET /bookings/:bookingId/queue-position
   */
  app.get('/bookings/:bookingId/queue-position', async (c) => {
    try {
      const { bookingId } = c.req.param();

      const queueResult = await query(`
        SELECT
          tq.*,
          COALESCE(v.owner_name, v.business_name) AS vendor_name,
          (
            SELECT COUNT(*) FROM tele_queue
            WHERE vendor_id = tq.vendor_id AND status = 'waiting' AND position < tq.position
          ) AS ahead_in_queue
        FROM tele_queue tq
        LEFT JOIN vendors v ON tq.vendor_id = v.id
        WHERE tq.booking_id = $1 AND tq.status IN ('waiting', 'in_progress')
        ORDER BY tq.created_at DESC
        LIMIT 1
      `, [bookingId]);

      if (queueResult.rows.length === 0) {
        return c.json({ success: false, error: 'No active queue entry found', queuePosition: null, estimatedWaitTime: null }, 404);
      }

      const q = queueResult.rows[0];
      const position = parseInt(q.ahead_in_queue) + 1;

      return c.json({
        success: true,
        queuePosition: position,
        estimatedWaitTime: parseInt(q.ahead_in_queue) * 10,
        totalInQueue: position,
        status: q.status,
        vendorName: q.vendor_name,
        expiresAt: q.expires_at,
      });
    } catch (error: any) {
      console.error('[queue-position] error:', error);
      return c.json({ success: false, error: error.message, queuePosition: null, estimatedWaitTime: null }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/tele-queue-stream
   * SSE stream for vendor to see live queue changes.
   */
  app.get('/vendor/:vendorId/tele-queue-stream', async (c) => {
    const vendorId = c.req.param('vendorId');
    if (!vendorId) return c.json({ error: 'Vendor ID is required' }, 400);

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
      let isActive = true;
      let lastQueueHash = '';

      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
      let pollInterval: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        isActive = false;
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      };

      try {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'connected', message: 'Queue stream connected', timestamp: new Date().toISOString() }),
          event: 'connection',
        });
      } catch {
        cleanup();
        return;
      }

      heartbeatInterval = setInterval(async () => {
        if (!isActive) return;
        try {
          await stream.writeSSE({
            data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
            event: 'heartbeat',
          });
        } catch { isActive = false; }
      }, 30000);

      pollInterval = setInterval(async () => {
        if (!isActive) { cleanup(); return; }
        try {
          await query(`
            UPDATE tele_queue SET status = 'expired', resolved_at = NOW()
            WHERE vendor_id = $1 AND status = 'waiting' AND expires_at < NOW()
          `, [vendorId]);

          const result = await query(`
            SELECT tq.*, 
                   COALESCE(c.full_name, 'Customer') AS customer_name, 
                   c.phone AS customer_phone,
                   p.name AS pet_name, 
                   p.species AS pet_type
            FROM tele_queue tq
            INNER JOIN customers c ON tq.customer_id = c.id
            INNER JOIN pets p ON tq.pet_id = p.id
            WHERE tq.vendor_id = $1 AND tq.status = 'waiting'
            ORDER BY tq.urgency DESC, tq.position ASC
          `, [vendorId]);

          const queueHash = JSON.stringify(result.rows.map((r: any) => r.id));
          if (queueHash !== lastQueueHash) {
            lastQueueHash = queueHash;
            const queue = result.rows.map((q: any) => ({
              id: q.id,
              position: q.position,
              customer: { id: q.customer_id, name: q.customer_name, phone: q.customer_phone },
              pet: { id: q.pet_id, name: q.pet_name, type: q.pet_type },
              service: { name: q.service_name, price: q.price },
              symptoms: q.symptoms,
              urgency: q.urgency,
              waitingSince: q.created_at,
              timeInQueue: Math.floor((Date.now() - new Date(q.created_at).getTime()) / 60000),
            }));

            await stream.writeSSE({
              data: JSON.stringify({ type: 'queue_update', queue, total: queue.length, timestamp: new Date().toISOString() }),
              event: 'queue_update',
            });
          }
        } catch (error: any) {
          console.error('[vendor-queue-stream] poll error:', error);
        }
      }, 2000);

      c.req.raw.signal?.addEventListener('abort', cleanup);
      stream.onAbort?.(() => cleanup());
    });
  });

  console.log('✅ Instant Tele Queue endpoints registered (vendor-only)');
}
