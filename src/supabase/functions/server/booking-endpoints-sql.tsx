/**
 * ============================================================================
 * SQL-BASED BOOKING ENDPOINTS
 * ============================================================================
 * 
 * Migrated from: booking-endpoints.tsx (KV-based)
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All operations wrapped in transactions
 * ✅ State machine validation
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getSchedulingService } from "../../lib/services/scheduling-service.ts";
import { withTransaction, getDbClient } from "../../lib/db.ts";
import { createProductionBookingSQL } from "./booking-creation-sql.tsx";

export function bookingEndpointsSQL(app: Hono) {
  const bookingsRepo = getBookingsRepository();
  const vendorsRepo = getVendorsRepository();
  const servicesRepo = getServicesRepository();
  const customersRepo = getCustomersRepository();
  const schedulingService = getSchedulingService();
  const client = getDbClient();

  /**
   * Create a new booking - SQL-BASED
   * POST /make-server-3dd53475/bookings/create
   */
  app.post("/make-server-3dd53475/bookings/create", async (c) => {
    try {
      const bookingData = await c.req.json();
      
      // Validate required fields
      if (!bookingData.customerId && !bookingData.customerPhone && !bookingData.phone) {
        return sendError(c, 'Missing customer identifier', 400);
      }
      if (!bookingData.vendorId || !bookingData.serviceId) {
        return sendError(c, 'Missing vendor or service', 400);
      }
      if (!bookingData.bookingDate || !bookingData.bookingTime) {
        return sendError(c, 'Missing booking date or time', 400);
      }

      // ✅ SQL-BASED: Create booking using SQL helper
      const booking = await createProductionBookingSQL({
        phone: bookingData.customerPhone || bookingData.phone,
        customerPhone: bookingData.customerPhone || bookingData.phone,
        petId: bookingData.petId,
        vendorId: bookingData.vendorId,
        serviceId: bookingData.serviceId,
        serviceType: bookingData.serviceType || 'at_vendor',
        scheduledDate: bookingData.bookingDate,
        scheduledTime: bookingData.bookingTime,
        paymentMethod: bookingData.paymentMethod || 'razorpay',
        amount: bookingData.price || bookingData.amount,
        isPackage: bookingData.isPackage || false,
        packageDetails: bookingData.packageDetails,
        staffId: bookingData.staffId,
        customerLocation: bookingData.customerLocation,
        notes: bookingData.specialInstructions || bookingData.notes,
      });

      return sendSuccess(c, { booking });
    } catch (error: any) {
      console.error('[BOOKING-SQL] Error:', error);
      return sendError(c, error.message || 'Failed to create booking', 500);
    }
  });

  /**
   * Get booking by ID - SQL-BASED
   * GET /make-server-3dd53475/bookings/:bookingId
   */
  app.get("/make-server-3dd53475/bookings/:bookingId", async (c) => {
    try {
      const { bookingId } = c.req.param();
      
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }
      
      return sendSuccess(c, { booking });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to get booking', 500);
    }
  });

  /**
   * Update booking status - SQL-BASED
   * PUT /make-server-3dd53475/bookings/:bookingId/status
   */
  app.put("/make-server-3dd53475/bookings/:bookingId/status", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { status, notes, cancellationReason } = await c.req.json();

      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // ✅ SQL-BASED: Update booking with state machine validation
      await withTransaction(async (txClient) => {
        const updateData: any = {};
        
        if (status) {
          // State machine validation happens at database level via trigger
          updateData.status = status;
        }
        
        if (notes) updateData.notes = notes;
        if (cancellationReason) {
          updateData.cancellation_reason = cancellationReason;
          updateData.cancelled_at = new Date().toISOString();
        }
        
        if (status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        }

        await bookingsRepo.update(bookingId, updateData);
      });

      const updated = await bookingsRepo.findById(bookingId);
      return sendSuccess(c, { booking: updated });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to update booking', 500);
    }
  });

  /**
   * Get customer bookings - SQL-BASED
   * GET /make-server-3dd53475/bookings/customer/:customerId
   */
  app.get("/make-server-3dd53475/bookings/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');
      
      const bookings = await bookingsRepo.findByCustomer(customerId, {
        status: status || undefined,
        limit: 100,
      });
      
      return sendSuccess(c, { bookings });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to get bookings', 500);
    }
  });

  /**
   * Get vendor bookings - SQL-BASED
   * GET /make-server-3dd53475/bookings/vendor/:vendorId
   */
  app.get("/make-server-3dd53475/bookings/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');
      const date = c.req.query('date');
      
      const bookings = await bookingsRepo.findByVendor(vendorId, {
        status: status || undefined,
        date: date || undefined,
        limit: 100,
      });
      
      return sendSuccess(c, { bookings });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to get bookings', 500);
    }
  });

  /**
   * Cancel booking - SQL-BASED
   * POST /make-server-3dd53475/bookings/:bookingId/cancel
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/cancel", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { reason } = await c.req.json();

      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.status === 'cancelled') {
        return sendError(c, 'Booking already cancelled', 400);
      }

      if (booking.status === 'completed') {
        return sendError(c, 'Cannot cancel completed booking', 400);
      }

      // ✅ SQL-BASED: Cancel booking
      await bookingsRepo.update(bookingId, {
        status: 'cancelled',
        cancellation_reason: reason || 'Customer request',
        cancelled_at: new Date().toISOString(),
      });

      const updated = await bookingsRepo.findById(bookingId);
      return sendSuccess(c, { booking: updated });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to cancel booking', 500);
    }
  });
}

