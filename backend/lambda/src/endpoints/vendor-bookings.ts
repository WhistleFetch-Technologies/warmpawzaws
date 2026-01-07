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

import { Hono } from 'hono';
import { select, update, query } from '../database/rds-connection';
import { logBookingStatusChange } from '../utils/audit-log';

export function registerVendorBookingsEndpoints(app: Hono) {
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
      const params: any[] = [vendorId];
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

      const result = await query(queryText, params).catch(() => ({ rows: [] }));

      // Enrich bookings with customer, service, and related data (prescriptions, medical records, chat)
      const enrichedBookings = await Promise.all(
        result.rows.map(async (booking: any) => {
          const [customer, service, prescriptions, medicalRecords, chatMessages] = await Promise.all([
            booking.customer_id
              ? select('customers', { id: booking.customer_id }).catch(() => [])
              : Promise.resolve([]),
            booking.service_id
              ? select('services', { id: booking.service_id }).catch(() => [])
              : Promise.resolve([]),
            // Check for prescriptions
            query(
              `SELECT COUNT(*) as count FROM prescriptions 
               WHERE booking_id = $1 AND is_active = true`,
              [booking.id]
            ).catch(() => ({ rows: [{ count: '0' }] })),
            // Check for medical records
            query(
              `SELECT COUNT(*) as count FROM medical_records 
               WHERE booking_id = $1 AND is_active = true`,
              [booking.id]
            ).catch(() => ({ rows: [{ count: '0' }] })),
            // Check for unread chat messages
            query(
              `SELECT COUNT(*) as count FROM chat_messages 
               WHERE booking_id = $1 AND is_read = false`,
              [booking.id]
            ).catch(() => ({ rows: [{ count: '0' }] })),
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
        })
      );

      return c.json({
        success: true,
        bookings: enrichedBookings,
        total: enrichedBookings.length,
        filters: {
          date,
          status: filter,
        },
      });
    } catch (error: any) {
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
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Get current booking to track status change
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      const oldStatus = booking.status;
      const vendorId = c.req.header('x-vendor-id') || booking.vendor_id;

      // Update booking
      const updateData: any = { status };
      if (notes) {
        updateData.notes = notes;
      }

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }

      const updated = await update('bookings', { id: bookingId }, updateData);

      // Log status change if status actually changed
      if (oldStatus !== status) {
        await logBookingStatusChange(
          bookingId,
          oldStatus,
          status,
          vendorId,
          'vendor',
          notes || 'Status updated by vendor'
        );

        // Publish notification event
        try {
          const { publishBookingStatusUpdated } = await import('../utils/sns-client');
          await publishBookingStatusUpdated({
            bookingId,
            customerId: booking.customer_id,
            vendorId: booking.vendor_id || vendorId,
            oldStatus,
            newStatus: status,
            reason: notes || 'Status updated by vendor',
            eventTimestamp: new Date().toISOString(),
            eventId: crypto.randomUUID(),
          });
        } catch (error) {
          console.error('Failed to publish booking status updated event:', error);
        }
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking status updated successfully',
      });
    } catch (error: any) {
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
      const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      if (booking.status !== 'pending') {
        return c.json({ error: `Booking cannot be confirmed. Current status: ${booking.status}` }, 400);
      }

      const updated = await update('bookings', { id: bookingId }, { status: 'confirmed' });

      // Log status change
      await logBookingStatusChange(
        bookingId,
        'pending',
        'confirmed',
        vendorId || booking.vendor_id,
        'vendor',
        'Vendor confirmed booking'
      );

      // Publish notification event
      try {
        const { publishBookingStatusUpdated } = await import('../utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id || vendorId,
          oldStatus: 'pending',
          newStatus: 'confirmed',
          reason: 'Vendor confirmed booking',
          eventTimestamp: new Date().toISOString(),
          eventId: crypto.randomUUID(),
        });
      } catch (error) {
        console.error('Failed to publish booking status updated event:', error);
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking confirmed successfully',
      });
    } catch (error: any) {
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
      const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');
      const { reason } = await c.req.json();

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      const oldStatus = booking.status;
      if (!['pending', 'confirmed'].includes(oldStatus)) {
        return c.json({ error: `Booking cannot be cancelled. Current status: ${oldStatus}` }, 400);
      }

      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'cancelled',
          cancellation_reason: reason || null,
          cancelled_at: new Date().toISOString(),
        }
      );

      // Log status change
      await logBookingStatusChange(
        bookingId,
        oldStatus,
        'cancelled',
        vendorId || booking.vendor_id,
        'vendor',
        reason || 'Vendor cancelled booking'
      );

      // Publish notification event
      try {
        const { publishBookingStatusUpdated } = await import('../utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id || vendorId,
          oldStatus,
          newStatus: 'cancelled',
          reason: reason || 'Vendor cancelled booking',
          eventTimestamp: new Date().toISOString(),
          eventId: crypto.randomUUID(),
        });
      } catch (error) {
        console.error('Failed to publish booking status updated event:', error);
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking cancelled successfully',
      });
    } catch (error: any) {
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
      const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');
      const { notes } = await c.req.json();

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      const oldStatus = booking.status;
      if (!['confirmed', 'in_progress'].includes(oldStatus)) {
        return c.json({ error: `Booking cannot be completed. Current status: ${oldStatus}` }, 400);
      }

      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: notes || booking.notes,
        }
      );

      // Log status change
      await logBookingStatusChange(
        bookingId,
        oldStatus,
        'completed',
        vendorId || booking.vendor_id,
        'vendor',
        'Vendor marked booking as completed'
      );

      // Publish notification event
      try {
        const { publishBookingStatusUpdated } = await import('../utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id || vendorId,
          oldStatus,
          newStatus: 'completed',
          reason: 'Service completed',
          eventTimestamp: new Date().toISOString(),
          eventId: crypto.randomUUID(),
        });
      } catch (error) {
        console.error('Failed to publish booking status updated event:', error);
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking completed successfully',
      });
    } catch (error: any) {
      console.error('Error completing booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

