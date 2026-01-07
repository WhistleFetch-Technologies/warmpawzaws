"use strict";
/**
 * ============================================================================
 * BOOKING LIFECYCLE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Booking lifecycle management (reschedule, accept, reject)
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBookingLifecycleEndpoints = registerBookingLifecycleEndpoints;
const response_utils_1 = require("./response-utils");
const sms_notification_service_enhanced_sql_1 = require("./sms-notification-service-enhanced-sql");
const repositories_1 = require("../lib/repositories");
const BASE_PATH = '/make-server-3dd53475';
function registerBookingLifecycleEndpoints(app) {
    /**
     * POST /make-server-3dd53475/bookings/:bookingId/reschedule
     * Reschedule a booking (Customer or Vendor)
     */
    app.post(`${BASE_PATH}/bookings/:bookingId/reschedule`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { newDate, newTimeSlot, reason, phone } = await c.req.json();
            if (!newDate || !newTimeSlot) {
                return (0, response_utils_1.sendError)(c, 'New date and time are required', 400);
            }
            // ✅ SQL: Get booking from bookings table
            const bookingsRepo = (0, repositories_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // Policy Check: Cannot reschedule within 2 hours
            const originalDate = new Date(`${booking.booking_date}T${booking.booking_time}`);
            const now = new Date();
            const hoursDiff = (originalDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            if (hoursDiff < 2) {
                return (0, response_utils_1.sendError)(c, 'Cannot reschedule within 2 hours of appointment', 400);
            }
            // Update Booking
            const oldDate = booking.booking_date;
            const oldTime = booking.booking_time;
            // ✅ SQL: Update booking in bookings table
            const metadata = booking.metadata || {};
            const history = metadata.history || [];
            history.push({
                action: 'reschedule',
                from: `${oldDate} ${oldTime}`,
                to: `${newDate} ${newTimeSlot}`,
                at: new Date().toISOString(),
                by: phone || 'customer'
            });
            await bookingsRepo.update(bookingId, {
                booking_date: newDate,
                booking_time: newTimeSlot,
                status: 'rescheduled',
                metadata: {
                    ...metadata,
                    rescheduledAt: new Date().toISOString(),
                    rescheduleReason: reason || 'Customer request',
                    history
                }
            });
            const updatedBooking = await bookingsRepo.findById(bookingId);
            // 🔔 NOTIFICATION
            const customersRepo = (0, repositories_1.getCustomersRepository)();
            const customer = await customersRepo.findById(booking.customer_id);
            await (0, sms_notification_service_enhanced_sql_1.triggerBookingNotification)('booking.rescheduled', {
                booking: updatedBooking,
                customer: customer || undefined
            });
            console.log(`✅ Booking ${bookingId} rescheduled to ${newDate} ${newTimeSlot}`);
            return (0, response_utils_1.sendSuccess)(c, { booking: updatedBooking });
        }
        catch (error) {
            console.error('Error rescheduling booking:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /make-server-3dd53475/bookings/:bookingId/accept
     * Vendor accepts a pending booking (Cafe/Resort)
     */
    app.post(`${BASE_PATH}/bookings/:bookingId/accept`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { vendorId } = await c.req.json(); // Verify vendor ownership
            // ✅ SQL: Get booking from bookings table
            const bookingsRepo = (0, repositories_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            if (booking.vendor_id !== vendorId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized', 403);
            }
            if (booking.status !== 'pending') {
                return (0, response_utils_1.sendError)(c, `Booking is already ${booking.status}`, 400);
            }
            // ✅ SQL: Update booking status
            const metadata = booking.metadata || {};
            await bookingsRepo.update(bookingId, {
                status: 'confirmed',
                metadata: {
                    ...metadata,
                    confirmedAt: new Date().toISOString()
                }
            });
            const updatedBooking = await bookingsRepo.findById(bookingId);
            // 🔔 NOTIFICATION
            const customersRepo = (0, repositories_1.getCustomersRepository)();
            const customer = await customersRepo.findById(booking.customer_id);
            await (0, sms_notification_service_enhanced_sql_1.triggerBookingNotification)('booking.confirmed', {
                booking: updatedBooking,
                customer: customer || undefined
            });
            console.log(`✅ Booking ${bookingId} accepted by vendor ${vendorId}`);
            return (0, response_utils_1.sendSuccess)(c, { booking: updatedBooking });
        }
        catch (error) {
            console.error('Error accepting booking:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /make-server-3dd53475/bookings/:bookingId/reject
     * Vendor rejects a pending booking
     */
    app.post(`${BASE_PATH}/bookings/:bookingId/reject`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { vendorId, reason } = await c.req.json();
            // ✅ SQL: Get booking from bookings table
            const bookingsRepo = (0, repositories_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            if (booking.vendor_id !== vendorId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized', 403);
            }
            let refundStatus = 'pending';
            let refundId = null;
            let refundAmount = null;
            // ✅ FIX: Process refund automatically (using Lambda API endpoint)
            try {
                // In Lambda, we can call the refund endpoint directly or use internal function
                // For now, we'll set refund status to pending and let refund endpoint handle it
                // TODO: Integrate with refund processing endpoint
                refundStatus = 'pending';
                console.log(`⚠️ Refund processing will be handled by refund endpoint for booking ${bookingId}`);
            }
            catch (refundError) {
                console.error('Error processing refund:', refundError);
            }
            // ✅ SQL: Update booking status
            const metadata = booking.metadata || {};
            await bookingsRepo.update(bookingId, {
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancellation_reason: reason || 'Vendor rejected request',
                metadata: {
                    ...metadata,
                    cancelledBy: 'vendor',
                    refundStatus,
                    refundId,
                    refundAmount
                }
            });
            const updatedBooking = await bookingsRepo.findById(bookingId);
            // 🔔 NOTIFICATION
            const customersRepo = (0, repositories_1.getCustomersRepository)();
            const customer = await customersRepo.findById(booking.customer_id);
            await (0, sms_notification_service_enhanced_sql_1.triggerBookingNotification)('booking.cancelled', {
                booking: updatedBooking,
                customer: customer || undefined
            });
            return (0, response_utils_1.sendSuccess)(c, { booking: updatedBooking });
        }
        catch (error) {
            console.error('Error rejecting booking:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
}
//# sourceMappingURL=booking-lifecycle-sql.js.map