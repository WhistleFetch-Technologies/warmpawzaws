"use strict";
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
 *
 * Date: 2026-01-28
 * Phase: 3
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
exports.registerBookingEndpointsEnhanced = registerBookingEndpointsEnhanced;
const base_handler_enhanced_1 = require("../handler/base-handler-enhanced");
const rds_connection_1 = require("../database/rds-connection");
const idempotency_1 = require("../utils/idempotency");
const audit_log_1 = require("../utils/audit-log");
const commute_time_calculator_1 = require("../utils/commute-time-calculator");
const bookings_1 = require("@warmpawz/api-contracts/bookings");
// ============================================================================
// CONFIGURATION
// ============================================================================
const MAX_ADVANCE_BOOKING_DAYS = 60;
const MIN_NOTICE_HOURS = 1;
// ============================================================================
// VALIDATION UTILITIES
// ============================================================================
function validateBookingDate(bookingDate, bookingTime) {
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
class CreateBookingHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
        const body = this.parseBody(context.event);
        const requestId = context.requestId;
        // Validate request with Zod schema
        const validationResult = bookings_1.CreateBookingRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return this.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: validationResult.error.errors }, requestId);
        }
        const { customerId, vendorId, serviceId, staffId, bookingDate, bookingTime, serviceType, address, petId, amount, idempotencyKey, } = validationResult.data;
        // Check idempotency key first
        if (idempotencyKey) {
            const existing = await (0, idempotency_1.checkIdempotencyKey)(idempotencyKey);
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
            return this.error(dateValidation.error, 400, 'VALIDATION_ERROR', undefined, requestId);
        }
        // Validate service exists
        const services = await (0, rds_connection_1.select)('services', { id: serviceId });
        if (services.length === 0) {
            const vendorServices = await (0, rds_connection_1.select)('vendor_services', { id: serviceId });
            if (vendorServices.length === 0) {
                return this.error('Service not found', 404, 'NOT_FOUND', undefined, requestId);
            }
        }
        try {
            const result = await (0, rds_connection_1.withTransaction)(async (client) => {
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
                                const commuteResult = await (0, commute_time_calculator_1.calculateStaffETA)(staffId, customerLocation, bookingDateTime, {
                                    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
                                    bufferMinutes: 5,
                                });
                                const commuteInfo = `Commute: ${commuteResult.durationMinutes}min, Distance: ${commuteResult.distanceKm}km`;
                                bookingData.notes = bookingData.notes
                                    ? `${bookingData.notes} | ${commuteInfo}`
                                    : commuteInfo;
                                if (commuteResult.estimatedArrival) {
                                    bookingData.estimated_arrival = commuteResult.estimatedArrival;
                                }
                            }
                        }
                        catch (error) {
                            console.warn('Failed to calculate commute time for booking:', error);
                        }
                    }
                }
                // Insert booking
                const columns = Object.keys(bookingData);
                const values = Object.values(bookingData);
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                const insertResult = await client.query(`INSERT INTO bookings (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`, values);
                return insertResult.rows[0];
            });
            const booking = result;
            // Log audit entry
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
            // Log initial status
            await (0, audit_log_1.logBookingStatusChange)(booking.id, null, 'pending', customerId, 'customer', 'Booking created');
            // Publish event
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
            // Store idempotency key
            if (idempotencyKey) {
                await (0, idempotency_1.storeIdempotencyKey)(idempotencyKey, 'booking', booking.id, JSON.stringify(response), 200);
            }
            return this.success(response, requestId);
        }
        catch (error) {
            if (error.message === 'SLOT_CONFLICT' || error.code === '55P03') {
                return this.error('This time slot is already booked. Please select a different time.', 409, 'SLOT_CONFLICT', undefined, requestId);
            }
            throw error;
        }
    }
}
class GetBookingHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        const requestId = context.requestId;
        if (!bookingId) {
            return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
        }
        const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
        if (bookings.length === 0) {
            return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
        }
        return this.success({ booking: bookings[0] }, requestId);
    }
}
class GetBookingHistoryHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        const requestId = context.requestId;
        if (!bookingId) {
            return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
        }
        const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
        if (bookings.length === 0) {
            return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
        }
        const { rows: history } = await (0, rds_connection_1.query)(`SELECT * FROM booking_status_history 
       WHERE booking_id = $1 
       ORDER BY created_at ASC`, [bookingId]);
        return this.success({
            booking: bookings[0],
            history,
        }, requestId);
    }
}
class UpdateBookingStatusHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        const body = this.parseBody(context.event);
        const requestId = context.requestId;
        if (!bookingId) {
            return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
        }
        // Validate request with Zod schema
        const validationResult = bookings_1.UpdateBookingStatusRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return this.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: validationResult.error.errors }, requestId);
        }
        const { status, reason } = validationResult.data;
        const actorId = context.userId || body.actorId;
        const actorType = context.userRole || body.actorType || 'system';
        // Get current booking
        const existingBookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
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
        const invalidTransitions = {
            'completed': ['pending', 'confirmed', 'in_progress'],
            'cancelled': ['pending', 'confirmed', 'in_progress', 'completed'],
            'no_show': ['pending', 'confirmed', 'in_progress', 'completed'],
        };
        if (invalidTransitions[oldStatus]?.includes(status)) {
            return this.error(`Invalid status transition: Cannot change from '${oldStatus}' to '${status}'`, 400, 'VALIDATION_ERROR', undefined, requestId);
        }
        // Update booking
        await (0, rds_connection_1.withTransaction)(async (client) => {
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
            const setClauses = Object.keys(updateData).map((key, i) => `${key} = $${i + 1}`);
            const values = [...Object.values(updateData), bookingId];
            await client.query(`UPDATE bookings SET ${setClauses.join(', ')} WHERE id = $${values.length}`, values);
        });
        // Log status change
        await (0, audit_log_1.logBookingStatusChange)(bookingId, oldStatus, status, actorId, actorType, reason);
        // Log audit entry
        await (0, audit_log_1.logAuditEntry)({
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
        }, requestId);
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerBookingEndpointsEnhanced(app) {
    const createHandler = new CreateBookingHandlerEnhanced();
    const getHandler = new GetBookingHandlerEnhanced();
    const updateHandler = new UpdateBookingStatusHandlerEnhanced();
    const historyHandler = new GetBookingHistoryHandlerEnhanced();
    app.post('/bookings/create', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await createHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
    });
    app.get('/bookings/:bookingId', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { bookingId: c.req.param('bookingId') };
        const context = createLambdaContext();
        const result = await getHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
    });
    app.get('/bookings/:bookingId/history', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { bookingId: c.req.param('bookingId') };
        const context = createLambdaContext();
        const result = await historyHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
    });
    app.put('/bookings/:bookingId/status', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { bookingId: c.req.param('bookingId') };
        const context = createLambdaContext();
        const result = await updateHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
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
//# sourceMappingURL=bookings-enhanced.js.map