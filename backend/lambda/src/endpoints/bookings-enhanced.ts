/**
 * ============================================================================
 * BOOKING ENDPOINTS - ENHANCED VERSION (PHASE 3)
 * ============================================================================
 * 
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 * 
 * Endpoints:
 * - POST /bookings/create - Create new booking
 * - GET /bookings/:id - Get booking details
 * - PUT /bookings/:id/status - Update booking status
 * - GET /bookings/:id/history - Get booking status history
 * - POST /bookings/:id/cancel - Cancel booking
 * - POST /bookings/:id/reschedule - Reschedule booking
 * 
 * Date: 2026-01-28
 * Phase: 3
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../handler/base-handler-enhanced';
import { query, select, withTransaction } from '../database/rds-connection';
import { checkIdempotencyKey, storeIdempotencyKey } from '../utils/idempotency';
import { logAuditEntry, logBookingStatusChange } from '../utils/audit-log';
import { calculateStaffETA } from '../utils/commute-time-calculator';
import {
  CreateBookingRequestSchema,
  UpdateBookingStatusRequestSchema,
} from '@warmpawz/api-contracts/bookings';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_ADVANCE_BOOKING_DAYS = 60;
const MIN_NOTICE_HOURS = 1;

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

function validateBookingDate(bookingDate: string, bookingTime: string): { valid: boolean; error?: string } {
  const now = new Date();
  const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
  
  if (isNaN(bookingDateTime.getTime())) {
    return { valid: false, error: 'Invalid booking date or time format' };
  }

  const minBookingTime = new Date(now.getTime() + MIN_NOTICE_HOURS * 60 * 60 * 1000);
  if (bookingDateTime < minBookingTime) {
    return { 
      valid: false, 
      error: `Booking must be at least ${MIN_NOTICE_HOURS} hour(s) in the future` 
    };
  }

  const maxBookingDate = new Date(now);
  maxBookingDate.setDate(maxBookingDate.getDate() + MAX_ADVANCE_BOOKING_DAYS);
  if (bookingDateTime > maxBookingDate) {
    return { 
      valid: false, 
      error: `Cannot book more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance` 
    };
  }

  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  if (!timeRegex.test(bookingTime)) {
    return { valid: false, error: 'Invalid time format. Use HH:MM format' };
  }

  return { valid: true };
}

function generateEventMetadata(requestId?: string) {
  return {
    eventTimestamp: new Date().toISOString(),
    eventId: crypto.randomUUID(),
    requestId: requestId || crypto.randomUUID(),
    sourceService: 'booking-handler',
  };
}

// ============================================================================
// BOOKING HANDLERS
// ============================================================================

class CreateBookingHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    // Validate request with Zod schema
    const validationResult = CreateBookingRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

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
      idempotencyKey,
    } = validationResult.data;

    // Check idempotency key first
    if (idempotencyKey) {
      const existing = await checkIdempotencyKey(idempotencyKey);
      if (existing.exists) {
        return {
          statusCode: existing.httpStatus || 200,
          headers: { 'X-Idempotent-Replay': 'true' },
          body: existing.response,
        };
      }
    }

    // Validate booking date/time
    const dateValidation = validateBookingDate(bookingDate, bookingTime);
    if (!dateValidation.valid) {
      return this.error(dateValidation.error!, 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // Validate service exists
    const services = await select('services', { id: serviceId });
    if (services.length === 0) {
      const vendorServices = await select('vendor_services', { id: serviceId });
      if (vendorServices.length === 0) {
        return this.error('Service not found', 404, 'NOT_FOUND', undefined, requestId);
      }
    }

    try {
      const result = await withTransaction(async (client) => {
        // Slot collision prevention with row-level locking
        const lockQuery = staffId
          ? `SELECT id FROM bookings 
             WHERE vendor_id = $1 AND booking_date = $2 AND booking_time = $3 AND staff_id = $4
             AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
             FOR UPDATE NOWAIT`
          : `SELECT id FROM bookings 
             WHERE vendor_id = $1 AND booking_date = $2 AND booking_time = $3 AND staff_id IS NULL
             AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
             FOR UPDATE NOWAIT`;

        const lockParams = staffId
          ? [vendorId, bookingDate, bookingTime, staffId]
          : [vendorId, bookingDate, bookingTime];

        const { rows: conflictingBookings } = await client.query(lockQuery, lockParams);

        if (conflictingBookings.length > 0) {
          throw new Error('SLOT_CONFLICT');
        }

        // Create booking
        const bookingData: Record<string, any> = {
          customer_id: customerId,
          vendor_id: vendorId,
          service_id: serviceId,
          booking_date: bookingDate,
          booking_time: bookingTime,
          service_type: serviceType || 'at_vendor',
          address: address,
          base_price: amount || 0,
          total_amount: amount || 0,
          status: 'pending',
          payment_status: 'pending',
          notes: petId ? `Pet ID: ${petId}` : null,
        };

        if (staffId) {
          bookingData.staff_id = staffId;
          
          // Calculate commute time for home services
          if (serviceType === 'at_home') {
            try {
              const addressObj = typeof address === 'string' ? JSON.parse(address) : address;
              if (addressObj?.latitude && addressObj?.longitude && staffId) {
                const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
                const customerLocation = {
                  latitude: parseFloat(addressObj.latitude),
                  longitude: parseFloat(addressObj.longitude),
                };

                const commuteResult = await calculateStaffETA(
                  staffId,
                  customerLocation,
                  bookingDateTime,
                  {
                    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
                    bufferMinutes: 5,
                  }
                );

                const commuteInfo = `Commute: ${commuteResult.durationMinutes}min, Distance: ${commuteResult.distanceKm}km`;
                bookingData.notes = bookingData.notes 
                  ? `${bookingData.notes} | ${commuteInfo}`
                  : commuteInfo;

                if (commuteResult.estimatedArrival) {
                  bookingData.estimated_arrival = commuteResult.estimatedArrival;
                }
              }
            } catch (error) {
              console.warn('Failed to calculate commute time for booking:', error);
            }
          }
        }

        // Insert booking
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

      // Log audit entry
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

      // Log initial status
      await logBookingStatusChange(
        booking.id,
        null,
        'pending',
        customerId,
        'customer',
        'Booking created'
      );

      // Publish event
      try {
        const { publishBookingCreated } = await import('../utils/sns-client');
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

      // Store idempotency key
      if (idempotencyKey) {
        await storeIdempotencyKey(idempotencyKey, 'booking', booking.id, JSON.stringify(response), 200);
      }

      return this.success(response, requestId);

    } catch (error: any) {
      if (error.message === 'SLOT_CONFLICT' || error.code === '55P03') {
        return this.error(
          'This time slot is already booked. Please select a different time.',
          409,
          'SLOT_CONFLICT',
          undefined,
          requestId
        );
      }
      throw error;
    }
  }
}

class GetBookingHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const bookings = await select('bookings', { id: bookingId });
    
    if (bookings.length === 0) {
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
    }

    return this.success({ booking: bookings[0] }, requestId);
  }
}

class GetBookingHistoryHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
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
      history,
    }, requestId);
  }
}

class UpdateBookingStatusHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // Validate request with Zod schema
    const validationResult = UpdateBookingStatusRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    const { status, reason } = validationResult.data;
    const actorId = context.userId || body.actorId;
    const actorType = context.userRole || body.actorType || 'system';

    // Get current booking
    const existingBookings = await select('bookings', { id: bookingId });
    if (existingBookings.length === 0) {
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
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
      }, requestId);
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
        400,
        'VALIDATION_ERROR',
        undefined,
        requestId
      );
    }

    // Update booking
    await withTransaction(async (client) => {
      const updateData: Record<string, any> = { 
        status, 
        updated_at: new Date() 
      };

      if (status === 'completed') {
        updateData.completed_at = new Date();
      } else if (status === 'cancelled') {
        updateData.cancelled_at = new Date();
        if (reason) {
          updateData.cancellation_reason = reason;
        }
      }

      const setClauses = Object.keys(updateData).map((key, i) => `${key} = $${i + 1}`);
      const values = [...Object.values(updateData), bookingId];

      await client.query(
        `UPDATE bookings SET ${setClauses.join(', ')} WHERE id = $${values.length}`,
        values
      );
    });

    // Log status change
    await logBookingStatusChange(
      bookingId,
      oldStatus,
      status,
      actorId,
      actorType,
      reason
    );

    // Log audit entry
    await logAuditEntry({
      entityType: 'booking',
      entityId: bookingId,
      action: 'status_change',
      oldValues: { status: oldStatus, reason },
      newValues: { status },
      changedFields: ['status'],
      actorId,
      actorType,
      requestId,
    });

    // Publish event
    try {
      const { publishBookingStatusUpdated } = await import('../utils/sns-client');
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
    }, requestId);
  }
}

class GetRefundPreviewHandler extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId } = body;
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('bookingId is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      // Get booking details
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const booking = bookings[0];

      // Calculate hours until booking
      let hoursUntilBooking = 0;
      if (booking.booking_datetime) {
        const bookingDateTime = new Date(booking.booking_datetime);
        hoursUntilBooking = Math.max(0, (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60));
      } else if (booking.booking_date && booking.booking_time) {
        const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
        hoursUntilBooking = Math.max(0, (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60));
      }

      // Get refund rules
      const rulesResult = await query(
        `SELECT * FROM booking_cancellation_rules
         WHERE (vendor_id = $1 OR vendor_id IS NULL)
           AND (service_id = $2 OR service_id IS NULL)
         ORDER BY vendor_id DESC NULLS LAST, service_id DESC NULLS LAST
         LIMIT 1`,
        [booking.vendor_id || null, booking.service_id || null]
      );

      const rule = rulesResult.rows.length > 0 ? rulesResult.rows[0] : null;
      const fullRefundHours = rule?.full_refund_before_hours || 48;
      const partialRefundHours = rule?.partial_refund_before_hours || 24;
      const partialRefundPercentage = parseFloat(rule?.partial_refund_percentage || '50');
      const cutoffHours = rule?.cancellation_cutoff_hours || 12;

      // Calculate refund percentage
      let refundPercentage = 0;
      let cancellationFee = 0;
      if (hoursUntilBooking >= fullRefundHours) {
        refundPercentage = 100;
      } else if (hoursUntilBooking >= partialRefundHours) {
        refundPercentage = partialRefundPercentage;
      } else if (hoursUntilBooking >= cutoffHours) {
        refundPercentage = partialRefundPercentage;
      } else {
        refundPercentage = 0;
        cancellationFee = parseFloat(booking.total_amount || '0') * 0.1; // 10% cancellation fee
      }

      const totalAmount = parseFloat(booking.total_amount || '0');
      const refundAmount = Math.max(0, (totalAmount * refundPercentage) / 100 - cancellationFee);

      return this.success({
        refund: {
          eligible: refundPercentage > 0,
          refundAmount: Math.round(refundAmount * 100) / 100,
          refundPercentage: Math.round(refundPercentage),
          hoursUntil: Math.round(hoursUntilBooking),
          cancellationFee: Math.round(cancellationFee * 100) / 100,
          message: refundPercentage > 0
            ? `₹${Math.round(refundAmount * 100) / 100} will be refunded to your original payment method`
            : 'No refund available for this booking',
          policy: {
            fullRefundBeforeHours: fullRefundHours,
            partialRefundBeforeHours: partialRefundHours,
            partialRefundPercentage: partialRefundPercentage,
            cancellationCutoffHours: cutoffHours,
          },
        },
      }, requestId);
    } catch (error: any) {
      console.error('Error calculating refund preview:', error);
      return this.error(
        error.message || 'Failed to calculate refund preview',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

class CancelBookingHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const reason = body.reason || body.cancellationReason || 'Customer cancellation';
    const actorId = context.userId || body.customerId || body.actorId;
    const actorType = context.userRole || body.actorType || 'customer';

    // Get current booking
    const existingBookings = await select('bookings', { id: bookingId });
    if (existingBookings.length === 0) {
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
    }

    const currentBooking = existingBookings[0];
    const oldStatus = currentBooking.status;

    // Validate that booking can be cancelled
    const cancellableStatuses = ['pending', 'confirmed'];
    if (!cancellableStatuses.includes(oldStatus)) {
      return this.error(
        `Booking cannot be cancelled. Current status: ${oldStatus}`,
        400,
        'VALIDATION_ERROR',
        { currentStatus: oldStatus, allowedStatuses: cancellableStatuses },
        requestId
      );
    }

    // Check if booking is in the past
    const bookingDateTime = new Date(`${currentBooking.booking_date}T${currentBooking.booking_time}`);
    const now = new Date();
    if (bookingDateTime < now) {
      return this.error(
        'Cannot cancel past bookings',
        400,
        'VALIDATION_ERROR',
        undefined,
        requestId
      );
    }

    try {
      // Update booking status to cancelled
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE bookings 
           SET status = 'cancelled', 
               cancelled_at = NOW(), 
               cancellation_reason = $1,
               updated_at = NOW() 
           WHERE id = $2`,
          [reason, bookingId]
        );
      });

      // Log status change
      await logBookingStatusChange(
        bookingId,
        oldStatus,
        'cancelled',
        actorId,
        actorType,
        reason
      );

      // Log audit entry
      await logAuditEntry({
        entityType: 'booking',
        entityId: bookingId,
        action: 'cancel',
        oldValues: { status: oldStatus },
        newValues: { status: 'cancelled', reason },
        changedFields: ['status', 'cancelled_at', 'cancellation_reason'],
        actorId,
        actorType,
        requestId,
      });

      // Process refund if payment was made
      let refundInfo = null;
      if (currentBooking.payment_status === 'paid' && currentBooking.total_amount > 0) {
        try {
          // Get payment for refund
          const payments = await query(
            `SELECT id FROM payments WHERE booking_id = $1 AND payment_status = 'completed' LIMIT 1`,
            [bookingId]
          );

          if (payments.rows.length > 0) {
            const paymentId = payments.rows[0].id;
            
            // Create refund request (refunds table uses refund_status, not status)
            const refundRequests = await query(
              `INSERT INTO refunds (
                payment_id,
                booking_id, 
                customer_id, 
                vendor_id,
                refund_amount,
                refund_reason, 
                refund_status,
                requested_at
              ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW()) 
              RETURNING *`,
              [
                paymentId,
                bookingId,
                currentBooking.customer_id,
                currentBooking.vendor_id || null,
                currentBooking.total_amount,
                `Booking cancellation: ${reason}`
              ]
            );
            refundInfo = {
              refundId: refundRequests.rows[0]?.id,
              amount: currentBooking.total_amount,
              status: 'pending'
            };
          }
        } catch (error) {
          console.error('Error creating refund request:', error);
          // Don't fail cancellation if refund processing fails
        }
      }

      // Publish event
      try {
        const { publishBookingStatusUpdated } = await import('../utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: currentBooking.customer_id,
          vendorId: currentBooking.vendor_id,
          oldStatus,
          newStatus: 'cancelled',
          reason,
          ...generateEventMetadata(requestId),
        });
      } catch (error) {
        console.error('Failed to publish booking cancelled event:', error);
      }

      return this.success({
        bookingId,
        message: 'Booking cancelled successfully',
        refund: refundInfo,
      }, requestId);
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      return this.error(
        error.message || 'Failed to cancel booking',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

class RescheduleBookingHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const newDate = body.newDate || body.bookingDate;
    const newTime = body.newTime || body.newTimeSlot || body.bookingTime;
    const reason = body.reason || body.rescheduleReason || 'Customer reschedule request';
    const actorId = context.userId || body.customerId || body.actorId;
    const actorType = context.userRole || body.actorType || 'customer';

    if (!newDate || !newTime) {
      return this.error(
        'newDate and newTime are required',
        400,
        'VALIDATION_ERROR',
        undefined,
        requestId
      );
    }

    // Validate new booking date/time
    const dateValidation = validateBookingDate(newDate, newTime);
    if (!dateValidation.valid) {
      return this.error(dateValidation.error!, 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // Get current booking
    const existingBookings = await select('bookings', { id: bookingId });
    if (existingBookings.length === 0) {
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
    }

    const currentBooking = existingBookings[0];
    const oldStatus = currentBooking.status;

    // Validate that booking can be rescheduled
    const reschedulableStatuses = ['pending', 'confirmed'];
    if (!reschedulableStatuses.includes(oldStatus)) {
      return this.error(
        `Booking cannot be rescheduled. Current status: ${oldStatus}`,
        400,
        'VALIDATION_ERROR',
        { currentStatus: oldStatus, allowedStatuses: reschedulableStatuses },
        requestId
      );
    }

    try {
      // Check for slot conflicts
      const conflictCheck = await query(
        `SELECT id FROM bookings 
         WHERE vendor_id = $1 
           AND booking_date = $2 
           AND booking_time = $3 
           AND id != $4
           AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
         LIMIT 1`,
        [currentBooking.vendor_id, newDate, newTime, bookingId]
      );

      if (conflictCheck.rows.length > 0) {
        return this.error(
          'This time slot is already booked. Please select a different time.',
          409,
          'SLOT_CONFLICT',
          undefined,
          requestId
        );
      }

      // Update booking with new date/time
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE bookings 
           SET booking_date = $1,
               booking_time = $2,
               rescheduled_from_booking_id = $4,
               notes = CASE 
                 WHEN notes IS NULL THEN $3
                 ELSE notes || ' | ' || $3
               END,
               updated_at = NOW() 
           WHERE id = $4`,
          [newDate, newTime, `Rescheduled: ${reason}`, bookingId]
        );
      });

      // Get updated booking
      const updatedBookings = await select('bookings', { id: bookingId });

      // Log status change (reschedule is a status update to track history)
      await logBookingStatusChange(
        bookingId,
        oldStatus,
        oldStatus, // Status remains the same, just time changes
        actorId,
        actorType,
        `Rescheduled to ${newDate} ${newTime}: ${reason}`
      );

      // Log audit entry
      await logAuditEntry({
        entityType: 'booking',
        entityId: bookingId,
        action: 'reschedule',
        oldValues: {
          booking_date: currentBooking.booking_date,
          booking_time: currentBooking.booking_time,
        },
        newValues: {
          booking_date: newDate,
          booking_time: newTime,
          reason,
        },
        changedFields: ['booking_date', 'booking_time'],
        actorId,
        actorType,
        requestId,
      });

      // Publish event
      try {
        const { publishBookingStatusUpdated } = await import('../utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: currentBooking.customer_id,
          vendorId: currentBooking.vendor_id,
          oldStatus,
          newStatus: oldStatus, // Status unchanged
          reason: `Rescheduled: ${reason}`,
          ...generateEventMetadata(requestId),
        });
      } catch (error) {
        console.error('Failed to publish booking rescheduled event:', error);
      }

      return this.success({
        bookingId,
        booking: updatedBookings[0],
        message: 'Booking rescheduled successfully',
        oldDate: currentBooking.booking_date,
        oldTime: currentBooking.booking_time,
        newDate,
        newTime,
      }, requestId);
    } catch (error: any) {
      if (error.message === 'SLOT_CONFLICT' || error.code === '55P03') {
        return this.error(
          'This time slot is already booked. Please select a different time.',
          409,
          'SLOT_CONFLICT',
          undefined,
          requestId
        );
      }
      console.error('Error rescheduling booking:', error);
      return this.error(
        error.message || 'Failed to reschedule booking',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerBookingEndpointsEnhanced(app: Hono) {
  const createHandler = new CreateBookingHandlerEnhanced();
  const getHandler = new GetBookingHandlerEnhanced();
  const updateHandler = new UpdateBookingStatusHandlerEnhanced();
  const historyHandler = new GetBookingHistoryHandlerEnhanced();
  const cancelHandler = new CancelBookingHandlerEnhanced();
  const rescheduleHandler = new RescheduleBookingHandlerEnhanced();
  const refundPreviewHandler = new GetRefundPreviewHandler();

  app.post('/bookings/create', async (c) => {
    try {
      // CRITICAL FIX: Use pre-parsed body from handler/index.ts global
      // This avoids the body consumption issue with Hono Request
      let body = (global as any).__parsedBodyForBookings;
      
      // Fallback: try to parse from request if global not available
      if (!body || Object.keys(body).length === 0) {
        try {
          body = await c.req.json();
        } catch (e) {
          body = {};
        }
      }
      
      // Create API Gateway event with validated body
      const event: any = {
        httpMethod: 'POST',
        path: c.req.path,
        headers: Object.fromEntries(c.req.raw.headers),
        body: JSON.stringify(body),
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams),
        requestContext: {
          requestId: crypto.randomUUID(),
          http: {
            method: c.req.method || 'POST',
            path: c.req.path,
          },
        },
        rawPath: c.req.path,
        rawQueryString: new URL(c.req.url, 'http://localhost').search.substring(1),
        isBase64Encoded: false,
      };
      
      const context = createLambdaContext();
      const result: any = await createHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: any) {
      console.error('Error in bookings/create:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // Compatibility endpoint for frontend
  app.post('/booking/create', async (c) => {
    try {
      // CRITICAL FIX: Use pre-parsed body from handler/index.ts global
      let body = (global as any).__parsedBodyForBookings;
      
      // Fallback: try to parse from request if global not available
      if (!body || Object.keys(body).length === 0) {
        try {
          body = await c.req.json();
        } catch (e) {
          body = {};
        }
      }
      
      const event: any = {
        httpMethod: 'POST',
        path: c.req.path,
        headers: Object.fromEntries(c.req.raw.headers),
        body: JSON.stringify(body),
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams),
        requestContext: {
          http: {
            method: c.req.method || 'POST',
            path: c.req.path,
          },
          requestId: crypto.randomUUID(),
        },
        rawPath: c.req.path,
        rawQueryString: new URL(c.req.url, 'http://localhost').search.substring(1),
        isBase64Encoded: false,
      };
      const context = createLambdaContext();
      const result: any = await createHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: any) {
      console.error('Error in booking/create:', error);
      return c.json({ error: error.message }, 500);
    }
  });
  
  // Customer-facing alias for booking creation
  app.post('/customer/booking/create', async (c) => {
    try {
      let body = (global as any).__parsedBodyForBookings;
      
      if (!body || Object.keys(body).length === 0) {
        try {
          body = await c.req.json();
        } catch (e) {
          body = {};
        }
      }
      
      const event: any = {
        httpMethod: 'POST',
        path: c.req.path,
        headers: Object.fromEntries(c.req.raw.headers),
        body: JSON.stringify(body),
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams),
        requestContext: {
          http: {
            method: c.req.method || 'POST',
            path: c.req.path,
          },
          requestId: crypto.randomUUID(),
        },
        rawPath: c.req.path,
        rawQueryString: new URL(c.req.url, 'http://localhost').search.substring(1),
        isBase64Encoded: false,
      };
      const context = createLambdaContext();
      const result: any = await createHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: any) {
      console.error('Error in customer/booking/create:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/bookings/:bookingId', async (c) => {
    const event = await createApiGatewayEvent(c);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result: any = await getHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.get('/bookings/:bookingId/history', async (c) => {
    const event = await createApiGatewayEvent(c);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result: any = await historyHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.put('/bookings/:bookingId/status', async (c) => {
    const event = await createApiGatewayEvent(c);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result: any = await updateHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.post('/customer/bookings/refund-preview', async (c) => {
    const event = await createApiGatewayEvent(c);
    const context = createLambdaContext();
    const result: any = await refundPreviewHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.post('/bookings/:bookingId/cancel', async (c) => {
    const event = await createApiGatewayEvent(c);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result: any = await cancelHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.post('/bookings/:bookingId/reschedule', async (c) => {
    const event = await createApiGatewayEvent(c);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result: any = await rescheduleHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });
}

// Create API Gateway event with pre-parsed body from global
async function createApiGatewayEventWithBody(c: any): Promise<any> {
  // Get headers
  const headers: Record<string, string> = {};
  try {
    if (c.req.raw && c.req.raw.headers) {
      const rawHeaders = c.req.raw.headers;
      for (const key in rawHeaders) {
        const value = rawHeaders[key];
        if (value) {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
        }
      }
    } else {
      const contentType = c.req.header('content-type');
      const authorization = c.req.header('authorization');
      if (contentType) headers['content-type'] = contentType;
      if (authorization) headers['authorization'] = authorization;
    }
  } catch (e) {
    console.warn('[BOOKINGS] Error processing headers:', e);
  }

  // CRITICAL FIX: Use pre-parsed body from handler/index.ts global
  let body = (global as any).__parsedBodyForBookings;
  
  // Fallback: try to parse from request if global not available
  if (!body || Object.keys(body).length === 0) {
    try {
      body = await c.req.json();
    } catch (e) {
      body = {};
    }
  }

  const url = new URL(c.req.url, 'http://localhost');
  return {
    rawPath: url.pathname,
    rawQueryString: url.search.substring(1),
    requestContext: {
      http: {
        method: c.req.method || 'POST',
        path: url.pathname,
      },
      requestId: crypto.randomUUID(),
    },
    headers: headers,
    body: JSON.stringify(body),
    isBase64Encoded: false,
  };
}

// Legacy function for endpoints that need body parsing
async function createApiGatewayEvent(c: any): Promise<any> {
  return createApiGatewayEventWithBody(c);
}

function createLambdaContext(): any {
  return {
    requestId: crypto.randomUUID(),
    functionName: 'booking-handler',
    functionVersion: '$LATEST',
  };
}

