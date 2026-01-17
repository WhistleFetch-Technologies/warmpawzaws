/**
 * ============================================================================
 * INSTANT TELE QUEUE ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles instant tele consultation queue for real-time video consultations:
 * - Provider "Available Now" toggle
 * - Customer queue joining
 * - Queue management (accept, skip, timeout)
 * - Real-time status updates via SSE
 * 
 * Business Rules:
 * - Only verified staff/individual providers can go "Available Now"
 * - Customers join a queue and wait for provider to accept
 * - Queue entries expire after configurable timeout (default 5 min)
 * - Provider can accept next in queue or skip
 * 
 * Date: 2026-01-17
 * ============================================================================
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { query, insert, update, select } from '../database/rds-connection';

// Queue configuration
const QUEUE_TIMEOUT_MINUTES = 5;
const MAX_QUEUE_SIZE = 20;

export function registerInstantTeleQueueEndpoints(app: Hono) {
  
  // ============================================
  // PROVIDER AVAILABILITY MANAGEMENT
  // ============================================

  /**
   * PUT /staff/:staffId/tele-availability
   * Toggle staff "Available Now" status for tele consultations
   */
  app.put("/staff/:staffId/tele-availability", async (c) => {
    try {
      const { staffId } = c.req.param();
      const body = await c.req.json();
      const { isAvailable, serviceIds } = body;

      if (isAvailable === undefined) {
        return c.json({ error: 'isAvailable is required' }, 400);
      }

      // Verify staff exists and is verified
      const staffResult = await select('staff', { id: staffId, is_active: true });
      if (staffResult.length === 0) {
        return c.json({ error: 'Staff not found or inactive' }, 404);
      }

      const staff = staffResult[0];
      
      if (!staff.mobile_verified) {
        return c.json({ 
          error: 'Mobile verification required to go live for instant tele consultations',
          requiresVerification: true 
        }, 400);
      }

      // Check if staff has tele services enabled
      const teleServicesCheck = await query(`
        SELECT ss.id, s.name as service_name, s.id as service_id
        FROM staff_services ss
        INNER JOIN services s ON ss.service_id = s.id
        WHERE ss.staff_id = $1 
          AND ss.enabled_by_staff = true 
          AND ss.is_active = true
          AND 'tele' = ANY(ss.service_styles)
      `, [staffId]);

      if (teleServicesCheck.rows.length === 0) {
        return c.json({ 
          error: 'No tele services enabled. Please enable tele services first.',
          noTeleServices: true 
        }, 400);
      }

      // Update or create availability record
      const existingAvailability = await query(`
        SELECT id FROM staff_tele_availability WHERE staff_id = $1
      `, [staffId]);

      if (existingAvailability.rows.length > 0) {
        await query(`
          UPDATE staff_tele_availability SET
            is_available = $1,
            available_services = $2,
            last_status_change = NOW(),
            updated_at = NOW()
          WHERE staff_id = $3
        `, [isAvailable, serviceIds || null, staffId]);
      } else {
        await query(`
          INSERT INTO staff_tele_availability (
            staff_id, is_available, available_services, last_status_change, created_at, updated_at
          ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())
        `, [staffId, isAvailable, serviceIds || null]);
      }

      // If going offline, clear their queue entries
      if (!isAvailable) {
        await query(`
          UPDATE tele_queue SET
            status = 'provider_offline',
            resolved_at = NOW(),
            updated_at = NOW()
          WHERE staff_id = $1 AND status = 'waiting'
        `, [staffId]);
      }

      // Get available services for response
      const availableServices = teleServicesCheck.rows.map((s: any) => ({
        id: s.service_id,
        name: s.service_name,
      }));

      return c.json({
        success: true,
        isAvailable,
        availableServices,
        message: isAvailable 
          ? 'You are now available for instant tele consultations'
          : 'You are now offline for instant tele consultations',
      });
    } catch (error: any) {
      console.error('Error updating tele availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /staff/:staffId/tele-availability
   * Get staff tele availability status
   */
  app.get("/staff/:staffId/tele-availability", async (c) => {
    try {
      const { staffId } = c.req.param();

      const result = await query(`
        SELECT 
          sta.is_available,
          sta.available_services,
          sta.last_status_change,
          s.name as staff_name,
          s.mobile_verified,
          (SELECT COUNT(*) FROM tele_queue WHERE staff_id = $1 AND status = 'waiting') as queue_count
        FROM staff_tele_availability sta
        INNER JOIN staff s ON sta.staff_id = s.id
        WHERE sta.staff_id = $1
      `, [staffId]);

      if (result.rows.length === 0) {
        // Check if staff exists
        const staffCheck = await select('staff', { id: staffId });
        if (staffCheck.length === 0) {
          return c.json({ error: 'Staff not found' }, 404);
        }
        
        return c.json({
          success: true,
          isAvailable: false,
          queueCount: 0,
          mobileVerified: staffCheck[0].mobile_verified,
        });
      }

      const availability = result.rows[0];
      
      return c.json({
        success: true,
        isAvailable: availability.is_available,
        availableServices: availability.available_services,
        lastStatusChange: availability.last_status_change,
        queueCount: parseInt(availability.queue_count) || 0,
        mobileVerified: availability.mobile_verified,
      });
    } catch (error: any) {
      console.error('Error fetching tele availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // CUSTOMER QUEUE OPERATIONS
  // ============================================

  /**
   * GET /customer/tele/available-providers
   * Get list of providers currently available for instant tele consultation
   */
  app.get("/customer/tele/available-providers", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const category = c.req.query('category');
      const serviceId = c.req.query('serviceId');

      let queryText = `
        SELECT DISTINCT
          s.id as staff_id,
          s.name,
          s.photo,
          s.role,
          s.experience_years,
          s.qualifications,
          COALESCE(v.business_name, s.name) as business_name,
          v.id as vendor_id,
          sta.last_status_change,
          sta.available_services,
          (SELECT AVG(rating) FROM reviews WHERE staff_id = s.id) as avg_rating,
          (SELECT COUNT(*) FROM reviews WHERE staff_id = s.id) as review_count,
          (SELECT COUNT(*) FROM tele_queue WHERE staff_id = s.id AND status = 'waiting') as queue_count,
          (
            SELECT json_agg(json_build_object(
              'id', ss.service_id,
              'name', srv.name,
              'price', COALESCE(ss.price, srv.base_price),
              'duration', COALESCE(ss.duration_minutes, srv.duration_minutes)
            ))
            FROM staff_services ss
            INNER JOIN services srv ON ss.service_id = srv.id
            WHERE ss.staff_id = s.id 
              AND ss.enabled_by_staff = true 
              AND ss.is_active = true
              AND 'tele' = ANY(ss.service_styles)
          ) as services
        FROM staff s
        INNER JOIN staff_tele_availability sta ON sta.staff_id = s.id
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE s.is_active = true
          AND s.mobile_verified = true
          AND sta.is_available = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by role
      if (roleId) {
        const roleResult = await query('SELECT name FROM roles WHERE id = $1 OR name = $1', [roleId]);
        if (roleResult.rows.length > 0) {
          queryText += ` AND s.role = $${paramIndex}`;
          params.push(roleResult.rows[0].name);
          paramIndex++;
        }
      }

      // Filter by category
      if (category) {
        const categoryRoles: Record<string, string[]> = {
          'vet': ['Veterinarian', 'veterinarian', 'vet'],
          'grooming': ['Groomer', 'groomer'],
          'training': ['Trainer', 'trainer'],
        };
        const roles = categoryRoles[category.toLowerCase()];
        if (roles) {
          queryText += ` AND s.role = ANY($${paramIndex})`;
          params.push(roles);
          paramIndex++;
        }
      }

      // Filter by specific service
      if (serviceId) {
        queryText += ` AND EXISTS (
          SELECT 1 FROM staff_services ss 
          WHERE ss.staff_id = s.id 
            AND ss.service_id = $${paramIndex}
            AND ss.enabled_by_staff = true
            AND 'tele' = ANY(ss.service_styles)
        )`;
        params.push(serviceId);
        paramIndex++;
      }

      queryText += ` ORDER BY queue_count ASC, avg_rating DESC NULLS LAST`;

      const result = await query(queryText, params);

      const providers = result.rows.map((p: any) => ({
        staffId: p.staff_id,
        name: p.name,
        photo: p.photo,
        role: p.role,
        experienceYears: p.experience_years,
        qualifications: p.qualifications,
        businessName: p.business_name,
        vendorId: p.vendor_id,
        rating: p.avg_rating ? parseFloat(p.avg_rating).toFixed(1) : null,
        reviewCount: parseInt(p.review_count) || 0,
        queueCount: parseInt(p.queue_count) || 0,
        estimatedWaitMinutes: (parseInt(p.queue_count) || 0) * 10, // Rough estimate: 10 min per person
        services: p.services || [],
        isAvailable: true,
        lastOnline: p.last_status_change,
      }));

      return c.json({
        success: true,
        providers,
        total: providers.length,
      });
    } catch (error: any) {
      console.error('Error fetching available providers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/tele/join-queue
   * Customer joins instant tele consultation queue
   */
  app.post("/customer/tele/join-queue", async (c) => {
    try {
      const body = await c.req.json();
      const { 
        customerId, 
        staffId, 
        petId, 
        serviceId,
        symptoms,
        urgency = 'normal', // normal, urgent
        notes 
      } = body;

      if (!customerId || !staffId || !petId || !serviceId) {
        return c.json({ 
          error: 'customerId, staffId, petId, and serviceId are required' 
        }, 400);
      }

      // Verify provider is available
      const availabilityCheck = await query(`
        SELECT is_available FROM staff_tele_availability 
        WHERE staff_id = $1 AND is_available = true
      `, [staffId]);

      if (availabilityCheck.rows.length === 0) {
        return c.json({ 
          error: 'Provider is not currently available for instant consultations',
          providerOffline: true 
        }, 400);
      }

      // Check if customer already has active queue entry for this provider
      const existingQueue = await query(`
        SELECT id, position, status FROM tele_queue 
        WHERE customer_id = $1 AND staff_id = $2 AND status = 'waiting'
      `, [customerId, staffId]);

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

      // Get current queue position
      const queuePositionResult = await query(`
        SELECT COALESCE(MAX(position), 0) + 1 as next_position
        FROM tele_queue
        WHERE staff_id = $1 AND status = 'waiting'
      `, [staffId]);

      const position = queuePositionResult.rows[0].next_position;

      // Check queue size limit
      if (position > MAX_QUEUE_SIZE) {
        return c.json({ 
          error: 'Queue is full. Please try again later.',
          queueFull: true 
        }, 400);
      }

      // Get service details
      const serviceResult = await query(`
        SELECT 
          ss.price, 
          ss.duration_minutes,
          s.name as service_name
        FROM staff_services ss
        INNER JOIN services s ON ss.service_id = s.id
        WHERE ss.staff_id = $1 AND ss.service_id = $2
      `, [staffId, serviceId]);

      const serviceDetails = serviceResult.rows[0] || {};

      // Calculate expiry time
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + QUEUE_TIMEOUT_MINUTES);

      // Create queue entry
      const queueEntry = await query(`
        INSERT INTO tele_queue (
          customer_id, staff_id, pet_id, service_id,
          position, status, symptoms, urgency, notes,
          price, service_name, duration_minutes,
          expires_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'waiting', $6, $7, $8,
          $9, $10, $11, $12, NOW(), NOW()
        )
        RETURNING *
      `, [
        customerId, staffId, petId, serviceId,
        position, symptoms, urgency, notes,
        serviceDetails.price, serviceDetails.service_name, serviceDetails.duration_minutes,
        expiresAt
      ]);

      // Get customer and pet info for notification
      const customerResult = await select('customers', { id: customerId });
      const petResult = await select('pets', { id: petId });

      return c.json({
        success: true,
        queueEntry: {
          id: queueEntry.rows[0].id,
          position,
          status: 'waiting',
          expiresAt,
          estimatedWaitMinutes: position * 10, // Rough estimate
        },
        service: {
          name: serviceDetails.service_name,
          price: serviceDetails.price,
          durationMinutes: serviceDetails.duration_minutes,
        },
        message: `You are #${position} in queue. Estimated wait: ${position * 10} minutes.`,
      });
    } catch (error: any) {
      console.error('Error joining tele queue:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /customer/tele/leave-queue/:queueId
   * Customer leaves the queue
   */
  app.delete("/customer/tele/leave-queue/:queueId", async (c) => {
    try {
      const { queueId } = c.req.param();

      await query(`
        UPDATE tele_queue SET
          status = 'cancelled',
          resolved_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND status = 'waiting'
      `, [queueId]);

      return c.json({
        success: true,
        message: 'You have left the queue',
      });
    } catch (error: any) {
      console.error('Error leaving queue:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/tele/queue-status/:queueId
   * Get customer's queue status
   */
  app.get("/customer/tele/queue-status/:queueId", async (c) => {
    try {
      const { queueId } = c.req.param();

      const result = await query(`
        SELECT 
          tq.*,
          s.name as staff_name,
          s.photo as staff_photo,
          s.phone as staff_phone,
          (
            SELECT COUNT(*) FROM tele_queue 
            WHERE staff_id = tq.staff_id 
              AND status = 'waiting' 
              AND position < tq.position
          ) as ahead_in_queue
        FROM tele_queue tq
        INNER JOIN staff s ON tq.staff_id = s.id
        WHERE tq.id = $1
      `, [queueId]);

      if (result.rows.length === 0) {
        return c.json({ error: 'Queue entry not found' }, 404);
      }

      const queueEntry = result.rows[0];

      // Check if expired
      if (queueEntry.status === 'waiting' && new Date(queueEntry.expires_at) < new Date()) {
        await query(`
          UPDATE tele_queue SET status = 'expired', resolved_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [queueId]);
        queueEntry.status = 'expired';
      }

      return c.json({
        success: true,
        queueEntry: {
          id: queueEntry.id,
          position: queueEntry.position,
          aheadInQueue: parseInt(queueEntry.ahead_in_queue) || 0,
          status: queueEntry.status,
          expiresAt: queueEntry.expires_at,
          estimatedWaitMinutes: (parseInt(queueEntry.ahead_in_queue) || 0) * 10,
          service: {
            name: queueEntry.service_name,
            price: queueEntry.price,
            durationMinutes: queueEntry.duration_minutes,
          },
          staff: {
            id: queueEntry.staff_id,
            name: queueEntry.staff_name,
            photo: queueEntry.staff_photo,
          },
          bookingId: queueEntry.booking_id, // Set when accepted
          meetingId: queueEntry.meeting_id, // Set when call starts
        },
      });
    } catch (error: any) {
      console.error('Error fetching queue status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // PROVIDER QUEUE MANAGEMENT
  // ============================================

  /**
   * GET /staff/:staffId/tele-queue
   * Get provider's current queue
   */
  app.get("/staff/:staffId/tele-queue", async (c) => {
    try {
      const { staffId } = c.req.param();

      const result = await query(`
        SELECT 
          tq.*,
          c.name as customer_name,
          c.phone as customer_phone,
          c.photo_url as customer_photo,
          p.name as pet_name,
          p.type as pet_type,
          p.breed as pet_breed,
          p.age_years as pet_age
        FROM tele_queue tq
        INNER JOIN customers c ON tq.customer_id = c.id
        INNER JOIN pets p ON tq.pet_id = p.id
        WHERE tq.staff_id = $1 AND tq.status = 'waiting'
        ORDER BY tq.urgency DESC, tq.position ASC
      `, [staffId]);

      // Clean up expired entries
      await query(`
        UPDATE tele_queue SET 
          status = 'expired', 
          resolved_at = NOW(), 
          updated_at = NOW()
        WHERE staff_id = $1 
          AND status = 'waiting' 
          AND expires_at < NOW()
      `, [staffId]);

      const queue = result.rows
        .filter((q: any) => new Date(q.expires_at) >= new Date())
        .map((q: any) => ({
          id: q.id,
          position: q.position,
          customer: {
            id: q.customer_id,
            name: q.customer_name,
            phone: q.customer_phone,
            photo: q.customer_photo,
          },
          pet: {
            id: q.pet_id,
            name: q.pet_name,
            type: q.pet_type,
            breed: q.pet_breed,
            age: q.pet_age,
          },
          service: {
            id: q.service_id,
            name: q.service_name,
            price: q.price,
            durationMinutes: q.duration_minutes,
          },
          symptoms: q.symptoms,
          urgency: q.urgency,
          notes: q.notes,
          waitingSince: q.created_at,
          expiresAt: q.expires_at,
          timeInQueue: Math.floor((Date.now() - new Date(q.created_at).getTime()) / 60000), // minutes
        }));

      return c.json({
        success: true,
        queue,
        total: queue.length,
      });
    } catch (error: any) {
      console.error('Error fetching staff queue:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /staff/:staffId/tele-queue/:queueId/accept
   * Accept customer from queue and create booking
   */
  app.post("/staff/:staffId/tele-queue/:queueId/accept", async (c) => {
    try {
      const { staffId, queueId } = c.req.param();

      // Get queue entry
      const queueResult = await query(`
        SELECT * FROM tele_queue WHERE id = $1 AND staff_id = $2 AND status = 'waiting'
      `, [queueId, staffId]);

      if (queueResult.rows.length === 0) {
        return c.json({ error: 'Queue entry not found or already processed' }, 404);
      }

      const queueEntry = queueResult.rows[0];

      // Check if expired
      if (new Date(queueEntry.expires_at) < new Date()) {
        await query(`
          UPDATE tele_queue SET status = 'expired', resolved_at = NOW() WHERE id = $1
        `, [queueId]);
        return c.json({ error: 'Queue entry has expired' }, 400);
      }

      // Get staff vendor_id
      const staffResult = await select('staff', { id: staffId });
      const vendorId = staffResult[0]?.vendor_id;

      // Create instant booking
      const bookingResult = await query(`
        INSERT INTO bookings (
          customer_id, vendor_id, staff_id, service_id, pet_id,
          service_type, booking_date, booking_time,
          total_amount, status, notes, is_instant_tele,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          'tele', CURRENT_DATE, CURRENT_TIME,
          $6, 'confirmed', $7, true,
          NOW(), NOW()
        )
        RETURNING *
      `, [
        queueEntry.customer_id,
        vendorId,
        staffId,
        queueEntry.service_id,
        queueEntry.pet_id,
        queueEntry.price || 0,
        queueEntry.symptoms || queueEntry.notes
      ]);

      const booking = bookingResult.rows[0];

      // Update queue entry
      await query(`
        UPDATE tele_queue SET
          status = 'accepted',
          booking_id = $1,
          resolved_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [booking.id, queueId]);

      // Update positions for remaining queue
      await query(`
        UPDATE tele_queue SET
          position = position - 1,
          updated_at = NOW()
        WHERE staff_id = $1 
          AND status = 'waiting' 
          AND position > $2
      `, [staffId, queueEntry.position]);

      return c.json({
        success: true,
        booking: {
          id: booking.id,
          customerId: booking.customer_id,
          petId: booking.pet_id,
          serviceId: booking.service_id,
          status: booking.status,
          totalAmount: booking.total_amount,
        },
        message: 'Customer accepted. Booking created. Ready to start video call.',
      });
    } catch (error: any) {
      console.error('Error accepting queue entry:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /staff/:staffId/tele-queue/:queueId/skip
   * Skip customer in queue (move to end or remove)
   */
  app.post("/staff/:staffId/tele-queue/:queueId/skip", async (c) => {
    try {
      const { staffId, queueId } = c.req.param();
      const body = await c.req.json();
      const { reason, removeFromQueue = false } = body;

      if (removeFromQueue) {
        // Remove from queue entirely
        await query(`
          UPDATE tele_queue SET
            status = 'skipped',
            skip_reason = $1,
            resolved_at = NOW(),
            updated_at = NOW()
          WHERE id = $2 AND staff_id = $3
        `, [reason, queueId, staffId]);
      } else {
        // Move to end of queue
        const maxPositionResult = await query(`
          SELECT COALESCE(MAX(position), 0) + 1 as next_position
          FROM tele_queue
          WHERE staff_id = $1 AND status = 'waiting'
        `, [staffId]);

        await query(`
          UPDATE tele_queue SET
            position = $1,
            updated_at = NOW()
          WHERE id = $2 AND staff_id = $3
        `, [maxPositionResult.rows[0].next_position, queueId, staffId]);
      }

      return c.json({
        success: true,
        message: removeFromQueue ? 'Customer removed from queue' : 'Customer moved to end of queue',
      });
    } catch (error: any) {
      console.error('Error skipping queue entry:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // REAL-TIME QUEUE UPDATES (SSE)
  // ============================================

  /**
   * GET /customer/tele/queue-stream/:queueId
   * SSE stream for customer to get real-time queue updates
   */
  app.get("/customer/tele/queue-stream/:queueId", async (c) => {
    const queueId = c.req.param('queueId');

    if (!queueId) {
      return c.json({ error: 'Queue ID is required' }, 400);
    }

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
      let isActive = true;
      let lastStatus = '';
      let lastPosition = -1;

      // Send initial connection
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'connected',
          message: 'Queue stream connected',
          timestamp: new Date().toISOString(),
        }),
        event: 'connection',
      });

      // Heartbeat
      const heartbeatInterval = setInterval(async () => {
        if (isActive) {
          try {
            await stream.writeSSE({
              data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
              event: 'heartbeat',
            });
          } catch {
            isActive = false;
          }
        }
      }, 30000);

      // Poll for updates
      const pollInterval = setInterval(async () => {
        if (!isActive) {
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          return;
        }

        try {
          const result = await query(`
            SELECT 
              tq.*,
              s.name as staff_name,
              (
                SELECT COUNT(*) FROM tele_queue 
                WHERE staff_id = tq.staff_id 
                  AND status = 'waiting' 
                  AND position < tq.position
              ) as ahead_in_queue
            FROM tele_queue tq
            INNER JOIN staff s ON tq.staff_id = s.id
            WHERE tq.id = $1
          `, [queueId]);

          if (result.rows.length === 0) {
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'error',
                message: 'Queue entry not found',
                timestamp: new Date().toISOString(),
              }),
              event: 'error',
            });
            isActive = false;
            return;
          }

          const queueEntry = result.rows[0];
          const currentPosition = parseInt(queueEntry.ahead_in_queue) + 1;

          // Check for changes
          if (queueEntry.status !== lastStatus || currentPosition !== lastPosition) {
            lastStatus = queueEntry.status;
            lastPosition = currentPosition;

            // Send update
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'queue_update',
                queueEntry: {
                  id: queueEntry.id,
                  position: currentPosition,
                  aheadInQueue: parseInt(queueEntry.ahead_in_queue) || 0,
                  status: queueEntry.status,
                  expiresAt: queueEntry.expires_at,
                  estimatedWaitMinutes: (parseInt(queueEntry.ahead_in_queue) || 0) * 10,
                  bookingId: queueEntry.booking_id,
                  meetingId: queueEntry.meeting_id,
                  staffName: queueEntry.staff_name,
                },
                timestamp: new Date().toISOString(),
              }),
              event: 'queue_update',
            });

            // If accepted, send special notification
            if (queueEntry.status === 'accepted' && queueEntry.booking_id) {
              await stream.writeSSE({
                data: JSON.stringify({
                  type: 'accepted',
                  bookingId: queueEntry.booking_id,
                  message: 'Your consultation has been accepted! Preparing video call...',
                  timestamp: new Date().toISOString(),
                }),
                event: 'accepted',
              });
              
              // Keep connection for a bit to ensure client receives, then close
              setTimeout(() => { isActive = false; }, 5000);
            }

            // If expired or cancelled
            if (['expired', 'cancelled', 'skipped', 'provider_offline'].includes(queueEntry.status)) {
              await stream.writeSSE({
                data: JSON.stringify({
                  type: 'ended',
                  reason: queueEntry.status,
                  message: queueEntry.status === 'expired' 
                    ? 'Queue entry expired. Please try again.'
                    : queueEntry.status === 'provider_offline'
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
          console.error('Error in queue stream:', error);
        }
      }, 2000); // Poll every 2 seconds

      c.req.raw.signal?.addEventListener('abort', () => {
        isActive = false;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
      });
    });
  });

  /**
   * GET /staff/:staffId/tele-queue-stream
   * SSE stream for provider to get real-time queue updates
   */
  app.get("/staff/:staffId/tele-queue-stream", async (c) => {
    const staffId = c.req.param('staffId');

    if (!staffId) {
      return c.json({ error: 'Staff ID is required' }, 400);
    }

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
      let isActive = true;
      let lastQueueHash = '';

      await stream.writeSSE({
        data: JSON.stringify({
          type: 'connected',
          message: 'Queue stream connected',
          timestamp: new Date().toISOString(),
        }),
        event: 'connection',
      });

      const heartbeatInterval = setInterval(async () => {
        if (isActive) {
          try {
            await stream.writeSSE({
              data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
              event: 'heartbeat',
            });
          } catch {
            isActive = false;
          }
        }
      }, 30000);

      const pollInterval = setInterval(async () => {
        if (!isActive) {
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          return;
        }

        try {
          // Clean expired entries
          await query(`
            UPDATE tele_queue SET status = 'expired', resolved_at = NOW()
            WHERE staff_id = $1 AND status = 'waiting' AND expires_at < NOW()
          `, [staffId]);

          const result = await query(`
            SELECT 
              tq.*,
              c.name as customer_name,
              c.phone as customer_phone,
              p.name as pet_name,
              p.type as pet_type
            FROM tele_queue tq
            INNER JOIN customers c ON tq.customer_id = c.id
            INNER JOIN pets p ON tq.pet_id = p.id
            WHERE tq.staff_id = $1 AND tq.status = 'waiting'
            ORDER BY tq.urgency DESC, tq.position ASC
          `, [staffId]);

          const queueHash = JSON.stringify(result.rows.map((r: any) => r.id));

          if (queueHash !== lastQueueHash) {
            lastQueueHash = queueHash;

            const queue = result.rows.map((q: any) => ({
              id: q.id,
              position: q.position,
              customer: {
                id: q.customer_id,
                name: q.customer_name,
                phone: q.customer_phone,
              },
              pet: {
                id: q.pet_id,
                name: q.pet_name,
                type: q.pet_type,
              },
              service: {
                name: q.service_name,
                price: q.price,
              },
              symptoms: q.symptoms,
              urgency: q.urgency,
              waitingSince: q.created_at,
              timeInQueue: Math.floor((Date.now() - new Date(q.created_at).getTime()) / 60000),
            }));

            await stream.writeSSE({
              data: JSON.stringify({
                type: 'queue_update',
                queue,
                total: queue.length,
                timestamp: new Date().toISOString(),
              }),
              event: 'queue_update',
            });
          }
        } catch (error: any) {
          console.error('Error in staff queue stream:', error);
        }
      }, 2000);

      c.req.raw.signal?.addEventListener('abort', () => {
        isActive = false;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
      });
    });
  });

  console.log('✅ Instant Tele Queue endpoints registered');
}
