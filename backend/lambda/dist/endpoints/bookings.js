"use strict";
/**
 * ============================================================================
 * BOOKING ENDPOINTS - LAMBDA VERSION (TEMPORAL AUDIT COMPLIANT)
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-booking/booking-endpoints.tsx
 *
 * Endpoints:
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
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBookingEndpoints = registerBookingEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
const idempotency_1 = require("../utils/idempotency");
const audit_log_1 = require("../utils/audit-log");
const commute_time_calculator_1 = require("../utils/commute-time-calculator");
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
function validateBookingDate(bookingDate, bookingTime) {
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
function generateEventMetadata(requestId) {
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
class CreateBookingHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const requestId = context.event.requestContext?.requestId || crypto.randomUUID();
        const { customerId, vendorId, serviceId, staffId, bookingDate, bookingTime, serviceType, address, petId, amount, idempotencyKey, // Client-provided idempotency key
         } = body;
        // ✅ VALIDATION: Required fields
        this.validateRequired(body, ['customerId', 'vendorId', 'serviceId', 'bookingDate', 'bookingTime']);
        // ✅ TEMPORAL FIX: Check idempotency key first
        if (idempotencyKey) {
            const existing = await (0, idempotency_1.checkIdempotencyKey)(idempotencyKey);
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
            return this.error(dateValidation.error, 400);
        }
        // ✅ Validate service exists
        const services = await (0, rds_connection_1.select)('services', { id: serviceId });
        if (services.length === 0) {
            const vendorServices = await (0, rds_connection_1.select)('vendor_services', { id: serviceId });
            if (vendorServices.length === 0) {
                return this.error('Service not found', 404);
            }
        }
        // ✅ TEMPORAL FIX: Use transaction for atomicity
        try {
            const result = await (0, rds_connection_1.withTransaction)(async (client) => {
                // ✅ Slot collision prevention with row-level locking
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
                // Create booking (using existing schema columns only)
                const bookingData = {
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
                    notes: petId ? `Pet ID: ${petId}` : null, // Store pet reference in notes
                    // Note: idempotency_key handled via separate table, not stored in bookings
                };
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
                                const commuteResult = await (0, commute_time_calculator_1.calculateStaffETA)(staffId, customerLocation, bookingDateTime, {
                                    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
                                    bufferMinutes: 5, // 5 minute buffer
                                });
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
                        }
                        catch (error) {
                            // Log but don't fail booking creation if commute calculation fails
                            console.warn('Failed to calculate commute time for booking:', error);
                        }
                    }
                }
                // Use client.query within transaction
                const columns = Object.keys(bookingData);
                const values = Object.values(bookingData);
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                const insertResult = await client.query(`INSERT INTO bookings (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`, values);
                return insertResult.rows[0];
            });
            const booking = result;
            // ✅ TEMPORAL FIX: Log audit entry
            await (0, audit_log_1.logAuditEntry)({
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
            await (0, audit_log_1.logBookingStatusChange)(booking.id, null, 'pending', customerId, // changedById
            'customer', // changedByType
            'Booking created' // changeReason
            );
            // ✅ TEMPORAL FIX: Publish event with timestamps
            try {
                const { publishBookingCreated } = await Promise.resolve().then(() => __importStar(require('../utils/sns-client')));
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
            }
            catch (error) {
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
                await (0, idempotency_1.storeIdempotencyKey)(idempotencyKey, 'booking', booking.id, response, 200);
            }
            return this.success(response);
        }
        catch (error) {
            if (error.message === 'SLOT_CONFLICT' || error.code === '55P03') {
                return this.error('This time slot is already booked. Please select a different time.', 409);
            }
            throw error;
        }
    }
}
class GetBookingHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        if (!bookingId) {
            return this.error('Booking ID is required', 400);
        }
        const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
        if (bookings.length === 0) {
            return this.error('Booking not found', 404);
        }
        return this.success(bookings[0]);
    }
}
class GetBookingHistoryHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        if (!bookingId) {
            return this.error('Booking ID is required', 400);
        }
        // Get booking
        const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
        if (bookings.length === 0) {
            return this.error('Booking not found', 404);
        }
        // Get status history
        const { rows: history } = await (0, rds_connection_1.query)(`SELECT * FROM booking_status_history 
       WHERE booking_id = $1 
       ORDER BY created_at ASC`, [bookingId]);
        return this.success({
            booking: bookings[0],
            statusHistory: history,
        });
    }
}
class UpdateBookingStatusHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        const body = this.parseBody(context.event);
        const requestId = context.event.requestContext?.requestId || crypto.randomUUID();
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
        const existingBookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
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
        const invalidTransitions = {
            'completed': ['pending', 'confirmed', 'in_progress'],
            'cancelled': ['pending', 'confirmed', 'in_progress', 'completed'],
            'no_show': ['pending', 'confirmed', 'in_progress', 'completed'],
        };
        if (invalidTransitions[oldStatus]?.includes(status)) {
            return this.error(`Invalid status transition: Cannot change from '${oldStatus}' to '${status}'`, 400);
        }
        // ✅ TEMPORAL FIX: Use transaction for atomicity
        await (0, rds_connection_1.withTransaction)(async (client) => {
            // Build update data with server-generated timestamps
            const updateData = {
                status,
                updated_at: new Date()
            };
            if (status === 'completed') {
                updateData.completed_at = new Date();
            }
            else if (status === 'cancelled') {
                updateData.cancelled_at = new Date();
            }
            // Update booking
            const setClauses = Object.keys(updateData).map((key, i) => `${key} = $${i + 1}`);
            const values = [...Object.values(updateData), bookingId];
            await client.query(`UPDATE bookings SET ${setClauses.join(', ')} WHERE id = $${values.length}`, values);
        });
        // ✅ TEMPORAL FIX: Log status change to history
        await (0, audit_log_1.logBookingStatusChange)(bookingId, oldStatus, status, actorId, // changedById
        actorType || 'system', // changedByType
        reason // changeReason
        );
        // ✅ TEMPORAL FIX: Log audit entry
        await (0, audit_log_1.logAuditEntry)({
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
            const { publishBookingStatusUpdated } = await Promise.resolve().then(() => __importStar(require('../utils/sns-client')));
            await publishBookingStatusUpdated({
                bookingId,
                customerId: currentBooking.customer_id,
                vendorId: currentBooking.vendor_id,
                oldStatus,
                newStatus: status,
                reason,
                ...generateEventMetadata(requestId),
            });
        }
        catch (error) {
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
function registerBookingEndpoints(app) {
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
function createApiGatewayEvent(req) {
    return {
        httpMethod: req.method,
        path: req.url,
        headers: req.headers,
        body: JSON.stringify(req.body || {}),
        pathParameters: req.param() || {},
        queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
        requestContext: {
            requestId: crypto.randomUUID(),
        },
    };
}
function createLambdaContext() {
    return {
        requestId: crypto.randomUUID(),
        functionName: 'booking-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=bookings.js.map