/**
 * ============================================================================
 * BOOKING ENDPOINTS - LAMBDA VERSION (DEPRECATED)
 * ============================================================================
 * 
 * ⚠️ DEPRECATED: This handler is deprecated and not registered.
 * 
 * Use bookings-enhanced.ts instead, which is registered in handler/index.ts
 * 
 * This file is kept for reference only. Do not use or register this handler.
 * 
 * 
 * Endpoints (DEPRECATED - not registered):
 * - POST /bookings/create - Create new booking
 * - GET /bookings/:id - Get booking details
 * - PUT /bookings/:id/status - Update booking status
 * - GET /bookings/:id/history - Get booking status history
 * 
 * TEMPORAL AUDIT FIXES (2026-01-02):
 * - ✅ Idempotency key enforcement
 * - ✅ Booking date/time validation
 * - ✅ Transaction wrapping
 * - ✅ Audit logging
 * - ✅ Event timestamps in SNS messages
 * 
 * Date: 2025-01-28
 * Updated: 2026-01-02 (Temporal Audit Fixes)
 * Deprecated: 2026-01-28 (Replaced by bookings-enhanced.ts)
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { query, select, insert, update, withTransaction, getClient } from '../../../database/rds-connection';
import { withIdempotency, checkIdempotencyKey, storeIdempotencyKey } from '../../../utils/idempotency';
import { logAuditEntry, logBookingStatusChange } from '../../../utils/audit-log';
import { calculateStaffETA } from '../../../utils/commute-time-calculator';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_ADVANCE_BOOKING_DAYS = 60; // Maximum days in advance for booking
const MIN_NOTICE_HOURS = 1; // Minimum hours before booking time

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate booking date is not in the past and within allowed window
 */
function validateBookingDate(bookingDate: string, bookingTime: string): { valid: boolean; error?: string } {
  const now = new Date();
  
  // Parse booking datetime
  const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
  
  // Check if date parsing was successful
  if (isNaN(bookingDateTime.getTime())) {
    return { valid: false, error: 'Invalid booking date or time format' };
  }

  // Check if booking is in the past
  const minBookingTime = new Date(now.getTime() + MIN_NOTICE_HOURS * 60 * 60 * 1000);
  if (bookingDateTime < minBookingTime) {
    return { 
      valid: false, 
      error: `Booking must be at least ${MIN_NOTICE_HOURS} hour(s) in the future` 
    };
  }

  // Check if booking is too far in the future
  const maxBookingDate = new Date(now);
  maxBookingDate.setDate(maxBookingDate.getDate() + MAX_ADVANCE_BOOKING_DAYS);
  if (bookingDateTime > maxBookingDate) {
    return { 
      valid: false, 
      error: `Cannot book more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance` 
    };
  }

  // Validate time format (HH:MM or HH:MM:SS)
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  if (!timeRegex.test(bookingTime)) {
    return { valid: false, error: 'Invalid time format. Use HH:MM format' };
  }

  return { valid: true };
}

/**
 * Generate event timestamp for SNS messages
 */
function generateEventMetadata(requestId?: string) {
  return {
    eventTimestamp: new Date().toISOString(),
    eventId: randomUUID(),
    requestId: requestId || randomUUID(),
    sourceService: 'booking-handler',
  };
}

function extractAddressMeta(address: unknown, body: Record<string, any>) {
  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const num = parseFloat(String(value));
    return Number.isFinite(num) ? num : null;
  };

  let addressText: string | null = typeof address === 'string' ? address : null;
  let addressObj: Record<string, any> | null = null;

  if (address && typeof address === 'object') {
    addressObj = address as Record<string, any>;
  } else if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address);
      if (parsed && typeof parsed === 'object') {
        addressObj = parsed as Record<string, any>;
      }
    } catch {
      // keep addressText as-is
    }
  }

  const addressId =
    body.addressId ||
    body.address_id ||
    addressObj?.id ||
    addressObj?.addressId ||
    addressObj?.address_id ||
    null;

  let latitude = toNumber(body.deliveryLatitude ?? body.delivery_latitude ?? body.latitude ?? body.lat);
  let longitude = toNumber(body.deliveryLongitude ?? body.delivery_longitude ?? body.longitude ?? body.lng);

  if (latitude == null && addressObj) {
    latitude = toNumber(addressObj.latitude ?? addressObj.lat ?? addressObj.coordinates?.lat ?? addressObj.coordinates?.latitude);
  }
  if (longitude == null && addressObj) {
    longitude = toNumber(addressObj.longitude ?? addressObj.lng ?? addressObj.coordinates?.lng ?? addressObj.coordinates?.longitude);
  }

  if (!addressText && addressObj) {
    const parts = [
      addressObj.addressLine1 || addressObj.address || addressObj.full_address || addressObj.formattedAddress,
      addressObj.city,
      addressObj.state,
      addressObj.pincode,
    ].filter(Boolean);
    addressText = parts.length > 0 ? parts.join(', ') : null;
  }

  return { addressText, addressId, latitude, longitude };
}

// ============================================================================
// BOOKING HANDLERS
// ============================================================================

class CreateBookingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.event.requestContext?.requestId || randomUUID();
    const {
      customerId,
      vendorId,
      serviceId,
      staffId,
      bookingDate,
      bookingTime,
      serviceType,
      address,
      petId,
      amount,
      idempotencyKey, // Client-provided idempotency key
    } = body;
    const addressMeta = extractAddressMeta(address, body);

    // ✅ VALIDATION: Required fields
    this.validateRequired(body, ['customerId', 'vendorId', 'serviceId', 'bookingDate', 'bookingTime']);

    // ✅ TEMPORAL FIX: Check idempotency key first
    if (idempotencyKey) {
      const existing = await checkIdempotencyKey(idempotencyKey);
      if (existing.exists) {
        console.log(`[IDEMPOTENCY] Returning cached booking for key: ${idempotencyKey}`);
        return {
          statusCode: existing.httpStatus || 200,
          headers: { 'Content-Type': 'application/json', 'X-Idempotent-Replay': 'true' },
          body: JSON.stringify(existing.response),
        };
      }
    }

    // ✅ TEMPORAL FIX: Validate booking date/time
    const dateValidation = validateBookingDate(bookingDate, bookingTime);
    if (!dateValidation.valid) {
      return this.error(dateValidation.error!, 400);
    }

    // ✅ Validate vendor service exists and get duration
    // bookings.service_id now references vendor_services.id (works for both catalog and custom services)
    let serviceDuration = 30; // Default duration
    const vendorServices = await select('vendor_services', { id: serviceId });
    if (vendorServices.length > 0) {
      serviceDuration = vendorServices[0].duration_minutes || vendorServices[0].custom_duration || 30;
    } else {
      return this.error('Vendor service not found', 404);
    }

    // ✅ TEMPORAL FIX: Use transaction for atomicity
    try {
      const result = await withTransaction(async (client) => {
        // ✅ FIX: Check overlap using ONLY service duration (no buffer blocking)
        // Buffer is informational (travel/prep/setup) and should NOT block adjacent slots
        // Convert booking time to minutes
        const [bookingHour, bookingMin] = bookingTime.split(':').map(Number);
        const newBookingStartMinutes = bookingHour * 60 + bookingMin;
        const newBookingEndMinutes = newBookingStartMinutes + serviceDuration;  // ✅ NO buffer

        // Fetch existing bookings for overlap check
        const overlapQuery = staffId
          ? `SELECT id, booking_time, COALESCE(duration_minutes, 30) as duration_minutes
             FROM bookings 
             WHERE vendor_id = $1 
             AND booking_date = $2 
             AND staff_id = $4
             AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
             FOR UPDATE`
          : `SELECT id, booking_time, COALESCE(duration_minutes, 30) as duration_minutes
             FROM bookings 
             WHERE vendor_id = $1 
             AND booking_date = $2 
             AND staff_id IS NULL
             AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
             FOR UPDATE`;

        const overlapParams = staffId
          ? [vendorId, bookingDate, staffId]
          : [vendorId, bookingDate];

        const { rows: existingBookings } = await client.query(overlapQuery, overlapParams);

        // ✅ ATOMIC SLOT OVERLAP CHECK: Each slot is independent (30 min)
        // A booking blocks ONLY the slot it starts at, regardless of service duration
        // Booking at 09:00 blocks ONLY 09:00. Slot 09:30 remains available.
        // This applies to ALL service types and ALL roles.
        const SLOT_SIZE = 30;
        const hasOverlap = existingBookings.some((existing: any) => {
          const [existingHour, existingMin] = existing.booking_time.split(':').map(Number);
          const existingStartMinutes = existingHour * 60 + existingMin;
          const existingEndMinutes = existingStartMinutes + SLOT_SIZE;  // ✅ ATOMIC: one slot per booking
          const newEnd = newBookingStartMinutes + SLOT_SIZE;
          
          // Overlap formula: (newStart < existingEnd) AND (newEnd > existingStart)
          return newBookingStartMinutes < existingEndMinutes && newEnd > existingStartMinutes;
        });

        if (hasOverlap) {
          throw new Error('SLOT_CONFLICT');
        }

        // Create booking (using existing schema columns only)
        const bookingData: Record<string, any> = {
          customer_id: customerId,
          vendor_id: vendorId,
          service_id: serviceId,
          booking_date: bookingDate,
          booking_time: bookingTime,
          service_type: serviceType || 'at_vendor',
          address: addressMeta.addressText || address || null,
          base_price: amount || 0,
          total_amount: amount || 0,
          status: 'pending',
          payment_status: 'pending',
          notes: petId ? `Pet ID: ${petId}` : null, // Store pet reference in notes
          // Note: idempotency_key handled via separate table, not stored in bookings
        };

        if (addressMeta.addressId) {
          bookingData.address_id = addressMeta.addressId;
        }
        if (addressMeta.latitude != null && addressMeta.longitude != null) {
          bookingData.delivery_latitude = addressMeta.latitude;
          bookingData.delivery_longitude = addressMeta.longitude;
          // Backward compatibility for older fields
          bookingData.latitude = addressMeta.latitude;
          bookingData.longitude = addressMeta.longitude;
        }

        if (staffId) {
          bookingData.staff_id = staffId;
          
          // Calculate commute time for home services if address has coordinates
          if (serviceType === 'at_home' || serviceType === 'home') {
            try {
              const addressObj = typeof address === 'string' ? JSON.parse(address) : address;
              if (addressObj?.latitude && addressObj?.longitude && staffId) {
                const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
                const customerLocation = {
                  latitude: parseFloat(addressObj.latitude),
                  longitude: parseFloat(addressObj.longitude),
                };

                // Get buffer time from vendor settings (default 5 minutes)
                let bufferMinutes = 5;
                try {
                  const vendorSettings = await query(`
                    SELECT buffer_time_minutes, service_style_buffer_times
                    FROM vendor_settings
                    WHERE vendor_id = $1
                  `, [vendorId]);
                  
                  if (vendorSettings.rows.length > 0) {
                    const settings = vendorSettings.rows[0];
                    // Check service-style specific buffer, fallback to general buffer
                    if (settings.service_style_buffer_times && typeof settings.service_style_buffer_times === 'object') {
                      bufferMinutes = settings.service_style_buffer_times[serviceType] || settings.buffer_time_minutes || 5;
                    } else {
                      bufferMinutes = settings.buffer_time_minutes || 5;
                    }
                  }
                } catch (error) {
                  console.warn('Error fetching buffer time, using default:', error);
                }

                const commuteResult = await calculateStaffETA(
                  staffId,
                  customerLocation,
                  bookingDateTime,
                  {
                    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
                    bufferMinutes, // Dynamic buffer from vendor settings
                  }
                );

                // Store commute time in notes (or add to booking metadata if column exists)
                const commuteInfo = `Commute: ${commuteResult.durationMinutes}min, Distance: ${commuteResult.distanceKm}km`;
                bookingData.notes = bookingData.notes 
                  ? `${bookingData.notes} | ${commuteInfo}`
                  : commuteInfo;

                // If estimated_arrival column exists, store it
                if (commuteResult.estimatedArrival) {
                  bookingData.estimated_arrival = commuteResult.estimatedArrival;
                }
              }
            } catch (error) {
              // Log but don't fail booking creation if commute calculation fails
              console.warn('Failed to calculate commute time for booking:', error);
            }
          }
        }

        // Use client.query within transaction
        const columns = Object.keys(bookingData);
        const values = Object.values(bookingData);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        const insertResult = await client.query(
          `INSERT INTO bookings (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
          values
        );

        return insertResult.rows[0];
      });

      const booking = result;

      // ✅ TEMPORAL FIX: Log audit entry
      await logAuditEntry({
        entityType: 'booking',
        entityId: booking.id,
        action: 'create',
        newValues: {
          status: booking.status,
          customerId,
          vendorId,
          serviceId,
          bookingDate,
          bookingTime,
        },
        actorId: customerId,
        actorType: 'customer',
        requestId,
      });

      // ✅ TEMPORAL FIX: Log initial status
      await logBookingStatusChange(
        booking.id,
        null,
        'pending',
        customerId,      // changedById
        'customer',      // changedByType
        'Booking created' // changeReason
      );

      // ✅ TEMPORAL FIX: Publish event with timestamps
      try {
        // ✅ Trigger webhooks
        try {
          const { triggerWebhook } = await import('../../webhooks');
          await triggerWebhook('booking.created', {
            bookingId: booking.id,
            customerId: booking.customer_id,
            vendorId: booking.vendor_id,
            serviceId: booking.service_id,
            bookingDate: booking.booking_date,
            bookingTime: booking.booking_time,
            status: booking.booking_status,
            amount: booking.total_amount,
          });
        } catch (error) {
          console.error('Failed to trigger webhooks:', error);
        }

        const { publishBookingCreated } = await import('../../../utils/sns-client');
        await publishBookingCreated({
          bookingId: booking.id,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id,
          serviceType: booking.service_type,
          status: booking.status,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          ...generateEventMetadata(requestId),
        });
      } catch (error) {
        console.error('Failed to publish booking created event:', error);
      }

      const response = {
        bookingId: booking.id,
        status: booking.status,
        message: 'Booking created successfully',
        isNew: true,
      };

      // ✅ TEMPORAL FIX: Store idempotency key
      if (idempotencyKey) {
        await storeIdempotencyKey(idempotencyKey, 'booking', booking.id, response, 200);
      }

      return this.success(response);

    } catch (error: any) {
      if (error.message === 'SLOT_CONFLICT' || error.code === '55P03') {
        return this.error(
          'This time slot is already booked. Please select a different time.',
          409
        );
      }
      throw error;
    }
  }
}

class GetBookingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    const bookings = await select('bookings', { id: bookingId });
    
    if (bookings.length === 0) {
      return this.error('Booking not found', 404);
    }

    return this.success(bookings[0]);
  }
}

class GetBookingHistoryHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    // Get booking
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404);
    }

    // Get status history (check if table exists)
    let history: any[] = [];
    try {
      const tableCheck = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'booking_status_history'
        )`
      );
      
      if (tableCheck.rows[0]?.exists) {
        const result = await query(
          `SELECT * FROM booking_status_history 
           WHERE booking_id = $1 
           ORDER BY created_at ASC`,
          [bookingId]
        );
        history = result.rows;
      } else {
        // Table doesn't exist, return empty history
        console.warn('[Booking History] booking_status_history table does not exist');
      }
    } catch (error: any) {
      // If query fails, return empty history
      console.warn('[Booking History] Error querying status history:', error.message);
      history = [];
    }

    return this.success({
      booking: bookings[0],
      statusHistory: history,
    });
  }
}

class UpdateBookingStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const body = this.parseBody(context.event);
    const requestId = context.event.requestContext?.requestId || randomUUID();
    const { status, reason, actorId, actorType } = body;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    if (!status) {
      return this.error('Status is required', 400);
    }

    const validStatuses = [
      'pending', 
      'confirmed', 
      'in_progress', 
      'completed', 
      'cancelled',
      'no_show',
      'rescheduled'
    ];
    
    if (!validStatuses.includes(status)) {
      return this.error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    // Get current booking
    const existingBookings = await select('bookings', { id: bookingId });
    if (existingBookings.length === 0) {
      return this.error('Booking not found', 404);
    }

    const currentBooking = existingBookings[0];
    const oldStatus = currentBooking.status;

    // Prevent duplicate status update
    if (oldStatus === status) {
      return this.success({
        bookingId,
        oldStatus,
        newStatus: status,
        message: 'Status unchanged',
        isNew: false,
      });
    }

    // Validate state transitions
    const invalidTransitions: Record<string, string[]> = {
      'completed': ['pending', 'confirmed', 'in_progress'],
      'cancelled': ['pending', 'confirmed', 'in_progress', 'completed'],
      'no_show': ['pending', 'confirmed', 'in_progress', 'completed'],
    };

    if (invalidTransitions[oldStatus]?.includes(status)) {
      return this.error(
        `Invalid status transition: Cannot change from '${oldStatus}' to '${status}'`,
        400
      );
    }

    // ✅ TEMPORAL FIX: Use transaction for atomicity
    await withTransaction(async (client) => {
      // Build update data with server-generated timestamps
      const updateData: Record<string, any> = { 
        status, 
        updated_at: new Date() 
      };

      if (status === 'completed') {
        updateData.completed_at = new Date();
      } else if (status === 'cancelled') {
        updateData.cancelled_at = new Date();
      }

      // Update booking
      const setClauses = Object.keys(updateData).map((key, i) => `${key} = $${i + 1}`);
      const values = [...Object.values(updateData), bookingId];

      await client.query(
        `UPDATE bookings SET ${setClauses.join(', ')} WHERE id = $${values.length}`,
        values
      );
    });

    // ✅ TEMPORAL FIX: Log status change to history
    await logBookingStatusChange(
      bookingId,
      oldStatus,
      status,
      actorId,                    // changedById
      actorType || 'system',      // changedByType
      reason                      // changeReason
    );

    // ✅ TEMPORAL FIX: Log audit entry
    await logAuditEntry({
      entityType: 'booking',
      entityId: bookingId,
      action: 'status_change',
      oldValues: { status: oldStatus, reason },
      newValues: { status },
      changedFields: ['status'],
      actorId,
      actorType: actorType || 'system',
      requestId,
    });

    // ✅ TEMPORAL FIX: Publish event with timestamps
    try {
      const { publishBookingStatusUpdated } = await import('../../../utils/sns-client');
      await publishBookingStatusUpdated({
        bookingId,
        customerId: currentBooking.customer_id,
        vendorId: currentBooking.vendor_id,
        oldStatus,
        newStatus: status,
        reason,
        ...generateEventMetadata(requestId),
      });
    } catch (error) {
      console.error('Failed to publish booking status updated event:', error);
    }

    return this.success({ 
      bookingId,
      oldStatus,
      newStatus: status,
      message: 'Booking status updated successfully',
      isNew: true,
    });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerBookingEndpoints(app: Hono) {
  const createHandler = new CreateBookingHandler();
  const getHandler = new GetBookingHandler();
  const updateHandler = new UpdateBookingStatusHandler();
  const historyHandler = new GetBookingHistoryHandler();

  app.post('/bookings/create', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await createHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/bookings/:bookingId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await getHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/bookings/:bookingId/history', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await historyHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/bookings/:bookingId/status', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await updateHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'booking-handler',
    functionVersion: '$LATEST',
  };
}
