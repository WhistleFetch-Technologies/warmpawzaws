/**
 * ============================================================================
 * BOOKING ENDPOINTS - SQL ONLY
 * ============================================================================
 * 
 * REFACTORED: All KV usage removed, uses SQL repositories only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";
import { validateBookingTransition } from "../../lib/services/state-machine-validator.ts";
import { createBookingWithPayment } from "../../lib/utils/transaction-helper.ts";
import { calculateGST } from "../../lib/services/gst-calculator.ts";
import { selectQuery } from "../../lib/db.ts";

const BASE_PATH = "/make-server-3dd53475";

export function bookingEndpointsSQL(app: Hono) {
  
  /**
   * POST /bookings
   * Create a new booking (SQL only)
   */
  app.post(`${BASE_PATH}/bookings`, async (c) => {
    try {
      const bookingData = await c.req.json();
      
      // Validate required fields
      if (!bookingData.customer_id || !bookingData.vendor_id || !bookingData.service_id) {
        return sendError(c, 'Missing required fields: customer_id, vendor_id, service_id', 400);
      }
      
      // Get entities
      const customersRepo = getCustomersRepository();
      const vendorsRepo = getVendorsRepository();
      const servicesRepo = getServicesRepository();
      
      const customer = await customersRepo.findById(bookingData.customer_id);
      const vendor = await vendorsRepo.findById(bookingData.vendor_id);
      const service = await servicesRepo.findById(bookingData.service_id);
      
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      if (!service) {
        return sendError(c, 'Service not found', 404);
      }
      
      // Calculate pricing with GST
      const basePrice = bookingData.base_price || service.price || 0;
      const discountAmount = bookingData.discount_amount || 0;
      const subtotal = basePrice - discountAmount;
      
      const gst = await calculateGST({
        amount: subtotal,
        roleId: vendor.role_id,
        serviceStyle: bookingData.service_type || 'at_center',
        customerState: customer.state,
        vendorState: vendor.state
      });
      
      const totalAmount = subtotal + gst.gstAmount;
      
      // Create booking with payment atomically
      const { booking, payment } = await createBookingWithPayment({
        customer_id: bookingData.customer_id,
        vendor_id: bookingData.vendor_id,
        staff_id: bookingData.staff_id || null,
        service_id: bookingData.service_id,
        booking_date: bookingData.booking_date,
        booking_time: bookingData.booking_time,
        service_type: bookingData.service_type || 'at_center',
        address: bookingData.address || null,
        city: bookingData.city || null,
        state: bookingData.state || null,
        pincode: bookingData.pincode || null,
        latitude: bookingData.latitude || null,
        longitude: bookingData.longitude || null,
        base_price: basePrice,
        discount_amount: discountAmount,
        tax_amount: gst.gstAmount,
        total_amount: totalAmount,
        status: 'pending',
        payment_status: 'pending',
        notes: bookingData.notes || null
      }, {
        customer_id: bookingData.customer_id,
        amount: totalAmount,
        payment_method: bookingData.payment_method || 'online',
        payment_gateway: bookingData.payment_gateway || 'razorpay',
        gateway_transaction_id: bookingData.gateway_transaction_id || null
      });
      
      // Log audit
      await selectQuery(
        "SELECT create_audit_log($1, $2, $3, $4, $5, $6)",
        [
          'booking_created',
          'booking',
          booking.id,
          bookingData.customer_id,
          'customer',
          JSON.stringify({ vendor_id: bookingData.vendor_id, service_id: bookingData.service_id })
        ]
      );
      
      return sendSuccess(c, { booking, payment }, 'Booking created successfully');
    } catch (error) {
      console.error('❌ [BOOKING] Error creating booking:', error);
      return sendError(c, error, 500);
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
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }
      
      // Validate state transition
      const validation = await validateBookingTransition(
        booking.status,
        status,
        {
          hasOtp: !!otp && booking.otp_code === otp,
          hasPayment: hasPayment || booking.payment_status === 'paid'
        }
      );
      
      if (!validation.allowed) {
        return sendError(c, validation.reason || 'Invalid state transition', 400);
      }
      
      // Update booking status
      const updated = await bookingsRepo.update(bookingId, { status });
      
      // Log transaction
      await selectQuery(
        "INSERT INTO booking_transaction_log (booking_id, transaction_type, old_status, new_status) VALUES ($1, $2, $3, $4)",
        [bookingId, 'update', booking.status, status]
      );
      
      // Log audit
      await selectQuery(
        "SELECT create_audit_log($1, $2, $3, $4, $5, $6)",
        [
          'booking_status_updated',
          'booking',
          bookingId,
          c.get('vendor')?.id || c.get('customer')?.id || 'system',
          c.get('vendor') ? 'vendor' : (c.get('customer') ? 'customer' : 'system'),
          JSON.stringify({ from: booking.status, to: status })
        ]
      );
      
      return sendSuccess(c, { booking: updated }, 'Booking status updated');
    } catch (error) {
      console.error('❌ [BOOKING] Error updating status:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * GET /bookings/:bookingId
   * Get booking by ID
   */
  app.get(`${BASE_PATH}/bookings/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }
      
      return sendSuccess(c, { booking }, 'Booking retrieved');
    } catch (error) {
      console.error('❌ [BOOKING] Error getting booking:', error);
      return sendError(c, error, 500);
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
      
      const bookingsRepo = getBookingsRepository();
      
      let bookings;
      if (customerId) {
        bookings = await bookingsRepo.findByCustomer(customerId);
      } else if (vendorId) {
        bookings = await bookingsRepo.findByVendor(vendorId);
      } else {
        return sendError(c, 'Must provide customer_id or vendor_id', 400);
      }
      
      // Filter by status if provided
      if (status) {
        bookings = bookings.filter(b => b.status === status);
      }
      
      return sendSuccess(c, { bookings }, 'Bookings retrieved');
    } catch (error) {
      console.error('❌ [BOOKING] Error listing bookings:', error);
      return sendError(c, error, 500);
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
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }
      
      // Validate cancellation transition
      const validation = await validateBookingTransition(
        booking.status,
        'cancelled',
        {
          hasRefund: booking.payment_status === 'paid'
        }
      );
      
      if (!validation.allowed) {
        return sendError(c, validation.reason || 'Cannot cancel booking in current state', 400);
      }
      
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
      await selectQuery(
        "SELECT create_audit_log($1, $2, $3, $4, $5, $6)",
        [
          'booking_cancelled',
          'booking',
          bookingId,
          cancelledBy === 'customer' ? booking.customer_id : (c.get('vendor')?.id || 'system'),
          cancelledBy || 'system',
          JSON.stringify({ reason })
        ]
      );
      
      return sendSuccess(c, { booking: updated }, 'Booking cancelled');
    } catch (error) {
      console.error('❌ [BOOKING] Error cancelling booking:', error);
      return sendError(c, error, 500);
    }
  });
}

