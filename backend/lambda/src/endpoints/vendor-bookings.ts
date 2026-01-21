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
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { checkVendorCapability } from '../middleware/capability-enforcement';

export function registerVendorBookingsEndpoints(app: Hono) {
  /**
   * GET /vendor/bookings/:vendorId
   * Get all bookings for a vendor with filters
   * Requires: booking_view or booking_create capability
   */
  app.get("/vendor/bookings/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check capability - allow if vendor has booking_view or booking_create
      const hasBookingCapability = await checkVendorCapability(vendorId, 'booking_view') || 
                                   await checkVendorCapability(vendorId, 'booking_create');
      if (!hasBookingCapability) {
        return c.json({ error: 'Vendor does not have booking viewing capability' }, 403);
      }
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
   * Requires: booking_create capability
   */
  app.put("/vendor/bookings/:bookingId/status", async (c) => {
    try {
      const { bookingId } = c.req.param();
      
      // Get booking first to get vendorId
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      const booking = bookings[0];
      const vendorId = c.req.header('x-vendor-id') || booking.vendor_id;
      
      // Check capability
      const hasBookingCapability = await checkVendorCapability(vendorId, 'booking_create');
      if (!hasBookingCapability) {
        return c.json({ error: 'Vendor does not have booking management capability' }, 403);
      }
      const { status, notes } = await c.req.json();

      if (!status) {
        return c.json({ error: 'status is required' }, 400);
      }

      const oldStatus = booking.status;

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
   * POST /vendor/bookings/:bookingId/decline
   * Decline a booking (alias for cancel with reason)
   */
  app.post("/vendor/bookings/:bookingId/decline", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, reason, suggestAlternative } = await c.req.json();

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      const oldStatus = booking.status;
      if (!['pending', 'confirmed'].includes(oldStatus)) {
        return c.json({ error: `Booking cannot be declined. Current status: ${oldStatus}` }, 400);
      }

      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'cancelled',
          cancellation_reason: reason || 'Vendor declined booking',
          cancelled_at: new Date().toISOString(),
          metadata: {
            ...(booking.metadata || {}),
            suggestAlternative: suggestAlternative || null,
            declinedBy: 'vendor',
          },
        }
      );

      // Log status change
      await logBookingStatusChange(
        bookingId,
        oldStatus,
        'cancelled',
        vendorId || booking.vendor_id,
        'vendor',
        reason || 'Vendor declined booking'
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
          reason: reason || 'Vendor declined booking',
          eventTimestamp: new Date().toISOString(),
          eventId: crypto.randomUUID(),
        });
      } catch (error) {
        console.error('Failed to publish booking status updated event:', error);
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking declined successfully',
      });
    } catch (error: any) {
      console.error('Error declining booking:', error);
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

  /**
   * GET /vendor/bookings/:bookingId/details
   * Get detailed booking information for appointment modal
   */
  app.get("/vendor/bookings/:bookingId/details", async (c) => {
    try {
      const { bookingId } = c.req.param();

      console.log(`📋 [VENDOR-BOOKINGS] Fetching booking details for: ${bookingId}`);

      // Validate UUID format
      if (!isValidUUID(bookingId)) {
        return c.json({ error: 'Invalid booking ID format' }, 400);
      }

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // ✅ FIX: Extract pet_id from notes if not in pet_id column
      // Legacy bookings stored pet_id in notes as "Pet ID: <uuid>"
      let petIdToUse = booking.pet_id;
      if (!petIdToUse && booking.notes) {
        const petIdMatch = booking.notes.match(/Pet ID:\s*([0-9a-f-]{36})/i);
        if (petIdMatch) {
          petIdToUse = petIdMatch[1];
          console.log(`📋 [BOOKING-DETAILS] Extracted pet_id from notes: ${petIdToUse}`);
        }
      }
      if (!petIdToUse && booking.special_instructions) {
        const petIdMatch = booking.special_instructions.match(/Pet ID:\s*([0-9a-f-]{36})/i);
        if (petIdMatch) {
          petIdToUse = petIdMatch[1];
          console.log(`📋 [BOOKING-DETAILS] Extracted pet_id from special_instructions: ${petIdToUse}`);
        }
      }

      // Fetch related data in parallel
      const [customer, service, pet, vendor, prescriptions, activities] = await Promise.all([
        // Customer info
        booking.customer_id
          ? select('customers', { id: booking.customer_id }).catch(() => [])
          : Promise.resolve([]),
        // Service info
        booking.service_id
          ? select('services', { id: booking.service_id }).catch(() => [])
          : Promise.resolve([]),
        // Pet info - use extracted petIdToUse
        petIdToUse
          ? select('pets', { id: petIdToUse }).catch(() => [])
          : Promise.resolve([]),
        // Vendor info
        booking.vendor_id
          ? select('vendors', { id: booking.vendor_id }).catch(() => [])
          : Promise.resolve([]),
        // Prescriptions
        query(
          `SELECT * FROM prescriptions 
           WHERE booking_id = $1 AND is_active = true
           ORDER BY created_at DESC`,
          [bookingId]
        ).catch(() => ({ rows: [] })),
        // Activities/history
        query(
          `SELECT * FROM booking_activities 
           WHERE booking_id = $1
           ORDER BY created_at DESC`,
          [bookingId]
        ).catch(() => ({ rows: [] })),
      ]);

      // Build enriched booking response
      const enrichedBooking = {
        id: booking.id,
        bookingId: booking.id,
        status: booking.status,
        bookingDate: booking.booking_date,
        bookingTime: booking.booking_time,
        duration: booking.duration || 30,
        totalAmount: parseFloat(booking.total_amount || '0'),
        serviceStyle: booking.service_style || 'at_clinic',
        notes: booking.notes,
        specialInstructions: booking.special_instructions,
        paymentStatus: booking.payment_status || 'pending',
        
        // Customer details
        customerId: booking.customer_id,
        customerName: customer.length > 0 ? customer[0].full_name : 'Unknown Customer',
        customerPhone: customer.length > 0 ? customer[0].phone : null,
        customerEmail: customer.length > 0 ? customer[0].email : null,
        customerAddress: customer.length > 0 ? customer[0].address : null,
        
        // Pet details - use extracted petIdToUse
        petId: petIdToUse || booking.pet_id,
        petName: pet.length > 0 ? pet[0].name : booking.pet_name || 'Unknown Pet',
        petType: pet.length > 0 ? pet[0].species : booking.pet_type || '',
        petBreed: pet.length > 0 ? pet[0].breed : booking.pet_breed || '',
        petAge: pet.length > 0 ? (pet[0].age_years || pet[0].age) : booking.pet_age || '',
        petWeight: pet.length > 0 ? (pet[0].weight_kg || pet[0].weight) : null,
        petPhoto: pet.length > 0 ? pet[0].profile_photo_url : null,
        
        // Service details
        serviceId: booking.service_id,
        serviceName: service.length > 0 ? service[0].name : booking.service_name || 'Unknown Service',
        serviceCategory: service.length > 0 ? service[0].category : null,
        serviceDescription: service.length > 0 ? service[0].description : null,
        
        // Vendor details
        vendorId: booking.vendor_id,
        vendorName: vendor.length > 0 ? vendor[0].business_name || vendor[0].full_name : null,
        vendorPhone: vendor.length > 0 ? vendor[0].phone : null,
        vendorAddress: vendor.length > 0 
          ? [vendor[0].address, vendor[0].city, vendor[0].state, vendor[0].pincode].filter(Boolean).join(', ')
          : null,
        
        // OTP and session tracking
        otpCode: booking.otp_code,
        otpVerifiedAt: booking.otp_verified_at,
        sessionStartedAt: booking.session_started_at,
        sessionEndedAt: booking.session_ended_at,
        completedAt: booking.completed_at,
        cancelledAt: booking.cancelled_at,
        
        // Timestamps
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
      };

      return c.json({
        success: true,
        booking: enrichedBooking,
        activities: activities.rows.map((a: any) => ({
          id: a.id,
          type: a.activity_type,
          description: a.description,
          performedBy: a.performed_by,
          createdAt: a.created_at,
        })),
        prescriptions: prescriptions.rows.map((p: any) => ({
          id: p.id,
          notes: p.notes,
          medications: p.medications,
          uploadedAt: p.created_at,
          file: p.file_url,
        })),
      });
    } catch (error: any) {
      console.error('❌ [VENDOR-BOOKINGS] Error fetching booking details:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ✅ FIX: Add alias route for frontend compatibility
  // Frontend calls /vendor/:vendorId/bookings but backend has /vendor/bookings/:vendorId
  app.get("/vendor/:vendorId/bookings", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check capability - allow if vendor has booking_view or booking_create
      const hasBookingCapability = await checkVendorCapability(vendorId, 'booking_view') || 
                                   await checkVendorCapability(vendorId, 'booking_create');
      if (!hasBookingCapability) {
        return c.json({ error: 'Vendor does not have booking viewing capability' }, 403);
      }
      const date = c.req.query('date');
      const status = c.req.query('status') || 'all';
      const startDate = c.req.query('startDate');

      console.log(`📋 [VENDOR-BOOKINGS] Fetching bookings for vendor: ${vendorId} (alias route)`);
      console.log(`   Filters: date=${date}, status=${status}, startDate=${startDate}`);

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

      // Filter by start date (for upcoming)
      if (startDate) {
        queryText += ` AND booking_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      // Filter by status
      if (status && status !== 'all') {
        queryText += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      queryText += ' ORDER BY booking_date DESC, booking_time DESC';

      const result = await query(queryText, params).catch(() => ({ rows: [] }));

      // Enrich bookings with customer and service data
      const enrichedBookings = await Promise.all(
        result.rows.map(async (booking: any) => {
          const [customer, service] = await Promise.all([
            booking.customer_id
              ? select('customers', { id: booking.customer_id }).catch(() => [])
              : Promise.resolve([]),
            booking.service_id
              ? select('services', { id: booking.service_id }).catch(() => [])
              : Promise.resolve([]),
          ]);

          return {
            ...booking,
            customer: customer.length > 0 ? {
              id: customer[0].id,
              name: customer[0].full_name || customer[0].name,
              phone: customer[0].phone,
            } : null,
            service: service.length > 0 ? {
              id: service[0].id,
              name: service[0].name,
              category: service[0].category,
            } : null,
            chatEnabled: true,
            hasUnreadMessages: false,
            unreadMessageCount: 0,
            hasPrescription: false,
            prescriptionCount: 0,
            hasMedicalRecords: false,
            medicalRecordCount: 0,
            isFollowUp: false,
          };
        })
      );

      return c.json({ 
        success: true, 
        bookings: enrichedBookings,
        total: enrichedBookings.length,
        filters: { status }
      });
    } catch (error: any) {
      console.error('❌ [VENDOR-BOOKINGS] Error fetching bookings:', error);
      return c.json({ error: error.message || 'Failed to fetch bookings' }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/bookings/today
   * Get today's bookings for a vendor
   */
  app.get("/vendor/:vendorId/bookings/today", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const today = new Date().toISOString().split('T')[0];

      console.log(`📋 [VENDOR-BOOKINGS] Fetching today's bookings for vendor: ${vendorId}`);

      // Get today's bookings
      const result = await query(
        `SELECT * FROM bookings 
         WHERE vendor_id = $1 AND booking_date = $2 
         ORDER BY booking_time ASC`,
        [vendorId, today]
      ).catch(() => ({ rows: [] }));

      // Enrich bookings with customer and service data
      const enrichedBookings = await Promise.all(
        result.rows.map(async (booking: any) => {
          const [customer, service] = await Promise.all([
            booking.customer_id
              ? select('customers', { id: booking.customer_id }).catch(() => [])
              : Promise.resolve([]),
            booking.service_id
              ? select('services', { id: booking.service_id }).catch(() => [])
              : Promise.resolve([]),
          ]);

          return {
            id: booking.id,
            customer_name: customer.length > 0 ? customer[0].full_name : 'Unknown',
            service_name: service.length > 0 ? service[0].name : 'Unknown Service',
            booking_date: booking.booking_date,
            booking_time: booking.booking_time,
            status: booking.status,
            total_amount: parseFloat(booking.total_amount || '0'),
            service_style: booking.service_style || 'at_clinic',
          };
        })
      );

      return c.json({
        success: true,
        bookings: enrichedBookings,
      });
    } catch (error: any) {
      console.error('Error fetching today\'s bookings:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

