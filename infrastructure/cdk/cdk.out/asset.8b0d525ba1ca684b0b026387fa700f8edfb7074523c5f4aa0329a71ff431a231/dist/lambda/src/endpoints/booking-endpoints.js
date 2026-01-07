"use strict";
/**
 * ============================================================================
 * BOOKING ENDPOINTS - SQL ONLY (Lambda Version)
 * ============================================================================
 *
 * REFACTORED: All KV usage removed, uses SQL repositories only
 *
 * Date: 2025-01-28
 * Agent: Agent 2 (Lambda Migration)
 * Migration: Deno → Node.js for Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingEndpointsSQL = bookingEndpointsSQL;
const response_utils_1 = require("./response-utils");
const bookings_1 = require("../lib/repositories/bookings");
const vendors_1 = require("../lib/repositories/vendors");
const customers_1 = require("../lib/repositories/customers");
const db_1 = require("../lib/db");
// TODO: Convert these dependencies
// import { getServicesRepository } from '../lib/repositories/services';
// import { validateBookingTransition } from '../lib/services/state-machine-validator';
// import { createBookingWithPayment } from '../lib/utils/transaction-helper';
// import { calculateGST } from '../lib/services/gst-calculator';
const BASE_PATH = "/make-server-3dd53475";
function bookingEndpointsSQL(app) {
    /**
     * POST /bookings
     * Create a new booking (SQL only)
     */
    app.post(`${BASE_PATH}/bookings`, async (c) => {
        try {
            const bookingData = await c.req.json();
            // Validate required fields
            if (!bookingData.customer_id || !bookingData.vendor_id || !bookingData.service_id) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields: customer_id, vendor_id, service_id', 400);
            }
            // Get entities
            const customersRepo = (0, customers_1.getCustomersRepository)();
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            // TODO: Get services repository when converted
            // const servicesRepo = getServicesRepository();
            const customer = await customersRepo.findById(bookingData.customer_id);
            const vendor = await vendorsRepo.findById(bookingData.vendor_id);
            // TODO: Get service when services repository is converted
            // const service = await servicesRepo.findById(bookingData.service_id);
            if (!customer) {
                return (0, response_utils_1.sendError)(c, 'Customer not found', 404);
            }
            if (!vendor) {
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            // TODO: Check service when services repository is converted
            // if (!service) {
            //   return sendError(c, 'Service not found', 404);
            // }
            // TODO: Calculate pricing with GST when GST calculator is converted
            const basePrice = bookingData.base_price || 0;
            const discountAmount = bookingData.discount_amount || 0;
            const subtotal = basePrice - discountAmount;
            // TODO: Calculate GST when GST calculator is converted
            // const gst = await calculateGST({...});
            const gstAmount = bookingData.tax_amount || 0;
            const totalAmount = subtotal + gstAmount;
            // TODO: Create booking with payment atomically when transaction helper is converted
            // For now, create booking directly
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.create({
                customer_id: bookingData.customer_id,
                vendor_id: bookingData.vendor_id,
                staff_id: bookingData.staff_id || undefined,
                service_id: bookingData.service_id,
                booking_date: bookingData.booking_date,
                booking_time: bookingData.booking_time,
                service_type: bookingData.service_type || 'at_center',
                address: bookingData.address || undefined,
                city: bookingData.city || undefined,
                state: bookingData.state || undefined,
                pincode: bookingData.pincode || undefined,
                latitude: bookingData.latitude || undefined,
                longitude: bookingData.longitude || undefined,
                base_price: basePrice,
                discount_amount: discountAmount,
                tax_amount: gstAmount,
                total_amount: totalAmount,
                notes: bookingData.notes || undefined
            });
            // Log audit
            const pool = await (0, db_1.getDbClient)();
            await pool.query("SELECT create_audit_log($1, $2, $3, $4, $5, $6)", [
                'booking_created',
                'booking',
                booking.id,
                bookingData.customer_id,
                'customer',
                JSON.stringify({ vendor_id: bookingData.vendor_id, service_id: bookingData.service_id })
            ]);
            return (0, response_utils_1.sendSuccess)(c, { booking }, 'Booking created successfully');
        }
        catch (error) {
            console.error('❌ [BOOKING] Error creating booking:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * PATCH /bookings/:bookingId/status
     * Update booking status with state machine validation
     */
    app.patch(`${BASE_PATH}/bookings/:bookingId/status`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { status, otp, hasPayment } = await c.req.json();
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // TODO: Validate state transition when state machine validator is converted
            // const validation = await validateBookingTransition(...);
            // For now, allow any status update
            // if (!validation.allowed) {
            //   return sendError(c, validation.reason || 'Invalid state transition', 400);
            // }
            // Update booking status
            const updated = await bookingsRepo.update(bookingId, { status });
            // Log transaction
            const pool = await (0, db_1.getDbClient)();
            await pool.query("INSERT INTO booking_transaction_log (booking_id, transaction_type, old_status, new_status) VALUES ($1, $2, $3, $4)", [bookingId, 'update', booking.status, status]);
            // Log audit
            // TODO: Get user info from context when auth middleware is added
            const userId = 'system'; // Placeholder until auth middleware is implemented
            const userRole = 'system'; // Placeholder until auth middleware is implemented
            await pool.query("SELECT create_audit_log($1, $2, $3, $4, $5, $6)", [
                'booking_status_updated',
                'booking',
                bookingId,
                userId,
                userRole,
                JSON.stringify({ from: booking.status, to: status })
            ]);
            return (0, response_utils_1.sendSuccess)(c, { booking: updated }, 'Booking status updated');
        }
        catch (error) {
            console.error('❌ [BOOKING] Error updating status:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /bookings/:bookingId
     * Get booking by ID
     */
    app.get(`${BASE_PATH}/bookings/:bookingId`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            return (0, response_utils_1.sendSuccess)(c, { booking }, 'Booking retrieved');
        }
        catch (error) {
            console.error('❌ [BOOKING] Error getting booking:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /bookings
     * List bookings with filters
     */
    app.get(`${BASE_PATH}/bookings`, async (c) => {
        try {
            const customerId = c.req.query('customer_id');
            const vendorId = c.req.query('vendor_id');
            const status = c.req.query('status');
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            let bookings;
            if (customerId) {
                bookings = await bookingsRepo.findByCustomer(customerId, status ? { status } : undefined);
            }
            else if (vendorId) {
                bookings = await bookingsRepo.findByVendor(vendorId, status ? { status } : undefined);
            }
            else {
                return (0, response_utils_1.sendError)(c, 'Must provide customer_id or vendor_id', 400);
            }
            return (0, response_utils_1.sendSuccess)(c, { bookings }, 'Bookings retrieved');
        }
        catch (error) {
            console.error('❌ [BOOKING] Error listing bookings:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /bookings/:bookingId/cancel
     * Cancel booking with refund check
     */
    app.post(`${BASE_PATH}/bookings/:bookingId/cancel`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { reason, cancelledBy } = await c.req.json();
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // TODO: Validate cancellation transition when state machine validator is converted
            // For now, allow cancellation
            // Update booking
            const updated = await bookingsRepo.update(bookingId, {
                status: 'cancelled',
                cancellation_reason: reason,
                cancelled_at: new Date().toISOString()
            });
            // Process refund if payment was made
            if (booking.payment_status === 'paid') {
                // Refund will be processed by refund handler
                // This endpoint just marks booking as cancelled
            }
            // Log audit
            const pool = await (0, db_1.getDbClient)();
            const userId = cancelledBy === 'customer' ? booking.customer_id : 'system'; // TODO: Get vendor ID from context
            const userRole = cancelledBy || 'system';
            await pool.query("SELECT create_audit_log($1, $2, $3, $4, $5, $6)", [
                'booking_cancelled',
                'booking',
                bookingId,
                userId,
                userRole,
                JSON.stringify({ reason })
            ]);
            return (0, response_utils_1.sendSuccess)(c, { booking: updated }, 'Booking cancelled');
        }
        catch (error) {
            console.error('❌ [BOOKING] Error cancelling booking:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /bookings/:bookingId/reschedule
     * Reschedule booking to new date/time
     */
    app.post(`${BASE_PATH}/bookings/:bookingId/reschedule`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { newDate, newTimeSlot, reason } = await c.req.json();
            if (!newDate || !newTimeSlot) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields: newDate, newTimeSlot', 400);
            }
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // Validate booking can be rescheduled
            if (booking.status === 'completed' || booking.status === 'cancelled') {
                return (0, response_utils_1.sendError)(c, `Cannot reschedule booking with status: ${booking.status}`, 400);
            }
            // Reschedule booking
            const rescheduledBooking = await bookingsRepo.reschedule(bookingId, newDate, newTimeSlot);
            // Log audit
            const pool = await (0, db_1.getDbClient)();
            await pool.query("SELECT create_audit_log($1, $2, $3, $4, $5, $6)", [
                'booking_rescheduled',
                'booking',
                bookingId,
                booking.customer_id,
                'customer',
                JSON.stringify({
                    originalDate: booking.booking_date,
                    originalTime: booking.booking_time,
                    newDate,
                    newTime: newTimeSlot,
                    reason
                })
            ]);
            return (0, response_utils_1.sendSuccess)(c, {
                originalBooking: booking,
                rescheduledBooking
            }, 'Booking rescheduled successfully');
        }
        catch (error) {
            console.error('❌ [BOOKING] Error rescheduling booking:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /bookings/create
     * Create booking (backward compatibility endpoint)
     * Redirects to POST /bookings
     */
    app.post(`${BASE_PATH}/bookings/create`, async (c) => {
        // Forward to main booking creation endpoint
        const bookingData = await c.req.json();
        // Create a new request to the main endpoint
        const newRequest = new Request(`${BASE_PATH}/bookings`, {
            method: 'POST',
            headers: c.req.raw.headers,
            body: JSON.stringify(bookingData),
        });
        // Handle via main endpoint
        return app.fetch(newRequest);
    });
}
//# sourceMappingURL=booking-endpoints.js.map