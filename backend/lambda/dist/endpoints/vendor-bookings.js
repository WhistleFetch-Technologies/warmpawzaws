"use strict";
/**
 * ============================================================================
 * VENDOR BOOKINGS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles vendor booking management:
 * - Get vendor bookings with filters
 * - Update booking status
 * - Booking actions (confirm, cancel, complete)
 *
 * Migrated from: supabase/functions/server/vendor-bookings.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVendorBookingsEndpoints = registerVendorBookingsEndpoints;
const rds_connection_1 = require("../database/rds-connection");
function registerVendorBookingsEndpoints(app) {
    /**
     * GET /vendor/bookings/:vendorId
     * Get all bookings for a vendor with filters
     */
    app.get("/vendor/bookings/:vendorId", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const date = c.req.query('date');
            const filter = c.req.query('filter') || 'all';
            console.log(`📋 [VENDOR-BOOKINGS] Fetching bookings for vendor: ${vendorId}`);
            console.log(`   Filters: date=${date}, status=${filter}`);
            // Get vendor bookings
            let queryText = 'SELECT * FROM bookings WHERE vendor_id = $1';
            const params = [vendorId];
            let paramIndex = 2;
            // Filter by date
            if (date) {
                queryText += ` AND booking_date = $${paramIndex}`;
                params.push(date);
                paramIndex++;
            }
            // Filter by status
            if (filter && filter !== 'all') {
                queryText += ` AND status = $${paramIndex}`;
                params.push(filter);
                paramIndex++;
            }
            queryText += ' ORDER BY booking_date DESC, booking_time DESC';
            const result = await (0, rds_connection_1.query)(queryText, params).catch(() => ({ rows: [] }));
            // Enrich bookings with customer, service, and related data (prescriptions, medical records, chat)
            const enrichedBookings = await Promise.all(result.rows.map(async (booking) => {
                const [customer, service, prescriptions, medicalRecords, chatMessages] = await Promise.all([
                    booking.customer_id
                        ? (0, rds_connection_1.select)('customers', { id: booking.customer_id }).catch(() => [])
                        : Promise.resolve([]),
                    booking.service_id
                        ? (0, rds_connection_1.select)('services', { id: booking.service_id }).catch(() => [])
                        : Promise.resolve([]),
                    // Check for prescriptions
                    (0, rds_connection_1.query)(`SELECT COUNT(*) as count FROM prescriptions 
               WHERE booking_id = $1 AND is_active = true`, [booking.id]).catch(() => ({ rows: [{ count: '0' }] })),
                    // Check for medical records
                    (0, rds_connection_1.query)(`SELECT COUNT(*) as count FROM medical_records 
               WHERE booking_id = $1 AND is_active = true`, [booking.id]).catch(() => ({ rows: [{ count: '0' }] })),
                    // Check for unread chat messages
                    (0, rds_connection_1.query)(`SELECT COUNT(*) as count FROM chat_messages 
               WHERE booking_id = $1 AND is_read = false`, [booking.id]).catch(() => ({ rows: [{ count: '0' }] })),
                ]);
                const prescriptionCount = parseInt(prescriptions.rows[0]?.count || '0', 10);
                const medicalRecordCount = parseInt(medicalRecords.rows[0]?.count || '0', 10);
                const unreadMessageCount = parseInt(chatMessages.rows[0]?.count || '0', 10);
                return {
                    ...booking,
                    customer: customer.length > 0 ? {
                        id: customer[0].id,
                        name: customer[0].full_name,
                        phone: customer[0].phone,
                    } : null,
                    service: service.length > 0 ? {
                        id: service[0].id,
                        name: service[0].name,
                        category: service[0].category,
                    } : null,
                    chatEnabled: booking.status !== 'cancelled',
                    hasUnreadMessages: unreadMessageCount > 0,
                    unreadMessageCount,
                    hasPrescription: prescriptionCount > 0,
                    prescriptionCount,
                    hasMedicalRecords: medicalRecordCount > 0,
                    medicalRecordCount,
                    isFollowUp: false, // Can be enhanced with follow_up_date check
                };
            }));
            return c.json({
                success: true,
                bookings: enrichedBookings,
                total: enrichedBookings.length,
                filters: {
                    date,
                    status: filter,
                },
            });
        }
        catch (error) {
            console.error('❌ [VENDOR-BOOKINGS] Error fetching bookings:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * PUT /vendor/bookings/:bookingId/status
     * Update booking status
     */
    app.put("/vendor/bookings/:bookingId/status", async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { status, notes } = await c.req.json();
            if (!status) {
                return c.json({ error: 'status is required' }, 400);
            }
            // Get booking
            const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
            if (bookings.length === 0) {
                return c.json({ error: 'Booking not found' }, 404);
            }
            // Update booking
            const updateData = { status };
            if (notes) {
                updateData.notes = notes;
            }
            if (status === 'completed') {
                updateData.completed_at = new Date().toISOString();
            }
            else if (status === 'cancelled') {
                updateData.cancelled_at = new Date().toISOString();
            }
            const updated = await (0, rds_connection_1.update)('bookings', { id: bookingId }, updateData);
            return c.json({
                success: true,
                booking: updated[0],
                message: 'Booking status updated successfully',
            });
        }
        catch (error) {
            console.error('Error updating booking status:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /vendor/bookings/:bookingId/confirm
     * Confirm a booking
     */
    app.post("/vendor/bookings/:bookingId/confirm", async (c) => {
        try {
            const { bookingId } = c.req.param();
            const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
            if (bookings.length === 0) {
                return c.json({ error: 'Booking not found' }, 404);
            }
            if (bookings[0].status !== 'pending') {
                return c.json({ error: `Booking cannot be confirmed. Current status: ${bookings[0].status}` }, 400);
            }
            const updated = await (0, rds_connection_1.update)('bookings', { id: bookingId }, { status: 'confirmed' });
            return c.json({
                success: true,
                booking: updated[0],
                message: 'Booking confirmed successfully',
            });
        }
        catch (error) {
            console.error('Error confirming booking:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /vendor/bookings/:bookingId/cancel
     * Cancel a booking
     */
    app.post("/vendor/bookings/:bookingId/cancel", async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { reason } = await c.req.json();
            const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
            if (bookings.length === 0) {
                return c.json({ error: 'Booking not found' }, 404);
            }
            if (!['pending', 'confirmed'].includes(bookings[0].status)) {
                return c.json({ error: `Booking cannot be cancelled. Current status: ${bookings[0].status}` }, 400);
            }
            const updated = await (0, rds_connection_1.update)('bookings', { id: bookingId }, {
                status: 'cancelled',
                cancellation_reason: reason || null,
                cancelled_at: new Date().toISOString(),
            });
            return c.json({
                success: true,
                booking: updated[0],
                message: 'Booking cancelled successfully',
            });
        }
        catch (error) {
            console.error('Error cancelling booking:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /vendor/bookings/:bookingId/complete
     * Mark booking as completed
     */
    app.post("/vendor/bookings/:bookingId/complete", async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { notes } = await c.req.json();
            const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
            if (bookings.length === 0) {
                return c.json({ error: 'Booking not found' }, 404);
            }
            if (!['confirmed', 'in_progress'].includes(bookings[0].status)) {
                return c.json({ error: `Booking cannot be completed. Current status: ${bookings[0].status}` }, 400);
            }
            const updated = await (0, rds_connection_1.update)('bookings', { id: bookingId }, {
                status: 'completed',
                completed_at: new Date().toISOString(),
                notes: notes || bookings[0].notes,
            });
            return c.json({
                success: true,
                booking: updated[0],
                message: 'Booking completed successfully',
            });
        }
        catch (error) {
            console.error('Error completing booking:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=vendor-bookings.js.map