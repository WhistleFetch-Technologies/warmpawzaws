"use strict";
/**
 * ============================================================================
 * VENDOR BOOKING ACTIONS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Endpoints for vendors to take actions on bookings:
 * - Complete booking with OTP verification
 * - Start session (for services like dog walking)
 * - End session
 *
 * Migrated from: supabase/functions/server/vendor-booking-actions.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVendorBookingActionsEndpoints = registerVendorBookingActionsEndpoints;
const rds_connection_1 = require("../database/rds-connection");
function registerVendorBookingActionsEndpoints(app) {
    /**
     * POST /vendor/bookings/:bookingId/complete
     * Complete a booking with OTP verification
     */
    app.post("/vendor/bookings/:bookingId/complete", async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { otp, vendorId } = await c.req.json();
            console.log(`📋 [COMPLETE-BOOKING] Vendor ${vendorId} completing booking ${bookingId} with OTP: ${otp}`);
            // Get booking
            const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
            if (bookings.length === 0) {
                return c.json({ error: 'Booking not found' }, 404);
            }
            const booking = bookings[0];
            // Verify vendor owns this booking
            if (booking.vendor_id !== vendorId) {
                return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
            }
            // Check if booking is already completed
            if (booking.status === 'completed') {
                return c.json({ error: 'Booking is already completed' }, 400);
            }
            // For tele consultations, no OTP required
            if (booking.service_type === 'online') {
                const updated = await (0, rds_connection_1.update)('bookings', { id: bookingId }, {
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                });
                console.log(`✅ [COMPLETE-BOOKING] Tele consultation completed without OTP`);
                return c.json({ success: true, booking: updated[0], message: 'Booking completed successfully!' });
            }
            // Verify OTP for in-person services
            if (!otp) {
                return c.json({ error: 'OTP is required for in-person services' }, 400);
            }
            // Check OTP from booking
            const expectedOTP = String(booking.otp_code || '').trim();
            const providedOTP = String(otp).trim();
            if (expectedOTP !== providedOTP) {
                console.error(`❌ [COMPLETE-BOOKING] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}"`);
                return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
            }
            // Mark booking as completed
            const updated = await (0, rds_connection_1.update)('bookings', { id: bookingId }, {
                status: 'completed',
                otp_verified: true,
                completed_at: new Date().toISOString(),
            });
            console.log(`✅ [COMPLETE-BOOKING] Booking completed successfully with OTP verification`);
            return c.json({
                success: true,
                booking: updated[0],
                message: 'Booking completed successfully!',
            });
        }
        catch (error) {
            console.error('Error completing booking:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /vendor/bookings/:bookingId/start-session
     * Start a session (for services like dog walking with live tracking)
     */
    app.post("/vendor/bookings/:bookingId/start-session", async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { otp, vendorId } = await c.req.json();
            console.log(`🚀 [START-SESSION] Vendor ${vendorId} starting session for booking ${bookingId} with OTP: ${otp}`);
            // Get booking
            const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
            if (bookings.length === 0) {
                return c.json({ error: 'Booking not found' }, 404);
            }
            const booking = bookings[0];
            // Verify vendor owns this booking
            if (booking.vendor_id !== vendorId) {
                return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
            }
            // Check if session already started
            if (booking.status === 'in_progress') {
                return c.json({ error: 'Session already started' }, 400);
            }
            // Verify OTP
            const expectedOTP = String(booking.otp_code || '').trim();
            const providedOTP = String(otp).trim();
            if (expectedOTP !== providedOTP) {
                console.error(`❌ [START-SESSION] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}"`);
                return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
            }
            // Start session
            const updated = await (0, rds_connection_1.update)('bookings', { id: bookingId }, {
                status: 'in_progress',
                otp_verified: true,
            });
            console.log(`✅ [START-SESSION] Session started successfully`);
            return c.json({
                success: true,
                booking: updated[0],
                message: 'Session started! Customer can now track live location.',
            });
        }
        catch (error) {
            console.error('Error starting session:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /vendor/bookings/:bookingId/end-session
     * End a session
     */
    app.post("/vendor/bookings/:bookingId/end-session", async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { vendorId, notes } = await c.req.json();
            console.log(`🏁 [END-SESSION] Vendor ${vendorId} ending session for booking ${bookingId}`);
            // Get booking
            const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
            if (bookings.length === 0) {
                return c.json({ error: 'Booking not found' }, 404);
            }
            const booking = bookings[0];
            // Verify vendor owns this booking
            if (booking.vendor_id !== vendorId) {
                return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
            }
            // Check if session is in progress
            if (booking.status !== 'in_progress') {
                return c.json({ error: `Session cannot be ended. Current status: ${booking.status}` }, 400);
            }
            // End session and mark as completed
            const updated = await (0, rds_connection_1.update)('bookings', { id: bookingId }, {
                status: 'completed',
                completed_at: new Date().toISOString(),
                notes: notes || booking.notes,
            });
            console.log(`✅ [END-SESSION] Session ended successfully`);
            return c.json({
                success: true,
                booking: updated[0],
                message: 'Session ended successfully!',
            });
        }
        catch (error) {
            console.error('Error ending session:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=vendor-booking-actions.js.map